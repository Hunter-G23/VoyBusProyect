import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapCanvasProps } from './mapTypes';
import { Loading, Notice } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import { isMappablePosition, vehicleMarker, vehicleMarkerCss, vehicleMarkerTheme } from './mapMarker';
import { mapPalette, mapPaletteScript } from './mapStyle';
import { isVehicleMapId, mapOverlayData, mapOverlayScript, mapSelectionMessage, mapStopFocus, vehicleDotZoom, vehicleFullZoom } from './mapLayers';
import './i18n/map';

export type { MapCanvasProps } from './mapTypes';

export function MapCanvas({
  vehicles, onSelectVehicle, selectedVehicleId, stops, routes, selectedStopId, onSelectStop, focusTarget,
  revealVehicles, userLocation, cameraTarget, onZoomBandChange, bottomInset = 0,
}: MapCanvasProps) {
  const theme = useTheme();
  const { t, language } = useLanguage();
  const label = t('map.canvas');
  const userLabel = t('map.userLocation');
  const webView = useRef<WebView<object>>(null);
  const onSelectRef = useRef(onSelectVehicle);
  onSelectRef.current = onSelectVehicle;
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;
  const onZoomBandRef = useRef(onZoomBandChange);
  onZoomBandRef.current = onZoomBandChange;
  const overlays = useMemo(
    () => mapOverlayData(stops, routes, selectedStopId, theme.action),
    [stops, routes, selectedStopId, theme.action],
  );
  const focus = useMemo(() => mapStopFocus(overlays.stops, focusTarget), [overlays.stops, focusTarget]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const markerTheme = vehicleMarkerTheme(theme);
  const water = mapPalette(theme.scheme).water;
  const paletteFn = mapPaletteScript(theme.scheme);
  const overlayFn = mapOverlayScript(theme);

  const source = useMemo(() => ({
    html: `<!doctype html><html lang="${language}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.css"><style>
  html,body,#map{margin:0;width:100%;height:100%;background:${water}}
  #map{position:relative;overflow:hidden}
  ${vehicleMarkerCss}${markerTheme}
  .maplibregl-ctrl-attrib.maplibregl-compact{background-color:${theme.paper};color:${theme.ink};border:1px solid ${theme.edge};border-radius:24px;min-height:48px;min-width:48px;padding:0}
  .maplibregl-ctrl-attrib.maplibregl-compact-show{padding:4px 48px 4px 12px;border-radius:14px}
  .maplibregl-ctrl-attrib-button{width:48px;height:48px;min-width:48px;min-height:48px;background-color:transparent;background-repeat:no-repeat;background-position:center;background-size:24px 24px;filter:${theme.scheme === 'dark' ? 'invert(1)' : 'none'}}
  .maplibregl-ctrl-attrib.maplibregl-compact-show a{display:inline-flex;align-items:center;min-height:48px;min-width:48px;color:${theme.action}}
  </style></head><body><div id="map" class="voybus-map" role="region"></div><script type="module">
  const send = message => window.ReactNativeWebView.postMessage(message);
  let loaded = false;
  const deadline = setTimeout(() => { if (!loaded) send('error'); }, 15000);
  ${paletteFn}
  ${overlayFn}
  try {
    const lib = await import('https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.mjs');
    const map = new lib.Map({container:'map',style:'https://tiles.openfreemap.org/styles/${theme.scheme === 'dark' ? 'dark' : 'positron'}',center:[-70.39,-23.64],zoom:13,attributionControl:false});
    map.addControl(new lib.AttributionControl({compact:true}),'top-right');
    map.getContainer().setAttribute('aria-label',${JSON.stringify(label)});
    map.getCanvas().setAttribute('aria-label',${JSON.stringify(label)});
    const markers = new Map();
    const overlays = createMapOverlays(map, send);
    window.updateOverlays = overlays.update;
    const restyle = () => applyPalette(map);
    const success = () => { loaded=true;clearTimeout(deadline);restyle();document.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');send('loaded'); };
    map.on('style.load',restyle);
    map.on('load',success);map.on('idle',success);
    let band;
    const updateBand = () => { const z = map.getZoom(); const next = z < ${vehicleDotZoom} ? 'far' : z < ${vehicleFullZoom} ? 'mid' : 'near';
      if (next === band) return; band = next; map.getContainer().dataset.zoomBand = next; send(JSON.stringify({type:'zoom',band:next})); };
    updateBand(); map.on('zoom', updateBand);
    let user;
    window.updateUser = (location) => {
      if (!location) { user?.remove(); user = undefined; return; }
      if (!user) { const el = document.createElement('div'); el.className = 'voybus-user'; el.setAttribute('role','img');
        el.setAttribute('aria-label', ${JSON.stringify(userLabel)}); user = new lib.Marker({element:el}); }
      user.setLngLat([location.longitud, location.latitud]).addTo(map);
    };
    let cameraRequest;
    window.moveCamera = (target) => { if (!target || target.requestId === cameraRequest) return; cameraRequest = target.requestId;
      map.easeTo({center: target.center, zoom: target.zoom, duration: 600}); };
    window.setInset = (bottom) => map.setPadding({top: 0, right: 0, left: 0, bottom});
    window.updateVehicles = (vehicles, selectedId, revealAll) => {
      const ids = new Set();
      vehicles.forEach(vehicle => {
        const p=vehicle.posicion;
        ids.add(vehicle.servicio_id);let marker=markers.get(vehicle.servicio_id);
        if(!marker){
          const el=document.createElement('div');
          el.setAttribute('role','button');
          el.setAttribute('tabindex','0');
          const select = () => send(JSON.stringify({type:'selectVehicle',id:vehicle.servicio_id}));
          el.addEventListener('click',e=>{e.stopPropagation();select();});
          el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
          marker=new lib.Marker({element:el,className:'voybus-marker'}).setLngLat([p.longitud,p.latitud]).addTo(map);
          markers.set(vehicle.servicio_id,marker);
        }
        const element=marker.getElement();
        element.innerHTML=vehicle.marker.markup;
        element.title=vehicle.marker.label;
        element.setAttribute('aria-label',vehicle.marker.label);
        element.setAttribute('aria-pressed',String(vehicle.servicio_id===selectedId));
        element.dataset.pinned=String(revealAll||vehicle.servicio_id===selectedId);
        marker.setLngLat([p.longitud,p.latitud]);
      });
      markers.forEach((marker,id)=>{if(!ids.has(id)){marker.remove();markers.delete(id);}});
    };send('ready');
  } catch {clearTimeout(deadline);send('error');}
  </script></body></html>`,
  }), [theme.scheme, water, paletteFn, overlayFn, markerTheme, theme.paper, theme.ink, theme.edge, theme.action, language, label, userLabel]);

  useEffect(() => { setReady(false); setLoading(true); setError(''); }, [source, attempt]);
  useEffect(() => {
    if (!ready) return;
    webView.current?.injectJavaScript(`window.updateOverlays?.(${JSON.stringify(overlays)},${JSON.stringify(focus ?? null)});true;`);
  }, [overlays, focus, ready]);

  useEffect(() => {
    if (!ready) return;
    webView.current?.injectJavaScript(`window.setInset?.(${bottomInset});window.updateUser?.(${JSON.stringify(userLocation ?? null)});window.moveCamera?.(${JSON.stringify(cameraTarget ?? null)});true;`);
  }, [userLocation, cameraTarget, bottomInset, ready]);

  useEffect(() => {
    if (!ready) return;
    const markers = vehicles.flatMap((vehicle) => isVehicleMapId(vehicle.servicio_id) && isMappablePosition(vehicle.posicion)
      ? [{ servicio_id: vehicle.servicio_id, posicion: vehicle.posicion, marker: vehicleMarker(vehicle, t) }]
      : []);
    const selected = isVehicleMapId(selectedVehicleId) ? selectedVehicleId : null;
    webView.current?.injectJavaScript(`window.updateVehicles?.(${JSON.stringify(markers)},${JSON.stringify(selected)},${!!revealVehicles});true;`);
  }, [vehicles, selectedVehicleId, revealVehicles, ready, t]);

  function failed() { setLoading(false); setError(t('map.error')); }
  function open(url: string) {
    if (/^https:\/\//i.test(url)) void Linking.openURL(url).catch(() => setError(t('map.error')));
  }
  function handleMessage(message: string) {
    if (message === 'ready') { setReady(true); return; }
    if (message === 'loaded') { setLoading(false); setError(''); return; }
    if (message === 'error') { failed(); return; }
    if (message.startsWith('{"type":"zoom"')) {
      try {
        const band = (JSON.parse(message) as { band?: unknown }).band;
        if (band === 'far' || band === 'mid' || band === 'near') onZoomBandRef.current?.(band);
      } catch { /* ignore malformed bridge messages */ }
      return;
    }
    const selection = mapSelectionMessage(message);
    if (selection?.type === 'selectVehicle') onSelectRef.current?.(selection.id);
    if (selection?.type === 'selectStop') onSelectStopRef.current?.(selection.id);
  }

  return (
    <View style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', backgroundColor: water }}>
      <View style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: water }}>
        <WebView<object>
          key={`${attempt}-${theme.scheme}-${language}`}
          ref={webView}
          source={source}
          originWhitelist={['*']}
          scrollEnabled={false}
          onShouldStartLoadWithRequest={(request) => { if (request.url === 'about:blank') return true; open(request.url); return false; }}
          onOpenWindow={(event) => open(event.nativeEvent.targetUrl)}
          onMessage={(event) => handleMessage(event.nativeEvent.data)}
          onError={failed}
          style={{ flex: 1, backgroundColor: water }}
        />
      </View>
      {(loading || !!error) && (
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2 }}>
          {loading && !error && <Loading />}
          {!!error && <Notice message={error} retry={() => setAttempt((value) => value + 1)} />}
        </View>
      )}
    </View>
  );
}
