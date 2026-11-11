export type User = {
  id: number;
  nombre: string;
  correo: string;
  rol: "pasajero" | "conductor" | "administrador";
};
export type Line = { id: number; codigo: string; nombre: string };
export type Route = {
  id: number;
  nombre: string;
  sentido: string;
  origen: string;
  destino: string;
  linea?: string;
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
