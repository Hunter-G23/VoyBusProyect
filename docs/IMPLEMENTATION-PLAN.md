# Plan de Implementación — VoyBus

> Plan para cerrar la v3 y completar lo que falta de la [ERS](entrega2/ERS_VoyBus_Entrega2_v1.docx): RF11, RF12, RF13, RF15, RF16, RF17, RF18 y la medición de RNF03.
> Cada paso P cabe en una sesión, deja la app funcionando y se verifica con pruebas concretas. Funciones F del [TRD](TRD.md); pantallas S del [APP-FLOW](APP-FLOW.md).

## 01 · Resumen

| Campo | Valor |
|---|---|
| Nombre del producto | VoyBus |
| Objetivo | v3 validada en teléfono y unida a `main`; operación del viaje, del conductor y administración completas según la ERS |
| Enfoque | Iterativo por módulo de la ERS: primero lo que cambia la experiencia del pasajero, luego conductor, luego administración |
| Plazo estimado | 4 a 5 semanas |
| Equipo | 1 a 3 desarrolladores, con agentes para pasos acotados |

Reglas para todos los pasos:
- `npm test`, `npm run typecheck`, `npm --prefix front run build:web` y `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` deben pasar.
- Cada regla nueva de la API lleva su prueba en `backend/test/` y cada pantalla nueva su `e2e/<pantalla>.spec.ts`.
- Textos con `t()`, colores de `theme.tsx`, movimiento de `motion.ts`, controles de 48 pt.
- Sin dependencias nuevas sin aprobación.

## 02 · Hitos

| Fase | Nombre | Semanas | Entregable | Hito (se puede mostrar) |
|---|---|---|---|---|
| 0 | Cierre de v3 | 1 | v3 validada en iPhone y en `main` | Mapa, panel, ubicación y arranque probados en teléfono |
| 1 | Viaje completo | 1 | RF11 y RF12 | El pasajero cancela una solicitud y se baja del bus |
| 2 | Operación del conductor | 1–2 | RF15 y RF13 | El conductor reconoce, atiende, inicia y cierra su servicio |
| 3 | Administración | 1–2 | RF18, RF17 y RF16 | El administrador gestiona usuarios, vehículos y red |
| 4 | Calidad y entrega | 0,5 | RNF03, RNF05, RNF07 | Informe de tiempos, revisión con lector de pantalla y README reproducible |

## 03 · Detalle de implementación

`‖` marca lo que puede ir en paralelo. Al terminar un paso se marca `[x]`.

### Fase 0 · Cierre de v3

- [ ] **P01** Prueba en iPhone con Expo Go (F7, F14): Mi ubicación (log `[ubicacion]`), arrastre del panel, umbrales de zoom 12,5 y 14, teclado sobre el buscador, inicio animado y movimiento reducido · Aceptación: lista de hallazgos del usuario resuelta o registrada en `docs/designs/voybus-v3-redesign.md`
- [ ] **P02** Revisar sobre el mapa base los tramos rectos largos del GTFS (103Y1, 108 ida, 129 ida, 107N) sin modificar trazados · Aceptación: cada tramo clasificado como avenida real o defecto del GTFS, con captura
- [ ] **P03** Commit de la v3, revisión opcional y unión a `main` · Depende de: P01 · Aceptación: suites completas en verde en la rama y en `main`

### Fase 1 · Viaje completo (S6)

- [ ] **P04** RF11 en API: `POST /api/viaje/solicitudes/:id/cancelar` (titular, solo pendiente, idempotente, 409 si reconocida, atendida o expirada; transacción contra el reconocimiento). Guarda un `evento_solicitud` · Aceptación: pruebas de cancelación repetida, ajena (404), en conflicto y concurrente con reconocimiento
- [ ] **P05** RF11 en Mi viaje: «Cancelar solicitud» con confirmación y spinner; el comprobante muestra «Solicitud cancelada»; desaparece de la bandeja (F11) · Depende de: P04 · Aceptación: `e2e/trip.spec.ts` cancela y la bandeja del conductor ya no la muestra
- [ ] **P06** RF12 en API: `POST /api/viaje/desvincular` (rechaza con solicitud pendiente o reconocida e informa su estado; cierre idempotente con fecha; historial intacto) ‖ P04 · Aceptación: pruebas de cierre, repetición y rechazo con solicitud activa
- [ ] **P07** RF12 en Mi viaje: «Bajarme de este bus» vuelve al paso Vincular; el viaje aparece en Historial (F13) · Depende de: P06 · Aceptación: e2e vincula, se desvincula y vincula otro servicio

### Fase 2 · Operación del conductor (S10, S12)

- [ ] **P08** RF15 en API: `PATCH /api/conductor/solicitudes/:id` con `{ estado: 'reconocida' | 'atendida' }` solo sobre el servicio asignado; transiciones válidas, idempotentes y auditadas en `evento_solicitud` · Aceptación: pruebas de salto inválido, estado final, servicio ajeno (403) y repetición
- [ ] **P09** RF15 en la bandeja: botones «Reconocer» y «Atendida» por solicitud; las atendidas salen de la bandeja y el pasajero ve el cambio en su comprobante y su aviso local · Depende de: P08 · Aceptación: e2e con dos sesiones (pasajero y conductor), cambio visible en ≤ 7 s
- [ ] **P10** RF13 en API: `POST /api/conductor/servicio` (vehículo y recorrido activos, sin otro servicio activo del vehículo o del conductor) y `POST /api/conductor/servicio/cerrar` (fecha final, cierra vínculos, expira solicitudes en una transacción); la última posición solo avanza ‖ P08 · Aceptación: pruebas de vehículo ocupado, recorrido inválido, servicio ajeno y cierre con solicitudes activas
- [ ] **P11** RF13 en S12: elegir vehículo y recorrido, iniciar, ver estado y cerrar con confirmación · Depende de: P10 · Aceptación: e2e inicia, recibe una solicitud y cierra; el pasajero ve «El servicio finalizó»

### Fase 3 · Administración (S11, S13–S15)

- [ ] **P12** RF18 en API: listar cuentas, crear conductores, activar o desactivar y cambiar rol con auditoría; el middleware valida el estado vigente de la cuenta en cada petición · Aceptación: pruebas de correo duplicado, rol desconocido, último administrador, conductor con servicio activo, token válido de cuenta desactivada (401) y ausencia de hashes en respuestas
- [ ] **P13** RF18 en S15 · Depende de: P12 · Aceptación: `e2e/admin.spec.ts` crea un conductor que luego ingresa
- [ ] **P14** RF17 en API y S14: vehículos con patente y código únicos; activar o desactivar sin perder historial ‖ P12 · Aceptación: pruebas de duplicados y desactivación con servicio activo; e2e registra un vehículo y lo usa en P11
- [ ] **P15** RF16 líneas y recorridos (API y S13): crear, editar y desactivar; secuencia de paraderos por ocurrencia; bloquear cambios con servicio activo · Aceptación: pruebas de códigos duplicados, posiciones repetidas y línea con servicio activo
- [ ] **P16** RF16 paraderos (API y S13): crear y editar con coordenadas válidas; desactivar sin borrar referencias; el mapa público los refleja · Depende de: P15 · Aceptación: pruebas de coordenadas inválidas; e2e crea un paradero y lo ve en Mapa (F7)

### Fase 4 · Calidad y entrega

- [ ] **P17** RNF03: script de carga sin dependencias nuevas (`scripts/carga.cjs`, 20 clientes concurrentes, 100 operaciones por tipo) con informe de p95 y errores en `docs/entrega2/` · Aceptación: p95 ≤ 2 s en catálogo y solicitudes; equipo y red registrados
- [ ] **P18** RNF05: recorrer los flujos con texto al 150 % y lector de pantalla (VoiceOver y TalkBack) en teléfono · Aceptación: hallazgos corregidos o registrados
- [ ] **P19** RNF07: actualizar el README (instalación, `.env`, migración, seed, Expo Go por red local, rama y commit probados) · Aceptación: otra persona levanta el proyecto siguiendo solo el README

## 04 · Después de la entrega

| Bloque | Qué hacer |
|---|---|
| Datos reales | Reemplazar el GTFS 2025 cuando la DTPR publique uno vigente; evaluar posiciones GPS reales |
| Recoger comentarios | Prueba con pasajeros y conductores reales de una línea |
| Iterar y mejorar | Ajustar umbrales del mapa, avisos y tiempos según uso |
| Siguiente versión | Push remoto y colores propios de variantes, si el cliente los confirma |

## 05 · Hitos de revisión

- Al cerrar cada fase se puede ofrecer una revisión independiente del diff; nunca es automática.
- Antes de unir a `main` en P03 y al final de la Fase 3 conviene revisar seguridad: permisos por rol, transacciones y respuestas sin datos sensibles.
