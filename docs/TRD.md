# TRD — VoyBus

## 1. Resumen

VoyBus permite consultar la red de micros de Antofagasta, ver las micros en un mapa y pedir una parada a bordo. El pasajero elige un destino de su recorrido y recibe un comprobante. El conductor consulta las solicitudes de su servicio con el vehículo detenido. El administrador publica el estado de las líneas.

El cliente funciona en Android, iOS (Expo Go) y web. Este documento describe la rama `codex/rediseno-movilidad` (v3, diseño Costa claro y Pulso oscuro) y planifica lo que falta de la [ERS de la entrega 2](entrega2/ERS_VoyBus_Entrega2_v1.docx). Las ampliaciones se detallan en el [diseño v2](designs/voybus-v2-design.md) y el [rediseño v3](designs/voybus-v3-redesign.md).

## 2. Features

| ID | Función | ERS | Prioridad | Estado |
|---|---|---|---|---|
| F1 | Registro | RF01 | Must | Hecho |
| F2 | Ingreso con control de rol | RF02 | Must | Hecho |
| F3 | Cierre de sesión | RF03 | Must | Hecho |
| F4 | Líneas y estado de servicio | RF04 + v2/v3 | Must | Hecho |
| F5 | Recorridos y variantes | RF05 + v2 | Must | Hecho |
| F6 | Paraderos ordenados | RF06 | Must | Hecho |
| F7 | Mapa de micros, paraderos y ubicación | RF07 + v3 | Must | Hecho, falta validar en iPhone |
| F8 | Vínculo por código | RF08 | Must | Hecho |
| F9 | Solicitud de parada | RF09 | Must | Hecho |
| F10 | Comprobante | RF10 | Must | Hecho |
| F11 | Bandeja del conductor | RF14 | Must | Hecho |
| F12 | Favoritos | v2 | Must | Hecho |
| F13 | Perfil e historial | v2 | Must | Hecho |
| F14 | Preferencias y avisos | v2 + v3 | Must | Hecho |
| F15 | Seguridad de la cuenta | v2 | Must | Hecho |
| F16 | Estado de líneas por el administrador | v2 + v3 | Must | Hecho |
| F17 | Cancelar una solicitud pendiente | RF11 | Should | Pendiente |
| F18 | Desvincularse de un servicio | RF12 | Should | Pendiente |
| F19 | Iniciar y cerrar un servicio | RF13 | Should | Pendiente |
| F20 | Reconocer y atender solicitudes | RF15 | Should | Pendiente |
| F21 | Mantener la red de transporte | RF16 | Could | Pendiente |
| F22 | Mantener vehículos | RF17 | Could | Pendiente |
| F23 | Administrar usuarios y roles | RF18 | Could | Pendiente |

## 3. Comportamiento esperado

### F1 a F3 — Identidad y acceso

- Registro: con nombre, correo disponible y contraseña válida se crea una cuenta de pasajero y se ofrece añadir una foto u omitirla. Un correo duplicado o un campo inválido muestra el error junto al campo.
- Ingreso: el pasajero accede a sus pestañas, el conductor a su bandeja y el administrador a Estado de líneas. Se rechazan credenciales incorrectas y cuentas inactivas.
- Cierre: el servidor incrementa la versión de sesión y el cliente borra la credencial local. Un token anterior recibe HTTP 401.

### F4 a F6 — Red de transporte

- Líneas muestra código, nombre, color GTFS y estado con texto e icono (activa, no activa, temporalmente inactiva). El filtro por estado y la búsqueda no ocultan filtros. La E01 lleva rayo y «Línea eléctrica».
- Estado automático: activa si hay al menos una micro con posición en el mapa; no activa si no hay ninguna. El administrador puede fijar un estado manual y volver a automático (F16).
- Al elegir una línea se ven sus recorridos (sentido, destino, variantes con código GTFS) y los paraderos en orden de paso. Tocar un paradero abre ese mismo paradero en el Mapa.
- La pantalla identifica la fuente y versión del GTFS y advierte que su vigencia oficial terminó el 31-12-2025.

### F7 — Mapa

- Visibilidad por zoom: con zoom menor a 12,5 no se dibujan micros y un aviso invita a acercarse; entre 12,5 y 14 cada micro es un punto de su color; desde 14 se ve el mini bus con rayo eléctrico y área táctil de 48 pt. Los paraderos son letreros con un bus y aparecen con fundido desde zoom 14,5. La micro y el paradero seleccionados se ven a cualquier zoom.
- Panel inferior con tres alturas (contraído, medio, expandido). Sigue el dedo y se asienta según la velocidad; tocar el asa lo contrae o expande. Contiene buscador de paraderos, contexto con botón de cierre, filtro por línea con el color de cada línea y la lista.
- Paradero: se ven solo las micros que aún pasarán por él, ordenadas, con minutos marcados como simulados o aproximados. El filtro de línea ofrece solo las líneas que lo sirven.
- Micro: se dibuja solo su recorrido y sentido con el color de su línea, la cámara se acerca a ella y se oculta el resto de la flota y el filtro. Si vino de un paradero, el botón de cierre vuelve a ese paradero.
- Mi ubicación: marcador propio distinto de las micros y botón que centra la cámara. Contempla carga, permiso denegado (con acceso a ajustes), GPS apagado, posición no disponible y usuario fuera de Antofagasta. Las actualizaciones de micros no mueven la cámara.

### F8 a F11 — Viaje y conductor

- Vínculo: el pasajero ingresa el código del vehículo con servicio activo; un código inválido impide avanzar.
- Solicitud: solo destinos futuros del recorrido vinculado. Un reintento con la misma clave devuelve la solicitud ya guardada.
- Comprobante: identificador, destino y estado; solo el titular puede consultarlo.
- Bandeja: el conductor consulta cada cinco segundos las solicitudes de su servicio, sin acceso a otros servicios.

### F12 a F16 — Cuenta y administración

- Favoritos en la cuenta o en el dispositivo, con aviso la primera vez y copia idempotente al ingresar.
- Perfil con foto (JPEG o PNG ≤ 512 KB), nombre editable, historial y privacidad.
- Preferencias: idioma (español, inglés) y tema (sistema, claro, oscuro) disponibles también sin sesión desde Ajustes; los avisos locales requieren cuenta.
- Seguridad: cambiar la contraseña conserva la sesión actual y cierra las demás; una contraseña actual incorrecta responde HTTP 403.
- Estado de líneas: cada cambio confirmado queda auditado con estado anterior, nuevo, autor y fecha; otros roles reciben HTTP 403.

### F17 — Cancelar una solicitud pendiente (RF11)

- El titular cancela una solicitud pendiente: queda «cancelada» con fecha del servidor y desaparece de la bandeja activa. Repetir la cancelación conserva el resultado.
- Si ya fue reconocida, atendida o expirada, la API responde conflicto sin cambiar el estado. La carrera entre reconocer y cancelar se resuelve en una transacción.

### F18 — Desvincularse de un servicio (RF12)

- El pasajero cierra su vínculo activo si no tiene una solicitud pendiente o reconocida. El vínculo queda cerrado con fecha y puede vincular otro servicio; el historial sigue disponible.
- Con solicitud activa se rechaza e informa el estado. Repetir el cierre no crea otro vínculo ni borra historial.

### F19 — Iniciar y cerrar un servicio (RF13)

- El conductor inicia un servicio con vehículo y recorrido activos si ni el vehículo ni él tienen otro servicio activo. Al cerrarlo se registra la fecha final, se cierran sus vínculos y expiran las solicitudes activas, todo en una transacción.
- La última posición pasada solo avanza dentro de su recorrido. Se rechaza vehículo ocupado, recorrido inválido o servicio ajeno.

### F20 — Reconocer y atender solicitudes (RF15)

- Sobre su servicio, el conductor reconoce una solicitud pendiente y después la marca atendida. Cada transición guarda actor, estado y fecha en `evento_solicitud`, se refleja en el comprobante (F10) y retira las atendidas de la bandeja.
- Repetir el mismo estado conserva el resultado. Saltar de pendiente a atendida, cambiar estados finales o tocar otro servicio se rechaza.

### F21 — Mantener la red (RF16)

- El administrador crea y edita líneas, recorridos y paraderos con ocurrencias ordenadas, y desactiva registros sin borrar los referenciados. Los cambios se reflejan en las consultas públicas.
- Se rechazan códigos duplicados, posiciones repetidas y coordenadas inválidas. Un recorrido con servicio activo no admite cambios de secuencia y no se desactiva una línea con servicios activos.

### F22 — Mantener vehículos (RF17)

- Registrar y editar vehículos con patente y código de vinculación únicos; activar o desactivar sin perder servicios históricos.
- Se rechaza desactivar un vehículo con servicio activo y duplicar código o patente. El código no funciona como credencial de conductor.

### F23 — Usuarios y roles (RF18)

- Crear conductores, consultar cuentas y activar o desactivar usuarios. Cambiar roles solo desde administración, guardando actor, fecha y cambio. Ninguna respuesta revela contraseñas ni hashes.
- Se rechaza correo duplicado y rol desconocido. No se puede desactivar al último administrador activo ni cambiar el rol o desactivar a un conductor con servicio activo. Las rutas protegidas comprueban el estado vigente de la cuenta aunque el token siga válido.

## 4. Requerimientos no funcionales

| ID | Tipo | Criterio de aceptación | Estado |
|---|---|---|---|
| R1 | Rendimiento · RNF03 | Con 20 usuarios concurrentes y 100 operaciones por tipo, p95 ≤ 2 s en catálogo y en crear o leer solicitudes; propagación a la bandeja ≤ 7 s. | Medición pendiente |
| R2 | Seguridad · RNF01/02 | bcrypt factor 12, JWT en cookie HttpOnly (web) y SecureStore (móvil), versión de sesión, HTTPS y clave ≥ 32 caracteres en producción. Sin secretos en respuestas ni registros. | Hecho |
| R3 | Accesibilidad · RNF05 | WCAG 2.2 AA en ambos temas, objetivos táctiles ≥ 48 pt, foco visible, nada solo por color, texto usable al 150 % (ERS) y al 200 % (v2). | Hecho en web; falta lector de pantalla en dispositivo |
| R4 | Consistencia · RNF04 | Reintentos idempotentes y un vínculo y una solicitud activa como máximo; migraciones repetibles. | Hecho |
| R5 | Recuperación · RNF06 | Petición sin respuesta en 10 s muestra error recuperable sin duplicar solicitudes. | Hecho |
| R6 | Reproducibilidad · RNF07 | README con instalación, migración, datos de prueba y arranque; rama y commit de la versión probada. | Revisar al cerrar v3 |
| R7 | Movimiento | Solo `transform` y `opacity`. Panel 320 ms con curva de cajón; inicio de marca ~2,4 s; scroll ligado al dedo. Con movimiento reducido, fundidos o cambio inmediato. | Hecho |
| R8 | Datos GTFS | Trazados a ≤ 5 m del GTFS original (Douglas-Peucker) y paraderos a ≤ 40 m de su trazado. | Hecho y probado |

## 5. Stack y arquitectura

- **Cliente.** React Native, Expo SDK 58 y TypeScript. Barra con Mapa, Líneas, Favoritos y Mi viaje; Perfil o Ajustes desde la cabecera. Diseño Costa (claro) y Pulso (oscuro) con la marca «V voybus», Barlow y Barlow Condensed. Colores en `front/src/theme.tsx`, movimiento en `front/src/motion.ts`, textos con `t()` por pantalla.
- **Mapa.** MapLibre: componente nativo en web y WebView en Expo Go, con la misma lógica de capas (`mapLayers.ts`). Ubicación con `expo-location` (aprobada el 25-11-2026) y la geolocalización del navegador en web.
- **Servidor.** API REST con Express sobre Node.js 24+ y SQLite (`node:sqlite`). En desarrollo, Expo y la API corren por separado y el teléfono se conecta por la red local.
- **Catálogo.** `backend/scripts/gtfs-extract.cjs` procesa los CSV de la DTPR y simplifica cada trazado a 5 m. El simulador mueve cuatro micros virtuales por línea sobre esos trazados y respeta las suspensiones manuales.

## 6. Restricciones

- La fuente es DTPR, GTFS `Antofagasta20250307`: 13 líneas base y 18 variantes, con vigencia oficial vencida el 31-12-2025. Es la última versión publicada.
- La línea 129 tiene un desvío transitorio anunciado por la Seremi (norte a sur, 09/11/2026 a 31/12/2026) que el GTFS no incluye; la app lo avisa sin alterar el trazado.
- Posiciones simuladas e identificadas como tales. El seed de demostración está bloqueado en producción.
- Dependencias nuevas requieren aprobación del usuario.

## 7. Fuera de alcance

- GPS real, pagos, timbre físico y notificaciones push remotas.
- Líneas 106, 204 y 214, ausentes del GTFS, e idiomas distintos de español e inglés.
- Marcar como eléctrica cada micro individual: el GTFS solo permite marcarlo por línea.

## 8. Preguntas abiertas

- ¿Las variantes usan el color de su línea base o su propio `route_color` del GTFS? Hoy heredan el color base.
- ¿Los umbrales de zoom (12,5 y 14) son cómodos en el teléfono? Se ajustan tras la prueba del usuario.
- ¿La app debe permitir la orientación horizontal en el teléfono? `app.json` la fija en vertical.
