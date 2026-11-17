const { test, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { openDatabase, migrate } = require("../src/database/db");
const { fixtures: seed } = require("./fixtures");
const { repository } = require("../src/models/repository");
const { createApp } = require("../src/app");

const temp = mkdtempSync(path.join(tmpdir(), "voybus-rf07-"));
let db,
  server,
  base,
  fecha,
  config,
  numero = 0;
const now = () => new Date(fecha);

async function iniciar() {
  server = createApp(db, config, now).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}

async function vehiculos() {
  const response = await fetch(base + "/red/vehiculos");
  assert.equal(response.status, 200);
  return response.json();
}

function muestra(servicio, medida, latitud = -23.64, longitud = -70.39) {
  db.prepare(
    "INSERT INTO posicion_vehiculo(servicio_id,latitud,longitud,medida_en) VALUES(?,?,?,?)",
  ).run(servicio, latitud, longitud, medida);
}

beforeEach(async () => {
  db = openDatabase(path.join(temp, `test-${++numero}.db`));
  migrate(db);
  seed(db);
  fecha = "2026-11-17T12:00:00.000Z";
  config = {
    jwtSecret: "test-only-secret-with-more-than-thirty-two-characters",
    origins: ["http://localhost:8081"],
    production: false,
    simularGps: false,
  };
  await iniciar();
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  db?.close();
});

after(() => rmSync(temp, { recursive: true, force: true }));

test("RF07 devuelve la última muestra fresca y el contrato público sin datos personales", async () => {
  muestra(1, "2026-11-17T11:59:55.000Z", -23.635, -70.385);
  muestra(1, "2026-11-17T11:59:00.000Z");
  const result = await vehiculos();
  assert.deepEqual(result, {
    fuente: "gps",
    generado_en: fecha,
    vehiculos: [
      {
        servicio_id: 1,
        vehiculo: "TEST01",
        linea: "T01",
        recorrido_id: 1,
        sentido: "Ida",
        posicion: {
          latitud: -23.635,
          longitud: -70.385,
          medida_en: "2026-11-17T11:59:55.000Z",
          desactualizada: false,
        },
      },
      {
        servicio_id: 2,
        vehiculo: "TEST02",
        linea: "T02",
        recorrido_id: 3,
        sentido: "Ida",
        posicion: null,
      },
    ],
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /nombre|correo|email|conductor|password|patente/i,
  );
});

test("RF07 marca desactualizada solo cuando la muestra supera 30 segundos", async () => {
  muestra(1, "2026-11-17T11:59:30.000Z");
  assert.equal((await vehiculos()).vehiculos[0].posicion.desactualizada, false);
  fecha = "2026-11-17T12:00:00.001Z";
  const result = await vehiculos();
  assert.equal(result.generado_en, fecha);
  assert.equal(result.vehiculos[0].posicion.desactualizada, true);
});

test("RF07 mantiene posición nula cuando el servicio no tiene muestras", async () => {
  assert.deepEqual(
    (await vehiculos()).vehiculos.map((v) => v.posicion),
    [null, null],
  );
});

test("RF07 excluye servicios finalizados, vehículos inactivos y vehículos sin servicio", async () => {
  muestra(1, fecha);
  muestra(2, fecha);
  db.exec(
    "UPDATE servicio SET estado='finalizado' WHERE id=1; UPDATE vehiculo SET activo=0 WHERE id=2",
  );
  assert.deepEqual((await vehiculos()).vehiculos, []);
});

test("RF07 ordena por código de vehículo, no por servicio", async () => {
  db.exec("UPDATE vehiculo SET codigo_vinculacion='TEST90' WHERE id=1");
  assert.deepEqual(
    (await vehiculos()).vehiculos.map((v) => v.vehiculo),
    ["TEST02", "TEST90"],
  );
});

test("RF07 identifica la simulación cuando está habilitada", async () => {
  await new Promise((resolve) => server.close(resolve));
  config.simularGps = true;
  await iniciar();
  const { simuladorService } = require("../src/services/simulador");
  simuladorService(db, repository(db), now).step();
  assert.equal((await vehiculos()).fuente, "simulacion");
});

test("RF07 crear la aplicación no inicia el simulador en pruebas", async (t) => {
  await new Promise((resolve) => server.close(resolve));
  t.mock.timers.enable({ apis: ["setInterval"] });
  config.simularGps = true;
  await iniciar();
  t.mock.timers.tick(15000);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
    0,
  );
  assert.equal((await vehiculos()).fuente, "gps");
});

test("RF07 un paso del simulador persiste una muestra válida por servicio activo", async () => {
  const { simuladorService } = require("../src/services/simulador");
  const simulador = simuladorService(db, repository(db), now);
  simulador.step();
  const muestras = db
    .prepare("SELECT * FROM posicion_vehiculo ORDER BY servicio_id")
    .all();
  assert.deepEqual(
    muestras.map((m) => m.servicio_id),
    [1, 2],
  );
  for (const m of muestras) {
    assert.equal(m.origen, "simulacion");
    const limites = db
      .prepare(
        `SELECT MIN(p.latitud) min_lat, MAX(p.latitud) max_lat,
      MIN(p.longitud) min_lon, MAX(p.longitud) max_lon
      FROM servicio s JOIN recorrido_paradero rp ON rp.recorrido_id=s.recorrido_id
      JOIN paradero p ON p.id=rp.paradero_id WHERE s.id=?`,
      )
      .get(m.servicio_id);
    assert.ok(
      Number.isFinite(m.latitud) &&
        m.latitud >= limites.min_lat &&
        m.latitud <= limites.max_lat,
    );
    assert.ok(
      Number.isFinite(m.longitud) &&
        m.longitud >= limites.min_lon &&
        m.longitud <= limites.max_lon,
    );
    assert.equal(m.medida_en, fecha);
  }
  const result = await vehiculos();
  assert.ok(
    result.vehiculos.every((v) => v.posicion?.desactualizada === false),
  );
  assert.deepEqual(
    result.vehiculos.map((v) => v.posicion.latitud),
    muestras.map((m) => m.latitud),
  );
});

test("RF07 conserva la fuente simulada al desactivar la configuración y usa las últimas muestras", async () => {
  const { simuladorService } = require("../src/services/simulador");
  simuladorService(db, repository(db), now).step();
  assert.equal((await vehiculos()).fuente, "simulacion");
  muestra(1, "2026-11-17T12:00:01.000Z");
  assert.equal((await vehiculos()).fuente, "simulacion");
  muestra(2, "2026-11-17T12:00:01.000Z");
  assert.equal((await vehiculos()).fuente, "gps");
});

test("RF07 un error del intervalo se registra sin escapar y permite el siguiente paso", async (t) => {
  const { simuladorService } = require("../src/services/simulador");
  t.mock.timers.enable({ apis: ["setInterval"] });
  const error = t.mock.method(console, "error", () => {});
  const repo = repository(db);
  const write = t.mock.method(repo, "addPosition", () => {
    throw new Error("fixture write failure");
  });
  const simulador = simuladorService(db, repo, now);
  simulador.start();
  try {
    assert.doesNotThrow(() => t.mock.timers.tick(5000));
    assert.equal(error.mock.callCount(), 1);
    assert.match(
      error.mock.calls[0].arguments.join(" "),
      /fixture write failure/,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
      0,
    );
    write.mock.restore();
    t.mock.timers.tick(5000);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
      2,
    );
    assert.equal((await vehiculos()).fuente, "simulacion");
  } finally {
    simulador.stop();
  }
});

test("RF07 el simulador interpola siguiendo los paraderos por posición", async () => {
  const { simuladorService } = require("../src/services/simulador");
  db.exec(`UPDATE recorrido_paradero SET posicion=posicion+10 WHERE recorrido_id=1;
    UPDATE recorrido_paradero SET posicion=1 WHERE id=3;
    UPDATE recorrido_paradero SET posicion=2 WHERE id=1;
    UPDATE recorrido_paradero SET posicion=3 WHERE id=2;`);
  const simulador = simuladorService(db, repository(db), now);
  simulador.step();
  fecha = "2026-11-17T12:00:05.000Z";
  simulador.step();
  const posicion = (await vehiculos()).vehiculos[0].posicion;
  assert.equal(posicion.medida_en, fecha);
  assert.ok(posicion.latitud > -23.65 && posicion.latitud < -23.63);
  assert.ok(posicion.longitud > -70.4 && posicion.longitud < -70.38);
  assert.ok(
    Math.abs(posicion.latitud + 23.63 - (posicion.longitud + 70.38)) < 1e-9,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
    4,
  );
});

test("RF07 el simulador escribe cada 5 segundos y deja de escribir al detenerse", async (t) => {
  const { simuladorService } = require("../src/services/simulador");
  t.mock.timers.enable({ apis: ["setInterval"] });
  const simulador = simuladorService(db, repository(db), now);
  simulador.start();
  simulador.start();
  try {
    t.mock.timers.tick(4999);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
      0,
    );
    t.mock.timers.tick(1);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
      2,
    );
    db.exec(
      "UPDATE servicio SET estado='finalizado' WHERE id=1; UPDATE vehiculo SET activo=0 WHERE id=2",
    );
    t.mock.timers.tick(5000);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
      2,
    );
    db.exec(
      "UPDATE servicio SET estado='activo' WHERE id=1; UPDATE vehiculo SET activo=1 WHERE id=2",
    );
    simulador.stop();
    t.mock.timers.tick(10000);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
      2,
    );
    assert.ok((await vehiculos()).vehiculos.every((v) => v.posicion !== null));
  } finally {
    simulador.stop();
  }
});

test("RF07 la migración agrega el índice de muestras y sigue siendo idempotente", () => {
  muestra(1, fecha);
  migrate(db);
  migrate(db);
  const indices = db.prepare("PRAGMA index_list('posicion_vehiculo')").all();
  assert.ok(
    indices.some((indice) => {
      const columnas = db.prepare(`PRAGMA index_info('${indice.name}')`).all();
      return columnas.map((c) => c.name).join(",") === "servicio_id,medida_en";
    }),
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM posicion_vehiculo").get().n,
    1,
  );
});

test("RF07 SIMULAR_GPS solo se habilita con true explícito", () => {
  for (const [valor, esperado] of [
    ["true", true],
    ["false", false],
    ["", false],
  ]) {
    const resultado = execFileSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify(require('./src/config/env').simularGps))",
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          JWT_SECRET: config.jwtSecret,
          SIMULAR_GPS: valor,
          NODE_ENV: "test",
        },
        encoding: "utf8",
      },
    );
    assert.equal(resultado, JSON.stringify(esperado));
  }
});
