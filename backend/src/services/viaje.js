const { transaction } = require("../database/db");
const { fail, positiveId } = require("../utils/errors");
function viajeService(db, repo) {
  return {
    current(userId) {
      const vinculo = repo.activeLink(userId) || null;
      const solicitud = vinculo
        ? db
            .prepare(
              "SELECT id FROM solicitud_parada WHERE vinculo_id=? ORDER BY id DESC LIMIT 1",
            )
            .get(vinculo.id)
        : null;
      return {
        vinculo,
        solicitud: solicitud ? repo.request(solicitud.id, userId) : null,
      };
    },
    link(userId, body) {
      // RF08
      const codigo =
        typeof body.codigo_vehiculo === "string"
          ? body.codigo_vehiculo.trim().toUpperCase()
          : "";
      if (!/^[A-Z0-9]{4,12}$/.test(codigo))
        fail(
          400,
          "CODIGO_INVALIDO",
          "Escribe un código de 4 a 12 letras o números.",
          { codigo_vehiculo: "Por ejemplo, BUS001." },
        );
      return transaction(db, () => {
        const servicio = db
          .prepare(
            `SELECT s.id FROM servicio s JOIN vehiculo v ON v.id=s.vehiculo_id
          JOIN recorrido r ON r.id=s.recorrido_id JOIN linea l ON l.id=r.linea_id
          JOIN usuario u ON u.id=s.conductor_id
          WHERE v.codigo_vinculacion=? AND v.activo=1 AND s.estado='activo' AND r.activo=1 AND l.activa=1 AND u.activo=1 AND u.rol='conductor'`,
          )
          .get(codigo);
        if (!servicio)
          fail(
            404,
            "VEHICULO_NO_DISPONIBLE",
            "No encontramos un servicio activo para ese código.",
          );
        const active = repo.activeLink(userId);
        if (active) {
          if (active.servicio_id !== servicio.id)
            fail(
              409,
              "VINCULO_EXISTENTE",
              "Ya estás vinculado a otro vehículo.",
            );
          return { vinculo: active, creado: false };
        }
        db.prepare(
          "INSERT INTO vinculo_viaje(pasajero_id,servicio_id,estado,inicio) VALUES(?,?,'activo',?)",
        ).run(userId, servicio.id, new Date().toISOString());
        return { vinculo: repo.activeLink(userId), creado: true };
      });
    },
    createRequest(userId, body) {
      // RF09
      const destino = positiveId(body.destino_id);
      const clave = body.clave_idempotencia;
      if (typeof clave !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(clave))
        fail(400, "CLAVE_INVALIDA", "La clave de reintento no es válida.");
      return transaction(db, () => {
        const link = repo.activeLink(userId);
        if (!link)
          fail(
            409,
            "SIN_VINCULO",
            "Vincúlate a un vehículo antes de solicitar una parada.",
          );
        // Recover the original receipt before checking mutable service/position state.
        const previous = db
          .prepare(
            "SELECT id,destino_id FROM solicitud_parada WHERE vinculo_id=? AND clave_idempotencia=?",
          )
          .get(link.id, clave);
        if (previous) {
          if (previous.destino_id !== destino)
            fail(
              409,
              "REINTENTO_DIFERENTE",
              "Este intento ya se usó para otro destino.",
            );
          return {
            solicitud: repo.request(previous.id, userId),
            creada: false,
          };
        }
        if (link.servicio_estado !== "activo")
          fail(409, "SERVICIO_FINALIZADO", "El servicio ya finalizó.");
        const stop = db
          .prepare(
            "SELECT rp.* FROM recorrido_paradero rp JOIN paradero p ON p.id=rp.paradero_id WHERE rp.id=? AND p.activo=1",
          )
          .get(destino);
        if (
          !stop ||
          stop.recorrido_id !== link.recorrido_id ||
          stop.posicion <= link.ultima_posicion
        )
          fail(
            400,
            "DESTINO_INVALIDO",
            "Elige un paradero que aún no haya pasado en este recorrido.",
          );
        if (repo.activeRequest(link.id))
          fail(
            409,
            "SOLICITUD_ACTIVA",
            "Ya tienes una solicitud activa. Consulta su seguimiento.",
          );
        const now = new Date().toISOString();
        const result = db
          .prepare(
            "INSERT INTO solicitud_parada(vinculo_id,destino_id,clave_idempotencia,estado,creada_en,actualizada_en) VALUES(?,?,?,'pendiente',?,?)",
          )
          .run(link.id, destino, clave, now, now);
        db.prepare(
          "INSERT INTO evento_solicitud(solicitud_id,actor_id,estado_nuevo,fecha) VALUES(?,?,'pendiente',?)",
        ).run(result.lastInsertRowid, userId, now);
        return {
          solicitud: repo.request(Number(result.lastInsertRowid), userId),
          creada: true,
        };
      });
    },
    getRequest(userId, value) {
      // RF10
      const result = repo.request(positiveId(value), userId);
      if (!result)
        fail(404, "SOLICITUD_NO_DISPONIBLE", "No encontramos esa solicitud.");
      return result;
    },
  };
}
module.exports = { viajeService };
