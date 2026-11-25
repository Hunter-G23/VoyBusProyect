import React, { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import type { Line, LineStatus } from './types';
import { apiJson } from './api';
import { useResource } from './useResource';
import { Back, Button, Empty, LinePlate, SkeletonRows, Notice, Segmented, useStyles } from './ui';
import { useLanguage } from './i18n';
import { useListEntrance, ScrollReveal } from './motion';
import './i18n/admin';
type StateChoice = LineStatus | 'auto';
type StateEvent = { linea_id: number; admin_nombre: string; fecha: string };
const stateChoices: StateChoice[] = ['auto', 'activa', 'inactiva', 'temporal'];
export type AdminLinesProps = { onBack: () => void };
export function AdminLines({ onBack }: AdminLinesProps) {
  const { t } = useLanguage(); const styles = useStyles();
  const lines = useResource<{ lineas: Line[] }>('/red/lineas?todas=1');
  const events = useResource<{ eventos: StateEvent[] }>('/admin/lineas/eventos');
  const entrance = useListEntrance('admin-lines', lines.data?.lineas.length ?? 0);
  return <View style={styles.page}>
    <Back onPress={onBack} /><Text accessibilityRole="header" style={styles.title}>{t('admin.title')}</Text><Text style={styles.subtitle}>{t('admin.intro')}</Text>
    {lines.loading && !lines.data && !lines.error && <SkeletonRows count={5} />}
    {!!lines.error && <Notice message={lines.error} stale={!!lines.data} retry={lines.reload} />}
    {!!events.error && <Notice message={events.error} stale={!!events.data} retry={events.reload} />}
    {lines.data?.lineas.length === 0 && <Empty title={t('admin.empty')} text={t('admin.emptyHelp')} />}
    {lines.data?.lineas.map((line, index) => <ScrollReveal key={line.id}><Animated.View style={entrance(index)}>
      <AdminRow line={line} event={events.data?.eventos.find(event => event.linea_id === line.id)} onChanged={async () => { await Promise.all([lines.reload(), events.reload()]); }} />
    </Animated.View></ScrollReveal>)}
  </View>;
}
function AdminRow({ line, event, onChanged }: { line: Line; event?: StateEvent; onChanged: () => Promise<void> }) {
  const { t, language } = useLanguage(); const styles = useStyles();
  const current = line.modo_estado === 'auto' ? 'auto' : line.estado ?? 'activa';
  const [status, setStatus] = useState<StateChoice>(current); const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => setStatus(current), [current]);
  const label = (state: StateChoice) => state === 'auto' ? t('admin.auto') : t(`common.${state === 'activa' ? 'active' : state === 'inactiva' ? 'inactive' : 'temporary'}`);
  async function update() {
    if (busy) return; setBusy(true); setError(''); setSaved(false);
    try {
      await apiJson(`/admin/lineas/${line.id}/estado`, 'PATCH', status === 'auto' ? { modo_estado: status } : { estado: status });
      setConfirmation(false); setSaved(true); await onChanged();
    }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  const date = event ? new Date(event.fecha) : null;
  return <View testID={`admin-line-${line.codigo}`} style={{ gap: 12, paddingBottom: 20 }}>
    <LinePlate line={line} status={line.estado ?? 'activa'} />
    <Segmented label={t('admin.selector', { code: line.codigo })} value={status} disabled={busy} onChange={value => { setStatus(value); setConfirmation(false); setSaved(false); }} options={stateChoices.map(value => ({ value, label: label(value) }))} />
    <Text style={styles.small}>{event ? t('admin.last', { name: event.admin_nombre, date: date && Number.isFinite(date.getTime()) ? date.toLocaleString(language === 'es' ? 'es-CL' : 'en-GB') : t('admin.invalidDate') }) : t('admin.noChanges')}</Text>
    {!!error && <Notice message={error} />}
    {saved && <Notice kind="info" message={t('admin.saved')} />}
    {confirmation ? <>
      <Notice kind="info" message={status === 'auto' ? t('admin.questionAuto', { code: line.codigo }) : t('admin.question', { code: line.codigo, state: label(status) })} />
      <Button title={t('admin.confirm')} onPress={() => void update()} busy={busy} />
      <Button title={t('admin.cancel')} onPress={() => setConfirmation(false)} disabled={busy} secondary />
    </> : <Button title={t('admin.change')} onPress={() => setConfirmation(true)} disabled={status === current || busy} expanded={confirmation} secondary />}
  </View>;
}
