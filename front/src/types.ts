export type User = {
  id: number;
  nombre: string;
  correo: string;
  rol: "pasajero" | "conductor" | "administrador";
  idioma?: "es" | "en";
  tiene_foto?: boolean;
  notificaciones?: NotificationPreferences;
};
export type LineStatus = "activa" | "inactiva" | "temporal";
export type NotificationType = "estado_linea_favorita" | "solicitud";
export type NotificationPreferences = Record<NotificationType, boolean>;
export type PreferencesPatch = { idioma?: "es" | "en"; notificaciones?: Partial<NotificationPreferences> };
export type Line = {
  id: number; codigo: string; nombre: string;
  color?: string; color_texto?: string; electrica?: boolean | 0 | 1;
  estado?: LineStatus; fuente?: string;
  modo_estado?: 'auto' | 'manual';
};
export type Route = {
  id: number;
  nombre: string;
  sentido: string;
  origen: string;
  destino: string;
  linea?: string;
  codigo?: string;
  variante?: boolean | 0 | 1;
};
export type Stop = {
  id: number;
  paradero_id: number;
  posicion: number;
  codigo: string;
  nombre: string;
  latitud: number;
  longitud: number;
};
export type Link = {
  id: number;
  servicio_id: number;
  recorrido_id: number;
  ultima_posicion: number;
  servicio_estado: string;
  codigo_vinculacion: string;
  patente: string;
  linea: string;
  recorrido: string;
  sentido: string;
};
export type Request = {
  id: number;
  estado: "pendiente" | "reconocida" | "atendida" | "cancelada" | "expirada";
  creada_en: string;
  actualizada_en: string;
  destino_id: number;
  clave_idempotencia?: string;
  paradero: string;
  paradero_codigo: string;
  posicion: number;
  servicio_id: number;
  codigo_vinculacion: string;
  linea: string;
  sentido: string;
};
export type CurrentTrip = { vinculo: Link | null; solicitud: Request | null };
export type Inbox = {
  servicio: {
    id: number;
    codigo_vinculacion: string;
    patente: string;
    linea: string;
    sentido: string;
    recorrido: string;
  } | null;
  solicitudes: Request[];
  paraderos: {
    destino_id: number;
    posicion: number;
    codigo: string;
    nombre: string;
    cantidad: number;
  }[];
};
export type Attempt = { clave_idempotencia: string; destino_id: number };
export type VehiclePosition = {
  latitud: number;
  longitud: number;
  medida_en: string;
  desactualizada: boolean;
};
export type VehicleInCirculation = {
  color?: string;
  color_texto?: string;
  electrica?: Line['electrica'];
  servicio_id: number;
  vehiculo: string;
  linea: string;
  recorrido_id: number;
  sentido: string;
  posicion: VehiclePosition | null;
  simulado?: boolean;
  proximo_paradero_id?: number | null;
};
export type VehiclesResponse = {
  fuente: "simulacion" | "gps";
  generado_en: string;
  vehiculos: VehicleInCirculation[];
};
export type LocalFavorite = { linea_id: number; recorrido_id: number | null };
export type Favorite = { id: number; linea: Line; recorrido: Route | null; creado_en: string };
export type FavoritesResponse = { favoritos: Favorite[] };
export type FavoriteInput = { linea_id: number; recorrido_id?: number | null };
export type ProfilePatch = { nombre: string };
export type PasswordChange = { actual: string; nueva: string; confirmacion: string };
export type PhotoInput = { tipo: "image/jpeg" | "image/png"; datos_base64: string };
export type LineStatusPatch = { estado: LineStatus };
// Section 5 does not specify the history envelope. Narrow it after backend integration.
export type TripHistoryResponse = {
  vinculos: { id: number; linea: string; sentido: string; inicio: string; fin: string | null }[];
  solicitudes: Request[];
};
