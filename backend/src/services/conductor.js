const { fail, positiveId } = require("../utils/errors");
function conductorService(db) {
  return {
    inbox(userId, requestedService) {
      // RF14
      const servicio = db
        .prepare(
          `SELECT s.id,s.recorrido_id,s.ultima_posicion,v.codigo_vinculacion,v.patente,r.nombre AS recorrido,r.sentido,l.codigo AS linea
        FROM servicio s JOIN vehiculo v ON v.id=s.vehiculo_id JOIN recorrido r ON r.id=s.recorrido_id JOIN linea l ON l.id=r.linea_id
        WHERE s.conductor_id=? AND s.estado='activo'`,
        )
        .get(userId);
      if (
        requestedService !== undefined &&
        (!servicio || positiveId(requestedService) !== servicio.id)
      )
        fail(
          403,
          "SERVICIO_AJENO",
          "Solo puedes consultar tu servicio asignado.",
        );
      if (!servicio) return { servicio: null, solicitudes: [], paraderos: [] };
      const solicitudes = db
        .prepare(
          `SELECT s.id,s.estado,s.creada_en,s.actualizada_en,s.destino_id,rp.posicion,p.codigo AS paradero_codigo,p.nombre AS paradero
        FROM solicitud_parada s JOIN vinculo_viaje v ON v.id=s.vinculo_id JOIN recorrido_paradero rp ON rp.id=s.destino_id
        JOIN paradero p ON p.id=rp.paradero_id WHERE v.servicio_id=? AND s.estado IN ('pendiente','reconocida') ORDER BY rp.posicion,s.creada_en,s.id`,
        )
        .all(servicio.id);
      const groups = new Map();
      for (const s of solicitudes) {
        if (!groups.has(s.destino_id))
          groups.set(s.destino_id, {
            destino_id: s.destino_id,
            posicion: s.posicion,
            codigo: s.paradero_codigo,
            nombre: s.paradero,
            cantidad: 0,
          });
        groups.get(s.destino_id).cantidad++;
      }
      return { servicio, solicitudes, paraderos: [...groups.values()] };
    },
  };
}
module.exports = { conductorService };
