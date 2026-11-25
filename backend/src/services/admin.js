const { transaction } = require("../database/db");
const { fail, positiveId } = require("../utils/errors");
const { lineColumns, publishLine } = require("./lineState");

function adminService(db, visibleLines) {
  return {
    state(adminId, value, body) {
      const id = positiveId(value);
      const mode = body.modo_estado === undefined ? "manual" : body.modo_estado;
      if (
        (mode === "auto" && body.estado !== undefined) ||
        (mode === "manual" &&
          !["activa", "inactiva", "temporal"].includes(body.estado)) ||
        !["auto", "manual"].includes(mode)
      )
        fail(
          400,
          "ESTADO_INVALIDO",
          "Elige modo automático o un estado manual válido.",
        );
      return transaction(db, () => {
        const line = db.prepare(`SELECT ${lineColumns} FROM linea WHERE id=?`);
        const previous = line.get(id);
        if (!previous)
          fail(404, "LINEA_NO_DISPONIBLE", "Esta línea no está disponible.");
        const visible = visibleLines();
        const oldPublished = publishLine(previous, visible);
        const savedState = mode === "manual" ? body.estado : previous.estado;
        db.prepare("UPDATE linea SET estado=?,modo_estado=? WHERE id=?").run(
          savedState,
          mode,
          id,
        );
        const published = publishLine(
          line.get(id),
          mode === "auto" ? visibleLines() : visible,
        );
        if (
          previous.modo_estado !== mode ||
          oldPublished.estado !== published.estado
        )
          db.prepare(
            "INSERT INTO linea_estado_evento(linea_id,estado_anterior,estado_nuevo,admin_id,fecha,modo_anterior,modo_nuevo) VALUES(?,?,?,?,?,?,?)",
          ).run(
            id,
            oldPublished.estado,
            published.estado,
            adminId,
            new Date().toISOString(),
            previous.modo_estado,
            mode,
          );
        return published;
      });
    },
    // GET /api/admin/lineas/eventos: latest change per line, NOT full history.
    // Optional linea_id narrows to that line's latest change (zero or one).
    // admin_id/admin_nombre and fecha identify who made the last change and when.
    events(value) {
      const sql = `SELECT e.id,e.linea_id,e.estado_anterior,e.estado_nuevo,e.modo_anterior,e.modo_nuevo,e.admin_id,e.fecha,u.nombre AS admin_nombre
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
