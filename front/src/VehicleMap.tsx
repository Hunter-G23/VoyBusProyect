import React from 'react';
import { Text, View } from 'react-native';
import { MapCanvas } from './MapCanvas';
import type { Line, VehiclesResponse } from './types';
import { useResource } from './useResource';
import { Empty, Icon, Loading, Notice, useStyles } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import './i18n/map';
export function VehicleMap() {
  const styles = useStyles();
  const theme = useTheme();
  const { t, language } = useLanguage();
  const resource = useResource<VehiclesResponse>('/red/vehiculos', true);
  const lines = useResource<{ lineas: Line[] }>('/red/lineas?todas=1');
  const vehicles = resource.data?.vehiculos.map((vehicle) => {
    const line = lines.data?.lineas.find((line) => line.codigo === vehicle.linea);
    return { ...vehicle, color: line?.color ?? theme.ink, color_texto: line?.color_texto ?? theme.paper };
  }) ?? [];
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>{t('map.title')}</Text>
    <Text style={styles.subtitle}>{t('map.intro')}</Text>
    {!resource.data && !resource.error && <Loading />}
    {!!resource.error && <Notice message={resource.error} stale={!!resource.data} retry={() => void resource.reload()} />}
    {!!lines.error && <Notice message={lines.error} stale={!!lines.data} retry={() => void lines.reload()} />}
    {resource.data && <>
      {resource.data.fuente === 'simulacion' && <Notice kind="simulated" message={t('map.simulated')} />}
      <MapCanvas vehicles={vehicles} />
      {!vehicles.length ? <Empty title={t('map.empty')} text={t('map.refresh')} /> : <>
        <Text accessibilityRole="header" style={styles.section}>{t('map.list')}</Text>
        <Text style={styles.small}>{t('map.help')}</Text>
        <View accessibilityRole="list" style={styles.list}>{vehicles.map((item) => {
          const date = item.posicion ? new Date(item.posicion.medida_en) : null;
          const valid = date && Number.isFinite(date.getTime());
          return <View key={item.servicio_id} accessibilityRole="listitem" style={styles.listRow}>
            <Icon name="bus-outline" color={theme.action} />
            <View style={styles.grow}>
              <Text style={styles.label}>{t('map.vehicle', { vehicle: item.vehiculo, line: item.linea })}</Text>
              <Text style={styles.body}>{t('map.direction', { direction: item.sentido })}</Text>
              {item.posicion && <Text style={styles.small}>{t('map.measured', { time: valid ? date.toLocaleTimeString(language === 'es' ? 'es-CL' : 'en-GB') : t('map.invalid') })}</Text>}
              <Text style={styles.body}>{t(!item.posicion ? 'map.missing' : item.posicion.desactualizada ? 'map.stale' : 'map.fresh')}</Text>
            </View>
          </View>;
        })}</View>
      </>}
    </>}
  </View>;
}
