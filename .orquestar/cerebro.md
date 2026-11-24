# Cerebro — VoyBus

Máximo ~60 líneas. Solo lo que NO se deduce leyendo el código.

## Estado
- 2026-11-24 — v2 unida a main. Verificado: 72 tests backend, typecheck, build web, 30 e2e (Chrome). Revisión visual claro/oscuro hecha (V1) y animaciones §6.4 (V2). Pendiente: revisión del usuario en Expo Go.

## Decisiones
- 2026-11-17 — Diseño completo en `docs/designs/voybus-v2-design.md` (D1–D11 citas del usuario); es la fuente de requisitos.
- 2026-11-17 — Dependencias nuevas requieren aprobación del usuario (D10/S4).
- 2026-11-24 — Solo docs/TRD.md. El usuario descartó APP-FLOW, TESTING-GUIDE e IMPLEMENTATION-PLAN; no volver a proponerlos. Sin graphify por ahora.
- 2026-11-24 — `ThemeProvider` expone `storageError`, nunca `error`: ese nombre es un token de color y se pisaba.

## Convenciones no obvias
- Verificar: `npm test`, `npm run typecheck`, `npm --prefix front run build:web`, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` (levanta API en 3001 y web en 8082).
- Todo texto visible pasa por `t()` con un archivo por pantalla en `front/src/i18n/`.
- Colores solo desde tokens de `front/src/theme.tsx`; `e2e/a11y.spec.ts` lee ese archivo con regex para el test de contraste.

## Cuidado
- Movimiento: solo `transform`/`opacity`, respetar reducir movimiento (`front/src/motion.ts`).
