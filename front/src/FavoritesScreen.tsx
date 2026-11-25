import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import type { Favorite, Line, User } from './types';
import { Button, Empty, FavoriteButton, LinePlate, SkeletonRows, Notice, StatusChip, useStyles } from './ui';
import { useLanguage } from './i18n';
import './i18n/favorites';
import { removeFavorite, syncDeviceFavorites, useFavorites } from './favorites';
import { notify, useNotificationPreferences } from './notify';
import { useListEntrance, ScrollReveal } from './motion';
export type FavoritesProps = { user: User | null; onLogin: () => void; onLines: () => void; onOpenLine?: (line: Line) => void };
export function Favorites({ user, onLogin, onLines, onOpenLine }: FavoritesProps) {
  const { t } = useLanguage();
  const styles = useStyles();
  const saved = useFavorites(user);
  const entrance = useListEntrance('favorites', saved.favorites.length);
  const notifications = useNotificationPreferences();
  const previous = useRef(new Map<number, string>());
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const current = new Map(saved.favorites.map(item => [item.linea.id, item.linea.estado ?? 'activa']));
    if (notifications.preferences.estado_linea_favorita) current.forEach((state, id) => {
      if (previous.current.has(id) && previous.current.get(id) !== state) {
        const line = saved.favorites.find(item => item.linea.id === id)!.linea;
        void notify(t('favorites.changed'), t('favorites.state', { code: line.codigo, state: t(`common.${state === 'activa' ? 'active' : state === 'inactiva' ? 'inactive' : 'temporary'}`) })).catch(reason => setError((reason as Error).message));
      }
    });
    previous.current = current;
  }, [saved.favorites, notifications.preferences.estado_linea_favorita]);
  async function remove(item: Favorite, pulse: () => Promise<void>) {
    setBusy(true); setRemoving(item.id); setError('');
    try { await pulse(); await removeFavorite(user, item); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); setRemoving(null); }
  }
  async function sync() {
    setBusy(true); setError('');
    try { await syncDeviceFavorites(); }
    catch (reason) { setError(`${t('favorites.partial')} ${(reason as Error).message}`); saved.reload(); }
    finally { setBusy(false); }
  }
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>{t('favorites.title')}</Text>
    {!user && <><Notice kind="info" message={t('favorites.reminder')} /><Button title={t('favorites.login')} onPress={onLogin} /></>}
    {user?.rol === 'pasajero' && saved.device.length > 0 && <>
      <Notice kind="info" message={t('favorites.offer', { count: saved.device.length })} />
      <Button title={t('favorites.sync')} onPress={() => void sync()} busy={busy} />
    </>}
    {saved.loading && !saved.favorites.length && !saved.error && <SkeletonRows count={3} />}
    {!!saved.error && <Notice message={t(saved.error)} stale={!!saved.favorites.length} retry={saved.reload} />}
    {!!error && <Notice message={error} />}
    {!saved.loading && !saved.error && !saved.favorites.length && <><Empty title={t('favorites.empty')} text={t('favorites.help')} /><Button title={t('favorites.lines')} onPress={onLines} secondary /></>}
    {saved.favorites.map((item, index) => <ScrollReveal key={item.id}><Animated.View style={[{ gap: 8 }, entrance(index)]}>
      <LinePlate line={{ ...item.linea, codigo: item.recorrido?.codigo ?? item.linea.codigo, nombre: item.recorrido?.nombre ?? item.linea.nombre }} subtitle={item.recorrido?.sentido} onPress={() => onOpenLine ? onOpenLine(item.linea) : onLines()} />
      <StatusChip status={item.linea.estado ?? 'activa'} />
      <FavoriteButton saved title={t('favorites.remove')} accessibilityLabel={t('favorites.removeLabel', { code: item.linea.codigo, name: item.recorrido?.nombre ?? item.linea.nombre })} onPress={pulse => void remove(item, pulse)} busy={removing === item.id} disabled={busy || saved.loading} />
    </Animated.View></ScrollReveal>)}
  </View>;
}
