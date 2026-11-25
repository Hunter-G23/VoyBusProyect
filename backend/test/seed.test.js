const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase, migrate } = require("../src/database/db");
const { seed } = require("../src/database/seed");
const { createApp } = require("../src/app");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

test("v2 seed carga GTFS real idempotente con variantes y vehículos demo en recorridos reales", async () => {
  const db = openDatabase(":memory:");
  let server;
  try {
    migrate(db);
    seed(db);
    seed(db);
    server = createApp(db, {
      jwtSecret: "test-secret-at-least-thirty-two-characters",
      origins: [],
      production: false,
    }).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const initial = await (await fetch(base + "/red/lineas")).json();
    assert.deepEqual(initial.lineas, []);
    const lines = await (await fetch(base + "/red/lineas?todas=1")).json();
    assert.deepEqual(
      lines.lineas.map((l) => l.codigo),
      [
        "102",
        "103",
        "104",
        "107",
        "108",
        "110",
        "111",
        "112",
        "114",
        "119",
        "121",
        "129",
        "E01",
      ],
    );
    for (const line of lines.lineas) {
      assert.equal(line.estado, "inactiva");
      assert.equal(line.modo_estado, "auto");
      assert.equal(line.electrica, line.codigo === "E01" ? 1 : 0);
      assert.equal(
        line.color_texto,
        ["114", "119"].includes(line.codigo) ? "#132F35" : "#FFFFFF",
      );
      assert.equal(line.fuente, "gtfs:Antofagasta20250307");
      const routes = await (
        await fetch(base + `/red/lineas/${line.id}/recorridos`)
      ).json();
      assert.equal(routes.recorridos.filter((r) => !r.variante).length, 2);
      for (const route of routes.recorridos)
        assert.ok(
          (
            await (
              await fetch(base + `/red/recorridos/${route.id}/paraderos`)
            ).json()
          ).paraderos.length > 0,
        );
    }
    const data = require("../src/database/data/antofagasta.json");
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM recorrido").get().n,
      data.recorridos.length,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM paradero").get().n,
      data.paraderos.length,
    );
    assert.equal(
      new Set(data.recorridos.filter((r) => r.variante).map((r) => r.codigo))
        .size,
      18,
    );
    assert.ok(data.lineas.some((l) => l.nombre.includes("Huáscar")));
    assert.doesNotMatch(JSON.stringify(data), /Ã|�/);
    const services = db
      .prepare(
        `SELECT v.codigo_vinculacion,l.codigo,r.sentido FROM servicio s JOIN vehiculo v ON v.id=s.vehiculo_id JOIN recorrido r ON r.id=s.recorrido_id JOIN linea l ON l.id=r.linea_id ORDER BY v.codigo_vinculacion`,
      )
      .all();
    assert.equal(services[0].codigo_vinculacion, "BUS001");
    assert.equal(services[0].codigo, "102");
    assert.equal(services[0].sentido, "Ida");
    assert.notEqual(services[1].codigo, "102");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.prepare(
      "UPDATE linea SET estado='temporal',modo_estado='manual' WHERE codigo='102'",
    ).run();
    seed(db);
    const override = db
      .prepare("SELECT estado,modo_estado FROM linea WHERE codigo='102'")
      .get();
    assert.deepEqual(
      { ...override },
      { estado: "temporal", modo_estado: "manual" },
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    db.close();
  }
});
test("migración convierte líneas GTFS activas a automático una sola vez", () => {
  const db = openDatabase(":memory:");
  try {
    db.exec(`CREATE TABLE linea (
      id INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1, estado TEXT NOT NULL, fuente TEXT
    );
    INSERT INTO linea(codigo,nombre,activa,estado,fuente) VALUES
      ('102','Centro',1,'activa','gtfs:test'),
      ('103','Norte',0,'inactiva','gtfs:test'),
      ('104','Sur',0,'temporal','gtfs:test'),
      ('105','Legada',1,'activa',NULL);`);
    migrate(db);
    const modes = db.prepare("SELECT modo_estado FROM linea ORDER BY codigo");
    assert.deepEqual(
      modes.all().map((l) => l.modo_estado),
      ["auto", "manual", "manual", "manual"],
    );
    db.exec("UPDATE linea SET modo_estado='manual' WHERE codigo='102'");
    migrate(db);
    assert.ok(modes.all().every((l) => l.modo_estado === "manual"));
  } finally {
    db.close();
  }
});
test("v2 seed también impide la carga programática en producción", () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ["-e", "require('./src/database/seed').seed(null)"],
        {
          cwd: path.resolve(__dirname, ".."),
          env: { ...process.env, NODE_ENV: "production" },
          encoding: "utf8",
          stdio: "pipe",
        },
      ),
    /producción/,
  );
});
