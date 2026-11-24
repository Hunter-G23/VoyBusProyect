# TRD — VoyBus

## 1. Resumen

VoyBus permite consultar la red de micros de Antofagasta y pedir una parada a bordo. El pasajero elige un destino de su recorrido y recibe un comprobante. El conductor consulta las solicitudes de su servicio con el vehículo detenido. El administrador publica el estado de las líneas.

El cliente funciona en Android, iOS y web. Este documento describe la rama `integracion/v2`. Las referencias RF corresponden a la [ERS de la entrega 2](entrega2/ERS_VoyBus_Entrega2_v1.docx). Las ampliaciones se describen en el [diseño v2](designs/voybus-v2-design.md).

## 2. Features

| ID | Función | Prioridad | Descripción breve |
|---|---|---|---|
| F1 | Registro · RF01 | Must | Crear una cuenta de pasajero. |
| F2 | Ingreso · RF02 | Must | Autenticar al usuario y abrir la vista de su rol. |
| F3 | Cierre de sesión · RF03 | Must | Volver al acceso público y revocar las credenciales emitidas. |
| F4 | Líneas · RF04 + v2 | Must | Consultar el catálogo público GTFS y filtrar por estado. |
| F5 | Recorridos · RF05 + v2 | Must | Elegir sentido o variante dentro de una línea. |
| F6 | Paraderos · RF06 | Must | Consultar la secuencia de paraderos del recorrido elegido. |
| F7 | Vehículos · RF07 | Must | Consultar posiciones y su antigüedad en el mapa o la lista. |
| F8 | Vínculo · RF08 | Must | Identificar el servicio a bordo mediante el código del vehículo. |
| F9 | Solicitud de parada · RF09 | Must | Pedir una parada futura en el servicio vinculado. |
| F10 | Comprobante · RF10 | Must | Recuperar el identificador y el estado de la solicitud propia. |
| F11 | Bandeja del conductor · RF14 | Must | Consultar las solicitudes del servicio asignado al conductor. |
| F12 | Favoritos · v2 | Must | Guardar líneas o recorridos en el dispositivo o en la cuenta. |
| F13 | Perfil e historial · v2 | Must | Editar nombre y foto, consultar viajes propios y privacidad. |
| F14 | Preferencias y avisos · v2 | Must | Elegir idioma, tema y tipos de notificación. |
| F15 | Seguridad de la cuenta · v2 | Must | Cambiar la contraseña y cerrar las demás sesiones. |
| F16 | Estado de líneas · v2 | Must | Publicar y registrar un cambio de estado confirmado por un administrador. |

## 3. Comportamiento esperado

### F1 — Registro

- Al registrar un nombre, un correo disponible y una contraseña válida con su confirmación, se crea una cuenta de pasajero y se ofrece añadir una foto u omitir ese paso. Un correo duplicado o un campo inválido impide el alta y muestra el error.

### F2 — Ingreso

- Con credenciales válidas de una cuenta activa, el pasajero accede a sus pestañas, el conductor a su bandeja y el administrador a Estado de líneas. Se rechazan credenciales incorrectas y cuentas inactivas. Una sesión vencida requiere un nuevo ingreso.

### F3 — Cierre de sesión

- Al salir, el servidor incrementa la versión de sesión y el cliente elimina la credencial local. Al reabrir la aplicación se conserva el acceso público. Una petición con el token anterior recibe HTTP 401.

### F4 — Líneas

- Al abrir Líneas, incluso sin sesión, se muestran código, nombre, color GTFS y estado de cada línea. El filtro permite elegir Activa, No activa o Temporalmente inactiva. Cada estado lleva texto e icono. E01 lleva un rayo y la etiqueta «Eléctrica».
- La pantalla identifica la fuente y versión del catálogo. Si el filtro queda vacío, lo indica. Si falla una actualización, conserva los datos disponibles y señala que están desactualizados.

### F5 — Recorridos

- Al elegir una línea, se muestran los recorridos disponibles con su sentido y destino. Las variantes conservan el código y el nombre del GTFS. Si la línea carece de recorridos, el detalle muestra el estado vacío.

### F6 — Paraderos

- Al elegir un recorrido, se muestran sus paraderos en orden de paso. Si el vehículo pasa dos veces por el mismo paradero, cada paso ocupa su lugar en la secuencia. Si falla la consulta, el usuario puede reintentarla.

### F7 — Vehículos

- Al abrir Mapa, la lista y los marcadores identifican los vehículos con servicio activo. La vista distingue posiciones simuladas, muestras de más de 30 segundos y vehículos sin datos. Al actualizarse una posición se conserva el encuadre elegido.
- Si falla el mapa base, se informa del fallo y la lista sigue disponible con los datos recibidos de la API.

### F8 — Vínculo

- En Mi viaje, el pasajero autenticado introduce el código de un vehículo con servicio activo. El sistema conserva un único vínculo activo y muestra los destinos de ese servicio. Repetir la operación sobre el mismo servicio recupera el vínculo.
- Un código desconocido, un vehículo inactivo o la ausencia de servicio impiden avanzar al paso Destino.

### F9 — Solicitud de parada

- Con un vínculo activo, el pasajero selecciona una ocurrencia posterior a la última posición del servicio. El servidor valida recorrido y secuencia antes de guardar la solicitud. Rechaza destinos ajenos o ya pasados.
- Si se pierde la respuesta, el cliente conserva el destino y la clave de reintento. Reenviar la misma operación devuelve la solicitud persistida una sola vez.

### F10 — Comprobante

- Tras confirmar la persistencia, Mi viaje muestra el identificador, destino y estado de la solicitud. Al recuperar la conexión se consulta el estado guardado. Solo el titular puede consultar su comprobante.

### F11 — Bandeja del conductor

- Con la bandeja visible, el conductor consulta cada cinco segundos las solicitudes de su servicio. Ve el mismo identificador que el pasajero y los conteos por destino. Si carece de asignación, la vista lo indica. El acceso a solicitudes de otros servicios está restringido.

### F12 — Favoritos

- Desde el detalle se guarda una línea o un recorrido. Desde Favoritos se vuelve al detalle o se quita la entrada. Al guardar por primera vez sin sesión, un aviso explica que el favorito queda en el dispositivo.
- Al ingresar se ofrece copiar los favoritos locales a la cuenta. Si se interrumpe la copia, el dispositivo conserva la lista hasta confirmar todos los envíos. Reintentar mantiene una sola entrada por favorito.

### F13 — Perfil e historial

- Perfil muestra foto o avatar genérico, nombre, correo y rol. El usuario puede editar el nombre y sustituir o quitar su foto. Correo y rol son de solo lectura. Una foto inválida se rechaza y se informa del motivo.
- El pasajero ve sus vínculos cerrados y solicitudes por fecha. Si el historial está vacío, la pantalla lo indica. Privacidad explica qué datos conserva la aplicación.

### F14 — Preferencias y avisos

- El usuario puede elegir español o inglés y tema de sistema, claro u oscuro. El idioma se guarda en el dispositivo y, con sesión, también en la cuenta.
- Se habilitan por separado los avisos de cambios en líneas favoritas y en solicitudes propias. El permiso nativo se solicita al activar el primer tipo. Los avisos dependen de las consultas de las vistas activas y en web aparecen dentro de la aplicación.

### F15 — Seguridad de la cuenta

- Al confirmar la contraseña actual y una nueva válida, se mantiene la sesión que hizo el cambio y se invalidan las anteriores. Si la actual es incorrecta, el servidor responde HTTP 403 y el usuario puede corregirla dentro de la misma sesión.

### F16 — Estado de líneas

- Cuando el administrador confirma uno de los tres estados de F4, el catálogo público refleja el cambio en la siguiente consulta. Quedan registrados el estado anterior, el nuevo, el autor y la fecha. La vista administrativa muestra quién hizo el último cambio y cuándo. Un pasajero o conductor recibe HTTP 403 si intenta modificarlo.

## 4. Requerimientos no funcionales

| ID | Tipo | Criterio de aceptación |
|---|---|---|
| R1 | Rendimiento · RNF03 | Con 20 usuarios concurrentes y 100 operaciones válidas por tipo, el percentil 95 de consulta de catálogo y creación o lectura de solicitudes debe ser ≤ 2 s, excluida la carga inicial. Una solicitud debe aparecer en la bandeja abierta y conectada en ≤ 7 s. Medición pendiente. |
| R2 | Seguridad | Contraseñas con bcrypt, JWT en cookie HttpOnly en web y SecureStore en móvil. Cada petición protegida verifica vigencia, versión de sesión y permisos. En producción se exige HTTPS y una clave JWT de al menos 32 caracteres. |
| R3 | Accesibilidad | Objetivo WCAG 2.2 AA en ambos temas. Contraste mínimo de 4,5:1 en texto normal y 3:1 en texto grande y bordes de controles. Áreas táctiles ≥ 48 × 48 pt, texto usable al 200 %, foco visible, navegación por teclado y nombre, rol y estado accesibles. Validación integral pendiente. |
| R4 | Consistencia | Los reintentos de F9 y F12 deben conservar un único registro. Las migraciones deben poder repetirse sobre bases existentes sin perder datos. |
| R5 | Movimiento | Animar solo `transform` y `opacity`. Pulsación de 120 ms, transición de pantalla de 180 ms y cambio de tema de 220 ms. Con movimiento reducido se admite un fundido de 120 ms o un cambio inmediato. |
| R6 | Privacidad | Solo el titular puede leer su foto e historial. La API valida la firma JPEG o PNG y rechaza fotos de más de 512 KB decodificados. |

## 5. Stack y arquitectura

- **Cliente.** React Native, Expo SDK 58 y TypeScript. La barra de pasajero reúne Líneas, Mapa, Favoritos y Mi viaje. Perfil se abre desde la cabecera. El diseño Letrero usa Barlow Condensed para códigos y destinos, Barlow para lectura y los pasos de Boleto para Vincular, Destino y Comprobante. Los colores se centralizan en `front/src/theme.tsx` y los textos pasan por `t()` con diccionarios por pantalla.
- **Servidor y despliegue.** API REST con Express sobre Node.js 24+ y SQLite mediante `node:sqlite`. En desarrollo, Expo y la API se ejecutan como procesos separados. Un teléfono con Expo Go se conecta a la API por la red local.
- **Integraciones.** MapLibre dibuja el mapa con OpenFreeMap y sirve el worker web desde el mismo origen. Expo ImagePicker permite elegir fotos y Expo Notifications entrega avisos locales en móvil.
- **Catálogo.** El extractor procesa los CSV GTFS descomprimidos de la DTPR y elige el viaje con más paraderos por ruta y sentido. El seed carga el JSON versionado. Cada línea agrupa recorridos y variantes. Cada recorrido ordena sus paraderos por ocurrencia.
- **Operación.** Un servicio asocia vehículo, conductor y recorrido. El vínculo conecta al pasajero con ese servicio y la solicitud apunta a una ocurrencia de destino. Las posiciones conservan el origen de cada muestra.
- **Cuenta y administración.** Cada favorito pertenece a un usuario y referencia una línea y, opcionalmente, un recorrido. La cuenta agrupa foto, preferencias y versión de sesión. Cada cambio de estado enlaza la línea con el administrador responsable.

## 6. Restricciones

- La fuente es DTPR, GTFS `Antofagasta20250307`, con 13 líneas base y 18 variantes. Su calendario terminó el 31 de diciembre de 2025. La interfaz debe identificar esa versión. Los estados operativos los mantiene el administrador.
- Los vehículos, conductores y servicios de demostración usan recorridos reales y posiciones simuladas. El seed de demostración está bloqueado en producción.
- Las dependencias nuevas requieren aprobación. La validación formal del cliente y la prueba en teléfono físico siguen pendientes según el [README](../README.md).

## 7. Fuera de alcance

- GPS real, pagos, timbre físico y notificaciones push remotas.
- Líneas 106, 204 y 214, ausentes del GTFS de referencia, e idiomas adicionales a español e inglés.
- Cancelación de solicitudes, desvinculación manual, gestión de servicios por el conductor, reconocimiento y atención de solicitudes, y el resto de la administración prevista por la ERS.

## 8. Preguntas abiertas

- ¿Deben las variantes conservar el color de su línea base o usar su propio `route_color` del GTFS? En v2 heredan el color base. Por ejemplo, 103N usa el azul de la 103 (`#005BAA`), aunque el GTFS asigna verde a la variante (`#066A40`). [Diseño v2, §10](designs/voybus-v2-design.md#10-preguntas)
