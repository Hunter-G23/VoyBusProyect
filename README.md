# VoyBus

Proyecto de **Desarrollo de Soluciones Móviles, UCN, segundo semestre de 2026**.
Equipo indicado en el repositorio: Juan Gomez y Benjamin Gutierrez.

Implementación inicial de nueve requisitos de la [ERS](docs/entrega2/ERS_VoyBus_Entrega2_v1.docx), **pendiente de validación del cliente**. El catálogo y los servicios son ficticios para demostración. El [estado de implementación](docs/entrega2/IMPLEMENTACION.md) distingue lo desarrollado de lo pendiente. Hay un [borrador de consulta al cliente](docs/entrega2/CORREO_CLIENTE.md), todavía no enviado.

## Tecnologías

React Native, Expo y TypeScript para el cliente. Node.js 24 o superior, Express y SQLite mediante node:sqlite para la API. JWT de 60 minutos, bcrypt con factor 12, SecureStore nativo y cookie HttpOnly en web. Node Test Runner y Playwright para las pruebas.

## Instalar

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

El seed agrega datos de prueba de forma idempotente y conserva registros existentes. Para una demostración limpia, configura un nombre nuevo de base en backend/.env, por ejemplo `DB_PATH=./src/database/demo-nueva.db`, y ejecuta migración y seed. El seed se bloquea en producción.

backend/.env ya estaba versionado en el repositorio recibido. Se preservó su configuración. Antes de publicar, excluir ese archivo del control de versiones y revisar si contiene credenciales que deban reemplazarse. Los .env.example solo contienen ejemplos. En desarrollo se genera una clave JWT local si no hay una válida; en producción se exige una clave configurada de al menos 32 caracteres y HTTPS.

## Ejecutar en web

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm --prefix front run web
```

Abre la dirección de Expo, normalmente http://localhost:8081. La API usa http://localhost:3000/api. Si cambias puertos, ajusta PORT, EXPO_PUBLIC_API_URL y WEB_ORIGINS en los archivos .env correspondientes.

Para probar pasajero y conductor a la vez, usa dos perfiles de navegador o una ventana normal y otra de incógnito. Dos pestañas del mismo perfil comparten la sesión web.

## Ejecutar en teléfono

```powershell
npm --prefix front start
```

Usa Expo Go compatible con SDK 58 o un development build. Para un teléfono físico cambia EXPO_PUBLIC_API_URL en front/.env a `http://IP_LOCAL_DEL_PC:3000/api`, conecta ambos equipos a la misma red y permite conexiones al puerto 3000. Reinicia Expo después de cambiar las variables. En el emulador Android, la dirección habitual del host es `http://10.0.2.2:3000/api`.

La prueba física y la generación de APK/IPA quedaron pendientes. Se verificaron las exportaciones de JavaScript para web, Android e iOS, que no equivalen a una aplicación instalada.

## Datos de prueba

Contraseña ficticia y exclusivamente local para todas las cuentas: `VoyBusDemo2026!`.

| Rol | Correo | Servicio |
| --- | --- | --- |
| Pasajero | pasajero@example.test | Vínculo desde la aplicación |
| Pasajera | pasajera@example.test | Privacidad y conteos |
| Conductor | conductor@example.test | BUS001, L01, ida |
| Conductor | conductor2@example.test | BUS002, L02 |
| Conductor sin servicio | sinservicio@example.test | Sin asignación |
| Administrador | admin@example.test | Acceso y catálogo, administración futura |
| Pasajero inactivo | inactivo@example.test | Acceso rechazado |

BUS001 recorre Inicio, Centro y Terminal. La última posición pasada es 1, por lo que se puede solicitar Centro o Terminal. BUS003 está inactivo y BUS004 no tiene servicio. Ida y vuelta tienen secuencias diferentes.

## Demostrar los nueve requisitos

1. **RF01**: registrar un pasajero y mostrar rechazo de confirmación distinta o correo repetido.
2. **RF02**: ingresar como pasajero. El registro público no crea conductores ni administradores.
3. **RF04**: consultar las líneas públicas L01 y L02.
4. **RF05**: abrir L01 y elegir ida o vuelta.
5. **RF06**: consultar paraderos ordenados, códigos y coordenadas.
6. **RF08**: abrir Mi viaje y vincular BUS001 por código manual.
7. **RF09**: elegir Terminal y enviar la solicitud de parada.
8. **RF10**: consultar el comprobante y recargar la aplicación para comprobar persistencia.
9. **RF14**: ingresar como conductor en otra sesión y comprobar el mismo ID y destino. La bandeja se consulta cada 5 segundos mientras está visible.

La bandeja no reconoce ni atiende solicitudes. Esas transiciones son RF15, posterior a esta selección. El seed prepara servicios activos; su gestión por pantalla corresponde a RF13. También quedan para después mapa/GPS, QR, cancelación, desvinculación y administración. No existe conexión con un timbre físico.

## Pruebas

```powershell
npm test
npm run typecheck
npm --prefix front run build:web

# Primera ejecución de Playwright:
npx playwright install chromium
npm run test:e2e
```

Si tienes Chrome, puedes usarlo sin descargar Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Las pruebas API usan una base temporal. Playwright levanta su API aislada en 3001 y Expo en 8082, con tamaños móvil y escritorio. Comprueba registro, validaciones, catálogo, vínculo, pérdida de respuesta después de guardar, reintento sin duplicación, persistencia, pérdida de red y recepción por un conductor en una sesión separada. La [matriz de implementación](docs/entrega2/IMPLEMENTACION.md) registra los límites de estas verificaciones.

## Organización

backend/src separa config, database, routes, controllers, services, models, middlewares y utils. backend/test contiene pruebas API; front/src contiene las pantallas, API, almacenamiento y consultas; e2e contiene el flujo integrado. docs/entrega2 reúne ERS, estado y borrador de correo.

La presentación, el Gantt, el tablero, el video y la validación física se completarán posteriormente con evidencias reales del equipo. No se atribuyen al cliente aprobaciones no recibidas.
