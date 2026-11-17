const { transaction } = require("../database/db");
const { fail, positiveId } = require("../utils/errors");

function adminService(db) {
  return {
    state(adminId, value, body) {
      const id = positiveId(value);
      if (!["activa", "inactiva", "temporal"].includes(body.estado))
        fail(400, "ESTADO_INVALIDO", "Elige activa, inactiva o temporal.");
      return transaction(db, () => {
        const previous = db
          .prepare("SELECT estado FROM linea WHERE id=?")
          .get(id);
        if (!previous)
          fail(404, "LINEA_NO_DISPONIBLE", "Esta línea no está disponible.");
        db.prepare("UPDATE linea SET estado=?,activa=? WHERE id=?").run(
          body.estado,
          Number(body.estado === "activa"),
          id,
        );
        if (previous.estado !== body.estado)
          db.prepare(
            "INSERT INTO linea_estado_evento(linea_id,estado_anterior,estado_nuevo,admin_id,fecha) VALUES(?,?,?,?,?)",
          ).run(
            id,
            previous.estado,
            body.estado,
            adminId,
            new Date().toISOString(),
          );
        return db
          .prepare(
            "SELECT id,codigo,nombre,color,color_texto,electrica,estado,fuente FROM linea WHERE id=?",
          )
          .get(id);
      });
    },
    events(value) {
      const sql = `SELECT e.id,e.linea_id,e.estado_anterior,e.estado_nuevo,e.admin_id,e.fecha,u.nombre AS admin_nombre
        FROM linea_estado_evento e JOIN usuario u ON u.id=e.admin_id`;
      return value === undefined
        ? db
            .prepare(
              sql +
                " WHERE e.id=(SELECT MAX(id) FROM linea_estado_evento WHERE linea_id=e.linea_id) ORDER BY e.id DESC",
            )
            .all()
        : db
            .prepare(sql + " WHERE e.linea_id=? ORDER BY e.id DESC LIMIT 1")
            .all(positiveId(value));
    },
  };
}
module.exports = { adminService };
