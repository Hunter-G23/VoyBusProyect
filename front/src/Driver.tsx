import React from 'react';
import { Animated, Text, View } from 'react-native';
import { useResource } from './useResource';
import type { Inbox } from './types';
import { Button, Empty, Icon, Loading, Notice, useStyles } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import { useListEntrance } from './motion';
import './i18n/driver';
export function Driver() {
  const theme = useTheme(); const styles = useStyles(); const { t, language } = useLanguage();
  const inbox = useResource<Inbox>('/conductor/servicio/solicitudes', true); const service = inbox.data?.servicio;
  const stopCount = inbox.data?.paraderos.length ?? 0;
  const entrance = useListEntrance('driver-inbox', stopCount + (inbox.data?.solicitudes.length ?? 0), !!service);
  const count = (count: number) => t(count === 1 ? 'driver.one' : 'driver.many', { count });
  const time = (value: string | Date) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString(language === 'es' ? 'es-CL' : 'en-GB') : t('driver.invalidTime'); };
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>{t('driver.title')}</Text><Text style={styles.subtitle}>{t('driver.intro')}</Text>
    {inbox.loading && !inbox.data && !inbox.error && <Loading />}
    {!!inbox.error && <Notice message={inbox.error} retry={() => void inbox.reload()} stale={!!inbox.data} />}
    {service && <View style={[styles.panel, { borderWidth: 2, borderColor: theme.border }]}>
      <Icon name="bus-outline" color={theme.action} size={30} /><Text style={styles.section}>{service.codigo_vinculacion}</Text>
      <Text style={styles.body}>{t('driver.service', { line: service.linea, direction: service.sentido })}</Text>
      <Text style={styles.small}>{t('driver.details', { route: service.recorrido, plate: service.patente })}</Text>
    </View>}
    {inbox.data && !service && <Empty title={t('driver.noService')} text={t('driver.noServiceHelp')} />}
    {service && <>
      <Text accessibilityRole="header" style={styles.section}>{t('driver.next')}</Text><Text style={styles.small}>{count(inbox.data?.solicitudes.length ?? 0)}</Text>
      {!inbox.data?.paraderos.length ? <Empty title={t('driver.empty')} text={t('driver.emptyHelp')} /> : <View style={styles.list}>
        {inbox.data.paraderos.map((stop, index) => <Animated.View key={stop.destino_id} style={[styles.listRow, entrance(index)]}>
          <Icon name="location-outline" color={theme.action} /><View style={styles.grow}><Text style={styles.label}>{stop.nombre}</Text><Text style={styles.small}>{t('driver.stop', { code: stop.codigo, position: stop.posicion })}</Text><Text style={styles.body}>{count(stop.cantidad)}</Text></View>
        </Animated.View>)}
      </View>}
      {!!inbox.data?.solicitudes.length && <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={styles.section}>{t('driver.receipts')}</Text>
        {inbox.data.solicitudes.map((item, index) => <Animated.View key={item.id} style={[styles.listRow, entrance(stopCount + index)]}>
          <Text style={styles.label}>{t('driver.request', { id: item.id })}</Text><View style={styles.grow}><Text style={styles.body}>{item.paradero}</Text><Text style={styles.small}>{t(item.estado === 'pendiente' ? 'driver.pending' : 'driver.acknowledged')} · {time(item.creada_en)}</Text></View>
        </Animated.View>)}
      </View>}
      <Button title={t('driver.refresh')} onPress={() => void inbox.reload()} busy={inbox.loading} secondary />
      {inbox.updated && <Text style={styles.small}>{t('driver.updated', { time: time(inbox.updated) })}</Text>}
      <Text style={styles.small}>{t('driver.polling')}</Text>
    </>}
  </View>;
}
