# VoyBus: rediseño de catálogo y mapa

Fecha: 2026-11-24. Rama: `codex/rediseno-movilidad`.

Estado: usuario aprobó implementar Costa en claro y Pulso en oscuro, con la misma estructura y mapa protagonista. Se retoma la implementación en la rama indicada, sin merge automático.

Propuestas entregadas: `01-costa`, `02-senal` y `03-pulso`. Cada carpeta contiene `index.html`, `preview.png` (1120×1000 con Líneas y Mapa) y `preview-mobile.png` (375×900). Tres agentes Astra aplicaron UI UX Pro Max con las consultas `coastal transit mobile navigation`, `urban transit wayfinding swiss typography` y `dark mobility navigation app`, descartando las recomendaciones de páginas de marketing. Se verificaron búsqueda, filtros, favoritos, selección de bus y los cuatro accesos de navegación en Chrome. Los mapas son ilustraciones locales con datos de demostración.

## Pedido actual

- Sustituir el diseño pesado por una interfaz de transporte más legible y compacta.
- Mapa con buses pequeños, color de cada línea y rayo en los eléctricos.
- Distinguir activa, inactiva y temporalmente inactiva.
- Aplicar UI UX Pro Max y criterios de animación de scroll del kit.

## Dirección de la primera versión

Dirección final aprobada: Costa en claro (papel cálido, azul intenso, ilustración de La Portada) y Pulso en oscuro (tinta, superficies contenidas y lima). Una misma estructura y navegación de cuatro pestañas. Se conservan fuentes Barlow instaladas, colores GTFS y todas las funcionalidades actuales.

Catálogo editorial compacto con números, trazos GTFS y separadores; destinos legibles y estados con texto e icono. Cabecera y navegación ligeras. Mapa inmersivo fuera del scroll externo, con buses seleccionables y ficha inferior. La lista accesible se consulta desde un panel expandible. El mapa real no se sustituye por la ilustración de las maquetas ni se inventan geometrías de recorridos.

## Implementación R4

| Tarea | Responsable | Depende de | Aceptación |
| --- | --- | --- | --- |
| R4-UI | Builder Antigravity Hydrogen Medium | Propuestas aprobadas | Costa/Pulso, catálogo y shell; typecheck |
| R4-MAPA | Builder Antigravity Hydrogen Medium | Contrato flex sin props en VehicleMap | mapa inmersivo, selección y lista accesible; typecheck |
| Integración | Codex | Ambas tareas | build web, backend, E2E y capturas claro/oscuro |

Sin dependencias nuevas. Movimiento con las herramientas Animated existentes. Para el área segura se aplican las reglas generales de UI UX Pro Max: la base local no devolvió una entrada específica para SafeAreaView en dos búsquedas.

UI UX Pro Max devolvió estilo minimalista, colores de transporte y recomendaciones de accesibilidad; sus patrones de landing y fuentes sugeridas no corresponden a esta app y se descartan. Se aplican las recomendaciones verificadas de roles accesibles y separación de controles. Las skills Emil y GSAP orientan ritmo y revelado al entrar en pantalla; la implementación usa Animated existente para mantener compatibilidad Expo, sin añadir dependencias.

## Estados de servicio

El usuario confirmó que se trata de una prueba: «cualquiera es solo un test, pero para funcionalidad las micros cuando no se encuentre ninguna en el mapa se inactivan, pero sino que sean cosas manejables del admin».

- Modo automático: activa con al menos un bus de esa línea con posición visible en el mapa; inactiva sin ninguno. Una posición antigua que todavía se dibuja cuenta, con su aviso de antigüedad.
- Modo manual: el administrador puede fijar activa, inactiva o temporalmente inactiva y volver al automático. Sus cambios se auditan.
- La detección de buses no depende del estado de la línea, para permitir que una línea vuelva a activarse.
- Catálogo, filtros y favoritos comparten estado efectivo. El catálogo consulta periódicamente mientras está visible.
- No se inventan horarios ni suspensiones oficiales. Las posiciones de la demostración siguen identificadas como simuladas.

## Skills del kit

Instaladas las instrucciones compatibles para Codex: UI UX Pro Max; Emil (diseño y animación); GSAP (incluido ScrollTrigger); find-skills; browser-use; Karpathy; Ponytail; i-have-adhd y Elephant Goldfish. Orquestar-agentes y Humanizer ya estaban disponibles. Se instaló también animate-expo para el stack detectado. No se ejecutó el instalador general del kit, que elimina carpetas de skills y configura plugins exclusivos de Claude.

## Validación

Typecheck, build web, tests backend y E2E. Regresión de tamaño/color/rayo de marcadores y estados con datos controlados. Capturas móvil y escritorio, temas claro/oscuro y movimiento reducido. No se declara validado iOS nativo sin dispositivo.

Antes de la pausa: TypeScript, exportación web y 75 tests backend pasaron. E2E: 32 de 36 pasaron; los casos de mapa y administración requieren repetición después de ajustar selectores. La aserción de administración se corrigió a «No activa». Repetir estos casos con el diseño integrado.

Integración Costa/Pulso terminada: TypeScript, exportación web,75 tests backend y los36 E2E completos (móvil/escritorio Chrome) pasaron. Después de corregir contraste de etiquetas, tema/compactación de atribución y disposición horizontal, pasaron20 pruebas dirigidas de mapa y accesibilidad. El mapa conserva una ficha lateral desplazable en horizontal.

Pedido final de marcadores: punto de8px centrado exactamente en la coordenada, mini bus15x16 arriba a la derecha y distintivo de rayo para eléctricas. El contenedor de48px sigue disponible como área táctil invisible; selección y detalle de línea en la ficha. Se verificó posición relativa, dimensiones visuales, color GTFS, electricidad y selección en8 pruebas de mapa, además de typecheck y build web finales. Capturas reales guardadas en `.orquestar/logs/costa-pulso/`.

Referencia adicional autorizada: se revisó la previsualización pública «CHAPTER — Card entrance» de https://thepromptsfactory.com/ como referencia de entrada escalonada. Se conserva el sistema Animated existente (opacidad/transformación, entrada única y movimiento reducido), sin añadir dependencias ni copiar recursos de pago.

No se ha validado todavía en iPhone nativo. No se hizo commit, merge ni publicación.

## Mezcla de tráfico y llegadas R5

Tras revisar las dos propuestas Astra de `propuestas-trafico-astra` (Mapa libre y Llegadas), el usuario eligió una mezcla con este comportamiento:

- Al abrir Mapa se muestra toda la flota, sin recorrido seleccionado.
- Elegir un paradero muestra únicamente las micros que aún pasarán por él, con próximas llegadas y tiempos identificados como simulados o aproximados.
- Elegir una micro dibuja solo su recorrido y sentido, con el color de su línea. Las próximas micros se consultan en el paradero de referencia o en el siguiente de ese recorrido.
- Los paraderos aparecen al acercar el mapa desde zoom 15; el seleccionado permanece visible. La búsqueda permite elegir uno sin depender del zoom.
- Tocar un paradero en el detalle de Líneas abre ese mismo paradero en el mapa y centra la cámara. Las actualizaciones de posiciones conservan la cámara.
- Limpiar la selección restaura toda la flota y quita el trazado.

La demostración añade cuatro vehículos virtuales por línea, repartidos entre ambos sentidos y desplazados sobre la geometría GTFS existente. No crea conductores ni viajes reales. Los cambios manuales del administrador conservan prioridad sobre el estado automático.

Implementación R5 terminada por tres builders Codex Sol 6.2. Pasaron TypeScript, 22 pruebas backend dirigidas y cuatro pruebas de capas/puente WebView. Se verificó la API LAN con 54 micros (52 virtuales y dos existentes), 13 líneas, 46 geometrías y 746 paraderos. Metro entregó el bundle iOS actualizado con HTTP 200 y la API LAN incluida. El usuario pidió probar personalmente y llevar un prompt de verificación a otra IA; la suite integral E2E R5 y el uso real en iPhone quedan pendientes. Expo y API se dejan activos.

## Observaciones posteriores del usuario, pendientes

El usuario pidió registrar estas observaciones en el prompt de revisión para otra IA. No se han implementado sus correcciones:

- Micros y paraderos deben aparecer progresivamente al acercar el zoom. Tener disponible toda la flota no significa mostrar todos sus iconos desde lejos; actualmente las micros saturan la vista lejana.
- Tras abrir Buscar paraderos o Ver vehículos, el usuario no puede bajar o contraer el panel. Reproducir el fallo y asegurar un control visible para contraerlo, además del gesto que se admita.
- Renombrar Ver vehículos como Ver micros y permitir filtrar las micros por línea, con una opción Todas y filtros claros al combinar selecciones.
- Mostrar la posición del usuario con un marcador propio y añadir Mi ubicación para centrar la cámara. Contemplar permiso denegado, carga y ubicación no disponible.
- El usuario percibe trazados desajustados respecto de las calles y sospecha recorridos incorrectos. Verificar coordenadas, orden, sentidos, variantes y correspondencia de geometrías con fuentes oficiales vigentes. Distinguir diferencias del mapa base de errores GTFS; no inventar ni ajustar rutas a calles sin verificar su recorrido real.
- Al tocar una micro debe mantenerse el comportamiento de mostrar solo su recorrido completo y sentido con el color de su línea. Conservar el filtro de paradero cuando la selección proviene de él.

La revisión debe entregar pasos para reproducir, comportamiento esperado y observado, propuesta de corrección y pruebas realmente ejecutadas. El usuario realizará la prueba en el teléfono. La suite integral E2E R5 sigue pendiente.
