import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiJson } from './api';
import type { PhotoInput, User } from './types';
import { Avatar, Button, Notice, useStyles } from './ui';
import { t, useLanguage } from './i18n';
import './i18n/profile';
export function validatePhoto(photo: PhotoInput): PhotoInput {
  const base64 = photo.datos_base64;
  const size = base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (size > 512 * 1024) throw new Error(t('profile.photoLarge'));
  if (!base64 || (photo.tipo === 'image/jpeg' ? !base64.startsWith('/9j/') : !base64.startsWith('iVBORw0KGgo'))) throw new Error(t('profile.photoInvalid'));
  return photo;
}
export async function chooseAndUploadPhoto(): Promise<User | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error(t('profile.photoPermission'));
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error(t('profile.photoInvalid'));
  let data = asset.base64;
  if (!data) throw new Error(t('profile.photoInvalid'));
  if (Platform.OS === 'web') {
    // ImagePicker does not crop on web. Apply the same centered square crop
    // with the browser's image codec, without adding a processing dependency.
    data = await new Promise<string>((resolve, reject) => {
      const image = new globalThis.Image();
      image.onload = () => {
        try {
          const side = Math.min(image.naturalWidth, image.naturalHeight);
          const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side;
          const context = canvas.getContext('2d');
          if (!context || !side) throw new Error(t('profile.photoInvalid'));
          context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, side, side);
          const encoded = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          if (!encoded) throw new Error(t('profile.photoInvalid'));
          resolve(encoded);
        } catch (reason) { reject(reason); }
      };
      image.onerror = () => reject(new Error(t('profile.photoInvalid'))); image.src = asset.uri;
    });
  }
  const photo = validatePhoto({ tipo: data.startsWith('/9j/') ? 'image/jpeg' : 'image/png', datos_base64: data });
  return (await apiJson<{ usuario: User }>('/auth/me/foto', 'PUT', photo)).usuario;
}
export function PhotoStep({ user, onDone }: { user: User; onDone: (user: User) => void }) {
  const { t } = useLanguage(); const styles = useStyles();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function choose() {
    setBusy(true); setError('');
    try { const updated = await chooseAndUploadPhoto(); if (updated) onDone(updated); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <View style={styles.page}>
    <Avatar size={80} label={user.nombre} />
    <Text accessibilityRole="header" style={styles.title}>{t('profile.addPhoto')}</Text>
    <Text style={styles.body}>{t('profile.photoHelp')}</Text>
    {!!error && <Notice message={error} />}
    <Button title={t('profile.choosePhoto')} onPress={() => void choose()} busy={busy} />
    <Button title={t('profile.skip')} onPress={() => onDone(user)} disabled={busy} secondary />
  </View>;
}
