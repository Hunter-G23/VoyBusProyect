const lineColumns =
  "id,codigo,nombre,color,color_texto,electrica,estado,fuente,modo_estado";

function hasMapPosition(vehicle) {
  return (
    vehicle.medida_en !== null &&
    Number.isFinite(vehicle.latitud) &&
    Math.abs(vehicle.latitud) <= 90 &&
    Number.isFinite(vehicle.longitud) &&
    Math.abs(vehicle.longitud) <= 180
  );
}

function visibleLines(vehicles) {
  return new Set(
    vehicles
      .filter(hasMapPosition)
      .map((vehicle) => vehicle.linea),
  );
}

function publishLine(line, visible) {
  if (line.modo_estado === "manual") return line;
  return { ...line, estado: visible.has(line.codigo) ? "activa" : "inactiva" };
}

module.exports = { lineColumns, hasMapPosition, visibleLines, publishLine };
