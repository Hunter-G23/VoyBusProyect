import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AttributionControl, Map as LibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapCanvasProps } from './mapTypes';
import { Loading, Notice } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import { isMappablePosition, vehicleMarker, vehicleMarkerCss, vehicleMarkerTheme } from './mapMarker';
import { applyMapPalette, mapPalette } from './mapStyle';
import {
  emptyMapFeatures, isVehicleMapId, mapOverlayData, mapOverlayLayers, mapStopFocus, routeSourceId,
  stopImageScript, stopLayerIds, stopMinZoom, stopSourceId, stopTouchRadius, zoomBand,
} from './mapLayers';
import './i18n/map';

export type { MapCanvasProps } from './mapTypes';

export function MapCanvas({
  vehicles, onSelectVehicle, selectedVehicleId, stops, routes, selectedStopId, onSelectStop, focusTarget,
  revealVehicles, userLocation, cameraTarget, onZoomBandChange, bottomInset = 0,
}: MapCanvasProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const label = t('map.canvas');
  const failure = t('map.error');
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const markers = useRef(new Map<number, Marker>());
  const userMarker = useRef<Marker | null>(null);
  const cameraRequest = useRef<number | undefined>(undefined);
  const onZoomBandRef = useRef(onZoomBandChange);
  onZoomBandRef.current = onZoomBandChange;
  const focusedRequest = useRef<number | undefined>(undefined);
  const onSelectRef = useRef(onSelectVehicle);
  onSelectRef.current = onSelectVehicle;
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;
  const overlays = useMemo(
    () => mapOverlayData(stops, routes, selectedStopId, theme.action),
    [stops, routes, selectedStopId, theme.action],
  );
  const focus = useMemo(() => mapStopFocus(overlays.stops, focusTarget), [overlays.stops, focusTarget]);
  const overlayLayers = useMemo(() => mapOverlayLayers(theme), [theme.paper, theme.ink, theme.action, theme.onAction]);
  const syncOverlays = useRef<(instance: LibreMap) => void>(() => {});
  syncOverlays.current = (instance) => {
    const routeSource = instance.getSource<GeoJSONSource>(routeSourceId);
    const stopSource = instance.getSource<GeoJSONSource>(stopSourceId);
    if (!routeSource || !stopSource) return;
    routeSource.setData(overlays.routes);
    stopSource.setData(overlays.stops);
    if (focus && focus.requestId !== focusedRequest.current) {
      instance.jumpTo({ center: focus.center, zoom: Math.max(instance.getZoom(), stopMinZoom) });
      focusedRequest.current = focus.requestId;
      instance.getContainer().dataset.mapFocusedStop = String(focus.stopId);
    }
    if (!focus) delete instance.getContainer().dataset.mapFocusedStop;
  };
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap | undefined;
    let observer: ResizeObserver | undefined;
    let loaded = false;
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => {
      if (!loaded) {
        setLoading(false);
        setError(failure);
      }
    }, 15000);
    try {
      setWorkerUrl(new URL('/maplibre-gl-worker-6.19.0.mjs', window.location.origin).href);
      instance = new LibreMap({
        container: container.current,
        style: `https://tiles.openfreemap.org/styles/${theme.scheme === 'dark' ? 'dark' : 'positron'}`,
        center: [-70.39, -23.64],
        zoom: 13,
        attributionControl: false,
      });
      // Top-right: the bottom sheet covers the bottom of the map.
      instance.addControl(new AttributionControl({ compact: true }), 'top-right');
      map.current = instance;
      instance.getCanvas().setAttribute('aria-label', label);
      const restyle = () => { if (instance) applyMapPalette(instance, theme.scheme); };
      const collapseAttribution = () => {
        container.current?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');
      };
      const success = () => {
        loaded = true;
        clearTimeout(timeout);
        setLoading(false);
        setError('');
        restyle();
        collapseAttribution();
      };
      const activeMap = instance;
      instance.on('style.load', () => {
        restyle();
        activeMap.addSource(routeSourceId, { type: 'geojson', data: emptyMapFeatures });
        activeMap.addSource(stopSourceId, { type: 'geojson', data: emptyMapFeatures });
        // Same drawing code as the native WebView, evaluated from its shared source text.
        (new Function(`${stopImageScript(theme)}; return addStopImages;`)() as (map: LibreMap) => void)(activeMap);
        overlayLayers.forEach((layer) => activeMap.addLayer(layer));
        syncOverlays.current(activeMap);
      });
      instance.on('click', ({ point }) => {
        if (!onSelectStopRef.current || !activeMap.getLayer(stopLayerIds[0]!)) return;
        const options = { layers: stopLayerIds };
        const touchArea: [[number, number], [number, number]] = [
          [point.x - stopTouchRadius, point.y - stopTouchRadius],
          [point.x + stopTouchRadius, point.y + stopTouchRadius],
        ];
        let closestId: number | undefined;
        let closestDistance = Infinity;
        for (const hit of activeMap.queryRenderedFeatures(touchArea, options)) {
          if (typeof hit.id !== 'number' || hit.id <= 0 || hit.geometry.type !== 'Point') continue;
          const center = activeMap.project(hit.geometry.coordinates as [number, number]);
          const distance = Math.hypot(center.x - point.x, center.y - point.y);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestId = hit.id;
          }
        }
        if (closestId !== undefined) onSelectStopRef.current(closestId);
      });
      instance.on('load', success);
      instance.on('idle', success);
      let band: string | undefined;
      const updateBand = () => {
        const next = zoomBand(activeMap.getZoom());
        if (next === band) return;
        band = next;
        activeMap.getContainer().dataset.zoomBand = next;
        onZoomBandRef.current?.(next);
      };
      updateBand();
      instance.on('zoom', updateBand);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(container.current);
      }
      // A tile error is not a fatal map error. Only the initial-load deadline
      // (or construction failure) can replace loading with the error notice.
    } catch {
      clearTimeout(timeout);
      setLoading(false);
      setError(failure);
    }
    return () => {
      clearTimeout(timeout);
      observer?.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      userMarker.current?.remove();
      userMarker.current = null;
      cameraRequest.current = undefined;
      focusedRequest.current = undefined;
      if (instance) delete instance.getContainer().dataset.mapFocusedStop;
      map.current = null;
      instance?.remove();
    };
  }, [attempt, theme.scheme, failure, label, overlayLayers]);

  useEffect(() => {
    if (map.current) syncOverlays.current(map.current);
  }, [overlays, focus]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const ids = new Set<number>();
    for (const vehicle of vehicles) {
      if (!isVehicleMapId(vehicle.servicio_id) || !isMappablePosition(vehicle.posicion)) continue;
      ids.add(vehicle.servicio_id);
      let marker = markers.current.get(vehicle.servicio_id);
      const { latitud, longitud } = vehicle.posicion;
      if (!marker) {
        const element = document.createElement('div');
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          const id = Number(element.dataset.vehicleId);
          if (isVehicleMapId(id)) onSelectRef.current?.(id);
        });
        element.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const id = Number(element.dataset.vehicleId);
            if (isVehicleMapId(id)) onSelectRef.current?.(id);
          }
        });
        marker = new Marker({ element, className: 'voybus-marker' }).setLngLat([longitud, latitud]).addTo(instance);
        markers.current.set(vehicle.servicio_id, marker);
      }
      const element = marker.getElement();
      const { label: markerLabel, markup } = vehicleMarker(vehicle, t);
      element.dataset.vehicleId = String(vehicle.servicio_id);
      element.innerHTML = markup;
      element.title = markerLabel;
      element.setAttribute('aria-label', markerLabel);
      element.setAttribute('aria-pressed', String(vehicle.servicio_id === selectedVehicleId));
      element.dataset.pinned = String(!!revealVehicles || vehicle.servicio_id === selectedVehicleId);
      marker.setLngLat([longitud, latitud]);
    }
    markers.current.forEach((marker, id) => {
      if (!ids.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });
  }, [vehicles, selectedVehicleId, revealVehicles, attempt, theme.scheme, failure, label, overlayLayers, t]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!userLocation) { userMarker.current?.remove(); userMarker.current = null; return; }
    const position: [number, number] = [userLocation.longitud, userLocation.latitud];
    if (!userMarker.current) {
      const element = document.createElement('div');
      element.className = 'voybus-user';
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', t('map.userLocation'));
      userMarker.current = new Marker({ element }).setLngLat(position).addTo(instance);
    } else userMarker.current.setLngLat(position);
  }, [userLocation, attempt, theme.scheme, failure, label, overlayLayers, t]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !cameraTarget || cameraTarget.requestId === cameraRequest.current) return;
    cameraRequest.current = cameraTarget.requestId;
    instance.easeTo({ center: cameraTarget.center, zoom: cameraTarget.zoom, duration: 600 });
  }, [cameraTarget, attempt, theme.scheme, failure, label, overlayLayers]);

  useEffect(() => {
    map.current?.setPadding({ top: 0, right: 0, left: 0, bottom: bottomInset });
  }, [bottomInset, attempt, theme.scheme, failure, label, overlayLayers]);

  const water = mapPalette(theme.scheme).water;
  return (
    <View style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', backgroundColor: water }}>
      <style>{`${vehicleMarkerCss}${vehicleMarkerTheme(theme)}
        .maplibregl-ctrl-attrib.maplibregl-compact {
          background-color: ${theme.paper};
          color: ${theme.ink};
          border: 1px solid ${theme.edge};
          border-radius: 24px;
          min-height: 48px;
          min-width: 48px;
          padding: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
        }
        .maplibregl-ctrl-attrib.maplibregl-compact-show {
          padding: 4px 48px 4px 12px;
          border-radius: 14px;
        }
        .maplibregl-ctrl-attrib-button {
          width: 48px;
          height: 48px;
          min-width: 48px;
          min-height: 48px;
          background-color: transparent;
          background-repeat: no-repeat;
          background-position: center;
          background-size: 24px 24px;
          filter: ${theme.scheme === 'dark' ? 'invert(1)' : 'none'};
        }
        .maplibregl-ctrl-attrib.maplibregl-compact-show a {
          display: inline-flex;
          align-items: center;
          min-height: 48px;
          min-width: 48px;
          color: ${theme.action};
        }
        .maplibregl-ctrl-attrib-button:focus-visible,
        .maplibregl-ctrl-attrib a:focus-visible { outline: 3px solid ${theme.action}; outline-offset: 2px; }`}</style>
      <div
        ref={container}
        className="voybus-map"
        role="region"
        aria-label={label}
        data-map-loaded={!loading && !error}
        data-map-route-id={overlays.routes.features[0]?.id}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', width: '100%', height: '100%', backgroundColor: water }}
      />
      {(loading || !!error) && (
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2 }}>
          {loading && !error && <Loading />}
          {!!error && <Notice message={error} retry={() => setAttempt((value) => value + 1)} />}
        </View>
      )}
    </View>
  );
}
