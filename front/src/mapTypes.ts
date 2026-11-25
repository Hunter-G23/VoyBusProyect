import type { Line, VehicleInCirculation } from "./types";

export type MapStop = {
  id: number;
  codigo: string;
  nombre: string;
  latitud: number;
  longitud: number;
  lineas: Array<{
    id: number;
    codigo: string;
    color?: string;
    electrica?: boolean | 0 | 1;
  }>;
};

export type MapRoute = {
  id: number;
  linea_id: number;
  linea: string;
  codigo: string;
  nombre: string;
  sentido: string;
  origen: string;
  destino: string;
  variante: boolean | 0 | 1;
  color?: string;
  geometria: { type: "LineString"; coordinates: [number, number][] } | null;
  paraderos: Array<{ paradero_id: number; posicion: number; distancia_m: number }>;
};

export type MapMetadata = {
  version: string;
  fuente: string;
  lineas: Line[];
  recorridos: MapRoute[];
  paraderos: MapStop[];
};

export type StopArrivals = {
  paradero: MapStop;
  generado_en: string;
  fuente: "simulacion" | "gps" | "mixta";
  velocidad_supuesta_kmh?: number;
  llegadas: Array<{
    servicio_id: number;
    vehiculo: string;
    linea: string;
    linea_id: number;
    recorrido_id: number;
    sentido: string;
    destino: string;
    minutos: number;
    segundos: number;
    distancia_m: number;
    origen: "simulacion" | "estimacion";
    color?: string;
    electrica?: boolean | 0 | 1;
  }>;
};

export type MapFocusTarget = { stopId: number; routeId?: number; requestId: number };

export type MapCanvasProps = {
  vehicles: VehicleInCirculation[];
  onSelectVehicle?: (id: number) => void;
  selectedVehicleId?: number;
  stops?: MapStop[];
  routes?: MapRoute[];
  selectedStopId?: number;
  onSelectStop?: (id: number) => void;
  focusTarget?: MapFocusTarget;
  /** Show every listed bus at any zoom (a stop or line filter already narrowed them). */
  revealVehicles?: boolean;
  userLocation?: UserLocation | null;
  cameraTarget?: MapCameraTarget;
  /** Map area hidden by the bottom sheet; camera moves keep their target above it. */
  bottomInset?: number;
  onZoomBandChange?: (band: 'far' | 'mid' | 'near') => void;
};

export type UserLocation = { latitud: number; longitud: number };
export type MapCameraTarget = { center: [number, number]; zoom: number; requestId: number };
