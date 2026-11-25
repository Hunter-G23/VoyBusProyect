import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Linking, PanResponder, Platform, ScrollView, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { MapCanvas } from './MapCanvas';
import type { MapCameraTarget, MapFocusTarget, MapMetadata, StopArrivals, UserLocation } from './mapTypes';
import type { VehiclesResponse } from './types';
import { useResource } from './useResource';
import { Button, Icon, Notice, SkeletonRows, useStyles } from './ui';
import { useTheme } from './theme';
import { useLanguage, type Translate } from './i18n';
import { focusRing, motion, ScalePressable, useFadeSlideEntrance, useListEntrance, useNativeDriver, useReducedMotion, type PressState } from './motion';
import { isMappablePosition } from './mapMarker';
import { useUserLocation } from './useUserLocation';
import './i18n/map';

type Selection =
  | { mode: 'all' }
  | { mode: 'stop'; stopId: number }
  | { mode: 'vehicle'; vehicleId: number; stopId?: number };
type Sheet = 'collapsed' | 'half' | 'full';
const snaps: Sheet[] = ['collapsed', 'half', 'full'];

// Rough bounding box of the Antofagasta network.
const inAntofagasta = ({ latitud, longitud }: UserLocation) =>
  latitud > -23.9 && latitud < -23.3 && longitud > -70.6 && longitud < -70.2;

function formatTime(iso: string, language: string, t: Translate) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString(language === 'es' ? 'es-CL' : 'en-GB')
    : t('map.invalid');
}

function searchable(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function VehicleMap({ focusTarget }: { focusTarget?: MapFocusTarget }) {
  const styles = useStyles();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { t, language } = useLanguage();
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const resource = useResource<VehiclesResponse>('/red/vehiculos', true);
  const metadata = useResource<MapMetadata>('/red/mapa');
  const [selection, setSelection] = useState<Selection>(
    focusTarget ? { mode: 'stop', stopId: focusTarget.stopId } : { mode: 'all' },
  );
  const [focus, setFocus] = useState(focusTarget);
  const requestId = useRef(focusTarget?.requestId ?? 0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [rawLineFilter, setLineFilter] = useState<string | null>(null);
  const [zoomBand, setZoomBand] = useState<'far' | 'mid' | 'near'>('mid');
  const [camera, setCamera] = useState<MapCameraTarget>();
  const cameraId = useRef(0);
  const userLocation = useUserLocation();
  const [outside, setOutside] = useState(false);

  // ---- Sheet geometry (portrait): the sheet sits over the map and only moves with translateY.
  const viewWidth = viewport.width || window.width;
  const viewHeight = viewport.height || window.height;
  const isLandscapeCompact = viewWidth > viewHeight && viewHeight < 500;
  const isNarrow = viewWidth < 260;
  const [headerHeight, setHeaderHeight] = useState(150);
  const sheetHeight = Math.round(viewHeight * 0.88);
  const visible: Record<Sheet, number> = {
    collapsed: Math.min(headerHeight, sheetHeight),
    half: Math.max(headerHeight + 96, Math.round(viewHeight * 0.46)),
    full: sheetHeight,
  };
  const offset = (snap: Sheet) => sheetHeight - Math.min(visible[snap], sheetHeight);
  const [sheet, setSheet] = useState<Sheet>('half');
  const [bodyFor, setBodyFor] = useState<Sheet>('half');
  const y = useRef(new Animated.Value(offset('half'))).current;
  const current = useRef(offset('half'));
  useEffect(() => {
    const id = y.addListener(({ value }) => { current.current = value; });
    return () => y.removeListener(id);
  }, [y]);
  const geometry = useRef({ offset, sheet, reduced });
  geometry.current = { offset, sheet, reduced };

  function settle(target: Sheet) {
    const from = geometry.current.sheet;
    // Keep the taller body while moving so nothing blank is revealed, then fit it to the target.
    setBodyFor(snaps.indexOf(target) > snaps.indexOf(from) ? target : from);
    setSheet(target);
    y.stopAnimation();
    Animated.timing(y, {
      toValue: geometry.current.offset(target),
      duration: geometry.current.reduced ? 0 : motion.sheet,
      easing: motion.sheetEasing, useNativeDriver,
    }).start(({ finished }) => { if (finished) setBodyFor(target); });
  }
  const settleRef = useRef(settle);
  settleRef.current = settle;
  // Re-anchor when the screen or the header size changes.
  useEffect(() => { y.setValue(offset(sheet)); current.current = offset(sheet); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetHeight, headerHeight, viewHeight]);

  const dragStart = useRef(0);
  const drag = useRef(PanResponder.create({
    // Capture too, so a vertical drag that starts on the handle or the search field still moves the sheet.
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      y.stopAnimation();
      dragStart.current = current.current;
      setBodyFor('full');
    },
    onPanResponderMove: (_, gesture) => {
      const max = geometry.current.offset('collapsed');
      y.setValue(Math.max(0, Math.min(max, dragStart.current + gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      // Project ~150 ms ahead with the release velocity, then snap to the nearest height.
      const projected = current.current + gesture.vy * 150;
      const nearest = snaps.reduce((best, snap) =>
        Math.abs(geometry.current.offset(snap) - projected) < Math.abs(geometry.current.offset(best) - projected) ? snap : best);
      settleRef.current(nearest);
    },
    onPanResponderTerminate: () => settleRef.current(geometry.current.sheet),
  })).current;

  useEffect(() => {
    if (!focusTarget) return;
    setSelection({ mode: 'stop', stopId: focusTarget.stopId });
    setFocus({ ...focusTarget, requestId: ++requestId.current });
    setSearching(false);
    settle('half');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  // ---- Data
  const lines = metadata.data?.lineas ?? [];
  const vehicles = resource.data?.vehiculos.map((vehicle) => {
    const line = lines.find((item) => item.codigo === vehicle.linea);
    return {
      ...vehicle,
      color: line?.color ?? vehicle.color ?? theme.ink,
      color_texto: line?.color_texto ?? vehicle.color_texto ?? theme.paper,
      electrica: line?.electrica ?? vehicle.electrica,
    };
  }) ?? [];
  const routeOf = (id: number) => metadata.data?.recorridos.find((route) => route.id === id);

  const selected = selection.mode === 'vehicle'
    ? vehicles.find((item) => item.servicio_id === selection.vehicleId)
    : undefined;
  const selectedRoute = selected && routeOf(selected.recorrido_id);
  const lastStopId = selection.mode === 'all' ? undefined : selection.stopId;
  const keepStopFilter = lastStopId !== undefined && (
    selection.mode === 'stop' || (selectedRoute?.paraderos.some((item) => item.paradero_id === lastStopId) ?? true)
  );
  const arrivalStopId = selection.mode === 'vehicle'
    ? (keepStopFilter ? lastStopId : selected?.proximo_paradero_id ?? undefined)
    : lastStopId;
  const arrivals = useResource<StopArrivals>(arrivalStopId ? `/red/paraderos/${arrivalStopId}/llegadas` : null, true);
  const arrivalData = arrivals.data?.paradero.id === arrivalStopId ? arrivals.data : null;
  const stops = metadata.data?.paraderos;
  const arrivalStop = arrivalData?.paradero ?? stops?.find((stop) => stop.id === arrivalStopId);
  // With a stop selected, only the lines that serve it can be filtered.
  const filterLines = keepStopFilter && arrivalStop
    ? lines.filter((line) => arrivalStop.lineas.some((served) => served.codigo === line.codigo))
    : lines;
  // A filter for a line that does not serve the stop would hide everything without a visible chip; ignore it.
  const lineFilter = rawLineFilter && filterLines.some((line) => line.codigo === rawLineFilter) ? rawLineFilter : null;
  const upcoming = (arrivalData?.llegadas.filter((item) => item.segundos > 0) ?? [])
    .filter((item) => selection.mode === 'vehicle' ? item.servicio_id === selection.vehicleId : !lineFilter || item.linea === lineFilter);
  const upcomingIds = new Set(upcoming.map((item) => item.servicio_id));
  const lineVehicles = lineFilter ? vehicles.filter((item) => item.linea === lineFilter) : vehicles;
  // A selected bus is shown alone with its route; otherwise the stop and line filters apply.
  const visibleVehicles = selected ? [selected]
    : keepStopFilter ? lineVehicles.filter((item) => upcomingIds.has(item.servicio_id))
    : lineVehicles;
  const mappable = visibleVehicles.filter((item) => isMappablePosition(item.posicion)).length;
  const missingCount = visibleVehicles.length - mappable;
  const revealVehicles = !!selected || keepStopFilter || !!lineFilter;
  const needle = searchable(query.trim());
  const matchingStops = searching
    ? stops?.filter((stop) => searchable(`${stop.nombre} ${stop.codigo}`).includes(needle)) ?? []
    : [];
  const cardEntrance = useFadeSlideEntrance(selected ? String(selected.servicio_id) : null, 4);
  // Fleet, stop, bus and search swap their panel content with a short fade-and-rise.
  const contextKey = searching ? 'search' : selection.mode === 'all' ? 'all'
    : selection.mode === 'stop' ? `stop-${selection.stopId}` : `bus-${selection.vehicleId}`;
  const contextEntrance = useFadeSlideEntrance(contextKey, 10);
  const arrivalsEntrance = useListEntrance(`arrivals-${contextKey}`, upcoming.length, !!arrivalData);
  const fleetEntrance = useListEntrance(`fleet-${lineFilter ?? 'all'}`, visibleVehicles.length, !!resource.data);
  const show129 = lineFilter === '129' || selected?.linea === '129';

  // ---- Actions
  function openSearch() { setSearching(true); settle('full'); }
  function closeSearch() { setSearching(false); setQuery(''); settle('half'); }

  function selectStop(stopId: number) {
    setSelection({ mode: 'stop', stopId });
    const served = stops?.find((stop) => stop.id === stopId)?.lineas;
    if (rawLineFilter && served && !served.some((line) => line.codigo === rawLineFilter)) setLineFilter(null);
    setFocus({ stopId, requestId: ++requestId.current });
    setSearching(false);
    setQuery('');
    settle('half');
  }

  function selectVehicle(vehicleId: number) {
    setSelection({ mode: 'vehicle', vehicleId, stopId: lastStopId });
    // Zoom in on the tapped bus (a user action, so moving the camera is expected).
    const position = vehicles.find((item) => item.servicio_id === vehicleId)?.posicion;
    if (position && isMappablePosition(position)) {
      setCamera({ center: [position.longitud, position.latitud], zoom: 16, requestId: ++cameraId.current });
    }
    setSearching(false);
    settle('half');
  }

  function clearSelection() {
    if (selection.mode === 'vehicle' && selection.stopId !== undefined) {
      setSelection({ mode: 'stop', stopId: selection.stopId });
      return;
    }
    setSelection({ mode: 'all' });
    setFocus(undefined);
  }
  const closeLabel = selection.mode === 'vehicle' && selection.stopId !== undefined ? t('map.backToStop') : t('map.clear');

  function locate() {
    userLocation.locate((found) => {
      const near = inAntofagasta(found);
      setOutside(!near);
      // Always centre on the user; outside the network a notice explains that no buses are nearby.
      setCamera({ center: [found.longitud, found.latitud], zoom: near ? 15 : 13, requestId: ++cameraId.current });
    });
  }

  // ---- Presentation helpers
  const lineColor = (code: string, fallback?: string) => lines.find((line) => line.codigo === code)?.color ?? fallback ?? theme.action;
  const lineInk = (code: string) => lines.find((line) => line.codigo === code)?.color_texto ?? theme.onAction;
  const compactHeading = [styles.section, { fontSize: 18, lineHeight: 24 }];
  const status = (position: VehiclesResponse['vehiculos'][number]['posicion']) =>
    t(!position ? 'map.missing' : position.desactualizada ? 'map.stale' : 'map.fresh');
  const towards = (routeId: number, fallback: string) => {
    const destination = routeOf(routeId)?.destino;
    return destination ? t('map.towards', { destination }) : t('map.direction', { direction: fallback });
  };
  const rowStyle = ({ focused, pressed }: PressState) => [
    styles.listRow,
    { paddingVertical: 8, paddingHorizontal: 8, minHeight: 48, backgroundColor: pressed || focused ? theme.surface : theme.paper },
    focusRing(focused, theme.action),
  ];
  const chipStyle = (active: boolean) => ({ focused, pressed }: PressState) => [{
    minHeight: 48, minWidth: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    borderColor: active ? theme.action : theme.border,
    backgroundColor: active ? theme.action : pressed ? theme.surface : theme.paper,
  }, focusRing(focused, theme.action)];
  const locationNotice = outside ? t('map.locationOutside')
    : userLocation.status === 'denied' ? t('map.locationDenied')
    : userLocation.status === 'unavailable' ? t('map.locationUnavailable')
    : userLocation.status === 'insecure' ? t('map.locationInsecure') : '';
  const pad = isNarrow ? 10 : 16;

  const title = selection.mode === 'vehicle'
    ? (selected ? t('map.vehicle', { vehicle: selected.vehiculo, line: selected.linea }) : t('map.unavailableVehicle'))
    : selection.mode === 'stop'
      ? arrivalStop?.nombre ?? t('map.selectedStop')
      : !resource.data ? t('map.title')
      : mappable ? t(mappable === 1 ? 'map.fleetOne' : 'map.fleet', { count: mappable }) : t('map.empty');
  const subtitle = [
    selection.mode === 'vehicle' && selected ? towards(selected.recorrido_id, selected.sentido) : '',
    selection.mode === 'stop' ? t('map.stop') : '',
    selection.mode === 'all' && missingCount > 0 ? t('map.noPosition', { count: missingCount }) : '',
    lineFilter ? t('map.filteringLine', { line: lineFilter }) : '',
  ].filter(Boolean).join(' · ');

  const header = (
    <View onLayout={(event) => setHeaderHeight(Math.round(event.nativeEvent.layout.height))}
      {...(isLandscapeCompact ? {} : drag.panHandlers)} style={{ paddingHorizontal: pad, paddingBottom: 10, gap: 8,
        // Dragging the sheet with a mouse should not select its text on web.
        ...(Platform.OS === 'web' ? { userSelect: 'none' } as object : {}) }}>
      <ScalePressable accessibilityRole="button"
        accessibilityLabel={t(sheet === 'collapsed' ? 'map.expandPanel' : 'map.collapsePanel')}
        accessibilityState={{ expanded: sheet !== 'collapsed' }}
        onPress={() => settle(sheet === 'collapsed' ? 'half' : 'collapsed')}
        style={({ focused }: PressState) => [{ minHeight: 48, minWidth: 48, alignSelf: 'stretch',
          alignItems: 'center', justifyContent: 'center' }, focusRing(focused, theme.action)]}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: theme.border }} />
      </ScalePressable>

      {searching ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 24,
            borderWidth: 1, borderColor: searchFocused ? theme.action : theme.border, backgroundColor: theme.surface },
          focusRing(searchFocused, theme.action)]}>
            <Icon name="search-outline" size={18} color={theme.muted} />
            <TextInput accessibilityRole="searchbox" accessibilityLabel={t('map.stopQuery')} autoFocus
              placeholder={t('map.stopQuery')} placeholderTextColor={theme.muted}
              autoCorrect={false} autoCapitalize="none" returnKeyType="search" value={query}
              onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChangeText={setQuery}
              style={{ flex: 1, minWidth: 48, minHeight: 48, color: theme.ink, fontSize: 16, fontFamily: theme.fonts.body,
                outlineWidth: 0 /* the rounded field draws the focus ring */ }} />
          </View>
          <ScalePressable accessibilityRole="button" accessibilityLabel={t('map.cancelSearch')} onPress={closeSearch}
            style={({ focused }: PressState) => [{ minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 4 },
              focusRing(focused, theme.action)]}>
            <Text style={[styles.label, { color: theme.action }]}>{t('map.cancelSearch')}</Text>
          </ScalePressable>
        </View>
      ) : (
        <ScalePressable accessibilityRole="button" accessibilityLabel={t('map.searchStops')} onPress={openSearch}
          style={({ focused, pressed }: PressState) => [{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: theme.border,
            backgroundColor: pressed ? theme.edge : theme.surface }, focusRing(focused, theme.action)]}>
          <Icon name="search-outline" size={18} color={theme.muted} />
          <Text style={[styles.body, { color: theme.muted }]}>{t('map.searchStops')}</Text>
        </ScalePressable>
      )}

      {!searching && (
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, contextEntrance]}>
          {selection.mode === 'vehicle' && <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2,
            backgroundColor: selected?.color ?? theme.edge }} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" style={compactHeading} numberOfLines={2}>{title}</Text>
            {!!subtitle && <Text style={styles.small} numberOfLines={2}>{subtitle}</Text>}
          </View>
          {selection.mode !== 'all' && (
            <ScalePressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={clearSelection}
              style={({ focused, pressed }: PressState) => [{ width: 48, height: 48, borderRadius: 24, alignItems: 'center',
                justifyContent: 'center', backgroundColor: pressed ? theme.edge : theme.surface }, focusRing(focused, theme.action)]}>
              <Icon name={closeLabel === t('map.clear') ? 'close' : 'arrow-back'} size={22} color={theme.ink} />
            </ScalePressable>
          )}
        </Animated.View>
      )}
      {!!locationNotice && <Notice kind="info" message={locationNotice} />}
      {userLocation.status === 'denied' && Platform.OS !== 'web' && (
        <Button secondary title={t('map.openSettings')} onPress={() => void Linking.openSettings()} />
      )}
    </View>
  );

  const body = (
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: 16 }}>
      <Animated.View style={[{ gap: 10 }, contextEntrance]}>
      {searching ? (
        <>
          {!metadata.data && !metadata.error && <SkeletonRows count={4} />}
          {metadata.data && !matchingStops.length && (
            <Text accessibilityLiveRegion="polite" style={styles.small}>{t('map.noStops')}</Text>
          )}
          <View accessibilityRole="list" style={styles.list}>
            {matchingStops.slice(0, 8).map((stop) => (
              <View key={stop.id} accessibilityRole="listitem">
                <ScalePressable accessibilityRole="button"
                  accessibilityLabel={t('map.selectStop', { stop: stop.nombre, code: stop.codigo })}
                  onPress={() => selectStop(stop.id)} style={rowStyle}>
                  <Icon name="location-outline" size={20} color={theme.action} />
                  <View style={styles.grow}>
                    <Text style={styles.label}>{stop.nombre}</Text>
                    <Text style={styles.small}>{stop.codigo}</Text>
                  </View>
                </ScalePressable>
              </View>
            ))}
          </View>
          {matchingStops.length > 8 && <Text style={styles.small}>{t('map.refineStops')}</Text>}
        </>
      ) : (
        <>
          {!selected && filterLines.length > 1 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.small}>{t('map.lineFilter')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup"
                accessibilityLabel={t('map.lineFilter')} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {[null, ...filterLines].map((line) => {
                  const code = line?.codigo ?? null;
                  const active = lineFilter === code;
                  const color = line?.color ?? theme.action;
                  return (
                    <ScalePressable key={code ?? 'all'} accessibilityRole="radio"
                      accessibilityLabel={code ? t('map.lineChip', { line: code }) : t('map.allLines')}
                      accessibilityState={{ checked: active }}
                      onPress={() => setLineFilter(code)}
                      style={(state: PressState) => [...chipStyle(active)(state), line ? {
                        borderColor: color, flexDirection: 'row' as const, gap: 6,
                        backgroundColor: active ? color : state.pressed ? theme.surface : theme.paper,
                      } : {}]}>
                      {line && !active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
                      <Text style={[styles.label, { color: active ? (line?.color_texto ?? theme.onAction) : theme.ink }]}>
                        {code ?? t('map.allLines')}
                      </Text>
                    </ScalePressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {!!resource.error && <Notice message={resource.error} stale={!!resource.data} retry={resource.reload} />}
          {!!metadata.error && <Notice message={t('map.metadataError')} retry={metadata.reload} />}
          {show129 && <Notice kind="info" message={t('map.detour129')} />}

          {selection.mode === 'vehicle' && selected && (
            <Animated.View style={[{ gap: 4 }, cardEntrance]}>
              {selectedRoute && <Text style={styles.small}>{t('map.route', { from: selectedRoute.origen, to: selectedRoute.destino })}</Text>}
              <Text style={styles.small}>
                {status(selected.posicion)}
                {selected.posicion ? ` · ${t('map.measured', { time: formatTime(selected.posicion.medida_en, language, t) })}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {!!selected.electrica && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: theme.signal, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Icon name="flash" size={14} color={theme.signalInk} />
                    <Text style={[styles.small, { color: theme.signalInk }]}>{t('map.electric')}</Text>
                  </View>
                )}
                {(selected.simulado ?? resource.data?.fuente === 'simulacion') && (
                  <Text style={styles.small}>{t('map.simulated')}</Text>
                )}
              </View>
            </Animated.View>
          )}

          {arrivalStopId !== undefined ? (
            <>
              {selection.mode === 'vehicle' && arrivalStop && (
                <Text style={styles.label}>{t('map.referenceStop', { stop: arrivalStop.nombre })}</Text>
              )}
              {!!arrivalStop?.lineas.length && (
                <Text style={styles.small}>
                  {t('map.served', { lines: arrivalStop.lineas.map((line) => line.codigo).join(', ') })}
                </Text>
              )}
              <Text accessibilityRole="header" style={compactHeading}>{t('map.upcoming')}</Text>
              {!arrivalData && !arrivals.error && <SkeletonRows count={3} />}
              {!!arrivals.error && <Notice message={t('map.arrivalsError')} stale={!!arrivalData} retry={arrivals.reload} />}
              {arrivalData && !upcoming.length && <Text style={styles.small}>{t('map.noArrivals')}</Text>}
              {!!upcoming.length && (
                <View accessibilityRole="list" style={styles.list}>
                  {upcoming.map((item, index) => (
                    <Animated.View key={item.servicio_id} accessibilityRole="listitem" style={arrivalsEntrance(index)}>
                      <ScalePressable accessibilityRole="button"
                        accessibilityLabel={t('map.selectVehicle', { vehicle: item.vehiculo, line: item.linea })}
                        onPress={() => selectVehicle(item.servicio_id)}
                        style={(state: PressState) => [...rowStyle(state), { flexWrap: 'wrap', gap: 8 }]}>
                        <View style={{ minWidth: 44, minHeight: 32, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center',
                          justifyContent: 'center', backgroundColor: lineColor(item.linea, item.color) }}>
                          <Text style={[styles.label, { color: lineInk(item.linea) }]}>{item.linea}</Text>
                        </View>
                        <View style={{ flexGrow: 1, flexBasis: 96, minWidth: 0 }}>
                          <Text style={styles.label}>{item.vehiculo}</Text>
                          <Text style={styles.small}>{t('map.towards', { destination: item.destino })}</Text>
                        </View>
                        <Minutes text={t(item.origen === 'simulacion' ? 'map.simulatedMinutes' : 'map.approximateMinutes', { count: item.minutos })} />
                      </ScalePressable>
                    </Animated.View>
                  ))}
                </View>
              )}
            </>
          ) : selection.mode === 'vehicle' && selected ? (
            <Text style={styles.small}>{t('map.noReference')}</Text>
          ) : (
            <>
              <Text accessibilityRole="header" style={compactHeading}>{t('map.list')}</Text>
              {!resource.data && !resource.error && <SkeletonRows count={5} />}
              <View accessibilityRole="list" style={styles.list}>
                {visibleVehicles.map((item, index) => (
                  <Animated.View key={item.servicio_id} accessibilityRole="listitem" style={fleetEntrance(index)}>
                    <ScalePressable accessibilityRole="button"
                      accessibilityLabel={t('map.selectVehicle', { vehicle: item.vehiculo, line: item.linea })}
                      onPress={() => selectVehicle(item.servicio_id)} style={rowStyle}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                      <View style={styles.grow}>
                        <Text style={styles.label}>{t('map.vehicle', { vehicle: item.vehiculo, line: item.linea })}</Text>
                        <Text style={styles.small}>
                          {towards(item.recorrido_id, item.sentido)}
                          {item.electrica ? ` · ${t('map.electric')}` : ''}
                        </Text>
                        <Text style={styles.small}>{status(item.posicion)}</Text>
                      </View>
                    </ScalePressable>
                  </Animated.View>
                ))}
              </View>
            </>
          )}
        </>
      )}
      </Animated.View>
    </ScrollView>
  );

  const mapView = (
    <View style={{ flex: 1, minHeight: 120, minWidth: 0 }}>
      <MapCanvas
        vehicles={visibleVehicles}
        selectedVehicleId={selected?.servicio_id}
        onSelectVehicle={selectVehicle}
        stops={stops}
        selectedStopId={arrivalStopId}
        onSelectStop={selectStop}
        routes={selectedRoute ? [selectedRoute] : undefined}
        focusTarget={focus}
        revealVehicles={revealVehicles}
        userLocation={userLocation.location}
        cameraTarget={camera}
        onZoomBandChange={setZoomBand}
        bottomInset={isLandscapeCompact ? 0 : visible.half}
      />
      {zoomBand === 'far' && !revealVehicles && !!mappable && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 72, alignItems: 'flex-start' }}>
          <Text accessibilityLiveRegion="polite" style={[styles.small, { color: theme.ink, backgroundColor: theme.paper,
            borderRadius: 16, borderWidth: 1, borderColor: theme.edge, paddingHorizontal: 12, paddingVertical: 6 }]}>
            {t('map.zoomHint')}
          </Text>
        </View>
      )}
      <View style={{ position: 'absolute', top: 68, right: 12 }}>
        <ScalePressable accessibilityRole="button" accessibilityLabel={t('map.myLocation')}
          accessibilityState={{ busy: userLocation.status === 'locating' }} onPress={locate}
          style={({ focused, pressed }: PressState) => [{
            width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
            backgroundColor: pressed ? theme.surface : theme.paper, borderWidth: 1, borderColor: theme.border,
          }, focusRing(focused, theme.action)]}>
          {userLocation.status === 'locating'
            ? <SpinnerIcon />
            : <Icon name={userLocation.status === 'ready' ? 'locate' : 'locate-outline'} size={22} color={theme.action} />}
        </ScalePressable>
      </View>
    </View>
  );

  const onLayout = (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== viewport.width || height !== viewport.height) setViewport({ width, height });
  };

  if (isLandscapeCompact) {
    return (
      <View onLayout={onLayout} style={{ flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'row', backgroundColor: theme.background }}>
        {mapView}
        <View style={{ width: Math.min(340, Math.round(viewWidth * 0.44)), minHeight: 0, backgroundColor: theme.paper,
          borderLeftWidth: 1, borderLeftColor: theme.edge }}>
          {header}
          {sheet !== 'collapsed' && <View style={{ flex: 1, minHeight: 0 }}>{body}</View>}
        </View>
      </View>
    );
  }

  const bodyHeight = Math.max(0, visible[bodyFor] - headerHeight);
  return (
    <View onLayout={onLayout} style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: theme.background, overflow: 'hidden' }}>
      {mapView}
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: sheetHeight,
        transform: [{ translateY: y }],
        backgroundColor: theme.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        borderWidth: 1, borderBottomWidth: 0, borderColor: theme.edge,
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 8,
      }}>
        {header}
        <View accessibilityElementsHidden={sheet === 'collapsed'}
          importantForAccessibility={sheet === 'collapsed' ? 'no-hide-descendants' : 'auto'}
          pointerEvents={sheet === 'collapsed' ? 'none' : 'auto'}
          style={{ height: bodyHeight }}>
          {body}
        </View>
      </Animated.View>
    </View>
  );
}

/** Arrival time that ticks: when the minutes change, the new value slides down into place. */
function Minutes({ text }: { text: string }) {
  const styles = useStyles();
  const theme = useTheme();
  const tick = useFadeSlideEntrance(text, -8);
  return <Animated.Text style={[styles.label, { color: theme.action, flexShrink: 1 }, tick]}>{text}</Animated.Text>;
}

function SpinnerIcon() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  // Same 48 px button, spinner in place of the icon while locating.
  return <ActivityIndicator animating={!reduced} hidesWhenStopped={false} color={theme.action} />;
}
