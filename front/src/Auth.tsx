import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { api, ApiError } from './api';
import { session } from './storage';
import type { User } from './types';
import { Back, Button, Field, Notice, useStyles } from './ui';
import { useLanguage } from './i18n';
import './i18n/auth';
import { PhotoStep } from './PhotoStep';
export function Auth({ onDone, onBack }: { onDone: (user: User) => void; onBack: () => void }) {
  const { t } = useLanguage(); const styles = useStyles();
  const [register, setRegister] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({}); const [success, setSuccess] = useState('');
  const [newAccount, setNewAccount] = useState(false); const [photoUser, setPhotoUser] = useState<User | null>(null); const lock = useRef(false);
  async function submit() {
    if (lock.current) return; lock.current = true; setError(''); setFields({}); setSuccess(''); setBusy(true);
    try {
      if (register) {
        await api('/auth/registro', { nombre: name, correo: email, contrasena: password, confirmacion: confirmation });
        setRegister(false); setNewAccount(true); setSuccess(t('auth.created')); setConfirmation('');
      } else {
        const result = await api<{ token: string; usuario: User }>('/auth/login', { correo: email, contrasena: password });
        await session.set(result.token);
        if (newAccount) setPhotoUser(result.usuario); else onDone(result.usuario);
      }
    } catch (reason) { setError((reason as Error).message); if (reason instanceof ApiError) setFields(reason.fields); }
    finally { setBusy(false); lock.current = false; }
  }
  if (photoUser) return <PhotoStep user={photoUser} onDone={onDone} />;
  return <View style={styles.page}>
    <Back onPress={onBack} />
    <Text accessibilityRole="header" style={styles.title}>{t(register ? 'auth.create' : 'auth.welcome')}</Text>
    <Text style={styles.subtitle}>{t(register ? 'auth.registerHelp' : 'auth.loginHelp')}</Text>
    {!!success && <Notice kind="info" message={success} />}
    <View style={{ gap: 18 }}>
      {register && <Field label={t('auth.name')} value={name} onChangeText={setName} error={fields.nombre} autoComplete="name" editable={!busy} />}
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} error={fields.correo} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} placeholder={t('auth.emailHint')} />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} error={fields.contrasena} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete={register ? 'new-password' : 'current-password'} editable={!busy} onSubmitEditing={() => { if (!register) void submit(); }} />
      {register && <><Text style={styles.small}>{t('auth.passwordHelp')}</Text><Field label={t('auth.confirm')} value={confirmation} onChangeText={setConfirmation} error={fields.confirmacion} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} editable={!busy} /></>}
      <Button title={t(show ? 'auth.hide' : 'auth.show')} onPress={() => setShow(!show)} secondary disabled={busy} expanded={show} />
      {!!error && <Notice message={error} />}
      <Button title={t(register ? 'auth.submitRegister' : 'auth.login')} onPress={() => void submit()} busy={busy} />
      <Button title={t(register ? 'auth.haveAccount' : 'auth.register')} secondary disabled={busy} onPress={() => { setRegister(!register); setError(''); setFields({}); setSuccess(''); }} />
    </View>
    <Text style={styles.small}>{t('auth.public')}</Text>
  </View>;
}
