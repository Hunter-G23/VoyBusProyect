import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { UserLocation } from './mapTypes';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'insecure';

export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const watch = useRef<Location.LocationSubscription | null>(null);
  useEffect(() => () => watch.current?.remove(), []);

  async function locate(onFound: (location: UserLocation) => void) {
    setStatus('locating');
    try {
      if (!(await Location.hasServicesEnabledAsync())) { console.warn('[ubicacion] servicios de ubicación apagados'); setStatus('unavailable'); return; }
      const permission = await Location.requestForegroundPermissionsAsync();
      console.log('[ubicacion] permiso', permission.status, 'puede volver a preguntar:', permission.canAskAgain);
      if (permission.status !== 'granted') { setStatus('denied'); return; }
      const read = ({ coords }: Location.LocationObject) => ({ latitud: coords.latitude, longitud: coords.longitude });
      // A cold GPS fix can hang indoors: fall back to the last known position after 12 s.
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));
      const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout])
        ?? await Location.getLastKnownPositionAsync();
      console.log('[ubicacion] posición', position ? 'obtenida' : 'no disponible');
      if (!position) { setStatus('unavailable'); return; }
      const found = read(position);
      setLocation(found); setStatus('ready'); onFound(found);
      watch.current ??= await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (next) => setLocation(read(next)),
      );
    } catch (error) {
      console.warn('[ubicacion] error', error);
      setStatus('unavailable');
    }
  }
  return { status, location, locate: (onFound: (location: UserLocation) => void) => void locate(onFound) };
}
