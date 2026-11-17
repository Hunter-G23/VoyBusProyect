# VoyBus v2: datos reales de Antofagasta, perfil, favoritos y rediseño

Estado: borrador para revisión. Fecha: 17 de noviembre de 2026. Rama: `rediseno-ui`, creada desde `integracion/rf07-mapa` (d32b336).

## 1. Objetivo

Que VoyBus se sienta como una aplicación real para el transporte público de Antofagasta, usada con una mano dentro de la micro:

1. Reemplazar el catálogo ficticio por las líneas, recorridos y paraderos oficiales de Antofagasta.
2. Mostrar cada línea con su color oficial y su estado (activa, no activa, temporalmente inactiva).
3. Agregar perfil de usuario, favoritos e historial de viajes.
4. Rediseñar la interfaz con la dirección "Letrero" aprobada, con movimiento con propósito y WCAG 2.2 AA verificado.

## 2. Decisiones ya tomadas por el usuario

Citas textuales de la conversación, en orden.

- D1, rediseño: "Rediseña la interfaz de VoyBus [...] No toques el backend ni la lógica de negocio." Esta restricción aplica al rediseño visual. Las funciones nuevas de las secciones 5 a 7 sí requieren backend y se tratan como unidades separadas.
- D2, dirección visual: "mira la 1 me parecio bien, pero el vinculado y destino y comprobante del segundo me parecio mejor, puede tener un poco mas de detalle, tambien los botones de ingresar y salir de la 2 me gustaron mas que del 1, podriamos implementar el 1 completamente y llevarnos esas mejores partes del 2". Base: "Letrero". Desde "Boleto" se toman el indicador de pasos y los botones de la cabecera.
- D3, paleta: "acuerdate de la paleta de colores que habiamos acordado". Se mantiene `docs/entrega2/PALETA.md`.
- D4, fuentes: instalar Barlow Condensed y Barlow. Ya están instaladas en la rama y todavía no tienen commit.
- D5, alcance nuevo: "agregar una seccion de perfil donde salga la foto del pasajero, su nombre y abajo su correo y abajo su rol, y mas abajo opciones como miperfil que permite editar, mis favoritos, historial de viajes, preferencias de idioma, tema, notificaciones y privacidad, tambien de seguridad, para cmabiar su contraseña. y en la parte de abajo de la barra tengan 2 secciones mas la de favoritos que permite agregar linea favorita y recorridos y otro de lineas que salgan las lineas y se vea su status. tipo activa, no activa o temporalmente inactiva, con respectos colores verde rojo y amarilla. tambien me gustaria que fuera basado en las lineas de antofagasta".
- D6, color por línea: "me gustaria que al momento de poner su linea fuera basado en su color [...] y las E son electricas tambien podrias ponerle un detalle a ello".
- D7, fuente de los colores: "el de gtfs".
- D8, movimiento, del brief del rediseño: solo `transform` y `opacity`; tema en 200-250 ms; sección o pestaña en 150-200 ms con un indicador que se desplaza; botones en 100-150 ms con escala leve y sin rebote; carga que no cambia el ancho del botón; entrada escalonada de listas solo la primera vez; transición que explique cada paso de la solicitud; carga y error según cuánto tarde; con "reducir movimiento" activo, solo fundidos o nada. La misma implementación en web y en iPhone.
- D9, accesibilidad, del brief del rediseño: WCAG 2.2 AA verificado. Contraste de 4.5:1 en texto y de 3:1 en texto grande y en bordes de controles, en los dos temas. Objetivos táctiles de 48 pt. Nada comunicado solo con color. Foco visible y teclado en web. Texto usable al 200 %. `accessibilityLabel`, `accessibilityRole` y `accessibilityState` en cada control.
- D10, flujo: correr `npm test`, `npm run typecheck` y `npm run test:e2e` después de cada pantalla. Preguntar antes de agregar cualquier dependencia nueva.
- D11, respuestas a las preguntas abiertas del primer borrador (texto literal): "que de la opcion de subir una al inicio, si no sube nada queda como una por default como instagram, nop tambien se hacen si variantes se incluyen con los mismos colores. si se puede cerrar otras si. El admin. se guardan en el telefono y se de la un popup como recordatorio de que debe ingresar la primera vez que guarde uno". Se interpretan así:
  - P1, foto: se ofrece subirla al inicio, después del registro. Si no se sube, se muestra un avatar genérico, una silueta neutra.
  - P2, idioma y notificaciones: se implementan las dos.
  - P3, variantes: se incluyen, con el color de su línea base. **Es una interpretación por confirmar**, porque el GTFS asigna colores propios a algunas variantes, por ejemplo 103N #066A40 frente a 103 #005BAA.
  - P4, cambio de contraseña: cierra las demás sesiones.
  - P5, estado de las líneas: lo cambia un administrador.
  - P6, favoritos sin sesión: se guardan en el dispositivo. La primera vez se muestra un aviso que recuerda ingresar.

## 3. Fuente de datos: GTFS oficial

Fuente: GTFS de la División de Transporte Público Regional, `https://dtpr.gob.cl/wp-content/uploads/2025/12/antofagasta.zip`, versión `Antofagasta20250307`.

| Archivo | Contenido útil |
| --- | --- |
| routes.txt | 31 rutas: 13 líneas base y 18 variantes (sufijos N, Y1, Y2), con `route_color` y `route_text_color`. |
| stops.txt | 746 paraderos con nombre y coordenadas. |
| trips.txt | Viajes por ruta y sentido (`direction_id`), con letrero de destino (`trip_headsign`) y `shape_id`. |
| stop_times.txt | 63 MB. Secuencia de paraderos de cada viaje. |
| shapes.txt | Trazado de cada recorrido. |

Limitaciones verificadas:

- El calendario del archivo es 2025 (`feed_start_date` 20250101, `feed_end_date` 20251231). Es la versión más reciente que publica la DTPR, pero ya está vencida. La interfaz debe indicar la versión y la fecha de los datos.
- No trae el estado de las líneas ni la condición de "eléctrica". La E01 se identifica por su código y por fuentes públicas.
- Wikipedia (edición del 12 de junio de 2026) menciona líneas que el GTFS no incluye: 106, 204 y 214. No se agregan sin una fuente con paraderos.

### 3.1 Importación

El `.zip` no se procesa en tiempo de ejecución, ni se suma una dependencia para leerlo.

1. Un script de desarrollo, `backend/scripts/gtfs-extract.cjs`, lee los CSV ya descomprimidos y genera `backend/src/database/data/antofagasta.json`. No lee ningún `.zip`. El archivo generado se versiona y su tamaño se acota con el criterio siguiente.
2. Por cada línea base y cada `direction_id` se elige como representativo el viaje con más paraderos. De él se toma la secuencia de paraderos en orden y su `trip_headsign` como destino.
3. El JSON contiene líneas, recorridos (dos sentidos por línea base), solo los paraderos usados, la secuencia de cada recorrido y, opcionalmente, una forma simplificada del trazado para el mapa.
4. Las 18 variantes (sufijos N, Y1, Y2) entran como recorridos adicionales de su línea base. Cada una conserva su código (por ejemplo "103N") y el nombre del GTFS, y toma el color de la línea base (D11, P3). El GTFS no explica qué significa cada sufijo, así que la interfaz muestra el código y el nombre sin interpretarlos.
5. El seed carga ese JSON. Los vehículos, conductores y servicios siguen siendo de demostración (patentes DEMO01 a DEMO04) y quedan asignados a recorridos reales.

Los datos del GTFS son públicos. La atribución "Datos: DTPR, GTFS Antofagasta 2025" se muestra en la pantalla Líneas y en el README.

## 4. Modelo de datos

Los cambios se aplican en `schema.sql` y `migrate.js`. Las bases ya existentes reciben `ALTER TABLE` idempotentes.

| Tabla | Cambio | Motivo |
| --- | --- | --- |
| linea | `color TEXT`, `color_texto TEXT`, `electrica INTEGER 0/1`, `estado TEXT CHECK IN ('activa','inactiva','temporal')`. `activa` se conserva y se deriva de `estado` para compatibilidad. | D5, D6, D7 |
| linea | `fuente TEXT` (por ejemplo `gtfs:Antofagasta20250307`) | trazabilidad de los datos |
| posicion_vehiculo | `origen TEXT CHECK IN ('simulacion','gps')` | Hallazgo de la revisión de RF07: el campo `fuente` se calcula hoy desde la configuración, así que las muestras simuladas antiguas aparecen como "gps". |
| recorrido | `codigo TEXT` (por ejemplo "103N"), `variante INTEGER 0/1` | D11, P3 |
| favorito (nueva) | `id`, `usuario_id` FK, `linea_id` FK, `recorrido_id` FK opcional, `creado_en`; unicidad sobre (usuario, línea, recorrido) | D5 |
| usuario | `sesion_version INTEGER NOT NULL DEFAULT 0`, `idioma TEXT DEFAULT 'es'` | D11, P4; P2 |
| usuario_foto (nueva) | `usuario_id` PK y FK, `tipo TEXT CHECK IN ('image/jpeg','image/png')`, `datos BLOB`, `actualizada_en` | D11, P1 |
| preferencia_notificacion (nueva) | `usuario_id`, `tipo` (por ejemplo `estado_linea_favorita`, `solicitud`), `activa` | D11, P2 |
| linea_estado_evento (nueva) | `linea_id`, `estado_anterior`, `estado_nuevo`, `admin_id`, `fecha` | Registro de quién cambió el estado de cada línea (D11, P5). |

Riesgo: cambia el formato persistido (ítem de alto riesgo 1). Mitigación: la migración es idempotente, se prueba sobre una base creada con el esquema anterior y el seed se puede rehacer.

## 5. API

Los contratos existentes no se rompen: los cambios solo agregan campos opcionales o rutas nuevas.

| Método y ruta | Acceso | Respuesta o efecto |
| --- | --- | --- |
| `GET /api/red/lineas` | pública | Agrega `color`, `color_texto`, `electrica`, `estado`. El orden pasa a ser por código. Por defecto mantiene el contrato anterior y devuelve solo las líneas activas. Con `?todas=1` devuelve todas con su estado; es lo que usa la pestaña Líneas. |
| `GET /api/red/vehiculos` | pública | Sin cambio de forma. `fuente` se calcula desde `posicion_vehiculo.origen`. |
| `GET /api/favoritos` | pasajero | `{ favoritos: [{ id, linea, recorrido \| null, creado_en }] }` |
| `POST /api/favoritos` | pasajero | Body `{ linea_id, recorrido_id? }`. Idempotente: un duplicado devuelve el favorito existente. |
| `DELETE /api/favoritos/:id` | pasajero | Solo los favoritos propios; uno ajeno devuelve 404. |
| `PATCH /api/auth/me` | sesión | Body `{ nombre }`, con la validación de RF01. El correo y el rol no se editan. |
| `POST /api/auth/contrasena` | sesión | Body `{ actual, nueva, confirmacion }`. Verifica la contraseña actual con bcrypt y aplica las reglas de RF01. Si la contraseña actual es incorrecta responde 403 con el código `CONTRASENA_INCORRECTA`, no 401, porque el cliente trata cualquier 401 como sesión vencida. Ver 9 (R2). |
| `POST /api/auth/logout` | sesión | Además de borrar la cookie, incrementa `sesion_version`, de modo que un token copiado deja de valer. |
| `GET /api/viaje/historial` | pasajero | Vínculos cerrados y solicitudes propias, ordenados por fecha, sin datos de otros usuarios. |
| `PUT /api/auth/me/foto` | sesión | Body JSON `{ tipo, datos_base64 }` con un máximo de 512 KB decodificados. Se valida el tipo por sus bytes iniciales (firmas JPEG y PNG), no por la extensión. No se agrega ninguna dependencia de servidor. |
| `DELETE /api/auth/me/foto` | sesión | Vuelve al avatar genérico. |
| `GET /api/auth/me/foto` | sesión | Devuelve la imagen propia con `Content-Type` y `Cache-Control: private`. No hay acceso a fotos ajenas. |
| `PATCH /api/auth/me/preferencias` | sesión | `{ idioma?, notificaciones?: { tipo: boolean } }` |
| `PATCH /api/admin/lineas/:id/estado` | administrador | Body `{ estado }`. Registra el cambio en `linea_estado_evento`. Otros roles reciben 403. |

Cerrar las demás sesiones al cambiar la contraseña (D11, P4) funciona así:

1. El JWT incluye la claim `sv`, con el valor de `usuario.sesion_version`.
2. `POST /api/auth/contrasena` incrementa ese valor.
3. El middleware de autenticación rechaza con 401 todo token cuyo `sv` no coincida.
4. La sesión que hizo el cambio recibe un token nuevo, que en web llega en la cookie.

Favoritos sin sesión (D11, P6): se guardan en el dispositivo, con `storage` en web y SecureStore en el teléfono, usando la misma forma `{ linea_id, recorrido_id }`. La primera vez se muestra un aviso: "Tus favoritos se guardan solo en este teléfono. Ingresa para no perderlos." Al ingresar se ofrece subirlos a la cuenta mediante `POST /api/favoritos`, que es idempotente.

Hallazgos de la revisión de RF07 que se corrigen en la unidad W1:

- El `setInterval` del simulador captura los errores, los registra y no tumba el proceso.
- Se rehace la prueba que no probaba nada: los timers simulados se activan antes de crear la app.

## 6. Interfaz

### 6.1 Navegación

- Pasajero, barra inferior con cuatro pestañas:
  - **Líneas** reemplaza a Recorridos. Muestra la lista con su estado y, al tocar una línea, sus recorridos y paraderos.
  - **Mapa**.
  - **Favoritos**.
  - **Mi viaje**.
- Cabecera: marca VoyBus a la izquierda. A la derecha, un avatar con iniciales que abre **Perfil**, o el botón "Ingresar" sin sesión. Los botones de la cabecera usan el estilo de "Boleto" (D2): rectángulo con borde de 2 px y radio de 6 px.
- Conductor: su vista actual con el estilo nuevo y acceso a Perfil.
- Administrador: sección "Estado de líneas", con la lista de líneas y un selector de tres estados (D11, P5).
- Avatar: la foto propia si existe; si no, un avatar genérico (una silueta neutra sobre azul tinta) (D11, P1).

### 6.2 Pantallas

| Pantalla | Contenido | Estados |
| --- | --- | --- |
| Líneas | Placa por línea con su color GTFS, el código grande, el nombre "origen - destino", un chip de estado y, en la E01, un rayo con el texto "Eléctrica". Filtro por estado. Atribución de los datos. | cargando, vacío, error, sin conexión con datos guardados |
| Detalle de línea | Recorridos de ida y vuelta, lista de paraderos en orden y botón "Agregar a favoritos". | igual |
| Mapa | RF07 con el estilo nuevo y el color de cada línea en los marcadores. Corrige los hallazgos de la revisión: worker del mismo origen, error solo si el mapa no carga, encuadre solo la primera vez, enlaces bloqueados dentro del WebView. | igual, más "Posiciones simuladas" |
| Favoritos | Líneas y recorridos guardados, con acceso directo y opción para quitar. El vacío explica cómo agregar uno. | igual; sin sesión invita a ingresar |
| Mi viaje | Pasos Vincular, Destino y Comprobante con el indicador de "Boleto", más detallado: número, nombre, estado e icono. Transición entre pasos. | los actuales de RF08 a RF10 |
| Perfil | Avatar, nombre, correo y rol. Opciones: Mi perfil (editar nombre; cambiar o quitar la foto), Mis favoritos, Historial de viajes, Preferencias (idioma; tema sistema, claro u oscuro; notificaciones por tipo), Privacidad (qué datos guarda VoyBus) y Seguridad (cambiar contraseña, con el aviso de que se cierran las demás sesiones). | edición con validación y errores junto al campo |
| Foto al inicio | Paso opcional después de crear la cuenta: "Agrega una foto", con las acciones Elegir foto y Omitir. Al omitir queda el avatar genérico. | permiso denegado, archivo muy grande, error de red |
| Acceso y registro | Formularios actuales con el estilo nuevo. | validación existente |
| Estado de líneas (administrador) | Lista de líneas con su estado y un selector de tres opciones. Cada cambio pide confirmación y muestra quién hizo el último cambio y cuándo. | 403 para otros roles |

Idioma (D11, P2): español e inglés. Un diccionario propio en `front/src/i18n/`, sin dependencias, con un archivo por pantalla (`i18n/<pantalla>.ts`) para que las pantallas no compartan un archivo caliente. Todo texto visible pasa por `t()`. El idioma se guarda en el dispositivo y, si hay sesión, también en la cuenta.

Notificaciones (D11, P2), con `expo-notifications` (aprobada):

- Avisos locales cuando cambia el estado de una línea favorita o cuando cambia el estado de una solicitud propia.
- El cambio se detecta con las consultas periódicas que ya existen, mientras la app está abierta o en segundo plano reciente.
- No hay push remoto: no funciona en Expo Go en Android y requiere infraestructura que el proyecto no tiene.
- En web, los avisos se muestran dentro de la app.
- Cada tipo se activa o desactiva en Preferencias, y el permiso del sistema se pide solo al activar el primero.

La foto usa `expo-image-picker` (aprobada), con recorte cuadrado, calidad 0.7 y `base64`, y se rechaza en el cliente si supera 512 KB.

### 6.3 Sistema visual

Base: dirección "Letrero" del lienzo de Claude Design, con la paleta de PALETA.md.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| background | #F7F7F0 | #0C1C20 | fondo |
| paper | #FFFFFF | #132F35 | superficies |
| ink | #132F35 | #F7F7F0 | texto principal |
| muted | #526769 | #A9BDB8 | texto de apoyo |
| action | #12634D | #6FD3AE | única acción principal |
| onAction | #FFFFFF | #0C1C20 | texto sobre la acción |
| actionPressed | #0D4B3B | #4FB892 (por verificar) | acción pulsada |
| border | #71867C | #8FA79D | borde de controles |
| signal | #F6CE55 | #F6CE55 | señalización, siempre con texto ink #132F35 |
| error | #9B2C2C | #F2A0A0 | errores, siempre con texto |
| surface | #E8EEE9 | #1E3A40 | acción secundaria |

El tema oscuro se derivó y verificó aparte, como exige PALETA.md, regla 7. El verde #12634D sobre el fondo oscuro da 2.43:1; por eso la acción pasa a #6FD3AE en oscuro.

Colores de línea (GTFS) y color del número:

| Línea | Color | Número | Contraste |
| --- | --- | --- | --- |
| 102, 103 | #005BAA | blanco | 6.83 |
| 104 | #007DBD | blanco, solo tamaño grande | 4.50 |
| 107, 112 | #A92023 | blanco | 7.20 |
| 108 | #066A40 | blanco | 6.68 |
| 110 | #5A8400 | blanco, solo tamaño grande | 4.43 |
| 111 | #C9500E | blanco | 4.53 |
| 114, 119 | #CC9B00 | ink #132F35 | 5.56 (blanco daría 2.54) |
| 121 | #AD0101 | blanco | 7.55 |
| 129 | #4E0963 | blanco | 13.61 |
| E01 | #598200 | blanco, solo tamaño grande | 4.55 |

Reglas para las placas de línea:

- El número va en Barlow Condensed de 24 pt o más.
- En tema oscuro, la placa lleva un borde #8FA79D cuando su color contra el fondo no llega a 3:1.

Estado de línea. Siempre se muestra como chip con icono y texto, nunca solo con color:

| Estado | Claro | Oscuro | Texto |
| --- | --- | --- | --- |
| activa | fondo #12634D, texto blanco | fondo #6FD3AE, texto #0C1C20 | "Activa" |
| inactiva | fondo #9B2C2C, texto blanco | fondo #F2A0A0, texto #0C1C20 | "No activa" |
| temporal | fondo #F6CE55, texto #132F35 | igual | "Temporalmente inactiva" |

Choque con PALETA.md: el verde se reserva a la acción y el amarillo a la señalización. Se acepta una excepción acotada, los chips de estado, porque lo pidió el usuario (D5). Siempre llevan texto y no se usan como botones.

Tipografía: Barlow Condensed (600 a 800) para títulos, códigos y destinos; Barlow (400 a 700) para el texto. Se cargan con `useFonts` antes de mostrar la app y, si fallan, se usa la fuente del sistema.

### 6.4 Movimiento

Los tokens viven en `front/src/motion.ts`. Se implementa solo con la API `Animated` de React Native, sin dependencias nuevas, con `useNativeDriver` activo fuera de web.

| Token | Valor |
| --- | --- |
| press | 120 ms, `Easing.out(Easing.quad)` |
| fast | 160 ms, `Easing.bezier(0.2, 0, 0, 1)` |
| base | 200 ms, la misma curva |
| theme | 220 ms, `Easing.inOut(Easing.quad)` |
| stagger | 40 ms entre elementos; como máximo 6 elementos animados |
| spinnerDelay | 300 ms antes de mostrar un indicador de carga |

| Interacción | Animación | Propósito |
| --- | --- | --- |
| Cambio de tema | Una capa del color del fondo nuevo sube de opacidad 0 a 1 en 110 ms, se cambia el tema y la capa baja de 1 a 0 en 110 ms. | Evita el destello de colores mezclados. |
| Cambio de pestaña | El contenido nuevo pasa de opacidad 0 a 1 y de `translateY` 6 a 0 en 180 ms. El indicador de la pestaña se desplaza con `translateX` en 200 ms. | Muestra dónde estás y de dónde viniste. |
| Botón | Escala de 1 a 0.97 al presionar y vuelta a 1 al soltar, 120 ms, sin rebote. En "cargando", la etiqueta pasa a opacidad 0 y aparece un indicador en su lugar; el ancho no cambia. | Confirma el toque. |
| Listas | Los primeros 6 elementos entran con opacidad y `translateY` 8 a 0, escalonados cada 40 ms, solo en la primera carga de cada lista en la sesión. | Ayuda a leer la jerarquía al llegar. |
| Pasos de la solicitud | El paso que sale baja su opacidad; el que entra pasa de `translateX` 16 a 0 con opacidad. El círculo del paso completado pasa de escala 0.6 a 1. | Explica el avance: vinculado, destino, comprobante. |
| Carga y error | Menos de 300 ms: no se muestra nada. Entre 300 ms y 3 s: un indicador con texto. Más de 3 s: el texto pasa a "Sigue cargando…". El error reemplaza a la carga, nunca se apilan. Si hay datos previos, se conservan con el aviso "sin actualizar". | Evita parpadeos y saturar la pantalla. |
| Reducir movimiento | Se detecta con `AccessibilityInfo.isReduceMotionEnabled`, que en web lee `prefers-reduced-motion`, y se escucha su cambio. Con la opción activa, las traslaciones y escalas valen 0 y solo quedan los fundidos de 120 ms. Los escalonados se desactivan. | WCAG 2.3.3 y pedido explícito del usuario. |

### 6.5 Accesibilidad y su verificación

- Contraste: un script con los tokens de las dos tablas de arriba calcula cada par y se ejecuta como prueba, `npm --prefix front run check:contrast`. Agregar ese script requiere aprobación porque es un comando nuevo, aunque no una dependencia.
- Objetivos táctiles: `minHeight` y `minWidth` de 48 en todo control. Playwright mide los controles visibles en 390 px y falla si alguno mide menos de 48 por 48.
- Teclado y foco: en web, `Pressable` usa el estado `focused` para dibujar un anillo de 3 px en color `action` con 2 px de separación. Playwright recorre la pantalla con Tab y verifica que el foco sea visible.
- Texto al 200 %: Playwright toma una captura con un ancho de 195 px y verifica que no haya desborde horizontal. Hoy se desborda 57 px.
- Semántica: cada control tiene `accessibilityRole`, una etiqueta y su estado. La barra inferior usa `tablist` y `tab` con `selected`. Las opciones de destino usan `radio` con `checked` y `disabled`.

## 7. Plan de implementación

Cada unidad termina con su propio commit. Al cerrar cada pantalla corren `npm test`, `npm run typecheck` y `npm run test:e2e` (D10).

Las unidades de una misma ola corren en paralelo, cada una en su propio worktree y con archivos disjuntos. Los textos de cada pantalla viven en `front/src/i18n/<pantalla>.ts`, y cada unidad agrega sus pruebas de navegador en su propio `e2e/<pantalla>.spec.ts`. El archivo `e2e/voybus.spec.ts` lo actualiza el integrador.

| ID | Ola | Unidad | Archivos probables | Terminado si… |
| --- | --- | --- | --- | --- |
| B | 1 | Backend completo: datos GTFS y variantes, esquema y migración, favoritos, perfil, foto, preferencias, contraseña con `sesion_version`, historial, estado de líneas por el administrador, y los hallazgos de RF07 en backend | `backend/**`, `backend/scripts/gtfs-extract.cjs`, `backend/src/database/data/antofagasta.json` | `npm test` pasa con fixtures propios (ya no depende de L01 ni de P01), con una prueba por cada regla de las secciones 4 y 5, y con una migración sobre una base con el esquema anterior. |
| F0 | 1 | Base del front: fuentes, temas claro y oscuro, tokens de movimiento y "reducir movimiento", componentes, cabecera con avatar, barra de pestañas con indicador animado, sistema de i18n, utilidades de notificaciones, almacenamiento local de favoritos y tipos de la API nueva | `front/App.tsx`, `front/src/ui.tsx`, `theme.tsx`, `motion.ts`, `i18n/index.ts`, `notify.ts`, `localFavorites.ts`, `types.ts`, `api.ts` | `npm run typecheck` y `npm --prefix front run build:web` pasan; en 390 px, los controles de la cabecera y de la barra miden 48 o más. |
| S1 | 2 | Líneas, detalle y variantes | `Lines.tsx` (reemplaza a `Catalog.tsx`), `i18n/lines.ts`, `e2e/lines.spec.ts` | e2e: la 102 aparece con su color, la E01 con "Eléctrica" y el estado se lee como texto. |
| S2 | 2 | Mapa con el estilo nuevo y los hallazgos de RF07 en front | `VehicleMap.tsx`, `MapCanvas*.tsx`, `i18n/map.ts`, el worker servido desde el mismo origen | El mapa se ve en Chrome real y el zoom no se reinicia con cada actualización. |
| S3 | 2 | Favoritos: local, sincronizado y aviso de ingreso | `Favorites.tsx`, `i18n/favorites.ts`, `e2e/favorites.spec.ts` | e2e: guardar sin sesión muestra el aviso una sola vez; tras ingresar, el favorito aparece en la cuenta. |
| S4 | 3 | Mi viaje con los pasos nuevos y avisos de solicitud | `Trip.tsx`, `i18n/trip.ts` | El e2e de RF08 a RF10 pasa con las etiquetas actualizadas. |
| S5 | 3 | Perfil, foto al inicio, preferencias, privacidad y seguridad | `Profile.tsx`, `PhotoStep.tsx`, `i18n/profile.ts`, `e2e/profile.spec.ts` | e2e: editar el nombre, cambiar la contraseña (otra sesión queda cerrada) y cambiar idioma y tema. |
| S6 | 3 | Acceso y registro, conductor, y estado de líneas para el administrador | `Auth.tsx`, `Driver.tsx`, `AdminLines.tsx`, `i18n/auth.ts`, `i18n/driver.ts`, `i18n/admin.ts`, `e2e/admin.spec.ts` | e2e: el administrador cambia un estado y Líneas lo muestra; corrige "1 solicitudes" y "p. m..". |
| I | 4 | Integración, e2e completo, auditoría de accesibilidad, documentación, revisión de seguridad y unión a `main` | `e2e/voybus.spec.ts`, `DESIGN.md`, `PALETA.md`, `README.md`, `IMPLEMENTACION.md` | Las suites completas pasan en la rama de integración y la revisión independiente de B no deja hallazgos altos. |

## 8. Fuera de alcance

- Notificaciones push remotas. Sí hay avisos locales (ver 6.2).
- Idiomas distintos de español e inglés.
- Las líneas 106, 204 y 214, que no están en el GTFS.
- Posiciones reales de GPS.
- Pagos.

## 9. Riesgos

| ID | Riesgo | Mitigación |
| --- | --- | --- |
| R1 | El cambio de esquema rompe bases existentes (alto riesgo, ítem 1). | Migración idempotente probada sobre una base con el esquema anterior. |
| R2 | Cambio de contraseña (alto riesgo, ítem 2). Los JWT emitidos antes siguen valiendo hasta que vencen. | Verificar la contraseña actual. Agregar `usuario.sesion_version` e incluirla en el JWT para invalidar sesiones antiguas (ver P4). Revisión independiente. |
| R3 | El GTFS de 2025 está vencido y puede no reflejar 2026. | Mostrar la versión de los datos. No afirmar que los horarios están vigentes. |
| R4 | El estado de las líneas no viene en el GTFS. Inventarlo sería presentar datos falsos. | Todas las líneas parten "activa". Solo el administrador cambia un estado y cada cambio queda registrado (D11, P5). |
| R8 | Subida de foto: archivos maliciosos o demasiado grandes (alto riesgo, ítem 2). | Límite de 512 KB decodificados. Validación por firma de bytes JPEG y PNG. Se almacena como BLOB y nunca se ejecuta. Se sirve solo al dueño con su `Content-Type`. Prueba con un archivo que no es imagen. |
| R9 | Panel de administración: escalada de privilegios (alto riesgo, ítem 2). | Middleware de rol en el servidor. Prueba de 403 con pasajero y con conductor. Registro de cada cambio. |
| R10 | Las notificaciones locales dependen de que la app consulte. No hay push. | Se informa en Preferencias: "Te avisamos mientras la app esté abierta". |
| R5 | El worker de MapLibre se carga desde otro origen y el mapa puede no verse en web. | W6 sirve el worker desde el mismo origen y se verifica en Chrome. |
| R6 | Las pruebas actuales dependen de L01, P01 y BUS001. | W1 crea fixtures de prueba propios, separados del seed. |
| R7 | Las funciones nuevas no están en la ERS. | Registrarlas como alcance adicional en IMPLEMENTACION.md y en la consulta al cliente. |

## 10. Preguntas

P1 a P6 están resueltas en D11.

Decisiones adicionales del 17 de noviembre de 2026:

- Dependencias aprobadas: `expo-image-picker` y `expo-notifications`.
- Segundo idioma: inglés. El usuario puede cambiarlo.

Pendiente de confirmar: si las variantes usan el color de su línea base, como está escrito, o los colores propios del GTFS.
