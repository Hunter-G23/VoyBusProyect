const bcrypt = require("bcryptjs");
const { transaction, openDatabase, migrate } = require("./db");
const demoPassword = "VoyBusDemo2026!";
function seed(db) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Los datos ficticios no deben cargarse en producción.");
  const data = require("./data/antofagasta.json");
  const hash = bcrypt.hashSync(demoPassword, 12);
  const now = new Date().toISOString();
  transaction(db, () => {
    const user = db.prepare(
      "INSERT OR IGNORE INTO usuario(nombre,correo,password_hash,rol,activo,creado_en) VALUES(?,?,?,?,?,?)",
    );
    [
      ["Pasajero Demo", "pasajero@example.test", "pasajero", 1],
      ["Pasajera Demo", "pasajera@example.test", "pasajero", 1],
      ["Pasajero Inactivo", "inactivo@example.test", "pasajero", 0],
      ["Conductor Centro", "conductor@example.test", "conductor", 1],
      ["Conductor Norte", "conductor2@example.test", "conductor", 1],
      ["Administrador Demo", "admin@example.test", "administrador", 1],
      ["Conductor Sin Servicio", "sinservicio@example.test", "conductor", 1],
    ].forEach(([nombre, correo, rol, activo]) =>
      user.run(nombre, correo, hash, rol, activo, now),
    );
    const lines = new Map();
    for (const l of data.lineas) {
      db.prepare(
        `INSERT INTO linea(codigo,nombre,color,color_texto,electrica,estado,fuente) VALUES(?,?,?,?,?,'activa',?)
        ON CONFLICT(codigo) DO UPDATE SET nombre=excluded.nombre,color=excluded.color,
        color_texto=excluded.color_texto,electrica=excluded.electrica,fuente=excluded.fuente`,
      ).run(
        l.codigo,
        l.nombre,
        l.color,
        l.color_texto,
        l.electrica,
        data.fuente,
      );
      lines.set(
        l.codigo,
        db.prepare("SELECT id FROM linea WHERE codigo=?").get(l.codigo).id,
      );
    }
    const stops = new Map();
    for (const p of data.paraderos) {
      db.prepare(
        "INSERT OR IGNORE INTO paradero(codigo,nombre,latitud,longitud) VALUES(?,?,?,?)",
      ).run(p.codigo, p.nombre, p.latitud, p.longitud);
      stops.set(
        p.id,
        db.prepare("SELECT id FROM paradero WHERE codigo=?").get(p.codigo).id,
      );
    }
    const routes = new Map();
    for (const r of data.recorridos) {
      const lineId = lines.get(r.linea);
      let route = db
        .prepare(
          "SELECT id FROM recorrido WHERE linea_id=? AND codigo=? AND sentido=?",
        )
        .get(lineId, r.codigo, r.sentido);
      if (!route) {
        const result = db
          .prepare(
            "INSERT INTO recorrido(linea_id,codigo,nombre,sentido,origen,destino,variante) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            lineId,
            r.codigo,
            r.nombre,
            r.sentido,
            r.origen,
            r.destino,
            r.variante,
          );
        route = { id: Number(result.lastInsertRowid) };
      }
      routes.set(r.codigo + ":" + r.direction_id, route.id);
      r.paraderos.forEach((id, i) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO recorrido_paradero(recorrido_id,paradero_id,posicion) VALUES(?,?,?)",
          )
          .run(route.id, stops.get(id), i + 1),
      );
    }
    for (const [patente, codigo, activo] of [
      ["DEMO01", "BUS001", 1],
      ["DEMO02", "BUS002", 1],
      ["DEMO03", "BUS003", 0],
      ["DEMO04", "BUS004", 1],
    ])
      db.prepare(
        "INSERT OR IGNORE INTO vehiculo(patente,codigo_vinculacion,activo) VALUES(?,?,?)",
      ).run(patente, codigo, activo);
    for (const [code, email, routeId] of [
      ["BUS001", "conductor@example.test", routes.get("102:0")],
      ["BUS002", "conductor2@example.test", routes.get("103:0")],
    ]) {
      const vehicle = db
        .prepare("SELECT id FROM vehiculo WHERE codigo_vinculacion=?")
        .get(code);
      const driver = db
        .prepare("SELECT id FROM usuario WHERE correo=? AND rol='conductor'")
        .get(email);
      if (!vehicle || !driver)
        throw new Error("No se pudo preparar el servicio de demostración.");
      db.prepare(
        "INSERT OR IGNORE INTO servicio(vehiculo_id,conductor_id,recorrido_id,estado,ultima_posicion,inicio) VALUES(?,?,?,'activo',1,?)",
      ).run(vehicle.id, driver.id, routeId, now);
      // Upgrade an unused legacy demo service, never rewrite a passenger's trip history.
      db.prepare(
        `UPDATE servicio SET recorrido_id=?,ultima_posicion=1 WHERE vehiculo_id=? AND conductor_id=? AND estado='activo'
        AND recorrido_id IN (SELECT r.id FROM recorrido r JOIN linea l ON l.id=r.linea_id WHERE l.codigo IN ('L01','L02'))
        AND NOT EXISTS(SELECT 1 FROM vinculo_viaje WHERE servicio_id=servicio.id)`,
      ).run(routeId, vehicle.id, driver.id);
    }
  });
}
if (require.main === module) {
  const config = require("../config/env");
  if (config.production)
    throw new Error("Los datos ficticios no deben cargarse en producción.");
  const db = openDatabase(config.dbPath);
  try {
    migrate(db);
    seed(db);
    console.log(
      "Datos ficticios preparados. Contraseña local de demostración: " +
        demoPassword,
    );
  } finally {
    db.close();
  }
}
module.exports = { seed, demoPassword };
