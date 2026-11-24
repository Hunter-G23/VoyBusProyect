import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { VehicleInCirculation } from './types';
import { Loading, Notice } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import './i18n/map';
export function MapCanvas({ vehicles }: { vehicles: VehicleInCirculation[] }) {
  const theme = useTheme();
  const { t, language } = useLanguage();
  const webView = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const source = useMemo(() => ({ html: `<!doctype html><html lang="${language}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.css"><style>html,body,#map{margin:0;width:100%;height:100%;background:${theme.surface}}.vehicle{border:2px solid ${theme.border};border-radius:6px;padding:6px 8px;font:700 24px sans-serif}.maplibregl-ctrl-attrib a{display:inline-flex;align-items:center;min-height:48px;min-width:48px}</style></head><body><div id="map"></div><script type="module">
  const send = message => window.ReactNativeWebView.postMessage(message);
  let loaded = false;
  const deadline = setTimeout(() => { if (!loaded) send('error'); }, 15000);
  try {
    const lib = await import('https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.mjs');
    const map = new lib.Map({container:'map',style:'https://tiles.openfreemap.org/styles/${theme.scheme === 'dark' ? 'dark' : 'positron'}',center:[-70.39,-23.64],zoom:13,attributionControl:{compact:false}});
    const markers = new Map(); let fitted = '';
    const success = () => { loaded=true;clearTimeout(deadline);send('loaded'); };
    map.on('load',success);map.on('idle',success);
    window.updateVehicles = vehicles => {
      const ids = new Set(); const bounds = new lib.LngLatBounds();
      vehicles.forEach(vehicle => {
        const p=vehicle.posicion;if(!p || !Number.isFinite(p.latitud) || !Number.isFinite(p.longitud))return;
        ids.add(vehicle.servicio_id);let marker=markers.get(vehicle.servicio_id);
        if(!marker){marker=new lib.Marker({element:document.createElement('div')}).setLngLat([p.longitud,p.latitud]).addTo(map);markers.set(vehicle.servicio_id,marker);}
        const element=marker.getElement();element.className='vehicle';element.textContent=vehicle.linea;
        element.style.backgroundColor=vehicle.color;element.style.color=vehicle.color_texto;element.style.borderStyle=p.desactualizada?'dashed':'solid';
        marker.setLngLat([p.longitud,p.latitud]);bounds.extend([p.longitud,p.latitud]);
      });
      markers.forEach((marker,id)=>{if(!ids.has(id)){marker.remove();markers.delete(id);}});
      const signature=[...ids].sort((a,b)=>a-b).join(',');
      if(signature && signature!==fitted && !bounds.isEmpty()){map.fitBounds(bounds,{padding:48,maxZoom:13,duration:0});fitted=signature;}
    };send('ready');
  } catch {clearTimeout(deadline);send('error');}
  </script></body></html>` }), [theme.scheme, theme.surface, theme.border, language]);
  useEffect(() => { setReady(false); setLoading(true); setError(''); }, [source, attempt]);
  useEffect(() => { if (ready) webView.current?.injectJavaScript(`window.updateVehicles(${JSON.stringify(vehicles)});true;`); }, [vehicles, ready]);
  function failed() { setLoading(false); setError(t('map.error')); }
  function open(url: string) {
    if (/^https:\/\//i.test(url)) void Linking.openURL(url).catch(() => setError(t('map.error')));
  }
  return <View style={{ gap: 10 }}>
    {loading && !error && <Loading />}
    {!!error && <Notice message={error} retry={() => setAttempt(value => value + 1)} />}
    <View style={{ height: 320, backgroundColor: theme.surface }}>
      <WebView<object> key={`${attempt}-${theme.scheme}-${language}`} ref={webView} source={source} originWhitelist={['*']} scrollEnabled={false}
        onShouldStartLoadWithRequest={(request) => { if (request.url === 'about:blank') return true; open(request.url); return false; }}
        onOpenWindow={(event) => open(event.nativeEvent.targetUrl)}
        onMessage={(event) => { const message=event.nativeEvent.data; if(message==='ready')setReady(true);if(message==='loaded'){setLoading(false);setError('');}if(message==='error')failed(); }}
        onError={failed} style={{ backgroundColor: theme.surface }} />
    </View>
  </View>;
}
