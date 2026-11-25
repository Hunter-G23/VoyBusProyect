import { useEffect, useRef, useState } from 'react';
import type { UserLocation } from './mapTypes';
import type { LocationStatus } from './useUserLocation';

export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const watch = useRef<number | undefined>(undefined);
  useEffect(() => () => { if (watch.current !== undefined) navigator.geolocation.clearWatch(watch.current); }, []);

  function locate(onFound: (location: UserLocation) => void) {
    if (!window.isSecureContext) { setStatus('insecure'); return; }
    if (!('geolocation' in navigator)) { setStatus('unavailable'); return; }
    setStatus('locating');
    const read = ({ coords }: GeolocationPosition) => ({ latitud: coords.latitude, longitud: coords.longitude });
    const failed = (error: GeolocationPositionError) =>
      setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
    navigator.geolocation.getCurrentPosition((position) => {
      const found = read(position);
      setLocation(found); setStatus('ready'); onFound(found);
      if (watch.current === undefined) {
        watch.current = navigator.geolocation.watchPosition((next) => setLocation(read(next)), () => {}, { enableHighAccuracy: true });
      }
    }, failed, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }
  return { status, location, locate };
}
