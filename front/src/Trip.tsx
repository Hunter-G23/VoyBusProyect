import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { api, ApiError } from './api';
import { storage } from './storage';
import { useResource } from './useResource';
import type { Attempt, CurrentTrip, Request, Stop, User } from './types';
import { Button, Empty, Field, Icon, Loading, Notice, Steps, useStyles } from './ui';
import { focusRing, ScalePressable, StepTransition, type PressState } from './motion';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import './i18n/trip';
import { notify, useNotificationPreferences } from './notify';
export function Trip({ user, onLogin }: { user: User | null; onLogin: () => void }) {
  const styles = useStyles(); const { t } = useLanguage(); const theme = useTheme();
  if (!user) return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>{t('trip.welcome')}</Text>
    <Text style={styles.subtitle}>{t('trip.intro')}</Text>
    <View style={styles.panel}><Icon name="bus-outline" size={40} color={theme.action} />
      <Text style={styles.section}>{t('trip.account')}</Text><Text style={styles.body}>{t('trip.accountHelp')}</Text>
      <Button title={t('trip.login')} onPress={onLogin} />
    </View>
  </View>;
  if (user.rol !== 'pasajero') return <View style={styles.page}><Empty title={t('trip.passenger')} text={t('trip.passengerHelp')} /></View>;
  return <PassengerTrip key={user.id} user={user} />;
}
function PassengerTrip({ user }: { user: User }) {
  const styles = useStyles(); const theme = useTheme(); const { t, language } = useLanguage();
  const notifications = useNotificationPreferences();
  const current = useResource<CurrentTrip>('/viaje/actual');
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null); const [attempt, setAttempt] = useState<Attempt | null>(null); const [ready, setReady] = useState(false);
  const lock = useRef(false); const storageKey = `voybus-attempt-${user.id}`;
  const link = current.data?.vinculo;
  const stops = useResource<{ paraderos: Stop[] }>(link ? `/red/recorridos/${link.recorrido_id}/paraderos` : null);
  const initialReceipt = current.data?.solicitud;
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const receipt = useResource<{ solicitud: Request }>(receiptId ? `/viaje/solicitudes/${receiptId}` : null, true);
  const request = receipt.data?.solicitud || initialReceipt;
  const hasActive = !!request && ['pendiente', 'reconocida'].includes(request.estado);
  const previous = useRef<{ id: number; state: string } | null>(null);
  useEffect(() => {
    if (!request) return;
    if (previous.current?.id === request.id && previous.current.state !== request.estado && notifications.preferences.solicitud) {
      void notify(t('trip.notification'), t(`trip.state.${request.estado}`)).catch(reason => setError((reason as Error).message));
    }
    previous.current = { id: request.id, state: request.estado };
  }, [request?.id, request?.estado, notifications.preferences.solicitud]);
  useEffect(() => { if (initialReceipt) setReceiptId(initialReceipt.id); }, [initialReceipt?.id]);
  useEffect(() => {
    if (attempt && request?.clave_idempotencia === attempt.clave_idempotencia) {
      storage.remove(storageKey).then(() => setAttempt(null)).catch(() => setError(t('trip.clearError')));
    }
  }, [attempt, request?.clave_idempotencia, storageKey]);
  useEffect(() => {
    let active = true;
    storage.get(storageKey).then(value => {
      if (!active) return;
      if (value) {
        try { const data = JSON.parse(value) as Attempt;
          if (typeof data.clave_idempotencia !== 'string' || !Number.isInteger(data.destino_id)) throw new Error('invalid attempt');
          setAttempt(data); setSelected(data.destino_id);
        } catch { setError(t('trip.invalidAttempt')); }
      }
      setReady(true);
    }).catch(() => { if (active) { setReady(true); setError(t('trip.restoreError')); } });
    return () => { active = false; };
  }, [storageKey]);
  async function linkVehicle() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await api('/viaje/vincular', { codigo_vehiculo: code }); await current.reload(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); lock.current = false; }
  }
  async function send() {
    if (lock.current || !selected || !ready) return; lock.current = true; setBusy(true); setError('');
    try {
      const intent = attempt || { destino_id: selected, clave_idempotencia: Crypto.randomUUID() };
      await storage.set(storageKey, JSON.stringify(intent)); setAttempt(intent);
      const result = await api<{ solicitud: Request }>('/viaje/solicitudes', intent);
      setReceiptId(result.solicitud.id); await storage.remove(storageKey); setAttempt(null); await current.reload();
    } catch (reason) {
      setError((reason as Error).message);
      if (reason instanceof ApiError && reason.status > 0 && reason.status < 500) {
        try { await storage.remove(storageKey); setAttempt(null); }
        catch { setError(t('trip.restoreError')); }
        await current.reload();
      }
    } finally { setBusy(false); lock.current = false; }
  }
  const selectedStop = stops.data?.paraderos.find(item => item.id === selected);
  const step = request ? 2 : link ? 1 : 0;
  const date = request ? new Date(request.actualizada_en) : null;
  const time = date && Number.isFinite(date.getTime()) ? date.toLocaleString(language === 'es' ? 'es-CL' : 'en-GB') : t('trip.invalidTime');
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>{t('trip.title')}</Text>
    <Text style={styles.subtitle}>{t(link ? 'trip.linkedHelp' : 'trip.board')}</Text>
    <Steps current={step} />
    {current.loading && !current.data && !current.error && <Loading />}
    {!!current.error && <Notice message={current.error} stale={!!current.data} retry={() => void current.reload()} />}
    <StepTransition stepKey={step}><View style={{ gap: 22 }}>
      {current.data && !link && <View style={styles.panel}>
        <Icon name="bus-outline" size={30} color={theme.action} /><Text style={styles.section}>{t('trip.link')}</Text>
        <Field label={t('trip.code')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder={t('trip.codeHint')} editable={!busy} />
        <Button title={t('trip.linkAction')} onPress={() => void linkVehicle()} busy={busy} />
      </View>}
      {link && <>
        <View style={[styles.panel, { borderWidth: 2, borderColor: theme.border }]}>
          <Icon name="bus-outline" size={30} color={theme.action} /><Text style={styles.section}>{t('trip.vehicle', { code: link.codigo_vinculacion, line: link.linea })}</Text>
          <Text style={styles.body}>{link.recorrido}</Text><Text style={styles.small}>{t('trip.vehicleDetails', { direction: link.sentido, plate: link.patente })}</Text>
        </View>
        {request && <View style={styles.panel} accessibilityLiveRegion="polite">
          <Icon name={hasActive ? 'checkmark-circle-outline' : 'receipt-outline'} color={theme.action} />
          <Text accessibilityRole="header" style={styles.section}>{t(`trip.state.${request.estado}`)}</Text>
          <Text style={styles.body}>{t('trip.destination', { name: request.paradero, code: request.paradero_codigo })}</Text>
          <Text style={styles.small}>{t('trip.receipt', { id: request.id, time })}</Text>
          <Text style={styles.body}>{t(request.estado === 'pendiente' ? 'trip.pendingHelp' : 'trip.stateHelp')}</Text>
          {!!receipt.error && <Notice message={receipt.error} stale />}
          <Button title={t('trip.refresh')} onPress={() => void receipt.reload()} busy={receipt.loading} secondary />
          <Text style={styles.small}>{t('trip.polling')}</Text>
        </View>}
        {link.servicio_estado !== 'activo' ? <Empty title={t('trip.ended')} text={t('trip.endedHelp')} /> : !hasActive && <>
          <Text accessibilityRole="header" style={styles.section}>{t('trip.where')}</Text><Text style={styles.subtitle}>{t('trip.chooseHelp')}</Text>
          {stops.loading && !stops.data && !stops.error && <Loading />}
          {!!stops.error && <Notice message={stops.error} stale={!!stops.data} retry={() => void stops.reload()} />}
          {stops.data?.paraderos.length === 0 && <Empty title={t('trip.empty')} text={t('trip.emptyHelp')} />}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('trip.where')} style={styles.list}>
            {stops.data?.paraderos.map(stop => {
              const passed = stop.posicion <= link.ultima_posicion; const checked = selected === stop.id; const disabled = passed || busy || !!attempt;
              return <ScalePressable key={stop.id} accessibilityRole="radio" accessibilityLabel={t('trip.radio', { code: stop.codigo, name: stop.nombre, passed: passed ? t('trip.passedSuffix') : '' })} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => setSelected(stop.id)}
                style={({ focused, pressed }: PressState) => [styles.listRow, { backgroundColor: checked || pressed ? theme.surface : theme.background }, focusRing(focused, theme.action)]}>
                <Icon name={passed ? 'checkmark-circle-outline' : checked ? 'radio-button-on' : 'radio-button-off'} color={theme.action} />
                <View style={styles.grow}><Text style={styles.label}>{stop.nombre}</Text><Text style={styles.small}>{stop.codigo} · {passed ? t('trip.passed') : t('trip.stop', { position: stop.posicion })}</Text></View>
              </ScalePressable>;
            })}
          </View>
          {attempt && <Text style={styles.body}>{t('trip.uncertain')}</Text>}
          <Button title={attempt ? t('trip.retry') : selectedStop ? t('trip.send', { name: selectedStop.nombre }) : t('trip.select')} onPress={() => void send()} busy={busy} disabled={!selected || !ready || !!stops.error} />
        </>}
      </>}
    </View></StepTransition>
    {!!error && <Notice message={error} />}
    {attempt && <Button title={t('trip.check')} onPress={() => void current.reload()} secondary busy={current.loading} />}
  </View>;
}
