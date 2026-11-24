# VoyBus

Proyecto de Desarrollo de Soluciones Móviles, UCN, segundo semestre de 2026. Equipo indicado en el repositorio: Juan Gomez y Benjamin Gutierrez. La validación formal del cliente y la prueba en teléfono siguen pendientes; ver [implementación y límites](docs/entrega2/IMPLEMENTACION.md).

## Qué incluye v2

- Catálogo GTFS real de Antofagasta: líneas, variantes, colores oficiales, estados y paraderos ordenados.
- Mapa y lista accesible de vehículos. Los servicios y vehículos son de demostración; no hay GPS real. La interfaz identifica las posiciones simuladas cuando la API las informa.
- Favoritos de líneas y recorridos, guardado local sin sesión y sincronización idempotente al ingresar.
- Mi viaje: vínculo manual, destinos futuros, solicitud con reintento sin duplicación y comprobante persistido. La bandeja del conductor conserva el mismo identificador.
- Perfil: nombre, foto opcional, historial, español/inglés, tema sistema/claro/oscuro, preferencias de avisos locales, privacidad y cambio de contraseña.
- Administrador: cambio confirmado del estado de una línea y último actor/fecha. No equivale a implementar todos los requisitos administrativos de la ERS.
- Dirección visual Letrero, pasos de Boleto, Barlow, tokens de tema y movimiento reducido. [Diseño](DESIGN.md), [paleta y contrastes](docs/entrega2/PALETA.md).

Node.js 24+, Express y SQLite (`node:sqlite`); React Native, Expo SDK 58 y TypeScript. Sesiones web en cookie HttpOnly y nativas en SecureStore; sin tokens en localStorage. Las contraseñas se almacenan con bcrypt.

## Instalar y ejecutar

Desde la raíz, con Node.js 24 y npm:

```powershell
npm ci
npm --prefix backend ci
npm --prefix front ci
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (!(Test-Path front/.env)) { Copy-Item front/.env.example front/.env }
npm --prefix backend run migrate
npm --prefix backend run seed
```

`backend/.env` no está versionado en este checkout (verificado con `git ls-files backend/.env`). Créalo localmente desde el ejemplo y no publiques secretos. En producción se exige una clave JWT de al menos 32 caracteres y HTTPS; el seed está bloqueado en producción. Para una demo limpia usa un `DB_PATH` nuevo, no borres la base existente.

En terminales separadas:

```powershell
npm run dev:api
npm --prefix front run web
```

Expo publica normalmente en 8081 y la API en `http://localhost:3000/api`. Si cambias puertos, ajusta `PORT`, `WEB_ORIGINS` y `EXPO_PUBLIC_API_URL`. Para dos roles simultáneos usa perfiles distintos o incógnito: las pestañas del mismo perfil comparten cookie.

### Expo Go en la red local

Configura la API en `backend/.env`:

```dotenv
HOST=0.0.0.0
PORT=3000
```

Y el cliente en `front/.env`, sustituyendo el marcador por la IP LAN real del PC:

```dotenv
EXPO_PUBLIC_API_URL=http://<PC LAN IP>:3000/api
```

```powershell
npm --prefix front start
```

Conecta teléfono y PC a la misma red, permite el puerto 3000 en el firewall y abre el QR con Expo Go compatible con SDK 58. Reinicia Expo después de cambiar variables. El emulador Android usa habitualmente `http://10.0.2.2:3000/api`. No uses `localhost` del teléfono para señalar el PC. La instalación y los permisos de fotos/notificaciones en dispositivo real no se verificaron en esta ejecución.

## Datos oficiales y regeneración

Datos: DTPR, GTFS `Antofagasta20250307`, [archivo de origen](https://dtpr.gob.cl/wp-content/uploads/2025/12/antofagasta.zip). Su calendario va del 1 de enero al 31 de diciembre de 2025: está vencido y no garantiza vigencia de recorridos u horarios en 2026. Los estados de línea no vienen del GTFS; los cambia un administrador. E01 se identifica como eléctrica por su código y la decisión documentada del proyecto.

El JSON versionado es `backend/src/database/data/antofagasta.json`. Para regenerarlo, descarga el archivo, descomprímelo y pasa el directorio de los CSV, no el ZIP:

```powershell
node backend/scripts/gtfs-extract.cjs C:\ruta\gtfs-csv
npm --prefix backend run migrate
npm --prefix backend run seed
```

El extractor selecciona el viaje con más paraderos por ruta y sentido, conserva el orden y agrega las variantes a su línea base. No procesa ZIP en tiempo de ejecución. Revisa el diff de datos y prueba primero sobre una base de demostración separada. Los sufijos de variantes no se interpretan como horarios ni servicios especiales.

## Cuentas de demostración

Contraseña local de todas las cuentas: `VoyBusDemo2026!`. Nunca usar en producción.

| Rol | Correo | Servicio / uso |
| --- | --- | --- |
| Pasajero | pasajero@example.test | Vínculo desde Mi viaje |
| Pasajera | pasajera@example.test | Segunda sesión |
| Conductor | conductor@example.test | BUS001, línea 102, ida |
| Conductor | conductor2@example.test | BUS002, línea 103, ida |
| Conductor sin servicio | sinservicio@example.test | Sin asignación |
| Administrador | admin@example.test | Estado de líneas |
| Pasajero inactivo | inactivo@example.test | Acceso rechazado |

BUS001 y BUS002 usan recorridos reales con vehículos de demostración. La primera posición está pasada; selecciona un paradero posterior. BUS003 está inactivo y BUS004 no tiene servicio. La bandeja consulta cada cinco segundos y no reconoce ni atiende solicitudes: esas transiciones siguen fuera de esta implementación.

## Comprobar

```powershell
npm test
npm run typecheck
npm --prefix front run build:web
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Playwright inicia una API aislada en 3001 y Expo en 8082, con proyectos móvil y escritorio. Si la exportación agota memoria, se verificó también `npm --prefix front run build:web -- --max-workers 2`, sin cambiar dependencias o configuración del proyecto. El worker MapLibre 6.19.0 se copia desde el paquete instalado a `front/public/maplibre-gl-worker-6.19.0.mjs`; al actualizar MapLibre hay que actualizar la copia y su URL, y comprobar el archivo exportado en `front/dist`.

Los resultados observados y las restricciones de red/memoria están en [IMPLEMENTACION.md](docs/entrega2/IMPLEMENTACION.md). El mapa necesita acceso a OpenFreeMap; la lista y los estados siguen disponibles si no carga. No hay pagos, timbre físico, GPS real ni notificaciones push remotas. Los avisos locales dependen de las consultas mientras las vistas están activas.
