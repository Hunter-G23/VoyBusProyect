const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase, migrate } = require("../src/database/db");
const { createApp } = require("../src/app");
const { fixtures, password } = require("./fixtures");
const jwt = require("jsonwebtoken");
let db, server, base, tokens;
const config = {
  jwtSecret: "fixture-secret-at-least-thirty-two-characters",
  origins: ["http://localhost:8081"],
  production: false,
};
async function call(method, url, body, token = tokens.a, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    headers: res.headers,
    bytes,
    data:
      res.headers.get("content-type")?.includes("application/json") &&
      bytes.length
        ? JSON.parse(bytes)
        : null,
  };
}
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  fixtures(db);
  server = createApp(db, config).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  tokens = {};
  // Login once through HTTP per role; never mint application sessions in fixtures.
  for (const [key, correo] of [
    ["a", "pasajero@example.test"],
    ["b", "pasajera@example.test"],
    ["d", "conductor@example.test"],
    ["admin", "admin@example.test"],
  ]) {
    const login = await call(
      "POST",
      "/auth/login",
      { correo, contrasena: password },
      null,
    );
    assert.equal(login.status, 200);
    tokens[key] = login.data.token;
  }
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  db.close();
});

test("v2 catálogo expone metadatos, estados y variantes ordenados sin cambiar los campos existentes", async () => {
  const res = await call("GET", "/red/lineas?todas=1");
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.data.lineas.map((l) => l.codigo),
    ["T01", "T02", "T03"],
  );
  for (const l of res.data.lineas)
    for (const key of [
      "id",
      "codigo",
      "nombre",
      "color",
      "color_texto",
      "electrica",
      "estado",
      "fuente",
    ])
      assert.ok(Object.hasOwn(l, key), key);
  assert.equal(res.data.lineas[2].estado, "inactiva");
  db.exec(
    "INSERT INTO recorrido(linea_id,nombre,sentido,origen,destino,codigo,variante) VALUES(1,'Variante','Ida','A','B','T01N',1)",
  );
  const routes = await call("GET", "/red/lineas/1/recorridos");
  assert.equal(routes.status, 200);
  assert.equal(routes.data.recorridos.at(-1).codigo, "T01N");
  assert.equal(routes.data.recorridos.at(-1).variante, 1);
});
test("v2 favoritos de línea y recorrido son idempotentes, propios y persistentes", async () => {
  const results = await Promise.all([
    call("POST", "/favoritos", { linea_id: 1 }),
    call("POST", "/favoritos", { linea_id: 1 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  const id = results[0].data.favorito.id;
  assert.equal(results[1].data.favorito.id, id);
  const route = await call("POST", "/favoritos", {
    linea_id: 1,
    recorrido_id: 2,
  });
  assert.equal(route.status, 201);
  assert.equal(
    (await call("POST", "/favoritos", { linea_id: 1, recorrido_id: 2 })).data
      .favorito.id,
    route.data.favorito.id,
  );
  const list = await call("GET", "/favoritos");
  assert.equal(list.data.favoritos.length, 2);
  assert.equal(list.data.favoritos[0].linea.codigo, "T01");
  assert.equal(list.data.favoritos[0].recorrido, null);
  assert.equal(list.data.favoritos[1].recorrido.id, 2);
  assert.ok(list.data.favoritos[0].creado_en);
  assert.deepEqual(
    (await call("GET", "/favoritos", undefined, tokens.b)).data.favoritos,
    [],
  );
  assert.equal(
    (await call("DELETE", `/favoritos/${id}`, undefined, tokens.b)).status,
    404,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM favorito").get().n, 2);
  assert.equal((await call("DELETE", `/favoritos/${id}`)).status, 204);
  assert.equal((await call("DELETE", `/favoritos/${id}`)).status, 404);
  assert.equal((await call("GET", "/favoritos")).data.favoritos.length, 1);
});
test("v2 favoritos requieren pasajero y validan la relación línea/recorrido", async () => {
  for (const token of [tokens.d, tokens.admin])
    for (const [method, url, body] of [
      ["GET", "/favoritos"],
      ["POST", "/favoritos", { linea_id: 1 }],
      ["DELETE", "/favoritos/1"],
    ])
      assert.equal((await call(method, url, body, token)).status, 403);
  assert.equal((await call("GET", "/favoritos", undefined, null)).status, 401);
  for (const [body, status] of [
    [{ linea_id: "1x" }, 400],
    [{ linea_id: 999 }, 404],
    [{ linea_id: 1, recorrido_id: 3 }, 400],
    [{ linea_id: 1, recorrido_id: 999 }, 400],
  ])
    assert.equal((await call("POST", "/favoritos", body)).status, status);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM favorito").get().n, 0);
});
test("v2 perfil edita solo nombre, con las reglas RF01 y sin exponer secretos", async () => {
  for (const nombre of ["", "A", "a".repeat(81), 42, null])
    assert.equal((await call("PATCH", "/auth/me", { nombre })).status, 400);
  const res = await call("PATCH", "/auth/me", {
    nombre: "  Nombre nuevo  ",
    correo: "otro@example.test",
    rol: "administrador",
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.usuario.nombre, "Nombre nuevo");
  assert.equal(res.data.usuario.correo, "pasajero@example.test");
  assert.equal(res.data.usuario.rol, "pasajero");
  assert.doesNotMatch(
    JSON.stringify(res.data),
    /password_hash|FixturePassword/,
  );
  assert.equal(
    (await call("GET", "/auth/me")).data.usuario.nombre,
    "Nombre nuevo",
  );
  assert.equal(
    (await call("PATCH", "/auth/me", { nombre: "Test" }, null)).status,
    401,
  );
});
test("v2 contraseña valida actual, longitud, bytes y confirmación sin invalidar al fallar", async () => {
  const fields = {
    actual: password,
    nueva: "NewPassword2026!",
    confirmacion: "NewPassword2026!",
  };
  const wrong = await call("POST", "/auth/contrasena", {
    ...fields,
    actual: "incorrecta",
  });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.data.error.codigo, "CONTRASENA_INCORRECTA");
  for (const cambio of [
    { nueva: "1234567" },
    { nueva: "a".repeat(65) },
    { nueva: "ñ".repeat(40), confirmacion: "ñ".repeat(40) },
    { confirmacion: "distinta" },
    { nueva: null },
  ])
    assert.equal(
      (await call("POST", "/auth/contrasena", { ...fields, ...cambio })).status,
      400,
    );
  assert.equal((await call("GET", "/auth/me")).status, 200);
  assert.equal(
    db.prepare("SELECT sesion_version FROM usuario WHERE id=1").get()
      .sesion_version,
    0,
  );
});
test("v2 contraseña invalida todas las sesiones previas y renueva token y cookie del solicitante", async () => {
  assert.equal(jwt.decode(tokens.a).sv, 0);
  const other = await call(
    "POST",
    "/auth/login",
    { correo: "pasajero@example.test", contrasena: password },
    null,
  );
  const res = await call(
    "POST",
    "/auth/contrasena",
    {
      actual: password,
      nueva: "NewPassword2026!",
      confirmacion: "NewPassword2026!",
    },
    null,
    { Cookie: other.headers.get("set-cookie").split(";")[0] },
  );
  assert.equal(res.status, 200);
  assert.equal(jwt.decode(res.data.token).sv, 1);
  assert.equal(
    (
      await call("GET", "/auth/me", undefined, null, {
        Cookie: other.headers.get("set-cookie").split(";")[0],
      })
    ).status,
    401,
  );
  assert.match(res.headers.get("set-cookie"), /HttpOnly/);
  for (const token of [tokens.a, other.data.token])
    assert.equal((await call("GET", "/auth/me", undefined, token)).status, 401);
  const legacy = jwt.sign({}, config.jwtSecret, {
    subject: "1",
    issuer: "voybus",
    audience: "voybus-app",
  });
  assert.equal((await call("GET", "/auth/me", undefined, legacy)).status, 401);
  assert.equal(
    (await call("GET", "/auth/me", undefined, res.data.token)).status,
    200,
  );
  assert.equal(
    (
      await call("GET", "/auth/me", undefined, null, {
        Cookie: res.headers.get("set-cookie").split(";")[0],
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("GET", "/auth/me", undefined, tokens.b)).status,
    200,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/auth/login",
        { correo: "pasajero@example.test", contrasena: password },
        null,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/auth/login",
        { correo: "pasajero@example.test", contrasena: "NewPassword2026!" },
        null,
      )
    ).status,
    200,
  );
});
test("v2 cambios de contraseña concurrentes no aceptan dos veces la contraseña anterior", async () => {
  const results = await Promise.all(
    ["OneNewPassword!", "TwoNewPassword!"].map((nueva) =>
      call("POST", "/auth/contrasena", {
        actual: password,
        nueva,
        confirmacion: nueva,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  const winner = results.find((r) => r.status === 200);
  assert.equal(
    (await call("GET", "/auth/me", undefined, winner.data.token)).status,
    200,
  );
});
test("v2 login en curso no obtiene una sesión nueva si su contraseña acaba de cambiar", async (t) => {
  const bcrypt = require("bcryptjs");
  const compare = bcrypt.compare;
  let release,
    first = true;
  let started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  t.mock.method(bcrypt, "compare", async (...args) => {
    const valid = await compare(...args);
    if (!first) return valid;
    first = false;
    return new Promise((resolve) => {
      release = () => resolve(valid);
      started();
    });
  });
  const pending = call(
    "POST",
    "/auth/login",
    { correo: "pasajero@example.test", contrasena: password },
    null,
  );
  await waiting;
  try {
    assert.equal(
      (
        await call("POST", "/auth/contrasena", {
          actual: password,
          nueva: "Replacement2026!",
          confirmacion: "Replacement2026!",
        })
      ).status,
      200,
    );
  } finally {
    release();
  }
  assert.equal((await pending).status, 401);
});
test("v2 foto propia PNG/JPEG se almacena como BLOB, se sirve privada y se elimina", async () => {
  assert.equal((await call("GET", "/auth/me")).data.usuario.tiene_foto, false);
  assert.equal((await call("GET", "/auth/me/foto")).status, 404);
  for (const [tipo, bytes] of [
    ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1])],
    ["image/jpeg", Buffer.from([255, 216, 255, 224, 0, 1])],
  ]) {
    assert.equal(
      (
        await call("PUT", "/auth/me/foto", {
          tipo,
          datos_base64: bytes.toString("base64"),
        })
      ).status,
      200,
    );
    assert.equal((await call("GET", "/auth/me")).data.usuario.tiene_foto, true);
    const photo = await call("GET", "/auth/me/foto");
    assert.equal(photo.headers.get("content-type"), tipo);
    assert.match(photo.headers.get("cache-control"), /^private/);
    assert.deepEqual(photo.bytes, bytes);
    assert.equal(
      db
        .prepare(
          "SELECT typeof(datos) tipo FROM usuario_foto WHERE usuario_id=1",
        )
        .get().tipo,
      "blob",
    );
    assert.equal(
      (await call("GET", "/auth/me/foto", undefined, tokens.b)).status,
      404,
    );
    assert.equal(
      (await call("GET", "/auth/me/foto?usuario_id=1", undefined, tokens.b))
        .status,
      404,
    );
  }
  assert.equal(
    (await call("GET", "/auth/me/foto", undefined, null)).status,
    401,
  );
  assert.equal((await call("DELETE", "/auth/me/foto")).status, 204);
  assert.equal((await call("GET", "/auth/me")).data.usuario.tiene_foto, false);
  assert.equal((await call("GET", "/auth/me/foto")).status, 404);
});
test("v2 foto rechaza no-imágenes, base64 inválido y tipos falsos sin guardar", async () => {
  for (const body of [
    {
      tipo: "image/png",
      datos_base64: Buffer.from("<script>alert(1)</script>").toString("base64"),
    },
    { tipo: "image/png", datos_base64: "!!!" },
    {
      tipo: "image/jpeg",
      datos_base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString(
        "base64",
      ),
    },
    { tipo: "text/html", datos_base64: "YWJj" },
  ])
    assert.equal((await call("PUT", "/auth/me/foto", body)).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usuario_foto").get().n, 0);
});
test("v2 foto acepta exactamente 512 KB y rechaza más bytes decodificados", async () => {
  const bytes = Buffer.alloc(512 * 1024);
  Buffer.from([255, 216, 255]).copy(bytes);
  assert.equal(
    (
      await call("PUT", "/auth/me/foto", {
        tipo: "image/jpeg",
        datos_base64: bytes.toString("base64"),
      })
    ).status,
    200,
  );
  const tooBig = Buffer.concat([bytes, Buffer.from([0])]);
  assert.equal(
    (
      await call("PUT", "/auth/me/foto", {
        tipo: "image/jpeg",
        datos_base64: tooBig.toString("base64"),
      })
    ).status,
    413,
  );
  assert.deepEqual((await call("GET", "/auth/me/foto")).bytes, bytes);
  assert.equal(
    (await call("PATCH", "/auth/me", { nombre: "a".repeat(20000) })).status,
    413,
  );
});
test("B-fix 2 autentica antes de interpretar JSON grande", async () => {
  for (const path of ["/auth/me/foto", "/auth/me/foto/"]) {
    const response = await fetch(base + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"datos_base64":"' + "a".repeat(600 * 1024),
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.codigo, "SESION_INVALIDA");
  }
});
test("B-fix 2 acepta foto grande con ruta canónica y barra final", async () => {
  const bytes = Buffer.alloc(450 * 1024);
  Buffer.from([255, 216, 255]).copy(bytes);
  for (const path of ["/auth/me/foto", "/auth/me/foto/"]) {
    assert.equal(
      (
        await call("PUT", path, {
          tipo: "image/jpeg",
          datos_base64: bytes.toString("base64"),
        })
      ).status,
      200,
    );
    assert.deepEqual((await call("GET", "/auth/me/foto")).bytes, bytes);
  }
  for (const body of [null, [], "invalid", {}])
    assert.equal((await call("PUT", "/auth/me/foto/", body)).status, 400);
});

test("B-fix 4 logout revoca bearer y cookie y permite ausencia de sesión", async () => {
  const login = await call(
    "POST",
    "/auth/login",
    {
      correo: "pasajero@example.test",
      contrasena: password,
    },
    null,
  );
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await call("POST", "/auth/logout", {}, null, { Cookie: cookie })).status,
    204,
  );
  assert.equal(
    (await call("GET", "/auth/me", undefined, login.data.token)).status,
    401,
  );
  assert.equal(
    db.prepare("SELECT sesion_version FROM usuario WHERE id=1").get()
      .sesion_version,
    1,
  );
  assert.equal(
    (await call("GET", "/auth/me", undefined, null, { Cookie: cookie })).status,
    401,
  );
  assert.equal(
    (await call("GET", "/auth/me", undefined, tokens.b)).status,
    200,
  );
  assert.equal((await call("POST", "/auth/logout", {}, null)).status, 204);
  assert.equal(
    (await call("POST", "/auth/logout", {}, login.data.token)).status,
    204,
  );
  const bearerLogout = await call("POST", "/auth/logout", {}, tokens.b);
  assert.equal(bearerLogout.status, 204);
  assert.match(
    bearerLogout.headers.get("set-cookie"),
    /Expires=Thu, 01 Jan 1970/,
  );
  assert.equal(
    (await call("GET", "/auth/me", undefined, tokens.b)).status,
    401,
  );
});

test("B-fix 6 eventos devuelve solo el último cambio por línea, con actor y fecha", async () => {
  for (const [id, estado] of [
    [1, "temporal"],
    [2, "inactiva"],
    [1, "inactiva"],
  ])
    assert.equal(
      (
        await call(
          "PATCH",
          `/admin/lineas/${id}/estado`,
          { estado },
          tokens.admin,
        )
      ).status,
      200,
    );
  const latest = db
    .prepare("SELECT * FROM linea_estado_evento ORDER BY id DESC")
    .all();
  const response = await call(
    "GET",
    "/admin/lineas/eventos",
    undefined,
    tokens.admin,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.data.eventos.map((e) => e.id),
    [latest[0].id, latest[1].id],
  );
  for (const event of response.data.eventos) {
    assert.equal(event.admin_id, 6);
    assert.equal(event.admin_nombre, "Administrator");
    assert.equal(event.fecha, latest.find((e) => e.id === event.id).fecha);
    assert.ok(Number.isFinite(Date.parse(event.fecha)));
  }
  const filtered = await call(
    "GET",
    "/admin/lineas/eventos?linea_id=1",
    undefined,
    tokens.admin,
  );
  assert.deepEqual(filtered.data.eventos, [response.data.eventos[0]]);
});

test("B-fix 8 rutas administrativas sin sesión devuelven 401 y no escriben", async () => {
  assert.equal(
    (
      await call(
        "PATCH",
        "/admin/lineas/1/estado",
        { estado: "inactiva" },
        null,
      )
    ).status,
    401,
  );
  assert.equal(
    (await call("GET", "/admin/lineas/eventos", undefined, null)).status,
    401,
  );
  assert.equal(
    db.prepare("SELECT estado FROM linea WHERE id=1").get().estado,
    "activa",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM linea_estado_evento").get().n,
    0,
  );
});

test("v2 preferencias valida idioma y tipos booleanos y conserva opciones no editadas", async () => {
  const initial = (await call("GET", "/auth/me")).data.usuario;
  assert.equal(initial.idioma, "es");
  assert.deepEqual(initial.notificaciones, {
    estado_linea_favorita: false,
    solicitud: false,
  });
  let res = await call("PATCH", "/auth/me/preferencias", {
    idioma: "en",
    notificaciones: { solicitud: true },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.usuario.idioma, "en");
  assert.equal(res.data.usuario.notificaciones.solicitud, true);
  await call("PATCH", "/auth/me/preferencias", {
    notificaciones: { estado_linea_favorita: true },
  });
  const stored = (await call("GET", "/auth/me")).data.usuario;
  assert.deepEqual(stored.notificaciones, {
    estado_linea_favorita: true,
    solicitud: true,
  });
  assert.equal(stored.idioma, "en");
  assert.equal(
    (await call("GET", "/auth/me", undefined, tokens.b)).data.usuario.idioma,
    "es",
  );
  for (const body of [
    { idioma: "fr" },
    { notificaciones: { solicitud: 1 } },
    { notificaciones: { otro: true } },
    { notificaciones: [] },
    { notificaciones: null },
  ])
    assert.equal(
      (await call("PATCH", "/auth/me/preferencias", body)).status,
      400,
    );
  assert.equal((await call("GET", "/auth/me")).data.usuario.idioma, "en");
});
test("v2 historial incluye vínculos cerrados y solicitudes propias ordenados sin mostrar los de otros", async () => {
  await call("POST", "/viaje/vincular", { codigo_vehiculo: "TEST01" });
  const solicitud = await call("POST", "/viaje/solicitudes", {
    destino_id: 3,
    clave_idempotencia: "history-request-key-123",
  });
  await call(
    "POST",
    "/viaje/vincular",
    { codigo_vehiculo: "TEST02" },
    tokens.b,
  );
  db.exec(
    "UPDATE vinculo_viaje SET estado='cerrado',fin='2026-11-17T13:00:00.000Z' WHERE pasajero_id=1",
  );
  db.prepare(
    "UPDATE solicitud_parada SET creada_en='2026-11-17T12:00:00.000Z' WHERE id=?",
  ).run(solicitud.data.solicitud.id);
  await call("POST", "/viaje/vincular", { codigo_vehiculo: "TEST02" });
  const second = await call("POST", "/viaje/solicitudes", {
    destino_id: 8,
    clave_idempotencia: "history-second-key-123",
  });
  assert.equal(second.status, 201);
  db.exec(
    "UPDATE vinculo_viaje SET estado='cerrado',fin='2026-11-17T14:00:00.000Z' WHERE pasajero_id=1 AND estado='activo'",
  );
  await call("POST", "/viaje/vincular", { codigo_vehiculo: "TEST01" });
  const res = await call("GET", "/viaje/historial");
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.data.vinculos.map((v) => v.fin),
    ["2026-11-17T14:00:00.000Z", "2026-11-17T13:00:00.000Z"],
  );
  assert.ok(res.data.vinculos.every((v) => v.estado === "cerrado"));
  assert.deepEqual(
    res.data.solicitudes.map((s) => s.id),
    [second.data.solicitud.id, solicitud.data.solicitud.id],
  );
  assert.deepEqual(
    (await call("GET", "/viaje/historial", undefined, tokens.b)).data,
    { vinculos: [], solicitudes: [] },
  );
  assert.equal(
    (await call("GET", "/viaje/historial", undefined, tokens.d)).status,
    403,
  );
});
test("v2 estado de línea exige administrador, audita anterior/nuevo/actor y deriva activa", async () => {
  for (const token of [tokens.a, tokens.d]) {
    assert.equal(
      (
        await call(
          "PATCH",
          "/admin/lineas/1/estado",
          { estado: "inactiva" },
          token,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("GET", "/admin/lineas/eventos?linea_id=1", undefined, token))
        .status,
      403,
    );
  }
  for (const estado of ["temporal", "inactiva", "activa"]) {
    const res = await call(
      "PATCH",
      "/admin/lineas/1/estado",
      { estado },
      tokens.admin,
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.linea.estado, estado);
    const stored = db
      .prepare("SELECT estado,activa FROM linea WHERE id=1")
      .get();
    assert.equal(stored.activa, estado === "activa" ? 1 : 0);
    assert.equal(
      (await call("GET", "/red/lineas?todas=1")).data.lineas.find(
        (l) => l.id === 1,
      ).estado,
      estado,
    );
  }
  const events = await call(
    "GET",
    "/admin/lineas/eventos?linea_id=1",
    undefined,
    tokens.admin,
  );
  assert.equal(events.status, 200);
  assert.equal(events.data.eventos[0].estado_anterior, "inactiva");
  assert.equal(events.data.eventos[0].estado_nuevo, "activa");
  assert.equal(events.data.eventos[0].admin_id, 6);
  assert.ok(events.data.eventos[0].fecha);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM linea_estado_evento").get().n,
    3,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/admin/lineas/1/estado",
        { estado: "otro" },
        tokens.admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/admin/lineas/999/estado",
        { estado: "activa" },
        tokens.admin,
      )
    ).status,
    404,
  );
});

test("estado automático sigue la última posición visible en catálogo, recorridos y favoritos", async () => {
  db.exec("UPDATE linea SET modo_estado='auto' WHERE id=1");
  assert.equal((await call("POST", "/favoritos", { linea_id: 1 })).status, 201);

  async function assertPublished(expected) {
    const lines = (await call("GET", "/red/lineas?todas=1")).data.lineas;
    assert.equal(lines[0].modo_estado, "auto");
    assert.equal(lines[0].estado, expected);
    const active = (await call("GET", "/red/lineas")).data.lineas;
    assert.equal(
      active.some((line) => line.id === 1),
      expected === "activa",
    );
    const routes = await call("GET", "/red/lineas/1/recorridos");
    assert.equal(routes.status, 200);
    assert.equal(routes.data.linea.estado, expected);
    const favorites = (await call("GET", "/favoritos")).data.favoritos;
    assert.equal(favorites[0].linea.estado, expected);
  }

  await assertPublished("inactiva");
  const sample = db.prepare(
    "INSERT INTO posicion_vehiculo(servicio_id,latitud,longitud,medida_en) VALUES(1,?,?,?)",
  );
  sample.run(-23.64, -70.39, "2020-01-01T12:00:00.000Z");
  await assertPublished("activa");
  let vehicles = (await call("GET", "/red/vehiculos")).data.vehiculos;
  assert.equal(vehicles[0].posicion.desactualizada, true);

  db.exec("PRAGMA ignore_check_constraints=ON");
  sample.run(-91, -70.39, "2020-01-01T12:00:01.000Z");
  db.exec("PRAGMA ignore_check_constraints=OFF");
  await assertPublished("inactiva");
  vehicles = (await call("GET", "/red/vehiculos")).data.vehiculos;
  assert.equal(vehicles[0].posicion, null);
  sample.run(-23.64, -70.39, "2020-01-01T12:00:02.000Z");
  await assertPublished("activa");
  db.exec("UPDATE servicio SET estado='finalizado' WHERE id=1");
  await assertPublished("inactiva");
  db.exec("UPDATE servicio SET estado='activo' WHERE id=1");
  await assertPublished("activa");
});

test("administrador puede fijar estados y volver a automático con auditoría de modo", async () => {
  const url = "/admin/lineas/1/estado";
  const auto = { modo_estado: "auto" };
  const patch = (body, token = tokens.admin) => call("PATCH", url, body, token);
  assert.equal((await patch(auto, tokens.a)).status, 403);
  assert.equal((await patch(auto, tokens.d)).status, 403);
  assert.equal((await patch(auto, null)).status, 401);
  assert.equal((await patch({ modo_estado: "desconocido" })).status, 400);
  assert.equal((await patch({ ...auto, estado: "activa" })).status, 400);

  let line = (await patch(auto)).data.linea;
  assert.equal(line.estado, "inactiva");
  assert.equal(line.modo_estado, "auto");
  line = (await patch({ estado: "activa" })).data.linea;
  assert.equal(line.estado, "activa");
  assert.equal(line.modo_estado, "manual");

  db.exec(`INSERT INTO posicion_vehiculo(servicio_id,latitud,longitud,medida_en)
    VALUES(1,-23.64,-70.39,'2020-01-01T12:00:00.000Z')`);
  line = (await patch({ estado: "temporal" })).data.linea;
  assert.equal(line.estado, "temporal");
  assert.equal((await call("GET", "/red/lineas/1/recorridos")).status, 404);
  assert.equal((await call("GET", "/red/recorridos/1/paraderos")).status, 404);

  line = (await patch(auto)).data.linea;
  assert.equal(line.estado, "activa");
  assert.equal(line.modo_estado, "auto");
  assert.equal(
    db.prepare("SELECT estado FROM linea WHERE id=1").get().estado,
    "temporal",
  );
  assert.equal((await call("GET", "/red/lineas/1/recorridos")).status, 200);
  assert.equal((await call("GET", "/red/recorridos/1/paraderos")).status, 200);

  await patch({ estado: "activa" });
  const events = await call(
    "GET",
    "/admin/lineas/eventos?linea_id=1",
    undefined,
    tokens.admin,
  );
  const [event] = events.data.eventos;
  assert.equal(event.estado_anterior, "activa");
  assert.equal(event.estado_nuevo, "activa");
  assert.equal(event.modo_anterior, "auto");
  assert.equal(event.modo_nuevo, "manual");
  assert.equal(event.admin_id, 6);
  const count = db.prepare("SELECT COUNT(*) n FROM linea_estado_evento");
  assert.equal(count.get().n, 5);
  await patch({ estado: "activa" });
  assert.equal(count.get().n, 5);
});
