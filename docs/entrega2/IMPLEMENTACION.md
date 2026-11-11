# Implementación de la entrega 2

Revisión: 11 de noviembre de 2026. Referencia: ERS VoyBus 1.0 propuesta. **Alcance y paleta pendientes de validación del cliente.** Este registro describe el avance posterior a la creación de la ERS y no acredita aprobación del cliente.

| ID | Backend | Interfaz | Verificación |
| --- | --- | --- | --- |
| RF01 | `backend/src/services/auth.js` | `front/src/Auth.tsx` | Registro, validación, hash, roles y altas concurrentes. |
| RF02 | `services/auth.js`, `middlewares/auth.js` | `front/src/Auth.tsx`, `front/App.tsx`, `front/src/storage.ts` | Roles, firma, caducidad, cuentas inactivas y cookie web. |
| RF04 | `backend/src/services/red.js` | `front/src/Catalog.tsx` | Catálogo público, líneas activas y vacío. |
| RF05 | `services/red.js` | `Catalog.tsx` | Filtro por línea, ida/vuelta y errores. |
| RF06 | `services/red.js` | `Catalog.tsx` | Secuencias, ocurrencias y coordenadas. |
| RF08 | `backend/src/services/viaje.js` | `front/src/Trip.tsx` | Código, servicio activo, vínculo único y reintento. |
| RF09 | `services/viaje.js` | `Trip.tsx` | Destino futuro, transacción, unicidad y clave de reintento. |
| RF10 | `services/viaje.js` | `Trip.tsx`, `useResource.ts` | Propiedad, persistencia, estados y recuperación de conexión. |
| RF14 | `backend/src/services/conductor.js` | `front/src/Driver.tsx` | Servicio autorizado, conteos y privacidad. |

Los nombres abreviados de archivos se resuelven dentro del mismo directorio del primer archivo completo de su columna. Contratos REST: `backend/src/routes/index.js`. Esquema migrado: `backend/src/database/schema.sql`.

## Verificaciones

Resultado de esta revisión: **30 pruebas API aprobadas y 2 pruebas integradas de navegador aprobadas**, con tamaños móvil y escritorio. TypeScript y exportaciones web/Android/iOS completados.

- `backend/test/integration.test.js`: API real con base temporal, validaciones, concurrencia, persistencia y reinicio.
- `e2e/voybus.spec.ts`: flujo integrado en Chrome con tamaños móvil y escritorio, dos sesiones separadas, respuesta perdida después de persistir, reintento sin duplicación y recuperación de conexión.
- Comprobación TypeScript y exportación de JavaScript para web, Android e iOS.

La pantalla móvil simulada corresponde a navegador, no a un teléfono. Exportar JavaScript no genera un APK/IPA. Reejecutar las pruebas sobre el commit que el equipo decida entregar.

Capturas reales del flujo de pruebas en navegador: [pasajero](evidencia/pasajero_web_movil.png) y [conductor](evidencia/conductor_web_movil.png). Sirven para mostrar la paleta propuesta al cliente. No sustituyen el video ni la prueba física.

## Estado por módulo

| Módulo | Seleccionados desarrollados | Total ERS | Pendientes |
| --- | --- | --- | --- |
| Identidad | 2 | 3 | Validación completa de RF03 en dispositivo. |
| Red | 3 | 4 | RF07 mapa y posiciones. |
| Viaje | 3 | 5 | RF11 cancelación y RF12 desvinculación. |
| Conductor | 1 | 3 | RF13 gestión del servicio y RF15 atención. |
| Administración | 0 | 3 | RF16 a RF18. |

Los conteos describen código desarrollado en los entornos indicados. No certifican todas las metas no funcionales. Antes de declarar los nueve completos, verificar en el dispositivo elegido todas las condiciones pertinentes.

## Decisiones técnicas

Node 24 usa SQLite incluido en el runtime, manteniendo SQLite, Express, JWT y bcrypt del diseño inicial. Se eliminan dependencias nativas externas de SQLite y herramientas ORM no usadas. React Native y Expo crean el cliente, dado que front solo tenía un archivo de reserva. Las sesiones nativas usan SecureStore; web usa cookie HttpOnly, sin tokens en localStorage.

Los datos usan example.test y coordenadas ficticias. Las tablas de historia y posiciones no acreditan las funciones futuras de GPS o gestión del servicio. La ERS original conserva su condición de propuesta.

## Pendientes

- Obtener validación del cliente. Borrador no enviado: `CORREO_CLIENTE.md`.
- Probar teléfono/emulador, lector de pantalla, texto al 150 %, teclado y almacenamiento nativo.
- Medir RNF03 con 20 usuarios concurrentes y registrar el entorno. Las pruebas funcionales no acreditan esa métrica.
- Completar presentación, Gantt, tablero y video con fechas, responsables, aportes y enlaces reales. El usuario aplazó presentación y prueba física.
- Declarar rama y commit efectivamente presentados.
- Revisar backend/.env, previamente versionado, antes de publicar. No se alteró su configuración local.
