# Diseño de VoyBus: Letrero

Interfaz para consultar la red de Antofagasta y solicitar una parada con una mano. La dirección Letrero está aprobada; toma de Boleto los botones rectangulares de cabecera y el indicador detallado de pasos. La aprobación comercial del cliente es una evidencia separada. Referencia: [diseño v2](docs/designs/voybus-v2-design.md).

## Sistema visual

Barlow Condensed 600–800 identifica títulos, destinos y números de línea; Barlow 400–700 se usa para lectura. La aplicación carga las fuentes antes de mostrar las pantallas y admite la fuente del sistema si fallan. Las placas oscuras organizan las líneas; su número conserva el color oficial GTFS, a 36 pt. E01 lleva un rayo y el texto Eléctrica. Las variantes conservan su código y el color de la línea base.

Los valores se centralizan en `front/src/theme.tsx`; los componentes consumen `useTheme()`. Las líneas reciben su color desde la API. `ui.tsx` conserva los componentes compartidos y las exportaciones de compatibilidad.

| Token | Claro | Oscuro |
| --- | --- | --- |
| background | #F7F7F0 | #0C1C20 |
| paper | #FFFFFF | #132F35 |
| ink | #132F35 | #F7F7F0 |
| muted | #526769 | #A9BDB8 |
| action | #12634D | #6FD3AE |
| onAction | #FFFFFF | #0C1C20 |
| actionPressed | #0D4B3B | #4FB892 |
| border | #71867C | #8FA79D |
| signal | #F6CE55 | #F6CE55 |
| error | #9B2C2C | #F2A0A0 |
| surface | #E8EEE9 | #1E3A40 |
| plate / onPlate | #132F35 / #F7F7F0 | #132F35 / #F7F7F0 |
| plateMuted / signalInk | #D6E8DE / #132F35 | #D6E8DE / #132F35 |

El verde identifica la acción principal; el amarillo señala información, no botones principales. Excepción acotada: los chips de estado solicitados usan verde, rojo y amarillo, siempre con icono y texto. Los bordes de las placas se refuerzan en oscuro. Ver [contrastes y colores de línea](docs/entrega2/PALETA.md).

## Navegación y estados

Pasajero: Líneas, Mapa, Favoritos y Mi viaje. El avatar abre Perfil; sin sesión, Ingresar abre el acceso y registro. Conductor: bandeja propia y Perfil. Administrador: Estado de líneas, con confirmación y registro del último actor y fecha.

Cada consulta distingue carga, vacío, error y datos sin actualizar. Los datos anteriores permanecen visibles si falla una actualización. La atribución GTFS usa la versión real del campo `fuente`, nunca una fecha inventada. El mapa distingue posiciones simuladas y sin datos. Los favoritos sin sesión se guardan en el dispositivo y muestran el recordatorio una sola vez; la sincronización no borra el dispositivo antes de confirmar todos los POST.

## Movimiento

Solo `transform` y `opacity`, mediante `front/src/motion.ts`, sin otro sistema de animación.

| Token | Duración / regla |
| --- | --- |
| press | 120 ms, out quad, escala 1 a 0.97 sin rebote |
| fast / base | 160 / 200 ms, bezier(0.2, 0, 0, 1) |
| theme | 220 ms, cobertura y revelado de 110 ms |
| screen | 180 ms, opacidad y desplazamiento de 6 pt |
| stagger | 40 ms, primeros 6 elementos, primera carga de la sesión |
| spinnerDelay | 300 ms; después de 3 s se explica que sigue cargando |
| reduced | 120 ms de fundido; sin traslaciones, escalas ni escalonado |

`Steps` muestra número, nombre, estado e icono para Vincular, Destino y Comprobante. `StepTransition` explica el cambio de paso; los reintentos conservan la clave y el destino hasta conocer el resultado del servidor.

## Accesibilidad e idioma

- Controles de al menos 48 × 48 pt, también enlaces de atribución del mapa.
- Texto normal con contraste 4.5:1; números grandes y bordes necesarios, 3:1.
- Foco web de 3 px con separación de 2 px, navegación por teclado y estados accesibles de selección, marcado, deshabilitado, ocupado y expansión.
- Radio groups para filtros, recorridos, destinos y preferencias; pestañas con selección explícita.
- El estado nunca depende solo del color. Errores de campo junto al campo; ningún aviso sustituye una confirmación de persistencia.
- Español e inglés mediante diccionarios por pantalla y `t()`. Los nombres y códigos de la red provienen de la API.
- No se usa el carácter de raya larga en la interfaz.

`e2e/a11y.spec.ts` mide objetivos a 390 px, desborde a 195 px (la simulación solicitada de texto al 200 %), foco y funcionamiento con movimiento reducido. En esta ejecución solo se completó el cálculo de contraste; las comprobaciones de navegador quedaron bloqueadas por el entorno. Esto no certifica WCAG 2.2 AA ni sustituye pruebas con lector de pantalla o teléfono físico.
