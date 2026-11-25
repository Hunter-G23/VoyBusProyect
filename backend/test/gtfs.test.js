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
    assert.equal(route.shape.length, 2); // 601 identical points collapse to the ends
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

test("trazado GTFS conserva esquinas y queda a 5 m o menos del original", () => {
  const { simplify, SHAPE_TOLERANCE_M } = require("../scripts/gtfs-extract.cjs");
  const deg = 1 / 111195; // ~1 m in latitude
  // An L-shaped street (500 m north, then 500 m east) sampled every metre, with 2 m jitter.
  const points = [];
  for (let i = 0; i <= 500; i++) points.push({ lat: -23.6 + i * deg, lon: -70.4 + (i % 2) * 2 * deg });
  for (let i = 1; i <= 500; i++) points.push({ lat: -23.6 + 500 * deg, lon: -70.4 + (i * deg) / Math.cos((23.6 * Math.PI) / 180) });
  const kept = simplify(points, SHAPE_TOLERANCE_M);
  assert.ok(kept.length < 10, `quedaron ${kept.length} puntos`);
  assert.ok(kept.some((p) => p === points[500]), "conserva la esquina");
  const xy = (p) => [(p.lon + 70.4) * 111195 * Math.cos((23.6 * Math.PI) / 180), (p.lat + 23.6) * 111195];
  const gap = (p) => Math.min(...kept.slice(1).map((b, i) => {
    const [x, y] = xy(p), [ax, ay] = xy(kept[i]), [bx, by] = xy(b), dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }));
  assert.ok(Math.max(...points.map(gap)) <= SHAPE_TOLERANCE_M);
});

test("datos versionados: cada paradero queda a 40 m o menos de su trazado", () => {
  const data = require("../src/database/data/antofagasta.json");
  const stops = new Map(data.paraderos.map((s) => [s.id, s]));
  const m = 111195, k = Math.cos((23.6 * Math.PI) / 180);
  for (const route of data.recorridos) {
    const line = route.shape.map(([lat, lon]) => [lon * m * k, lat * m]);
    for (const id of route.paraderos) {
      const s = stops.get(id), x = s.longitud * m * k, y = s.latitud * m;
      const d = Math.min(...line.slice(1).map(([bx, by], i) => {
        const [ax, ay] = line[i], dx = bx - ax, dy = by - ay, size = dx * dx + dy * dy;
        const t = size ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / size)) : 0;
        return Math.hypot(x - ax - t * dx, y - ay - t * dy);
      }));
      assert.ok(d <= 40, `${route.codigo} sentido ${route.direction_id}: ${id} a ${Math.round(d)} m`);
    }
  }
});
