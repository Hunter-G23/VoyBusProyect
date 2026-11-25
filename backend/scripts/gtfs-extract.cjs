const fs = require("node:fs");
const path = require("node:path");

const colors = {
  102: "#005BAA",
  103: "#005BAA",
  104: "#007DBD",
  107: "#A92023",
  108: "#066A40",
  110: "#5A8400",
  111: "#C9500E",
  112: "#A92023",
  114: "#CC9B00",
  119: "#CC9B00",
  121: "#AD0101",
  129: "#4E0963",
  E01: "#598200",
};

// Every original shape point stays within this distance of the stored line.
const SHAPE_TOLERANCE_M = 5;

// Douglas-Peucker on a local metric projection. Sampling every Nth point
// instead cut across blocks by up to 471 m on the Antofagasta feed.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [lat0, lon0] = [points[0].lat, points[0].lon];
  const m = (Math.PI * 6371000) / 180;
  const xy = points.map((p) => [
    (p.lon - lon0) * m * Math.cos((lat0 * Math.PI) / 180),
    (p.lat - lat0) * m,
  ]);
  const distance = ([x, y], [ax, ay], [bx, by]) => {
    const dx = bx - ax,
      dy = by - ay,
      size = dx * dx + dy * dy;
    const t = size
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / size))
      : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = 0,
      index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = distance(xy[i], xy[first], xy[last]);
      if (d > max) [max, index] = [d, i];
    }
    if (max > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function text(value) {
  // Read bytes as latin1. Some supplied exports already contain UTF-8: repair only
  // a lossless UTF-8 round trip, leaving genuine latin1 (including 0xe1) intact.
  const bytes = Buffer.from(value, "latin1");
  const utf8 = bytes.toString("utf8");
  return (Buffer.from(utf8, "utf8").equals(bytes) ? utf8 : value).trim();
}

async function* csv(filename, required) {
  let field = "",
    row = [],
    quoted = false,
    closed = false,
    skipLF = false,
    headers;
  function record() {
    row.push(field);
    field = "";
    const values = row;
    row = [];
    if (values.length === 1 && values[0] === "") return null;
    if (!headers) {
      headers = values.map(text);
      if (
        new Set(headers).size !== headers.length ||
        required.some((k) => !headers.includes(k))
      )
        throw new Error(
          `CSV: columnas inválidas en ${path.basename(filename)}`,
        );
      return null;
    }
    if (values.length !== headers.length)
      throw new Error(`CSV: fila incompleta en ${path.basename(filename)}`);
    return Object.fromEntries(headers.map((key, i) => [key, text(values[i])]));
  }
  for await (const chunk of fs.createReadStream(filename, {
    encoding: "latin1",
  })) {
    for (const char of chunk) {
      if (skipLF) {
        skipLF = false;
        if (char === "\n") continue;
      }
      if (quoted) {
        if (char === '"') {
          quoted = false;
          closed = true;
        } else field += char;
      } else if (closed && char === '"') {
        field += '"';
        quoted = true;
        closed = false;
      } else if (char === ",") {
        row.push(field);
        field = "";
        closed = false;
      } else if (char === "\n" || char === "\r") {
        const result = record();
        closed = false;
        skipLF = char === "\r";
        if (result) yield result;
      } else if (char === '"' && field === "" && !closed) quoted = true;
      else {
        if (closed || char === '"')
          throw new Error(
            `CSV: comillas inválidas en ${path.basename(filename)}`,
          );
        field += char;
      }
      if (field.length > 1048576 || row.length > 100)
        throw new Error("CSV: campo o fila demasiado extenso");
    }
  }
  if (quoted)
    throw new Error(`CSV: comillas sin cerrar en ${path.basename(filename)}`);
  if (field || row.length || closed) {
    const result = record();
    if (result) yield result;
  }
  if (!headers)
    throw new Error(`CSV: archivo vacío ${path.basename(filename)}`);
}
function coordinate(value, limit) {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || Math.abs(n) > limit)
    throw new Error(`Coordenada inválida: ${value}`);
  return n;
}
function sequence(value) {
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 0
  )
    throw new Error(`Secuencia inválida: ${value}`);
  return Number(value);
}
function unique(map, key, value) {
  if (!key || map.has(key))
    throw new Error(`Identificador GTFS vacío o duplicado: ${key}`);
  map.set(key, value);
}

async function extract(directory) {
  const read = (file, columns) =>
    csv(path.join(directory, file + ".txt"), columns);
  let feed;
  for await (const row of read("feed_info", ["feed_version"])) {
    if (feed || !row.feed_version) throw new Error("Versión GTFS inválida");
    feed = row;
  }
  if (!feed) throw new Error("No hay información del GTFS");
  const fuente = "gtfs:" + feed.feed_version;
  const routes = new Map();
  for await (const r of read("routes", [
    "route_id",
    "route_short_name",
    "route_long_name",
  ])) {
    const match = /^(E01|\d+)(N2?|Y[12])?$/.exec(r.route_short_name);
    if (!match || !colors[match[1]])
      throw new Error(`Línea GTFS no admitida: ${r.route_short_name}`);
    unique(routes, r.route_id, {
      ...r,
      base: match[1],
      variante: Number(Boolean(match[2])),
    });
  }
  const lineas = [...routes.values()]
    .filter((r) => !r.variante)
    .map((r) => ({
      codigo: r.base,
      nombre: r.route_long_name,
      color: colors[r.base],
      color_texto: ["114", "119"].includes(r.base) ? "#132F35" : "#FFFFFF",
      electrica: Number(r.base === "E01"),
      estado: "activa",
      fuente,
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "en"));
  if (
    new Set(lineas.map((l) => l.codigo)).size !== lineas.length ||
    [...routes.values()].some((r) => !lineas.some((l) => l.codigo === r.base))
  )
    throw new Error("Línea base ausente o duplicada");
  const trips = new Map();
  for await (const t of read("trips", [
    "route_id",
    "trip_id",
    "direction_id",
    "trip_headsign",
    "shape_id",
  ])) {
    if (!routes.has(t.route_id) || !["0", "1"].includes(t.direction_id))
      throw new Error("Ruta o sentido de viaje inválido");
    unique(trips, t.trip_id, { ...t, count: 0 });
  }
  for await (const s of read("stop_times", [
    "trip_id",
    "stop_id",
    "stop_sequence",
  ])) {
    const trip = trips.get(s.trip_id);
    if (!trip) throw new Error(`Viaje desconocido: ${s.trip_id}`);
    sequence(s.stop_sequence);
    trip.count++;
  }
  const chosen = new Map();
  for (const t of trips.values()) {
    const key = t.route_id + ":" + t.direction_id,
      previous = chosen.get(key);
    if (
      !previous ||
      t.count > previous.count ||
      (t.count === previous.count && t.trip_id < previous.trip_id)
    )
      chosen.set(key, t);
  }
  const stopsByTrip = new Map([...chosen.values()].map((t) => [t.trip_id, []]));
  for await (const s of read("stop_times", [
    "trip_id",
    "stop_id",
    "stop_sequence",
  ])) {
    if (stopsByTrip.has(s.trip_id))
      stopsByTrip
        .get(s.trip_id)
        .push({ id: s.stop_id, posicion: sequence(s.stop_sequence) });
  }
  const used = new Set();
  for (const stops of stopsByTrip.values()) {
    stops.sort((a, b) => a.posicion - b.posicion);
    if (
      !stops.length ||
      new Set(stops.map((s) => s.posicion)).size !== stops.length
    )
      throw new Error("Secuencia de paraderos vacía o duplicada");
    for (const s of stops) used.add(s.id);
  }
  const stops = new Map();
  for await (const s of read("stops", [
    "stop_id",
    "stop_name",
    "stop_lat",
    "stop_lon",
  ])) {
    const latitud = coordinate(s.stop_lat, 90),
      longitud = coordinate(s.stop_lon, 180);
    unique(stops, s.stop_id, {
      id: s.stop_id,
      codigo: s.stop_id,
      nombre: s.stop_name,
      latitud,
      longitud,
    });
  }
  for (const id of used)
    if (!stops.has(id)) throw new Error(`Paradero desconocido: ${id}`);
  const shapes = new Map(
    [...chosen.values()].filter((t) => t.shape_id).map((t) => [t.shape_id, []]),
  );
  for await (const s of read("shapes", [
    "shape_id",
    "shape_pt_lat",
    "shape_pt_lon",
    "shape_pt_sequence",
  ])) {
    const lat = coordinate(s.shape_pt_lat, 90),
      lon = coordinate(s.shape_pt_lon, 180);
    if (shapes.has(s.shape_id))
      shapes
        .get(s.shape_id)
        .push({ lat, lon, posicion: sequence(s.shape_pt_sequence) });
  }
  const recorridos = [...chosen.values()]
    .map((t) => {
      const r = routes.get(t.route_id),
        paraderos = stopsByTrip.get(t.trip_id).map((s) => s.id);
      const points = (shapes.get(t.shape_id) || []).sort(
        (a, b) => a.posicion - b.posicion,
      );
      const shape = simplify(points, SHAPE_TOLERANCE_M).map((p) => [
        p.lat,
        p.lon,
      ]);
      return {
        linea: r.base,
        codigo: r.route_short_name,
        variante: r.variante,
        nombre: r.route_long_name,
        direction_id: Number(t.direction_id),
        sentido: t.direction_id === "0" ? "Ida" : "Vuelta",
        origen: stops.get(paraderos[0]).nombre,
        destino: t.trip_headsign,
        color: colors[r.base],
        paraderos,
        shape,
      };
    })
    .sort(
      (a, b) =>
        a.linea.localeCompare(b.linea, "en") ||
        a.variante - b.variante ||
        a.codigo.localeCompare(b.codigo, "en") ||
        a.direction_id - b.direction_id,
    );
  return {
    version: feed.feed_version,
    fuente,
    fecha_inicio: feed.feed_start_date,
    fecha_fin: feed.feed_end_date,
    lineas,
    recorridos,
    paraderos: [...stops.values()]
      .filter((s) => used.has(s.id))
      .sort((a, b) => a.id.localeCompare(b.id, "en")),
  };
}
if (require.main === module) {
  const directory = process.argv[2];
  if (!directory) {
    console.error(
      "Uso: node backend/scripts/gtfs-extract.cjs <directorio-csv>",
    );
    process.exitCode = 1;
  } else
    extract(directory)
      .then((data) => {
        const filename = path.resolve(
          __dirname,
          "../src/database/data/antofagasta.json",
        );
        const json = JSON.stringify(data) + "\n";
        if (Buffer.byteLength(json) >= 2 * 1024 * 1024)
          throw new Error("El JSON GTFS supera 2 MB");
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, json, "utf8");
        console.log(
          `${data.lineas.length} líneas, ${data.recorridos.length} recorridos, ${data.paraderos.length} paraderos; ${Buffer.byteLength(json)} bytes.`,
        );
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
}
module.exports = { extract, simplify, SHAPE_TOLERANCE_M };
