function repository(db) {
  return {
    userById: (id) =>
      db
        .prepare("SELECT id,nombre,correo,rol,activo FROM usuario WHERE id=?")
        .get(id),
    userByEmail: (correo) =>
      db.prepare("SELECT * FROM usuario WHERE correo=?").get(correo),
    activeLink: (userId) =>
      db
        .prepare(
          `SELECT v.*,s.recorrido_id,s.ultima_posicion,s.estado AS servicio_estado,
      ve.codigo_vinculacion,ve.patente,r.nombre AS recorrido,r.sentido,l.codigo AS linea
      FROM vinculo_viaje v JOIN servicio s ON s.id=v.servicio_id JOIN vehiculo ve ON ve.id=s.vehiculo_id
      JOIN recorrido r ON r.id=s.recorrido_id JOIN linea l ON l.id=r.linea_id
      WHERE v.pasajero_id=? AND v.estado='activo'`,
        )
        .get(userId),
    activeRequest: (linkId) =>
      db
        .prepare(
          "SELECT id FROM solicitud_parada WHERE vinculo_id=? AND estado IN ('pendiente','reconocida')",
        )
        .get(linkId),
    request: (id, userId) =>
      db
        .prepare(
          `SELECT s.id,s.estado,s.creada_en,s.actualizada_en,s.destino_id,s.clave_idempotencia,
      p.codigo AS paradero_codigo,p.nombre AS paradero,rp.posicion,v.servicio_id,ve.codigo_vinculacion,l.codigo AS linea,r.sentido
      FROM solicitud_parada s JOIN vinculo_viaje v ON v.id=s.vinculo_id
      JOIN recorrido_paradero rp ON rp.id=s.destino_id JOIN paradero p ON p.id=rp.paradero_id
      JOIN servicio se ON se.id=v.servicio_id JOIN vehiculo ve ON ve.id=se.vehiculo_id
      JOIN recorrido r ON r.id=se.recorrido_id JOIN linea l ON l.id=r.linea_id
      WHERE s.id=? AND v.pasajero_id=?`,
        )
        .get(id, userId),
  };
}
module.exports = { repository };
