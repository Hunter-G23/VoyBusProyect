import type { FeatureCollection, LineString, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { MapFocusTarget, MapRoute, MapStop } from './mapTypes';
import type { ThemeTokens } from './theme';

export const routeSourceId = 'voybus-routes';
export const stopSourceId = 'voybus-stops';
export const stopLayerIds = ['voybus-stop', 'voybus-stop-selected'];
export const stopMinZoom = 15;
// Stops fade in over the half zoom level before stopMinZoom.
const stopFadeZoom = stopMinZoom - 0.5;
// Buses: hidden below vehicleDotZoom, colour dot only below vehicleFullZoom.
export const vehicleDotZoom = 12.5;
export const vehicleFullZoom = 14;
export type ZoomBand = 'far' | 'mid' | 'near';
export function zoomBand(zoom: number): ZoomBand {
  return zoom < vehicleDotZoom ? 'far' : zoom < vehicleFullZoom ? 'mid' : 'near';
}
export const stopTouchRadius = 24;
export const stopImageIds = { regular: 'voybus-stop', selected: 'voybus-stop-selected' };
export const emptyMapFeatures: FeatureCollection = { type: 'FeatureCollection', features: [] };

type StopFeatures = FeatureCollection<Point, { selected: boolean }>;
type RouteFeatures = FeatureCollection<LineString, { color: string }>;

type OverlayTheme = Pick<ThemeTokens, 'paper' | 'ink' | 'action'> & Partial<Pick<ThemeTokens, 'onAction'>>;

/**
 * Bus-stop sign icons (a rounded sign with a bus and a pointer to the exact spot), drawn on a canvas so they
 * are ready synchronously before the layers that use them. Shared as source text with the native WebView.
 */
export function stopImageScript(theme: OverlayTheme) {
  return `function addStopImages(map) {
    if (typeof document === 'undefined' || !map.addImage) return;
    const draw = (bg, fg) => {
      const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 56;
      const c = canvas.getContext('2d');
      c.fillStyle = bg; c.strokeStyle = fg; c.lineWidth = 4;
      c.beginPath(); c.roundRect(4, 3, 40, 38, 10); c.fill(); c.stroke();
      c.fillStyle = fg; c.beginPath(); c.moveTo(17, 39); c.lineTo(31, 39); c.lineTo(24, 54); c.closePath(); c.fill();
      c.beginPath(); c.roundRect(14, 10, 20, 20, 4); c.fill();
      c.fillStyle = bg; c.fillRect(17, 13, 14, 7);
      c.beginPath(); c.arc(18.5, 25.5, 1.8, 0, 7); c.arc(29.5, 25.5, 1.8, 0, 7); c.fill();
      c.fillStyle = fg; c.fillRect(16, 30, 4, 4); c.fillRect(28, 30, 4, 4);
      return c.getImageData(0, 0, 48, 56);
    };
    const images = [[${JSON.stringify(stopImageIds.regular)}, ${JSON.stringify(theme.paper)}, ${JSON.stringify(theme.action)}],
      [${JSON.stringify(stopImageIds.selected)}, ${JSON.stringify(theme.action)}, ${JSON.stringify(theme.onAction ?? theme.paper)}]];
    for (const [id, bg, fg] of images) if (!map.hasImage(id)) map.addImage(id, draw(bg, fg), { pixelRatio: 2 });
  }`;
}

export function mapOverlayLayers(theme: OverlayTheme): LayerSpecification[] {
  return [
    {
      id: 'voybus-route-outline', type: 'line', source: routeSourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': theme.paper, 'line-width': 7 },
    },
    {
      id: 'voybus-route', type: 'line', source: routeSourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
    },
    {
      id: stopLayerIds[0]!, type: 'symbol', source: stopSourceId, minzoom: stopFadeZoom,
      filter: ['==', ['get', 'selected'], false],
      layout: {
        'icon-image': stopImageIds.regular, 'icon-anchor': 'bottom',
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], stopFadeZoom, 0.8, 17, 1.05],
      },
      paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], stopFadeZoom, 0, stopMinZoom, 1] },
    },
    {
      id: stopLayerIds[1]!, type: 'symbol', source: stopSourceId,
      filter: ['==', ['get', 'selected'], true],
      layout: {
        'icon-image': stopImageIds.selected, 'icon-anchor': 'bottom', 'icon-size': 1.2,
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
      },
    },
  ];
}

function isGtfsColor(color?: string): color is string {
  return !!color && /^#[a-f\d]{6}$/i.test(color);
}

export function mapOverlayData(
  stops: MapStop[] | undefined,
  routes: MapRoute[] | undefined,
  selectedStopId: number | undefined,
  routeFallback: string,
): { stops: StopFeatures; routes: RouteFeatures } {
  const colors = new Map<number, string>();
  const stopFeatures: StopFeatures = { type: 'FeatureCollection', features: [] };
  const routeFeatures: RouteFeatures = { type: 'FeatureCollection', features: [] };
  for (const stop of stops ?? []) {
    for (const line of stop.lineas) {
      if (isGtfsColor(line.color)) colors.set(line.id, line.color);
    }
    if (!Number.isInteger(stop.id) || stop.id <= 0
      || !Number.isFinite(stop.latitud) || Math.abs(stop.latitud) > 90
      || !Number.isFinite(stop.longitud) || Math.abs(stop.longitud) > 180) continue;
    stopFeatures.features.push({
      type: 'Feature', id: stop.id, properties: { selected: stop.id === selectedStopId },
      geometry: { type: 'Point', coordinates: [stop.longitud, stop.latitud] },
    });
  }
  for (const route of routes ?? []) {
    if (!route.geometria || route.geometria.coordinates.length < 2) continue;
    const color = isGtfsColor(route.color) ? route.color : colors.get(route.linea_id) ?? routeFallback;
    routeFeatures.features.push({
      type: 'Feature', id: route.id, properties: { color }, geometry: route.geometria,
    });
  }
  return { stops: stopFeatures, routes: routeFeatures };
}

export function mapStopFocus(stops: StopFeatures, target?: MapFocusTarget) {
  if (!target) return;
  const position = stops.features.find((feature) => feature.id === target.stopId)?.geometry.coordinates;
  if (position) return { ...target, center: position as [number, number] };
}

export function isVehicleMapId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id !== 0;
}

export function mapSelectionMessage(message: string): { type: 'selectVehicle' | 'selectStop'; id: number } | undefined {
  if (!message.startsWith('{')) return;
  try {
    const payload = JSON.parse(message) as { type?: unknown; id?: unknown };
    if (!isVehicleMapId(payload.id)) return;
    if (payload.type === 'selectVehicle' || (payload.type === 'selectStop' && payload.id > 0)) {
      return { type: payload.type, id: payload.id };
    }
  } catch {
    // Ignore malformed bridge messages.
  }
}

export function mapOverlayScript(theme: OverlayTheme) {
  return `${stopImageScript(theme)}
  function createMapOverlays(map, send) {
    const routeSourceId = ${JSON.stringify(routeSourceId)};
    const stopSourceId = ${JSON.stringify(stopSourceId)};
    const layers = ${JSON.stringify(stopLayerIds)};
    let latest;
    let focusedRequest;
    function applyOverlays() {
      const routeSource = map.getSource(routeSourceId);
      const stopSource = map.getSource(stopSourceId);
      if (!latest || !routeSource || !stopSource) return;
      routeSource.setData(latest.data.routes);
      stopSource.setData(latest.data.stops);
      const focus = latest.focus;
      if (focus && focus.requestId !== focusedRequest) {
        map.jumpTo({center: focus.center, zoom: Math.max(map.getZoom(), ${stopMinZoom})});
        focusedRequest = focus.requestId;
      }
    }
    map.on('style.load', () => {
      const empty = ${JSON.stringify(emptyMapFeatures)};
      map.addSource(routeSourceId, {type: 'geojson', data: empty});
      map.addSource(stopSourceId, {type: 'geojson', data: empty});
      addStopImages(map);
      ${JSON.stringify(mapOverlayLayers(theme))}.forEach(layer => map.addLayer(layer));
      applyOverlays();
    });
    map.on('click', ({point}) => {
      if (!map.getLayer(layers[0])) return;
      const radius = ${stopTouchRadius};
      const box = [[point.x - radius, point.y - radius], [point.x + radius, point.y + radius]];
      let closestId;
      let closestDistance = Infinity;
      for (const hit of map.queryRenderedFeatures(box, {layers})) {
        if (typeof hit.id !== 'number' || hit.id <= 0 || hit.geometry.type !== 'Point') continue;
        const center = map.project(hit.geometry.coordinates);
        const distance = Math.hypot(center.x - point.x, center.y - point.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = hit.id;
        }
      }
      if (closestId !== undefined) send(JSON.stringify({type: 'selectStop', id: closestId}));
    });
    return {
      get hasFocused() { return focusedRequest !== undefined; },
      update(data, focus) {
        latest = {data, focus};
        applyOverlays();
      }
    };
  }`;
}
