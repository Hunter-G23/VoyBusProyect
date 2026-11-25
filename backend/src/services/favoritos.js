const { transaction } = require("../database/db");
const { fail, positiveId } = require("../utils/errors");
const { lineColumns, publishLine } = require("./lineState");

function favoritosService(db, visibleLines) {
  function list(userId) {
    const visible = visibleLines();
    const line = db.prepare(`SELECT ${lineColumns} FROM linea WHERE id=?`);
    return db
      .prepare(
        "SELECT id,linea_id,recorrido_id,creado_en FROM favorito WHERE usuario_id=? ORDER BY id",
      )
      .all(userId)
      .map((f) => ({
        id: f.id,
        linea: publishLine(line.get(f.linea_id), visible),
        recorrido:
          f.recorrido_id === null
            ? null
            : db
                .prepare(
                  "SELECT id,codigo,nombre,sentido,origen,destino,variante FROM recorrido WHERE id=?",
                )
                .get(f.recorrido_id),
        creado_en: f.creado_en,
      }));
  }
  return {
    list,
    create(userId, body) {
      const linea = positiveId(body.linea_id);
      const recorrido =
        body.recorrido_id == null ? null : positiveId(body.recorrido_id);
      return transaction(db, () => {
        if (!db.prepare("SELECT id FROM linea WHERE id=?").get(linea))
          fail(404, "LINEA_NO_DISPONIBLE", "Esta línea no está disponible.");
        if (
          recorrido !== null &&
          !db
            .prepare("SELECT id FROM recorrido WHERE id=? AND linea_id=?")
            .get(recorrido, linea)
        )
          fail(
            400,
            "RECORRIDO_INVALIDO",
            "El recorrido no pertenece a esta línea.",
          );
        const result = db
          .prepare(
            "INSERT OR IGNORE INTO favorito(usuario_id,linea_id,recorrido_id,creado_en) VALUES(?,?,?,?)",
          )
          .run(userId, linea, recorrido, new Date().toISOString());
        const favorito = list(userId).find(
          (f) =>
            f.linea.id === linea && (f.recorrido?.id ?? null) === recorrido,
        );
        return { favorito, creado: Boolean(result.changes) };
      });
    },
    remove(userId, value) {
      const result = db
        .prepare("DELETE FROM favorito WHERE id=? AND usuario_id=?")
        .run(positiveId(value), userId);
      if (!result.changes)
        fail(404, "FAVORITO_NO_DISPONIBLE", "No encontramos ese favorito.");
    },
  };
}
module.exports = { favoritosService };
