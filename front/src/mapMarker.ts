import type { Translate } from './i18n';
import type { ThemeTokens } from './theme';
import type { VehicleInCirculation, VehiclePosition } from './types';

export const vehicleMarkerSize = 48;
export const vehicleMarkerCss = `
  .voybus-marker {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: ${vehicleMarkerSize}px;
    min-width: ${vehicleMarkerSize}px;
    max-width: ${vehicleMarkerSize}px;
    height: ${vehicleMarkerSize}px;
    min-height: ${vehicleMarkerSize}px;
    max-height: ${vehicleMarkerSize}px;
    padding: 0;
    margin: 0;
    cursor: pointer;
    border-radius: 12px;
  }
  .voybus-marker svg { display: block; width: 100%; height: 100%; }
  .voybus-marker:focus-visible { outline: 3px solid var(--vehicle-focus); outline-offset: 2px; }
  .voybus-marker[aria-pressed="true"] .voybus-marker-point {
    stroke: var(--vehicle-focus);
    stroke-width: 3px;
  }
  .voybus-marker { transition: opacity 200ms ease-out, visibility 0s; }
  .voybus-marker svg > * { transition: opacity 200ms ease-out; }
  .voybus-map[data-zoom-band="far"] .voybus-marker:not([data-pinned="true"]) {
    opacity: 0; visibility: hidden; pointer-events: none;
    transition: opacity 200ms ease-out, visibility 0s 200ms;
  }
  .voybus-map[data-zoom-band="mid"] .voybus-marker:not([data-pinned="true"]) { pointer-events: none; }
  .voybus-map[data-zoom-band="mid"] .voybus-marker:not([data-pinned="true"]) svg > :not(.voybus-marker-point) { opacity: 0; }
  .voybus-user { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
    background: color-mix(in srgb, var(--vehicle-focus) 22%, transparent); pointer-events: none; }
  .voybus-user::after { content: ""; width: 14px; height: 14px; border-radius: 50%; box-sizing: border-box;
    background: var(--vehicle-focus); border: 3px solid var(--vehicle-ink); box-shadow: 0 1px 4px rgba(0,0,0,.35); }
  /* Selected bus: a ring keeps pinging out from its dot. User location: a breathing halo. */
  .voybus-marker[aria-pressed="true"]::after { content: ""; position: absolute; left: 50%; top: 50%;
    width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; box-sizing: border-box;
    border: 2px solid var(--vehicle-focus); pointer-events: none; animation: voybus-ping 1.6s ease-out infinite; }
  .voybus-user::before { content: ""; position: absolute; inset: 0; border-radius: 50%;
    background: color-mix(in srgb, var(--vehicle-focus) 30%, transparent); animation: voybus-ping 2.2s ease-out infinite; }
  @keyframes voybus-ping { from { transform: scale(0.6); opacity: 0.9; } to { transform: scale(2.4); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .voybus-marker, .voybus-marker svg > * { transition: none !important; }
    .voybus-marker::after, .voybus-user::before { animation: none !important; display: none; }
  }
`;

export function vehicleMarkerTheme(theme: ThemeTokens) {
  return `.voybus-map {
    --vehicle-fill: ${theme.ink};
    --vehicle-ink: ${theme.paper};
    --vehicle-outline: ${theme.plate};
    --vehicle-signal: ${theme.signal};
    --vehicle-signal-ink: ${theme.signalInk};
    --vehicle-focus: ${theme.action};
  }`;
}

function gtfsColor(color: string | undefined, fallback: string) {
  return color && /^#[a-f\d]{6}$/i.test(color) ? color : fallback;
}

export function isMappablePosition(position: VehiclePosition | null): position is VehiclePosition {
  return !!position && Number.isFinite(position.latitud) && Math.abs(position.latitud) <= 90
    && Number.isFinite(position.longitud) && Math.abs(position.longitud) <= 180;
}

export function vehicleMarker(vehicle: VehicleInCirculation, t: Translate) {
  const stale = vehicle.posicion?.desactualizada;
  const label = [
    t('map.vehicle', { vehicle: vehicle.vehiculo, line: vehicle.linea }),
    t('map.direction', { direction: vehicle.sentido }),
    t(stale ? 'map.stale' : 'map.fresh'),
    ...(vehicle.electrica ? [t('map.electric')] : []),
  ].join(' · ');
  const fill = gtfsColor(vehicle.color, 'var(--vehicle-fill)');
  const ink = gtfsColor(vehicle.color_texto, 'var(--vehicle-ink)');

  return { label, markup: `<svg viewBox="0 0 48 48" aria-hidden="true" fill="${ink}">
    <path d="M26 22l5-5" stroke="var(--vehicle-outline)" stroke-width="1" />
    <circle class="voybus-marker-point" cx="24" cy="24" r="4" fill="${fill}" stroke="var(--vehicle-ink)" stroke-width="2"${stale ? ' stroke-dasharray="2 1"' : ''} />
    <g class="voybus-marker-bus">
    <path d="M31 19v3m9-3v3" stroke="var(--vehicle-outline)" stroke-width="2.5" stroke-linecap="round" />
    <rect class="voybus-marker-body" x="28" y="4" width="15" height="16" rx="3" fill="${fill}"
      stroke="${stale ? ink : 'var(--vehicle-outline)'}" stroke-width="1.5"${stale ? ' stroke-dasharray="3 2"' : ''} />
    <rect x="30" y="7" width="11" height="7" rx="1" fill="${ink}" fill-opacity="0.96" />
    <path d="M35.5 7v7" stroke="${fill}" stroke-width="1" />
    <path d="M30 17h2m7 0h2" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" />
    </g>
    ${vehicle.electrica ? `<g class="voybus-marker-electric"><circle cx="43" cy="5" r="4" fill="var(--vehicle-signal)" stroke="var(--vehicle-outline)" stroke-width="1" />
      <path d="M43.5 2l-2 3h1.5l-.5 3 2.5-3.5h-1.5z" fill="var(--vehicle-signal-ink)" /></g>` : ''}
  </svg>` };
}
