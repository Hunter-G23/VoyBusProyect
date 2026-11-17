const { transaction } = require("../database/db");

function simuladorService(db, repo, now) {
  let paso = 0;
  let timer;

  function step() {
    const medidaEn = now().toISOString();
    transaction(db, () => {
      for (const servicio of repo.activeVehicles()) {
        const paraderos = repo.routeStops(servicio.recorrido_id);
        if (!paraderos.length) continue;
        // Cada tramo toma seis pasos (30 s); en los extremos se invierte el avance.
        const ultimo = paraderos.length - 1;
        const ciclo = ultimo ? (paso / 6) % (2 * ultimo) : 0;
        const avance = ciclo <= ultimo ? ciclo : 2 * ultimo - ciclo;
        const indice = Math.floor(avance);
        const origen = paraderos[indice];
        const destino = paraderos[Math.min(indice + 1, ultimo)];
        const fraccion = avance - indice;
        repo.addPosition(
          servicio.servicio_id,
          origen.latitud + (destino.latitud - origen.latitud) * fraccion,
          origen.longitud + (destino.longitud - origen.longitud) * fraccion,
          medidaEn,
        );
      }
    });
    paso += 1;
  }

  return {
    step,
    start() {
      if (!timer) timer = setInterval(step, 5000);
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}

module.exports = { simuladorService };
