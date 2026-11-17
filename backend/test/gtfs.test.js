const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");

function input() {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "voybus-gtfs-"));
  const files = {
    "feed_info.txt":
      "feed_version,feed_start_date,feed_end_date\nFixture2025,20250101,20251231\n",
    "routes.txt":
      'route_id,route_short_name,route_long_name,route_color\nr1,102,"Huáscar, Centro",005BAA\nr2,102N,"Variante \"\"N\"\"",FFFFFF\n',
    "stops.txt":
      'stop_id,stop_code,stop_name,stop_lat,stop_lon\ns1,S1,"Huáscar, inicio",-23.6,-70.4\ns2,S2,Fin,-23.7,-70.3\ns3,S3,Unused,-23.5,-70.2\n',
    "trips.txt":
      "route_id,trip_id,direction_id,trip_headsign,shape_id\nr1,t1,0,Corto,sh1\nr1,t2,0,Huáscar,sh1\nr1,t3,1,Regreso,sh1\nr2,t4,0,Variante,sh1\n",
    "stop_times.txt":
      "trip_id,stop_id,stop_sequence\nt1,s1,1\nt2,s2,2\nt2,s1,1\nt3,s2,1\nt3,s1,2\nt4,s1,1\nt4,s2,2\n",
    "shapes.txt":
      "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n" +
      Array.from({ length: 601 }, (_, i) => `sh1,-23.6,-70.4,${i + 1}`).join(
        "\n",
      ) +
      "\n",
  };
  for (const [file, text] of Object.entries(files))
    fs.writeFileSync(path.join(dir, file), text, "latin1");
  for (const [i, suffix] of ["N2", "Y1", "Y2"].entries()) {
    fs.appendFileSync(
      path.join(dir, "routes.txt"),
      `v${i},102${suffix},Variante ${suffix},FFFFFF\n`,
      "latin1",
    );
    fs.appendFileSync(
      path.join(dir, "trips.txt"),
      `v${i},vt${i},0,Variante,sh1\n`,
      "latin1",
    );
    fs.appendFileSync(
      path.join(dir, "stop_times.txt"),
      `vt${i},s1,1\nvt${i},s2,2\n`,
      "latin1",
    );
  }
  return dir;
}
test("v2 extracción CSV latin1 elige el viaje mayor, respeta secuencia, variantes, colores y formas acotadas", async () => {
  const dir = input();
  try {
    const { extract } = require("../scripts/gtfs-extract.cjs");
    const data = await extract(dir);
    assert.equal(data.version, "Fixture2025");
    assert.equal(data.fuente, "gtfs:Fixture2025");
    assert.equal(data.lineas.length, 1);
    assert.equal(data.lineas[0].nombre, "Huáscar, Centro");
    assert.equal(data.recorridos.length, 6);
    const route = data.recorridos.find(
      (r) => r.codigo === "102" && r.direction_id === 0,
    );
    assert.deepEqual(route.paraderos, ["s1", "s2"]);
    assert.equal(route.destino, "Huáscar");
    assert.ok(route.shape.length <= 150);
    assert.equal(data.paraderos.length, 2);
    const variant = data.recorridos.find((r) => r.codigo === "102N");
    assert.equal(variant.variante, 1);
    assert.equal(variant.color, "#005BAA");
    assert.equal(variant.nombre, 'Variante "N"');
    for (const suffix of ["N", "N2", "Y1", "Y2"]) {
      const r = data.recorridos.find((r) => r.codigo === "102" + suffix);
      assert.equal(r.variante, 1);
      assert.equal(r.linea, "102");
      assert.equal(r.color, "#005BAA");
    }
    assert.deepEqual(await extract(dir), data);
    for (const file of ["routes.txt", "stops.txt", "trips.txt"]) {
      const filename = path.join(dir, file);
      fs.writeFileSync(filename, fs.readFileSync(filename, "latin1"), "utf8");
    }
    assert.deepEqual(await extract(dir), data);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("v2 extracción rechaza coordenadas no finitas o fuera de rango y CSV mal formado", async () => {
  const dir = input();
  try {
    const { extract } = require("../scripts/gtfs-extract.cjs");
    for (const value of ["91", "NaN", ""]) {
      fs.writeFileSync(
        path.join(dir, "stops.txt"),
        `stop_id,stop_name,stop_lat,stop_lon\ns1,Bad,${value},-70.4\ns2,Fin,-23.7,-70.3\n`,
        "latin1",
      );
      await assert.rejects(extract(dir), /coordenada/i);
    }
    fs.writeFileSync(
      path.join(dir, "stops.txt"),
      "stop_id,stop_name,stop_lat,stop_lon\ns1,Bad,-23.6,181\ns2,Fin,-23.7,-70.3\n",
      "latin1",
    );
    await assert.rejects(extract(dir), /coordenada/i);
    fs.writeFileSync(
      path.join(dir, "stops.txt"),
      "stop_id,stop_name,stop_lat,stop_lon\ns1,Inicio,-23.6,-70.4\ns2,Fin,-23.7,-70.3\n",
      "latin1",
    );
    fs.writeFileSync(
      path.join(dir, "shapes.txt"),
      "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nsh1,-91,-70.4,1\n",
      "latin1",
    );
    await assert.rejects(extract(dir), /coordenada/i);
    fs.writeFileSync(
      path.join(dir, "routes.txt"),
      'route_id,route_short_name,route_long_name\nr1,102,"unterminated\n',
      "latin1",
    );
    await assert.rejects(extract(dir), /CSV/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
