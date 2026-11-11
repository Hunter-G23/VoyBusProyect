const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const { openDatabase, migrate } = require("../src/database/db");
const { seed, demoPassword } = require("../src/database/seed");
const { createApp } = require("../src/app");
let db,
  server,
  base,
  tokens = {};
const temp = mkdtempSync(path.join(tmpdir(), "voybus-test-"));
const config = {
  jwtSecret: "test-only-secret-with-more-than-thirty-two-characters",
  origins: ["http://localhost:8081"],
  production: false,
};
async function call(method, url, body, token, extra = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}
const registration = (correo, other = {}) => ({
  nombre: "Usuario Prueba",
  correo,
  contrasena: "UnaClave2026!",
  confirmacion: "UnaClave2026!",
  ...other,
});
before(async () => {
  db = openDatabase(path.join(temp, "test.db"));
  migrate(db);
  seed(db);
  server = createApp(db, config).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const [key, correo] of [
    ["a", "pasajero@example.test"],
    ["b", "pasajera@example.test"],
    ["d", "conductor@example.test"],
    ["d2", "conductor2@example.test"],
    ["admin", "admin@example.test"],
    ["none", "sinservicio@example.test"],
  ]) {
    const response = await call("POST", "/auth/login", {
      correo,
      contrasena: demoPassword,
    });
    assert.equal(response.status, 200);
    tokens[key] = response.data.token;
  }
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(temp, { recursive: true, force: true });
});
test("RF01 crea, normaliza, oculta secretos y permite autenticación persistida", async () => {
  const result = await call(
    "POST",
    "/auth/registro",
    registration("  NUEVO@example.test "),
  );
  assert.equal(result.status, 201);
  assert.equal(result.data.usuario.correo, "nuevo@example.test");
  assert.equal(result.data.usuario.rol, "pasajero");
  assert.ok(!JSON.stringify(result.data).includes("hash"));
  assert.ok(!JSON.stringify(result.data).includes("UnaClave"));
  const stored = db
    .prepare("SELECT * FROM usuario WHERE id=?")
    .get(result.data.usuario.id);
  assert.match(stored.password_hash, /^\$2[aby]\$12\$/);
  const second = openDatabase(path.join(temp, "test.db"));
  assert.ok(
    second
      .prepare("SELECT id FROM usuario WHERE correo=?")
      .get("nuevo@example.test"),
  );
  second.close();
  assert.equal(
    (
      await call("POST", "/auth/login", {
        correo: "NUEVO@example.test",
        contrasena: "UnaClave2026!",
      })
    ).status,
    200,
  );
});
test("RF01 rechaza todos los campos inválidos y roles públicos sin insertar", async () => {
  const before = db.prepare("SELECT COUNT(*) n FROM usuario").get().n;
  for (const fields of [
    { nombre: "" },
    { nombre: "A" },
    { nombre: "a".repeat(81) },
    { correo: "incorrecto" },
    { contrasena: "1234567" },
    { contrasena: "a".repeat(65) },
    { contrasena: "ñ".repeat(40), confirmacion: "ñ".repeat(40) },
    { confirmacion: "diferente" },
    { rol: "administrador" },
    { rol: "conductor" },
  ]) {
    assert.equal(
      (
        await call(
          "POST",
          "/auth/registro",
          registration("valido@example.test", fields),
        )
      ).status,
      400,
    );
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usuario").get().n, before);
});
test("RF01 correo repetido y altas concurrentes dejan una sola cuenta", async () => {
  const responses = await Promise.all([
    call("POST", "/auth/registro", registration("carrera@example.test")),
    call("POST", "/auth/registro", registration("CARRERA@example.test")),
  ]);
  assert.deepEqual(responses.map((x) => x.status).sort(), [201, 409]);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM usuario WHERE correo=?")
      .get("carrera@example.test").n,
    1,
  );
});
test("RF02 autentica tres roles y emite token de 60 minutos sin secretos", async () => {
  for (const [key, role] of [
    ["a", "pasajero"],
    ["d", "conductor"],
    ["admin", "administrador"],
  ]) {
    const payload = jwt.verify(tokens[key], config.jwtSecret);
    assert.equal(payload.exp - payload.iat, 3600);
    const result = await call("GET", "/auth/me", undefined, tokens[key]);
    assert.equal(result.data.usuario.rol, role);
    assert.ok(!("password_hash" in result.data.usuario));
    assert.ok(!("password" in payload));
  }
});
test("RF02 credenciales inválidas e inactivas usan un mensaje uniforme", async () => {
  const responses = [];
  for (const [correo, contrasena] of [
    ["desconocido@example.test", demoPassword],
    ["inactivo@example.test", demoPassword],
    ["pasajero@example.test", "incorrecta"],
  ])
    responses.push(await call("POST", "/auth/login", { correo, contrasena }));
  assert.ok(responses.every((x) => x.status === 401));
  assert.deepEqual(responses[0].data, responses[1].data);
  assert.deepEqual(responses[1].data, responses[2].data);
});
test("RF02 rechaza tokens ausentes, alterados, vencidos y cuentas desactivadas", async () => {
  const expired = jwt.sign({}, config.jwtSecret, {
    subject: "1",
    issuer: "voybus",
    audience: "voybus-app",
    expiresIn: -1,
  });
  for (const token of [undefined, tokens.a + "alterado", expired])
    assert.equal((await call("GET", "/auth/me", undefined, token)).status, 401);
  db.prepare("UPDATE usuario SET activo=0 WHERE id=2").run();
  assert.equal(
    (await call("GET", "/auth/me", undefined, tokens.b)).status,
    401,
  );
  db.prepare("UPDATE usuario SET activo=1 WHERE id=2").run();
});
test("RF02 aplica permisos aunque el cliente cambie el rol o la URL", async () => {
  assert.equal(
    (await call("GET", "/conductor/servicio/solicitudes", undefined, tokens.a))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/vincular",
        { codigo_vehiculo: "BUS001" },
        tokens.d,
      )
    ).status,
    403,
  );
  const forged = jwt.sign({ rol: "conductor" }, config.jwtSecret, {
    subject: "1",
    issuer: "voybus",
    audience: "voybus-app",
  });
  assert.equal(
    (await call("GET", "/conductor/servicio/solicitudes", undefined, forged))
      .status,
    403,
  );
});
test("Sesión web usa cookie HttpOnly y cierre de sesión la elimina", async () => {
  const login = await call("POST", "/auth/login", {
    correo: "pasajero@example.test",
    contrasena: demoPassword,
  });
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(
    (
      await call("GET", "/auth/me", undefined, undefined, {
        Cookie: cookie.split(";")[0],
      })
    ).status,
    200,
  );
  assert.match(
    (await call("POST", "/auth/logout", {})).headers.get("set-cookie"),
    /Expires=Thu, 01 Jan 1970/,
  );
});
test("RF04 catálogo público solo devuelve líneas activas ordenadas", async () => {
  const response = await call("GET", "/red/lineas");
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.data.lineas.map((x) => x.codigo),
    ["L01", "L02"],
  );
});
test("RF04 distingue catálogo vacío de errores y permite recuperarlo", async () => {
  db.exec("UPDATE linea SET activa=0");
  const response = await call("GET", "/red/lineas");
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.lineas, []);
  db.exec("UPDATE linea SET activa=1 WHERE id IN(1,2)");
  assert.equal((await call("GET", "/red/lineas")).data.lineas.length, 2);
});
test("RF05 filtra por línea, separa ida/vuelta y conserva IDs", async () => {
  const response = await call("GET", "/red/lineas/1/recorridos");
  assert.equal(response.data.linea.id, 1);
  assert.deepEqual(
    response.data.recorridos.map((x) => [x.id, x.sentido]),
    [
      [1, "Ida"],
      [2, "Vuelta"],
    ],
  );
  assert.equal(
    (await call("GET", "/red/lineas/2/recorridos")).data.recorridos[0].id,
    3,
  );
});
test("RF05 línea inexistente/inactiva, ID inválido y lista vacía", async () => {
  for (const id of ["999", "3"])
    assert.equal(
      (await call("GET", `/red/lineas/${id}/recorridos`)).status,
      404,
    );
  assert.equal((await call("GET", "/red/lineas/1x/recorridos")).status, 400);
  db.exec("UPDATE recorrido SET activo=0 WHERE linea_id=2");
  assert.deepEqual(
    (await call("GET", "/red/lineas/2/recorridos")).data.recorridos,
    [],
  );
  db.exec("UPDATE recorrido SET activo=1 WHERE linea_id=2");
});
test("RF06 orden propio por recorrido, ocurrencias y coordenadas", async () => {
  const ida = (await call("GET", "/red/recorridos/1/paraderos")).data;
  const vuelta = (await call("GET", "/red/recorridos/2/paraderos")).data;
  assert.deepEqual(
    ida.paraderos.map((x) => [x.codigo, x.posicion]),
    [
      ["P01", 1],
      ["P02", 2],
      ["P03", 3],
    ],
  );
  assert.deepEqual(
    vuelta.paraderos.map((x) => x.codigo),
    ["P03", "P04", "P01"],
  );
  assert.equal(vuelta.paraderos[0].id, 4);
  assert.ok(
    ida.paraderos.every(
      (x) => Number.isFinite(x.latitud) && Number.isFinite(x.longitud),
    ),
  );
});
test("RF06 admite una segunda ocurrencia sin posiciones duplicadas ni coordenadas inválidas", () => {
  db.prepare("INSERT INTO recorrido_paradero VALUES(90,1,1,4)").run();
  assert.throws(
    () => db.exec("INSERT INTO recorrido_paradero VALUES(91,1,2,4)"),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO paradero VALUES(91,'INVALID','Fuera de rango',100,0,1)",
      ),
    /CHECK/,
  );
  db.exec("DELETE FROM recorrido_paradero WHERE id=90");
});
test("RF06 distingue recorrido inexistente y vacío", async () => {
  assert.equal(
    (await call("GET", "/red/recorridos/999/paraderos")).status,
    404,
  );
  db.exec("INSERT INTO recorrido VALUES(90,1,'Vacío','Ida','A','B',1)");
  assert.deepEqual(
    (await call("GET", "/red/recorridos/90/paraderos")).data.paraderos,
    [],
  );
  db.exec("DELETE FROM recorrido WHERE id=90");
});
test("RF08 rechaza códigos inválidos, inactivos y sin servicio", async () => {
  for (const [code, status] of [
    ["!", 400],
    ["BUS999", 404],
    ["BUS003", 404],
    ["BUS004", 404],
  ])
    assert.equal(
      (
        await call(
          "POST",
          "/viaje/vincular",
          { codigo_vehiculo: code },
          tokens.a,
        )
      ).status,
      status,
    );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM vinculo_viaje").get().n, 0);
});
test("RF08 crea vínculo persistente, idempotente y no permite cambiarlo", async () => {
  const first = await call(
    "POST",
    "/viaje/vincular",
    { codigo_vehiculo: " bus001 " },
    tokens.a,
  );
  assert.equal(first.status, 201);
  assert.equal(first.data.vinculo.servicio_id, 1);
  assert.equal(first.data.vinculo.linea, "L01");
  const second = await call(
    "POST",
    "/viaje/vincular",
    { codigo_vehiculo: "BUS001" },
    tokens.a,
  );
  assert.equal(second.status, 200);
  assert.equal(second.data.vinculo.id, first.data.vinculo.id);
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/vincular",
        { codigo_vehiculo: "BUS002" },
        tokens.a,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("GET", "/viaje/actual", undefined, tokens.a)).data.vinculo.id,
    first.data.vinculo.id,
  );
});
test("RF09 sin vínculo, destino pasado/ajeno y clave inválida no insertan", async () => {
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/solicitudes",
        { destino_id: 3, clave_idempotencia: "prueba-sin-vinculo-123" },
        tokens.b,
      )
    ).status,
    409,
  );
  for (const destino_id of [1, 4, 999])
    assert.equal(
      (
        await call(
          "POST",
          "/viaje/solicitudes",
          { destino_id, clave_idempotencia: "prueba-destino-invalido" },
          tokens.a,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/solicitudes",
        { destino_id: 3, clave_idempotencia: "corta" },
        tokens.a,
      )
    ).status,
    400,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM solicitud_parada").get().n,
    0,
  );
});
let receipt;
test("RF09 doble toque/reintento concurrente confirma una sola solicitud", async () => {
  const body = { destino_id: 3, clave_idempotencia: "prueba-concurrencia-123" };
  const results = await Promise.all([
    call("POST", "/viaje/solicitudes", body, tokens.a),
    call("POST", "/viaje/solicitudes", body, tokens.a),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 201]);
  receipt = results[0].data.solicitud;
  assert.equal(results[1].data.solicitud.id, receipt.id);
  assert.equal(receipt.estado, "pendiente");
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM solicitud_parada").get().n,
    1,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM evento_solicitud").get().n,
    1,
  );
});
test("RF09 una segunda clave o reutilizar clave con otro destino devuelve conflicto", async () => {
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/solicitudes",
        { destino_id: 2, clave_idempotencia: "prueba-concurrencia-123" },
        tokens.a,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/solicitudes",
        { destino_id: 3, clave_idempotencia: "otra-solicitud-activa-123" },
        tokens.a,
      )
    ).status,
    409,
  );
});
test("RF09 una respuesta perdida se recupera incluso si el vehículo ya pasó el destino", async () => {
  db.exec("UPDATE servicio SET ultima_posicion=3 WHERE id=1");
  const retry = await call(
    "POST",
    "/viaje/solicitudes",
    { destino_id: 3, clave_idempotencia: "prueba-concurrencia-123" },
    tokens.a,
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.data.solicitud.id, receipt.id);
  db.exec("UPDATE servicio SET ultima_posicion=1 WHERE id=1");
});
test("RF10 comprobante propio persiste, otra cuenta no lo puede consultar", async () => {
  const own = await call(
    "GET",
    `/viaje/solicitudes/${receipt.id}`,
    undefined,
    tokens.a,
  );
  assert.equal(own.status, 200);
  assert.equal(own.data.solicitud.paradero, "Terminal");
  assert.equal(
    (await call("GET", `/viaje/solicitudes/${receipt.id}`, undefined, tokens.b))
      .status,
    404,
  );
  assert.equal(
    (await call("GET", "/viaje/solicitudes/999", undefined, tokens.a)).status,
    404,
  );
});
test("RF10 consulta estados persistidos sin modificarlos, también con vínculo cerrado", async () => {
  for (const estado of [
    "reconocida",
    "atendida",
    "cancelada",
    "expirada",
    "pendiente",
  ]) {
    db.prepare(
      "UPDATE solicitud_parada SET estado=?,actualizada_en=? WHERE id=?",
    ).run(estado, "2026-11-11T12:00:00.000Z", receipt.id);
    const response = await call(
      "GET",
      `/viaje/solicitudes/${receipt.id}`,
      undefined,
      tokens.a,
    );
    assert.equal(response.data.solicitud.estado, estado);
    assert.equal(
      response.data.solicitud.actualizada_en,
      "2026-11-11T12:00:00.000Z",
    );
  }
  db.exec("UPDATE vinculo_viaje SET estado='cerrado' WHERE pasajero_id=1");
  assert.equal(
    (await call("GET", `/viaje/solicitudes/${receipt.id}`, undefined, tokens.a))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/solicitudes",
        { destino_id: 3, clave_idempotencia: "vinculo-cerrado-intento" },
        tokens.a,
      )
    ).status,
    409,
  );
  db.exec("UPDATE vinculo_viaje SET estado='activo' WHERE pasajero_id=1");
});
test("RF14 muestra mismo ID, agrupa por destino y omite datos personales", async () => {
  await call(
    "POST",
    "/viaje/vincular",
    { codigo_vehiculo: "BUS001" },
    tokens.b,
  );
  const other = await call(
    "POST",
    "/viaje/solicitudes",
    { destino_id: 3, clave_idempotencia: "segundo-pasajero-intento" },
    tokens.b,
  );
  assert.equal(other.status, 201);
  const inbox = await call(
    "GET",
    "/conductor/servicio/solicitudes",
    undefined,
    tokens.d,
  );
  assert.equal(inbox.data.solicitudes.length, 2);
  assert.equal(inbox.data.solicitudes[0].id, receipt.id);
  assert.equal(inbox.data.paraderos[0].cantidad, 2);
  assert.ok(!JSON.stringify(inbox.data).includes("correo"));
  assert.ok(!JSON.stringify(inbox.data).includes("pasajero"));
  assert.ok(!JSON.stringify(inbox.data).includes("hash"));
});
test("RF14 limita servicio, maneja ausencia y lectura no reconoce solicitudes", async () => {
  assert.equal(
    (
      await call(
        "GET",
        "/conductor/servicio/solicitudes?servicio_id=1",
        undefined,
        tokens.d2,
      )
    ).status,
    403,
  );
  assert.deepEqual(
    (await call("GET", "/conductor/servicio/solicitudes", undefined, tokens.d2))
      .data.solicitudes,
    [],
  );
  assert.equal(
    (
      await call(
        "GET",
        "/conductor/servicio/solicitudes",
        undefined,
        tokens.none,
      )
    ).data.servicio,
    null,
  );
  assert.equal(
    db.prepare("SELECT estado FROM solicitud_parada WHERE id=?").get(receipt.id)
      .estado,
    "pendiente",
  );
});
test("RF14 excluye estados finales y cuenta reconocida una vez", async () => {
  for (const estado of ["atendida", "cancelada", "expirada", "reconocida"]) {
    db.prepare("UPDATE solicitud_parada SET estado=? WHERE id=?").run(
      estado,
      receipt.id,
    );
    const inbox = (
      await call("GET", "/conductor/servicio/solicitudes", undefined, tokens.d)
    ).data;
    assert.equal(inbox.solicitudes.length, estado === "reconocida" ? 2 : 1);
    assert.equal(inbox.paraderos[0].cantidad, estado === "reconocida" ? 2 : 1);
  }
});
test("RF09 rechaza servicio finalizado sin escrituras parciales", async () => {
  db.exec(
    "UPDATE solicitud_parada SET estado='expirada';UPDATE servicio SET estado='finalizado' WHERE id=1",
  );
  const count = db.prepare("SELECT COUNT(*) n FROM solicitud_parada").get().n;
  assert.equal(
    (
      await call(
        "POST",
        "/viaje/solicitudes",
        { destino_id: 3, clave_idempotencia: "servicio-finalizado-intento" },
        tokens.a,
      )
    ).status,
    409,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM solicitud_parada").get().n,
    count,
  );
  db.exec("UPDATE servicio SET estado='activo' WHERE id=1");
});
test("Base de datos aplica FK y unicidad de servicios y vínculos", () => {
  assert.throws(
    () =>
      db.exec("INSERT INTO servicio VALUES(90,1,7,1,'activo',1,'fecha',NULL)"),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      db.exec("INSERT INTO vinculo_viaje VALUES(90,1,2,'activo','fecha',NULL)"),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO vinculo_viaje VALUES(91,9999,2,'activo','fecha',NULL)",
      ),
    /FOREIGN KEY/,
  );
});
test("Errores HTTP comprensibles, JSON inválido y orígenes no permitidos", async () => {
  assert.equal((await call("GET", "/no-existe")).status, 404);
  assert.equal(
    (
      await call("GET", "/health", undefined, undefined, {
        Origin: "https://ajeno.example",
      })
    ).status,
    403,
  );
  const response = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.codigo, "JSON_INVALIDO");
});
test("Reinicio real del backend conserva cuentas, vínculos y comprobantes", async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  db = openDatabase(path.join(temp, "test.db"));
  migrate(db);
  server = createApp(db, config).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  assert.equal(
    (
      await call("POST", "/auth/login", {
        correo: "nuevo@example.test",
        contrasena: "UnaClave2026!",
      })
    ).status,
    200,
  );
  const current = await call("GET", "/viaje/actual", undefined, tokens.a);
  assert.equal(current.data.vinculo.servicio_id, 1);
  assert.equal(current.data.solicitud.id, receipt.id);
  assert.equal(
    (await call("GET", `/viaje/solicitudes/${receipt.id}`, undefined, tokens.a))
      .status,
    200,
  );
});
