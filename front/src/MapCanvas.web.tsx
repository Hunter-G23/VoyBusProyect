import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { LngLatBounds, Map as LibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { VehicleInCirculation } from './types';
import { Loading, Notice } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import './i18n/map';
export function MapCanvas({ vehicles }: { vehicles: VehicleInCirculation[] }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const label = t('map.canvas');
  const failure = t('map.error');
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const markers = useRef(new Map<number, Marker>());
  const fitted = useRef('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap | undefined;
    let loaded = false;
    setLoading(true); setError('');
    const timeout = setTimeout(() => { if (!loaded) { setLoading(false); setError(failure); } }, 15000);
    try {
      setWorkerUrl(new URL('/maplibre-gl-worker-6.19.0.mjs', window.location.origin).href);
      instance = new LibreMap({ container: container.current, style: `https://tiles.openfreemap.org/styles/${theme.scheme === 'dark' ? 'dark' : 'positron'}`, center: [-70.39, -23.64], zoom: 13, attributionControl: { compact: true } });
      map.current = instance;
      instance.getCanvas().setAttribute('aria-label', label);
      const success = () => { loaded = true; clearTimeout(timeout); setLoading(false); setError(''); };
      instance.on('load', success);
      instance.on('idle', success);
      // A tile error is not a fatal map error. Only the initial-load deadline
      // (or construction failure) can replace loading with the error notice.
    } catch { clearTimeout(timeout); setLoading(false); setError(failure); }
    return () => { clearTimeout(timeout); markers.current.forEach((marker) => marker.remove()); markers.current.clear(); fitted.current = ''; map.current = null; instance?.remove(); };
  }, [attempt, theme.scheme, failure, label]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const bounds = new LngLatBounds();
    const ids = new Set<number>();
    for (const vehicle of vehicles) {
      if (!vehicle.posicion || !Number.isFinite(vehicle.posicion.latitud) || !Number.isFinite(vehicle.posicion.longitud)) continue;
      ids.add(vehicle.servicio_id);
      let marker = markers.current.get(vehicle.servicio_id);
      if (!marker) { marker = new Marker({ element: document.createElement('div') }).setLngLat([vehicle.posicion.longitud, vehicle.posicion.latitud]).addTo(instance); markers.current.set(vehicle.servicio_id, marker); }
      const { latitud, longitud, desactualizada } = vehicle.posicion;
      const element = marker.getElement();
      element.textContent = vehicle.linea;
      element.title = `${vehicle.vehiculo} · ${vehicle.linea} · ${vehicle.sentido} · ${t(desactualizada ? 'map.stale' : 'map.fresh')}`;
      Object.assign(element.style, { backgroundColor: vehicle.color ?? theme.ink, color: vehicle.color_texto ?? theme.paper, border: `2px ${desactualizada ? 'dashed' : 'solid'} ${theme.border}`, borderRadius: '6px', padding: '6px 8px', fontSize: '24px', fontFamily: theme.fonts.heading, fontWeight: '700' });
      marker.setLngLat([longitud, latitud]); bounds.extend([longitud, latitud]);
    }
    markers.current.forEach((marker, id) => { if (!ids.has(id)) { marker.remove(); markers.current.delete(id); } });
    const signature = [...ids].sort((a, b) => a - b).join(',');
    if (signature && signature !== fitted.current && !bounds.isEmpty()) { instance.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 }); fitted.current = signature; }
  }, [vehicles, attempt, theme, t]);
  return <View style={{ gap: 10 }}>
    {loading && !error && <Loading />}
    {!!error && <Notice message={error} retry={() => setAttempt((value) => value + 1)} />}
    <style>{`.maplibregl-ctrl-attrib a { display:inline-flex; align-items:center; min-height:48px; min-width:48px; } .maplibregl-ctrl-attrib a:focus-visible {outline:3px solid ${theme.action};outline-offset:2px;}`}</style>
    <div ref={container} role="region" aria-label={label} data-map-loaded={!loading && !error} style={{ height: 320, width: '100%', backgroundColor: theme.surface }} />
  </View>;
}
