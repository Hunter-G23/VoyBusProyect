Objective: implement ERS RF07 (vehicles in circulation on a map) with simulated GPS clearly labeled.
Branch: feat/rf07-mapa, integrated in integracion/rf07-mapa. Delivery: ask-on-risk. Runners: `npm test` (node:test), `npm run typecheck`, `npm --prefix front run build:web`, `npm run test:e2e` (Playwright).

## Specs

- S1 (ERS RF07, verbatim): "Mostrar vehículos de servicios activos con posición y hora de medición. Con muestras actualizadas, el mapa debe ubicar cada vehículo en sus coordenadas. Si la última muestra supera 30 segundos, debe marcarse desactualizada. Sin muestras, mostrar ausencia de datos."
- S2 (ERS RF07, verbatim): "Una simulación debe identificarse como tal y no presentarse como telemetría real."
- S3 (user, verbatim): "el proveedor puede ser cualquiera escoge el que mas lindo sea". Decision: MapLibre GL with OpenFreeMap vector tiles, style `https://tiles.openfreemap.org/styles/positron` (no API key). Web renders maplibre-gl directly; native renders it inside react-native-webview (works in Expo Go).
- S4 (user approved option, verbatim): "Hago un commit en main con tus 21 archivos pendientes, tal como están, y lanzo B1 y F1 con GPS simulado y marcado como 'Simulación'."
- S5 (user, verbatim): "trata de ocupar solo el sol en alto o xhigh para programar y si no pueden hacer la tarea ahi recien delegas a astra". Writers: Codex `gpt-6.1-sol` (high/xhigh); fallback `gpt-6-astra`.
- S6 API contract (leader-defined): `GET /api/red/vehiculos`, public, 200 →
  `{ "fuente": "simulacion" | "gps", "generado_en": ISO-8601, "vehiculos": [ { "servicio_id", "vehiculo" (vehiculo.codigo_vinculacion, e.g. "BUS001"), "linea" (linea.codigo), "recorrido_id", "sentido", "posicion": { "latitud", "longitud", "medida_en", "desactualizada" } | null } ] }`.
  Only active services of active vehicles, ordered by `vehiculo`. `desactualizada` is true when server now − `medida_en` > 30 s. No personal data (no driver name or email).
- S7 Simulator (assumption, leader-defined): enabled by env `SIMULAR_GPS=true`; writes one `posicion_vehiculo` sample per active service every 5 s along its route stops; when enabled, `fuente` is `"simulacion"`. Off in tests unless a test enables it.

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T0 | S3 | inline (leader): add maplibre-gl 6.19.0 and react-native-webview 14.0.1 | done | base commit |
| B1 | S1, S2, S6, S7 | delegated: Codex gpt-6.1-sol xhigh (parallel unit, disjoint backend surface) | pending | |
| F1 | S1, S2, S3, S6 | delegated: Codex gpt-6.1-sol high (parallel unit, disjoint front surface) | pending | |
| S1x | all | inline (leader): integrate, e2e, docs | pending | |

## Log

- L1 (2026-11-17, user verbatim): "segun yo tambien falta el mapa, el proveedor puede ser cualquiera escoge el que mas lindo sea y empecemos a codear con gentle ai para medir el uso te parece?"
- L2 (2026-11-17, user verbatim): "tambien tienes presente que puedes ocupar codex no? trata de ocupar solo el sol en alto o xhigh para programar y si no pueden hacer la tarea ahi recien delegas a astra"
- L3: user chose "Aprobar así". Pending work committed on main as 4e99aa3. npm audit: 3 moderate findings pre-exist (minimatch via @expo/fingerprint), none from the new dependencies.
- L4: writer reason is parallelism: B1 (backend) and F1 (front) are independent units with disjoint edit surfaces, joined by the S6 contract.
