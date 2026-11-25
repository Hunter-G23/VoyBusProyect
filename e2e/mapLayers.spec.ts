import { expect, test } from '@playwright/test';
import {
  mapOverlayData, mapOverlayLayers, mapOverlayScript, mapSelectionMessage, mapStopFocus,
  routeSourceId, stopLayerIds, stopMinZoom, stopSourceId,
} from '../front/src/mapLayers';
import type { MapRoute, MapStop } from '../front/src/mapTypes';

const theme = { paper: '#FFFFFF', ink: '#182A2D', action: '#005A70' };
const stops: MapStop[] = [
  { id: 4, codigo: 'PA4', nombre: 'Norte', latitud: -23.60, longitud: -70.39,
    lineas: [{ id: 8, codigo: 'E01', color: '#598200' }] },
  { id: 7, codigo: 'PA7', nombre: 'Sur', latitud: -23.61, longitud: -70.40, lineas: [] },
];
const route: MapRoute = {
  id: 16, linea_id: 8, linea: 'E01', codigo: 'E01-I', nombre: 'Norte', sentido: 'Ida',
  origen: 'Sur', destino: 'Norte', variante: false, paraderos: [],
  color: '#005BAA',
  geometria: { type: 'LineString', coordinates: [[-70.40, -23.61], [-70.39, -23.60]] },
};

test('paraderos como letrero, visibles desde zoom 15 y selección visible en todo zoom', () => {
  const signs = mapOverlayLayers(theme).filter((layer) => layer.type === 'symbol');
  const [regular, selected] = stopLayerIds.map((id) => signs.find((layer) => layer.id === id));
  expect(regular?.minzoom).toBe(14.5);
  expect(regular?.paint).toMatchObject({ 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15, 1] });
  expect(regular?.layout).toMatchObject({ 'icon-image': 'voybus-stop', 'icon-anchor': 'bottom' });
  expect(selected?.layout).toMatchObject({ 'icon-image': 'voybus-stop-selected' });
  expect(regular?.filter).toEqual(['==', ['get', 'selected'], false]);
  expect(selected?.minzoom).toBeUndefined();
  expect(selected?.filter).toEqual(['==', ['get', 'selected'], true]);
  const data = mapOverlayData(stops, [], 4, theme.action);
  expect(data.stops.features.map(({ id, properties }) => [id, properties.selected])).toEqual([[4, true], [7, false]]);
  expect(data.routes.features).toEqual([]);
});

test('traza rutas con geometría y colores GTFS', () => {
  const data = mapOverlayData(stops, [
    route,
    { ...route, id: 17, color: undefined },
    { ...route, id: 18, geometria: null },
  ], undefined, theme.action);
  expect(data.routes.features.map(({ id, geometry, properties }) => [id, geometry, properties.color])).toEqual([
    [16, route.geometria, '#005BAA'],
    [17, route.geometria, '#598200'],
  ]);
});

test('puente distingue paraderos positivos y buses enteros de ambos signos', () => {
  for (const [type, id] of [['selectVehicle', -52], ['selectVehicle', 1], ['selectStop', 4]]) {
    expect(mapSelectionMessage(JSON.stringify({ type, id }))).toEqual({ type, id });
  }
  for (const [type, id] of [['selectVehicle', 0], ['selectVehicle', 1.5], ['selectStop', -52], ['selectStop', '4'], ['select', 4]]) {
    expect(mapSelectionMessage(JSON.stringify({ type, id }))).toBeUndefined();
  }
});

test('script WebView aplica capas y foco diferido una vez por solicitud', () => {
  type Click = { point: { x: number; y: number } };
  const events = new Map<string, (event?: Click) => void>();
  const sources = new Map<string, { setData: (data: unknown) => void }>();
  const sourceData = new Map<string, unknown>();
  const layers = new Map<string, ReturnType<typeof mapOverlayLayers>[number]>();
  const cameras: Array<{ center: number[]; zoom: number }> = [];
  const messages: string[] = [];
  const map = {
    on: (type: string, listener: (event?: Click) => void) => events.set(type, listener),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: (data) => sourceData.set(id, data) }),
    addLayer: (layer: ReturnType<typeof mapOverlayLayers>[number]) => layers.set(layer.id, layer),
    getLayer: (id: string) => layers.get(id),
    getZoom: () => 13,
    jumpTo: (camera: { center: number[]; zoom: number }) => cameras.push(camera),
    project: ([x, y]: [number, number]) => ({ x, y }),
    queryRenderedFeatures: (box: number[][], options: { layers: string[] }) => {
      expect(box).toEqual([[76, 76], [124, 124]]);
      expect(options.layers).toEqual(stopLayerIds);
      return [
        { id: 4, geometry: { type: 'Point', coordinates: [110, 110] } },
        { id: 7, geometry: { type: 'Point', coordinates: [104, 105] } },
      ];
    },
  };
  const install = new Function('map', 'send', mapOverlayScript(theme) + '\nreturn createMapOverlays(map, send);');
  const overlays = install(map, (message: string) => messages.push(message));
  const target = { stopId: 4, requestId: 1 };
  const missing = mapOverlayData([], [], 4, theme.action);
  const data = mapOverlayData(stops, [route], 4, theme.action);
  overlays.update(missing, mapStopFocus(missing.stops, target));
  expect(overlays.hasFocused).toBe(false);
  expect(cameras).toEqual([]);
  const focus = mapStopFocus(data.stops, target);
  overlays.update(data, focus);
  expect(cameras).toEqual([]);
  events.get('style.load')!();
  expect([...layers.values()]).toEqual(mapOverlayLayers(theme));
  overlays.update(data, focus);
  expect(sourceData.get(stopSourceId)).toEqual(data.stops);
  expect(sourceData.get(routeSourceId)).toEqual(data.routes);
  expect(cameras).toEqual([{ center: [-70.39, -23.60], zoom: stopMinZoom }]);
  expect(overlays.hasFocused).toBe(true);
  const nextTarget = { stopId: 7, requestId: 2 };
  overlays.update(missing, mapStopFocus(missing.stops, nextTarget));
  expect(cameras).toHaveLength(1);
  overlays.update(data, mapStopFocus(data.stops, nextTarget));
  expect(cameras[1]).toEqual({ center: [-70.40, -23.61], zoom: stopMinZoom });
  events.get('click')!({ point: { x: 100, y: 100 } });
  expect(messages.map(mapSelectionMessage)).toEqual([{ type: 'selectStop', id: 7 }]);
});
