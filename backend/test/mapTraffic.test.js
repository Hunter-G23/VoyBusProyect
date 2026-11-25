const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase, migrate } = require("../src/database/db");
const { seed, demoPassword } = require("../src/database/seed");
const { fixtures } = require("./fixtures");
const { createApp } = require("../src/app");
const { routeGeometry } = require("../src/services/mapGeometry");
const gtfs = require("../src/database/data/antofagasta.json");

async function withMap(load, check) {
  const db = openDatabase(":memory:");
  const config = {
    jwtSecret: "map-traffic-test-secret-with-thirty-two-characters",
    origins: [],
    simularGps: false,
  };
  let time = Date.parse("2026-11-24T12:00:00.000Z");
  let server;
  try {
    migrate(db);
    load(db);
    server = createApp(db, config, () => new Date(time)).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(path, options, status = 200) {
      const response = await fetch(base + path, options);
      assert.equal(response.status, status, path);
      return response.json();
    }
    function write(path, body, token, method = "POST", status = 200) {
      return request(
        path,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        },
        status,
      );
    }
    function position(id, { latitud, longitud }, age = 0) {
      db.prepare(
        "INSERT INTO posicion_vehiculo(servicio_id,latitud,longitud,medida_en) VALUES(?,?,?,?)",
      ).run(id, latitud, longitud, new Date(time - age).toISOString());
    }
    await check({
      db,
      config,
      request,
      write,
      position,
      advance: (delta) => {
        time += delta;
      },
      setTime: (value) => {
        time = value;
      },
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    db.close();
  }
}

const mapped = (request) => request("/red/mapa");
const vehicles = async (request) => (await request("/red/vehiculos")).vehiculos;
const arrivals = (request, id) => request(`/red/paraderos/${id}/llegadas`);

test("mapa GTFS expone coordenadas GeoJSON e IDs reales y simula 4 buses por línea", () =>
  withMap(seed, async ({ db, config, request, advance, setTime }) => {
    const map = await mapped(request);
    assert.equal(map.version, gtfs.version);
    assert.equal(map.fuente, gtfs.fuente);
    assert.equal(map.lineas.length, 13);
    assert.equal(map.recorridos.length, 46);
    assert.equal(map.paraderos.length, 746);
    const route = map.recorridos.find(
      (r) => r.linea === "102" && r.sentido === "Ida",
    );
    const [lat, lon] = gtfs.recorridos[0].shape[0];
    assert.deepEqual(route.geometria.coordinates[0], [lon, lat]);
    assert.equal(
      route.color,
      map.lineas.find((line) => line.codigo === "102").color,
    );
    const actualStops = db
      .prepare(
        "SELECT paradero_id,posicion FROM recorrido_paradero WHERE recorrido_id=? ORDER BY posicion",
      )
      .all(route.id);
    assert.deepEqual(
      route.paraderos.map(({ paradero_id, posicion }) => [
        paradero_id,
        posicion,
      ]),
      actualStops.map(({ paradero_id, posicion }) => [paradero_id, posicion]),
    );
    const stop = map.paraderos.find(
      ({ id }) => id === route.paraderos[0].paradero_id,
    );
    assert.ok(stop.lineas.some(({ id }) => id === route.linea_id));
    for (const entry of map.recorridos) {
      for (let index = 1; index < entry.paraderos.length; index += 1) {
        assert.ok(
          entry.paraderos[index].distancia_m >=
            entry.paraderos[index - 1].distancia_m,
        );
      }
    }

    assert.deepEqual(
      (await vehicles(request)).map((v) => v.vehiculo),
      ["BUS001", "BUS002"],
    );
    config.simularGps = "true";
    assert.equal((await vehicles(request)).length, 2);
    config.simularGps = true;
    const fleet = await vehicles(request);
    const simulated = fleet.filter((v) => v.simulado);
    assert.equal(fleet.length, 54);
    assert.equal(new Set(simulated.map((v) => v.servicio_id)).size, 52);
    for (const line of map.lineas) {
      const lineFleet = simulated.filter((v) => v.linea === line.codigo);
      assert.deepEqual(lineFleet.map((v) => v.sentido).sort(), [
        "Ida",
        "Ida",
        "Vuelta",
        "Vuelta",
      ]);
      assert.ok(
        lineFleet.every(
          (v) => v.servicio_id < 0 && v.vehiculo.startsWith("SIM-"),
        ),
      );
      assert.ok(lineFleet.every((v) => v.posicion.desactualizada === false));
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM servicio").get().n, 2);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM posicion_vehiculo").get().n,
      0,
    );
    assert.equal((await request("/red/lineas")).lineas.length, 13);

    advance(5000);
    const moved = (await vehicles(request)).filter((v) => v.simulado);
    assert.deepEqual(
      moved.map((v) => v.servicio_id),
      simulated.map((v) => v.servicio_id),
    );
    assert.ok(
      moved.every(
        (v, i) =>
          v.posicion.latitud !== simulated[i].posicion.latitud ||
          v.posicion.longitud !== simulated[i].posicion.longitud,
      ),
    );

    const geometry = routeGeometry(route.geometria.coordinates);
    const busName = "SIM-102-1-1";
    const wrapAt = ((geometry.length * 0.85) / (24 / 3.6)) * 1000;
    setTime(Math.floor(wrapAt - 1000));
    const tail = (await vehicles(request)).find(
      (v) => v.vehiculo === busName,
    ).posicion;
    setTime(Math.ceil(wrapAt + 1000));
    const head = (await vehicles(request)).find(
      (v) => v.vehiculo === busName,
    ).posicion;
    const along = ({ longitud, latitud }) =>
      geometry.nearest(longitud, latitud).distance;
    assert.ok(along(tail) > geometry.length - 10);
    assert.ok(along(head) < 10);
  }));

test("llegadas filtran pasado, sentido, GPS viejo y nulo, y respetan las suspensiones", () =>
  withMap(seed, async ({ db, config, request, write, position, advance }) => {
    config.simularGps = true;
    const map = await mapped(request);
    const route = map.recorridos.find(
      (r) => r.linea === "102" && r.sentido === "Ida",
    );
    const inbound = map.recorridos.find(
      (r) => r.linea === "102" && r.sentido === "Vuelta",
    );
    const inboundOnly = inbound.paraderos.find(
      ({ paradero_id }) =>
        !route.paraderos.some((stop) => stop.paradero_id === paradero_id),
    );
    const geometry = routeGeometry(route.geometria.coordinates);
    position(1, geometry.point(geometry.length * 0.55), 3000);
    const late = route.paraderos.at(-1).paradero_id;
    const early = route.paraderos[0].paradero_id;
    const result = await arrivals(request, late);
    assert.deepEqual(
      result.paradero,
      map.paraderos.find(({ id }) => id === late),
    );
    assert.equal(result.fuente, "mixta");
    assert.equal(result.velocidad_supuesta_kmh, 24);
    const eta = result.llegadas.find((arrival) => arrival.servicio_id === 1);
    assert.equal(eta.origen, "estimacion");
    assert.equal(eta.recorrido_id, route.id);
    assert.equal(
      eta.segundos,
      Math.ceil(
        (route.paraderos.at(-1).distancia_m - geometry.length * 0.55) /
          (24 / 3.6),
      ),
    );
    assert.ok(
      result.llegadas.some((arrival) => arrival.origen === "simulacion"),
    );
    assert.ok(
      result.llegadas.every(
        (arrival, index) =>
          arrival.servicio_id !== 2 &&
          arrival.segundos > 0 &&
          (index === 0 ||
            arrival.segundos >= result.llegadas[index - 1].segundos),
      ),
    );
    assert.ok(
      !(await arrivals(request, early)).llegadas.some(
        (arrival) => arrival.servicio_id === 1,
      ),
    );
    assert.ok(
      !(await arrivals(request, inboundOnly.paradero_id)).llegadas.some(
        (arrival) => arrival.recorrido_id === route.id,
      ),
    );
    await request("/red/paraderos/9999/llegadas", undefined, 404);
    await request("/red/paraderos/-1/llegadas", undefined, 400);

    advance(31000);
    assert.ok(
      (await vehicles(request)).find((v) => v.servicio_id === 1).posicion
        .desactualizada,
    );
    assert.ok(
      !(await arrivals(request, late)).llegadas.some(
        (arrival) => arrival.servicio_id === 1,
      ),
    );
    position(1, geometry.point(geometry.length * 0.55));
    const login = (correo) =>
      write("/auth/login", { correo, contrasena: demoPassword });
    const passenger = await login("pasajero@example.test");
    const administrator = await login("admin@example.test");
    const favorite = await write(
      "/favoritos",
      { linea_id: route.linea_id },
      passenger.token,
      "POST",
      201,
    );
    assert.equal(favorite.favorito.linea.estado, "activa");
    const statePath = `/admin/lineas/${route.linea_id}/estado`;
    await write(
      statePath,
      { estado: "temporal" },
      administrator.token,
      "PATCH",
    );
    const suspendedFleet = await vehicles(request);
    assert.equal(suspendedFleet.filter((v) => v.simulado).length, 48);
    assert.ok(suspendedFleet.some((v) => v.servicio_id === 1));
    assert.ok(
      !(await arrivals(request, late)).llegadas.some(
        (arrival) => arrival.linea_id === route.linea_id,
      ),
    );
    const favorites = () =>
      request("/favoritos", {
        headers: { Authorization: `Bearer ${passenger.token}` },
      });
    assert.equal((await favorites()).favoritos[0].linea.estado, "temporal");
    db.exec("DELETE FROM posicion_vehiculo WHERE servicio_id=1");
    const restored = await write(
      statePath,
      { modo_estado: "auto" },
      administrator.token,
      "PATCH",
    );
    assert.equal(restored.linea.estado, "activa");
    assert.equal((await favorites()).favoritos[0].linea.estado, "activa");
    assert.equal(
      (await vehicles(request)).filter((v) => v.simulado).length,
      52,
    );
  }));

test("un paradero repetido usa su siguiente ocurrencia y no crea geometría pública", () =>
  withMap(
    (db) => {
      fixtures(db);
      db.exec(`UPDATE paradero SET longitud=-70.42 WHERE id=3;
      INSERT INTO recorrido_paradero(recorrido_id,paradero_id,posicion) VALUES(1,1,4)`);
    },
    async ({ config, request, position }) => {
      config.simularGps = true;
      const map = await mapped(request);
      const route = map.recorridos.find((r) => r.id === 1);
      assert.equal(route.geometria, null);
      assert.equal((await vehicles(request)).length, 2);
      const firstStop = route.paraderos[0];
      const nextVisit = route.paraderos.at(-1);
      assert.equal(firstStop.paradero_id, nextVisit.paradero_id);
      assert.ok(nextVisit.distancia_m > firstStop.distancia_m);
      position(
        1,
        map.paraderos.find((s) => s.id === route.paraderos[1].paradero_id),
      );
      const result = await arrivals(request, firstStop.paradero_id);
      assert.equal(result.fuente, "gps");
      assert.equal(result.llegadas.length, 1);
      assert.equal(result.llegadas[0].servicio_id, 1);
      assert.equal(
        result.llegadas[0].distancia_m,
        Math.round(nextVisit.distancia_m - route.paraderos[1].distancia_m),
      );
    },
  ));
