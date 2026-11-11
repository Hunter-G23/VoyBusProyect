const bcrypt = require("bcryptjs");
const { transaction, openDatabase, migrate } = require("./db");
const demoPassword = "VoyBusDemo2026!";
function seed(db) {
  const hash = bcrypt.hashSync(demoPassword, 12);
  const now = new Date().toISOString();
  transaction(db, () => {
    const user = db.prepare(
      "INSERT OR IGNORE INTO usuario(id,nombre,correo,password_hash,rol,activo,creado_en) VALUES(?,?,?,?,?,?,?)",
    );
    [
      [1, "Pasajero Demo", "pasajero@example.test", "pasajero", 1],
      [2, "Pasajera Demo", "pasajera@example.test", "pasajero", 1],
      [3, "Pasajero Inactivo", "inactivo@example.test", "pasajero", 0],
      [4, "Conductor Centro", "conductor@example.test", "conductor", 1],
      [5, "Conductor Norte", "conductor2@example.test", "conductor", 1],
      [6, "Administrador Demo", "admin@example.test", "administrador", 1],
      [7, "Conductor Sin Servicio", "sinservicio@example.test", "conductor", 1],
    ].forEach(([id, nombre, correo, rol, activo]) =>
      user.run(id, nombre, correo, hash, rol, activo, now),
    );
    db.exec(`INSERT OR IGNORE INTO linea VALUES (1,'L01','Centro y terminal',1),(2,'L02','Sector norte',1),(3,'L03','Servicio suspendido',0);
      INSERT OR IGNORE INTO recorrido VALUES
      (1,1,'Centro a terminal','Ida','Inicio','Terminal',1), (2,1,'Terminal a centro','Vuelta','Terminal','Inicio',1),
      (3,2,'Recorrido norte','Ida','Norte','Estación',1);
      INSERT OR IGNORE INTO paradero VALUES
      (1,'P01','Inicio',-23.65,-70.40,1),(2,'P02','Centro',-23.64,-70.39,1),
      (3,'P03','Terminal',-23.63,-70.38,1),(4,'P04','Retorno',-23.64,-70.41,1);
      INSERT OR IGNORE INTO recorrido_paradero VALUES
      (1,1,1,1),(2,1,2,2),(3,1,3,3),(4,2,3,1),(5,2,4,2),(6,2,1,3),(7,3,4,1),(8,3,2,2);
      INSERT OR IGNORE INTO vehiculo VALUES
      (1,'DEMO01','BUS001',1),(2,'DEMO02','BUS002',1),(3,'DEMO03','BUS003',0),(4,'DEMO04','BUS004',1);`);
    const service = db.prepare(
      "INSERT OR IGNORE INTO servicio(id,vehiculo_id,conductor_id,recorrido_id,estado,ultima_posicion,inicio) VALUES(?,?,?,?,'activo',1,?)",
    );
    service.run(1, 1, 4, 1, now);
    service.run(2, 2, 5, 3, now);
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
