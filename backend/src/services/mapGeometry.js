const METERS_PER_DEGREE = (Math.PI * 6371000) / 180;

function routeGeometry(coordinates) {
  const [originLon, originLat] = coordinates[0] ?? [0, 0];
  const metersPerLongitude =
    METERS_PER_DEGREE * Math.cos((originLat * Math.PI) / 180);
  const toMeters = ([lon, lat]) => [
    (lon - originLon) * metersPerLongitude,
    (lat - originLat) * METERS_PER_DEGREE,
  ];
  const segments = [];
  let length = 0;
  const points = coordinates.map(toMeters);
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i - 1];
    const dx = points[i][0] - x;
    const dy = points[i][1] - y;
    const size = Math.hypot(dx, dy);
    if (!size) continue;
    segments.push({ x, y, dx, dy, size, start: length });
    length += size;
  }

  function projections(lon, lat) {
    const [x, y] = toMeters([lon, lat]);
    return segments.map((segment) => {
      const px = x - segment.x;
      const py = y - segment.y;
      const ratio = Math.max(
        0,
        Math.min(1, (px * segment.dx + py * segment.dy) / segment.size ** 2),
      );
      return {
        distance: segment.start + ratio * segment.size,
        error: (px - ratio * segment.dx) ** 2 + (py - ratio * segment.dy) ** 2,
      };
    });
  }

  return {
    length,
    point(distance) {
      const segment = segments.find(
        ({ start, size }) => distance <= start + size,
      );
      const ratio = (distance - segment.start) / segment.size;
      return {
        longitud:
          originLon + (segment.x + ratio * segment.dx) / metersPerLongitude,
        latitud:
          originLat + (segment.y + ratio * segment.dy) / METERS_PER_DEGREE,
      };
    },
    nearest(lon, lat) {
      return projections(lon, lat).reduce(
        (best, point) => (!best || point.error < best.error ? point : best),
        null,
      );
    },
    stopDistances(stops) {
      if (!segments.length) return stops.map(() => 0);
      // Align the whole ordered stop list where the shape crosses or doubles back.
      let previous = [{ distance: 0, cost: 0 }];
      for (const stop of stops) {
        const [x, y] = toMeters([stop.longitud, stop.latitud]);
        const [endX, endY] = points.at(-1);
        const candidates = [
          { distance: 0, error: x ** 2 + y ** 2 },
          ...projections(stop.longitud, stop.latitud),
          { distance: length, error: (x - endX) ** 2 + (y - endY) ** 2 },
        ];
        let best;
        let index = 0;
        for (const candidate of candidates) {
          while (previous[index]?.distance <= candidate.distance) {
            const point = previous[index++];
            if (!best || point.cost < best.cost) best = point;
          }
          candidate.cost = candidate.error + best.cost;
          candidate.previous = best;
        }
        previous = candidates;
      }
      let point = previous.reduce((best, candidate) =>
        candidate.cost < best.cost ? candidate : best,
      );
      return stops
        .map(() => {
          const distance = point.distance;
          point = point.previous;
          return distance;
        })
        .reverse();
    },
  };
}

module.exports = { routeGeometry };
