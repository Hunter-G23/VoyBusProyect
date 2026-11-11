const { fail, positiveId } = require("../utils/errors");
function redService(db) {
  return {
    lines: () =>
      db
        .prepare(
          "SELECT id,codigo,nombre FROM linea WHERE activa=1 ORDER BY codigo",
        )
        .all(), // RF04
    routes(value) {
      // RF05
      const id = positiveId(value);
      const linea = db
        .prepare("SELECT id,codigo,nombre FROM linea WHERE id=? AND activa=1")
        .get(id);
      if (!linea)
        fail(404, "LINEA_NO_DISPONIBLE", "Esta línea no está disponible.");
      return {
        linea,
        recorridos: db
          .prepare(
            "SELECT id,nombre,sentido,origen,destino FROM recorrido WHERE linea_id=? AND activo=1 ORDER BY id",
          )
          .all(id),
      };
    },
    stops(value) {
      // RF06
      const id = positiveId(value);
      const recorrido = db
        .prepare(
          `SELECT r.id,r.nombre,r.sentido,r.origen,r.destino,l.codigo AS linea FROM recorrido r
        JOIN linea l ON l.id=r.linea_id WHERE r.id=? AND r.activo=1 AND l.activa=1`,
        )
        .get(id);
      if (!recorrido)
        fail(
          404,
          "RECORRIDO_NO_DISPONIBLE",
          "Este recorrido no está disponible.",
        );
      return {
        recorrido,
        paraderos: db
          .prepare(
            `SELECT rp.id,rp.paradero_id,rp.posicion,p.codigo,p.nombre,p.latitud,p.longitud
        FROM recorrido_paradero rp JOIN paradero p ON p.id=rp.paradero_id WHERE rp.recorrido_id=? ORDER BY rp.posicion`,
          )
          .all(id),
      };
    },
  };
}
module.exports = { redService };
