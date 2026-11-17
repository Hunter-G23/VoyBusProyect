const bcrypt = require("bcryptjs");
const password = "FixturePassword2026!";
const hash = bcrypt.hashSync(password, 12);

function fixtures(db) {
  const user = db.prepare(
    "INSERT INTO usuario(id,nombre,correo,password_hash,rol,activo,creado_en) VALUES(?,?,?,?,?,?,?)",
  );
  [
    [1, "Passenger A", "pasajero@example.test", "pasajero", 1],
    [2, "Passenger B", "pasajera@example.test", "pasajero", 1],
    [3, "Inactive", "inactivo@example.test", "pasajero", 0],
    [4, "Driver A", "conductor@example.test", "conductor", 1],
    [5, "Driver B", "conductor2@example.test", "conductor", 1],
    [6, "Administrator", "admin@example.test", "administrador", 1],
    [7, "Unassigned Driver", "sinservicio@example.test", "conductor", 1],
  ].forEach(([id, nombre, correo, rol, activo]) =>
    user.run(id, nombre, correo, hash, rol, activo, "2026-11-17T12:00:00.000Z"),
  );
  db.exec(`INSERT INTO linea(id,codigo,nombre,activa) VALUES
    (1,'T01','Test center',1),(2,'T02','Test north',1),(3,'T03','Test suspended',0);
    INSERT INTO recorrido(id,linea_id,nombre,sentido,origen,destino,activo) VALUES
    (1,1,'Test outbound','Ida','Inicio','Terminal',1),
    (2,1,'Test inbound','Vuelta','Terminal','Inicio',1),(3,2,'Test north','Ida','Norte','Estación',1);
    INSERT INTO paradero VALUES
    (1,'TP01','Inicio',-23.65,-70.40,1),(2,'TP02','Centro',-23.64,-70.39,1),
    (3,'TP03','Terminal',-23.63,-70.38,1),(4,'TP04','Retorno',-23.64,-70.41,1);
    INSERT INTO recorrido_paradero VALUES
    (1,1,1,1),(2,1,2,2),(3,1,3,3),(4,2,3,1),(5,2,4,2),(6,2,1,3),(7,3,4,1),(8,3,2,2);
    INSERT INTO vehiculo VALUES
    (1,'TEST01','TEST01',1),(2,'TEST02','TEST02',1),(3,'TEST03','TEST03',0),(4,'TEST04','TEST04',1);
    INSERT INTO servicio(id,vehiculo_id,conductor_id,recorrido_id,estado,ultima_posicion,inicio) VALUES
    (1,1,4,1,'activo',1,'2026-11-17T12:00:00.000Z'),(2,2,5,3,'activo',1,'2026-11-17T12:00:00.000Z');`);
}
module.exports = { fixtures, password };
