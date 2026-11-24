import React, { useEffect, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import type { NotificationType, TripHistoryResponse, User } from './types';
import { API_URL, api, apiJson, ApiError } from './api';
import { session } from './storage';
import { Avatar, Back, Button, Empty, Field, Loading, MenuRow, Notice, Segmented, useStyles } from './ui';
import { useTheme } from './theme';
import { useLanguage } from './i18n';
import './i18n/profile';
import { chooseAndUploadPhoto } from './PhotoStep';
import { useNotificationPreferences } from './notify';
import { useResource } from './useResource';
import { useFadeSlideEntrance, useListEntrance } from './motion';
export type ProfileProps = { user: User; onUserChange: (user: User) => void; onLogout: () => Promise<void>; onBack: () => void; onFavorites?: () => void };
type Section = 'edit' | 'history' | 'preferences' | 'privacy' | 'security';
export function Profile({ user, onUserChange, onLogout, onBack, onFavorites }: ProfileProps) {
  const theme = useTheme(); const styles = useStyles(); const { t, language, setLanguage } = useLanguage();
  const notifications = useNotificationPreferences();
  const [section, setSection] = useState<Section | null>(null);
  const sectionEntrance = useFadeSlideEntrance(section, 6);
  const [name, setName] = useState(user.nombre); const [actual, setActual] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const [photoVersion, setPhotoVersion] = useState(0); const [headers, setHeaders] = useState<Record<string, string>>(); const [photoReady, setPhotoReady] = useState(false);
  const history = useResource<TripHistoryResponse>(section === 'history' && user.rol === 'pasajero' ? '/viaje/historial' : null);
  const linkCount = history.data?.vinculos.length ?? 0;
  const historyEntrance = useListEntrance('profile-history', linkCount + (history.data?.solicitudes.length ?? 0), section === 'history');
  useEffect(() => { let active = true; setPhotoReady(false);
    session.get().then(token => { if (active) { setHeaders(token && Platform.OS !== 'web' ? { Authorization: `Bearer ${token}` } : undefined); setPhotoReady(true); } }).catch(reason => setError((reason as Error).message));
    return () => { active = false; };
  }, [user, photoVersion]);
  async function perform(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(''); setSuccess(''); setFields({});
    try { await action(); }
    catch (reason) { const failure = reason as Error; if (reason instanceof ApiError) setFields(reason.fields); setError(failure.message); }
    finally { setBusy(false); }
  }
  async function saveName() { await perform(async () => {
    const result = await apiJson<{ usuario: User }>('/auth/me', 'PATCH', { nombre: name }); onUserChange(result.usuario); setSuccess(t('profile.saved'));
  }); }
  async function changePassword() {
    if (busy) return; setBusy(true); setError(''); setSuccess(''); setFields({});
    try {
      const result = await api<{ token: string; usuario: User }>('/auth/contrasena', { actual, nueva: password, confirmacion: confirmation });
      await session.set(result.token); onUserChange(result.usuario); setActual(''); setPassword(''); setConfirmation(''); setSuccess(t('profile.changed'));
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'CONTRASENA_INCORRECTA') setFields({ actual: t('profile.wrongCurrent') });
      else { if (reason instanceof ApiError) setFields(reason.fields); setError((reason as Error).message); }
    } finally { setBusy(false); }
  }
  function select(value: Section) { setSection(section === value ? null : value); setError(''); setSuccess(''); setFields({}); }
  function date(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString(language === 'es' ? 'es-CL' : 'en-GB') : t('profile.invalidDate'); }
  return <View style={styles.page}>
    <Back onPress={onBack} />
    <Avatar photoUrl={photoReady && user.tiene_foto ? `${API_URL}/auth/me/foto?v=${photoVersion}` : null} headers={headers} label={user.nombre} size={80} />
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={styles.title}>{user.nombre}</Text>
      <Text style={styles.body}>{user.correo}</Text>
      <Text style={styles.small}>{t(`common.${user.rol === 'conductor' ? 'driver' : user.rol === 'administrador' ? 'administrator' : 'passenger'}`)}</Text>
    </View>
    <View style={{ gap: 8 }}>
      <MenuRow title={t('profile.edit')} icon="person-outline" expanded={section === 'edit'} onPress={() => select('edit')} />
      {onFavorites && <MenuRow title={t('profile.favorites')} icon="heart-outline" onPress={onFavorites} />}
      {user.rol === 'pasajero' && <MenuRow title={t('profile.history')} icon="time-outline" expanded={section === 'history'} onPress={() => select('history')} />}
      {([
        ['preferences', 'settings-outline'], ['privacy', 'shield-checkmark-outline'], ['security', 'lock-closed-outline'],
      ] as const).map(([value, icon]) => <MenuRow key={value} title={t(`profile.${value}`)} icon={icon} expanded={section === value} onPress={() => select(value)} />)}
    </View>
    {!!error && <Notice message={error} />}
    {!!success && <Notice kind="info" message={success} />}
    {section === 'edit' && <Animated.View style={[{ gap: 16 }, sectionEntrance]}>
      <Text accessibilityRole="header" style={styles.section}>{t('profile.edit')}</Text>
      <Field label={t('profile.name')} value={name} onChangeText={setName} error={fields.nombre} editable={!busy} autoComplete="name" />
      <Button title={t('profile.saveName')} onPress={() => void saveName()} busy={busy} />
      <Button title={t('profile.photo')} secondary disabled={busy} onPress={() => void perform(async () => { const updated = await chooseAndUploadPhoto(); if (updated) { onUserChange(updated); setPhotoVersion(value => value + 1); setSuccess(t('profile.saved')); } })} />
      <Button title={t('profile.removePhoto')} secondary disabled={busy} onPress={() => void perform(async () => { await apiJson('/auth/me/foto', 'DELETE'); setPhotoVersion(value => value + 1); onUserChange({ ...user, tiene_foto: false }); setSuccess(t('profile.saved')); })} />
    </Animated.View>}
    {section === 'history' && <Animated.View style={[{ gap: 16 }, sectionEntrance]}>
      <Text accessibilityRole="header" style={styles.section}>{t('profile.history')}</Text>
      {history.loading && !history.data && !history.error && <Loading />}
      {!!history.error && <Notice message={history.error} stale={!!history.data} retry={() => void history.reload()} />}
      {history.data && !history.data.vinculos.length && !history.data.solicitudes.length && <Empty title={t('profile.emptyHistory')} text={t('profile.historyHelp')} />}
      {history.data?.vinculos.map((link, index) => <Animated.View key={`link-${link.id}`} style={[styles.listRow, historyEntrance(index)]}><View style={styles.grow}>
        <Text style={styles.label}>{t('profile.closed', { line: link.linea, direction: link.sentido })}</Text><Text style={styles.small}>{t('profile.historyDate', { date: date(link.fin ?? link.inicio) })}</Text>
      </View></Animated.View>)}
      {history.data?.solicitudes.map((request, index) => <Animated.View key={`request-${request.id}`} style={[styles.listRow, historyEntrance(linkCount + index)]}><View style={styles.grow}>
        <Text style={styles.label}>{t('profile.historyRequest', { id: request.id, name: request.paradero })}</Text><Text style={styles.body}>{t(`profile.state.${request.estado}`)}</Text><Text style={styles.small}>{t('profile.historyDate', { date: date(request.creada_en) })}</Text>
      </View></Animated.View>)}
    </Animated.View>}
    {section === 'preferences' && <Animated.View style={[{ gap: 16 }, sectionEntrance]}>
      <Text accessibilityRole="header" style={styles.section}>{t('profile.preferences')}</Text>
      <Text style={styles.label}>{t('profile.language')}</Text>
      <Segmented label={t('profile.language')} value={language} disabled={busy} onChange={value => void perform(() => setLanguage(value))} options={[{ value: 'es', label: t('profile.spanish') }, { value: 'en', label: t('profile.english') }]} />
      <Text style={styles.label}>{t('profile.theme')}</Text>
      <Segmented label={t('profile.theme')} value={theme.preference} disabled={busy} onChange={value => void perform(() => theme.setPreference(value))} options={[{ value: 'system', label: t('profile.system') }, { value: 'light', label: t('profile.light') }, { value: 'dark', label: t('profile.dark') }]} />
      <Text style={styles.label}>{t('profile.notifications')}</Text>
      {(['estado_linea_favorita', 'solicitud'] as NotificationType[]).map(type => <View key={type} style={{ gap: 8 }}>
        <Text style={styles.body}>{t(type === 'solicitud' ? 'profile.requestNotifications' : 'profile.lineNotifications')}</Text>
        <Segmented label={t(type === 'solicitud' ? 'profile.requestNotifications' : 'profile.lineNotifications')} value={notifications.preferences[type] ? 'on' : 'off'} disabled={busy || notifications.loading} onChange={value => void perform(async () => { await notifications.setPreference(type, value === 'on'); })} options={[{ value: 'on', label: t('profile.yes') }, { value: 'off', label: t('profile.no') }]} />
      </View>)}
      <Text style={styles.small}>{t('profile.notificationHelp')}</Text>
    </Animated.View>}
    {section === 'privacy' && <Animated.View style={[{ gap: 12 }, sectionEntrance]}><Text accessibilityRole="header" style={styles.section}>{t('profile.privacy')}</Text><Text style={styles.body}>{t('profile.privacyText')}</Text></Animated.View>}
    {section === 'security' && <Animated.View style={[{ gap: 16 }, sectionEntrance]}>
      <Text accessibilityRole="header" style={styles.section}>{t('profile.security')}</Text>
      <Notice kind="info" message={t('profile.warning')} />
      <Field label={t('profile.currentPassword')} value={actual} onChangeText={setActual} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" error={fields.actual} editable={!busy} />
      <Field label={t('profile.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" error={fields.nueva} editable={!busy} />
      <Text style={styles.small}>{t('profile.passwordHelp')}</Text>
      <Field label={t('profile.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} error={fields.confirmacion} editable={!busy} />
      <Button title={t('profile.changePassword')} onPress={() => void changePassword()} busy={busy} />
    </Animated.View>}
    <Button title={t('profile.logout')} onPress={() => void perform(onLogout)} busy={busy} secondary />
  </View>;
}
