# Cerebro — VoyBus

Máximo ~60 líneas. Solo lo que NO se deduce leyendo el código.

## Estado
- 2026-11-25 — Revisión R5 corregida sin commit: trazados GTFS con Douglas-Peucker 5 m (antes muestreo 1/N desviaba hasta 471 m), micros por franja de zoom con fundido (<12,5 ocultas, <14 punto, ≥14 completas; fijadas con filtro), paraderos con fundido 14,5-15, panel con cabecera fija/asa/3 alturas, filtro por línea, Mi ubicación (expo-location aprobado por el usuario), textos micros, desvío 129 y GTFS vencido avisados. Pendiente: prueba del usuario en iPhone y umbrales.
- 2026-11-24 — R5 implementado:54 buses demo/13líneas, parada filtra futuros, micro traza recorrido/sentido, Lines->Mapa y zoom15. Typecheck,22 backend dirigidos y4 capas pasaron; usuario probará y pidió prompt para otra IA. E2E integral R5 pendiente. Expo8081/API3000 activos en192.168.1.88, bundleiOS200 actualizado. Sin merge.
- 2026-11-24 — Costa/Pulso completos en codex/rediseno-movilidad sin merge:75 backend, typecheck, build web,36 E2E completos y20 dirigidos de mapa/a11y pasaron; último ajuste de marcadores verificó8 casos mapa. Capturas en .orquestar/logs/costa-pulso/. Pendiente iPhone nativo.
- 2026-11-24 — v2 unida a main. Verificado: 72 tests backend, typecheck, build web, 30 e2e (Chrome). Revisión visual claro/oscuro hecha (V1) y animaciones §6.4 (V2). Pendiente: revisión del usuario en Expo Go.

## Decisiones
- 2026-11-24 — Usuario pidió subir cambios a GitHub en rama del rediseño. Notas posteriores pendientes en docs/designs/voybus-v3-redesign.md: zoom también micros, panel plegable, filtro línea, Ver micros, ubicación y verificación de trazados. No confundirlas con correcciones ya implementadas.
- 2026-11-24 — Diseño aprobado: Costa claro + Pulso oscuro, navegación de cuatro accesos y mapa protagonista; conservar identidad local, colores GTFS y rayo eléctrico. Referencias en docs/designs/propuestas-astra/01-costa y 03-pulso.
- 2026-11-24 — Usuario pidió reducir buses: punto de8px centrado en coordenada y mini bus15x16 arriba/derecha, rayo eléctrico;48px solo como área táctil invisible. Código y detalle en ficha.
- 2026-11-24 — Estados de prueba: automático según buses con posición visible en mapa; administrador puede fijar manualmente tres estados y volver a automático. No inventar horarios oficiales.
- 2026-11-17 — Diseño completo en `docs/designs/voybus-v2-design.md` (D1–D11 citas del usuario); es la fuente de requisitos.
- 2026-11-17 — Dependencias nuevas requieren aprobación del usuario (D10/S4). 2026-11-25: aprobó expo-location.
- 2026-11-25 — GTFS oficial DTPR solo existe Antofagasta20250307 (vigencia 2025, vencida). Si se publica otro, regenerar con `node backend/scripts/gtfs-extract.cjs <dir>` y actualizar el texto `lines.attribution` y el aviso `map.detour129` (desvío 129 hasta 31/12/2026).
- 2026-11-25 — Docs: TRD, APP-FLOW e IMPLEMENTATION-PLAN (este último con lo pendiente de la ERS: RF11-13, RF15-18, RNF03). TESTING-GUIDE descartado; no proponerlo. Sin graphify.
- 2026-11-24 — `ThemeProvider` expone `storageError`, nunca `error`: ese nombre es un token de color y se pisaba.

## Convenciones no obvias
- Verificar: `npm test`, `npm run typecheck`, `npm --prefix front run build:web`, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` (levanta API en 3001 y web en 8082).
- Todo texto visible pasa por `t()` con un archivo por pantalla en `front/src/i18n/`.
- Colores solo desde tokens de `front/src/theme.tsx`; `e2e/a11y.spec.ts` lee ese archivo con regex para el test de contraste.

## Cuidado
- Movimiento: solo `transform`/`opacity`, respetar reducir movimiento (`front/src/motion.ts`).
