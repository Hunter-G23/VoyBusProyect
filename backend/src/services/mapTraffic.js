const data = require("../database/data/antofagasta.json");
const { fail, positiveId } = require("../utils/errors");
const { hasMapPosition } = require("./lineState");
const { routeGeometry } = require("./mapGeometry");

const SPEED_KMH = 24;
const SPEED_MPS = SPEED_KMH / 3.6;
const FRESHNESS_MS = 30000;
const routeKey = ({ linea, codigo, sentido }) =>
  `${linea}:${codigo}:${sentido}`;
const gtfsRoutes = new Map(
  data.recorridos.map((route) => [routeKey(route), route]),
);
const lineSlots = new Map(
  data.lineas.map(({ codigo }, index) => [codigo, index]),
);

function suspended(line) {
  return (
    line.modo_estado === "manual" && (line.estado !== "activa" || !line.activa)
  );
}

function lineAppearance(line) {
  return {
    ...(line.color ? { color: line.color } : {}),
    electrica: line.electrica,
  };
}

function readNetwork(db) {
  const routes = new Map();
  const stops = new Map(
    db
      .prepare(
        "SELECT id,codigo,nombre,latitud,longitud FROM paradero WHERE activo=1 ORDER BY id",
      )
      .all()
      .map((stop) => [stop.id, { stop, lineIds: new Set() }]),
  );
  const routeRows = db
    .prepare(
      `SELECT r.id,r.linea_id,l.codigo AS linea,COALESCE(r.codigo,l.codigo) AS codigo,r.nombre,
      r.sentido,r.origen,r.destino,r.variante,l.fuente
     FROM recorrido r JOIN linea l ON l.id=r.linea_id WHERE r.activo=1 ORDER BY r.id`,
    )
    .all();
  const routeStops = new Map();
  for (const { recorrido_id, ...stop } of db
    .prepare(
      "SELECT recorrido_id,paradero_id,posicion FROM recorrido_paradero ORDER BY recorrido_id,posicion",
    )
    .all()) {
    if (!stops.has(stop.paradero_id)) continue;
    if (!routeStops.has(recorrido_id)) routeStops.set(recorrido_id, []);
    routeStops.get(recorrido_id).push(stop);
  }
  for (const { fuente, ...route } of routeRows) {
    const source =
      fuente === data.fuente ? gtfsRoutes.get(routeKey(route)) : null;
    const coordinates = source?.shape?.map(([lat, lon]) => [lon, lat]);
    const geometria =
      coordinates?.length > 1 ? { type: "LineString", coordinates } : null;
    const relations = routeStops.get(route.id) ?? [];
    const orderedStops = relations.map(({ paradero_id }) => {
      const entry = stops.get(paradero_id);
      entry.lineIds.add(route.linea_id);
      return entry.stop;
    });
    const geometry = routeGeometry(
      geometria?.coordinates ??
        orderedStops.map(({ longitud, latitud }) => [longitud, latitud]),
    );
    const distances = geometry.stopDistances(orderedStops);
    const paraderos = relations.map((stop, index) => ({
      ...stop,
      distancia_m: distances[index],
    }));
    routes.set(route.id, {
      metadata: { ...route, geometria, paraderos },
      geometry,
      direction: geometria && !route.variante ? source.direction_id : null,
    });
  }
  return { routes, stops };
}

function mapTrafficService(db, repo, config) {
  let network;
  const getNetwork = () => (network ??= readNetwork(db));
  const arrivalLines = db.prepare(
    "SELECT id,codigo,color,electrica,estado,modo_estado,activa FROM linea",
  );

  function vehicles(date, lines) {
    const active = repo.activeVehicles();
    if (config.simularGps !== true) return active;
    const { routes } = getNetwork();
    const enabled = new Set(
      (lines ?? arrivalLines.all())
        .filter((line) => !suspended(line))
        .map(({ id }) => id),
    );
    const seconds = date.getTime() / 1000;
    const medida_en = date.toISOString();
    for (const { metadata: route, geometry, direction } of routes.values()) {
      if (
        direction === null ||
        !geometry.length ||
        !enabled.has(route.linea_id)
      )
        continue;
      const lineSlot = lineSlots.get(route.linea);
      for (let slot = 0; slot < 2; slot += 1) {
        const offset =
          seconds * SPEED_MPS + geometry.length * (0.15 + slot * 0.5);
        const distance =
          ((offset % geometry.length) + geometry.length) % geometry.length;
        active.push({
          servicio_id: -(lineSlot * 4 + direction * 2 + slot + 1),
          vehiculo: `SIM-${route.linea}-${direction + 1}-${slot + 1}`,
          linea: route.linea,
          recorrido_id: route.id,
          sentido: route.sentido,
          ...geometry.point(distance),
          medida_en,
          origen: "simulacion",
          simulado: true,
          distance,
        });
      }
    }
    return active;
  }

  function progress(vehicle, route, date) {
    if (vehicle.simulado) return vehicle.distance;
    const age = date - Date.parse(vehicle.medida_en);
    if (!(age >= 0 && age <= FRESHNESS_MS) || !hasMapPosition(vehicle))
      return null;
    return (
      route.geometry.nearest(vehicle.longitud, vehicle.latitud)?.distance ??
      null
    );
  }

  function stopWithLines({ stop, lineIds }, lineas) {
    return {
      ...stop,
      lineas: lineas
        .filter(({ id }) => lineIds.has(id))
        .map((line) => ({
          id: line.id,
          codigo: line.codigo,
          ...lineAppearance(line),
        })),
    };
  }

  return {
    vehicles,
    nextStop(vehicle, date) {
      if (!hasMapPosition(vehicle)) return undefined;
      const route = getNetwork().routes.get(vehicle.recorrido_id);
      if (!route?.metadata.geometria) return undefined;
      const distance = progress(vehicle, route, date);
      if (distance === null) return undefined;
      return (
        route.metadata.paraderos.find((stop) => stop.distancia_m > distance)
          ?.paradero_id ?? null
      );
    },
    map(lineas) {
      const { routes, stops } = getNetwork();
      const colors = new Map(lineas.map(({ id, color }) => [id, color]));
      return {
        version: data.version,
        fuente: data.fuente,
        lineas,
        recorridos: Array.from(routes.values(), ({ metadata }) => {
          const color = colors.get(metadata.linea_id);
          return color ? { ...metadata, color } : metadata;
        }),
        paraderos: Array.from(stops.values(), (stop) =>
          stopWithLines(stop, lineas),
        ),
      };
    },
    arrivals(value, date) {
      const { routes, stops } = getNetwork();
      const id = positiveId(value);
      const stop = stops.get(id);
      if (!stop)
        fail(
          404,
          "PARADERO_NO_DISPONIBLE",
          "Este paradero no está disponible.",
        );
      const lineas = arrivalLines.all();
      const lines = new Map(lineas.map((line) => [line.id, line]));
      const llegadas = [];
      for (const vehicle of vehicles(date, lineas)) {
        const route = routes.get(vehicle.recorrido_id);
        if (!route || !stop.lineIds.has(route.metadata.linea_id)) continue;
        const line = lines.get(route.metadata.linea_id);
        if (suspended(line)) continue;
        const distance = progress(vehicle, route, date);
        if (distance === null) continue;
        const pending = route.metadata.paraderos.find(
          (visit) => visit.paradero_id === id && visit.distancia_m > distance,
        );
        if (!pending) continue;
        const remaining = pending.distancia_m - distance;
        const segundos = Math.ceil(remaining / SPEED_MPS);
        llegadas.push({
          servicio_id: vehicle.servicio_id,
          vehiculo: vehicle.vehiculo,
          linea: vehicle.linea,
          linea_id: line.id,
          recorrido_id: vehicle.recorrido_id,
          sentido: vehicle.sentido,
          destino: route.metadata.destino,
          minutos: Math.ceil(segundos / 60),
          segundos,
          distancia_m: Math.round(remaining),
          origen: vehicle.origen === "simulacion" ? "simulacion" : "estimacion",
          ...lineAppearance(line),
        });
      }
      llegadas.sort(
        (a, b) => a.segundos - b.segundos || a.distancia_m - b.distancia_m,
      );
      const estimated = llegadas.some(({ origen }) => origen === "estimacion");
      const simulated = llegadas.some(({ origen }) => origen === "simulacion");
      return {
        paradero: stopWithLines(stop, lineas),
        generado_en: date.toISOString(),
        fuente: estimated
          ? simulated
            ? "mixta"
            : "gps"
          : simulated || config.simularGps === true
            ? "simulacion"
            : "gps",
        ...(estimated ? { velocidad_supuesta_kmh: SPEED_KMH } : {}),
        llegadas,
      };
    },
  };
}

module.exports = { mapTrafficService, FRESHNESS_MS };
