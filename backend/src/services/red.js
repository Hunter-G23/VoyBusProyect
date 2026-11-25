const { fail, positiveId } = require("../utils/errors");
const { lineColumns, hasMapPosition, publishLine } = require("./lineState");
const { FRESHNESS_MS } = require("./mapTraffic");
function redService(db, traffic, visibleLines, config, now) {
  function lines(todas = false) {
    const visible = visibleLines();
    return db
      .prepare(`SELECT ${lineColumns} FROM linea ORDER BY codigo`)
      .all()
      .map((line) => publishLine(line, visible))
      .filter((line) => todas || line.estado === "activa"); // RF04
  }

  return {
    lines,
    map() {
      return traffic.map(lines(true));
    },
    arrivals(value) {
      return traffic.arrivals(value, now());
    },
    vehicles() {
      // RF07
      const fecha = now();
      const vehiculos = traffic.vehicles(fecha);
      const posiciones = vehiculos.filter(hasMapPosition);
      return {
        fuente: (
          posiciones.length
            ? posiciones.some((v) => v.origen === "simulacion")
            : config.simularGps
        )
          ? "simulacion"
          : "gps",
        generado_en: fecha.toISOString(),
        vehiculos: vehiculos.map((v) => ({
          servicio_id: v.servicio_id,
          vehiculo: v.vehiculo,
          linea: v.linea,
          recorrido_id: v.recorrido_id,
          sentido: v.sentido,
          ...(v.simulado ? { simulado: true } : {}),
          proximo_paradero_id: traffic.nextStop(v, fecha),
          posicion: !hasMapPosition(v)
            ? null
            : {
                latitud: v.latitud,
                longitud: v.longitud,
                medida_en: v.medida_en,
                desactualizada: fecha - Date.parse(v.medida_en) > FRESHNESS_MS,
              },
        })),
      };
    },
    routes(value) {
      // RF05
      const id = positiveId(value);
      const linea = db
        .prepare(
          `SELECT ${lineColumns} FROM linea WHERE id=? AND (activa=1 OR modo_estado='auto')`,
        )
        .get(id);
      if (!linea)
        fail(404, "LINEA_NO_DISPONIBLE", "Esta línea no está disponible.");
      return {
        linea: publishLine(linea, visibleLines()),
        recorridos: db
          .prepare(
            "SELECT id,nombre,sentido,origen,destino,codigo,variante FROM recorrido WHERE linea_id=? AND activo=1 ORDER BY id",
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
        JOIN linea l ON l.id=r.linea_id WHERE r.id=? AND r.activo=1 AND (l.activa=1 OR l.modo_estado='auto')`,
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
