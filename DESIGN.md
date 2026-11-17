# Diseño de VoyBus

Interfaz para operar con rapidez en un teléfono al usar transporte público. La pantalla principal prioriza la consulta de recorridos, el vínculo con el bus y la confirmación de la solicitud. La vista del conductor prioriza destinos y conteos, sin datos personales del pasajero.

## Paleta definida por el equipo

Versión 1.0, 11 de noviembre de 2026. El equipo define la paleta para esta implementación; la confirmación del cliente está pendiente. La especificación completa y sus reglas están en [PALETA.md](docs/entrega2/PALETA.md).

El verde profundo #12634D identifica acciones y selecciones. El azul tinta #132F35 organiza títulos, texto principal y el resumen del vehículo. El fondo marfil #F7F7F0 y las superficies blancas #FFFFFF mantienen la lectura clara. El amarillo #F6CE55 se limita a señalización del recorrido y detalles del vehículo; los botones principales conservan el verde.

Los colores de apoyo son #526769 para texto secundario, #D6DFD9 para separadores decorativos, #9B2C2C para errores, #E8EEE9 para acciones secundarias, #71867C para bordes de campos, #D6E8DE para texto secundario sobre azul tinta y #0D4B3B para el botón principal al pulsarlo. Todos se centralizan en front/src/ui.tsx.

Tipografía nativa legible, jerarquía marcada por tamaño y peso. Las listas de recorridos y paraderos son filas con divisores, sin tarjetas anidadas. Controles táctiles de 48 puntos como mínimo, errores junto al campo y botones con texto explícito.

## Navegación y estados

Dos tareas principales para pasajero: Recorridos y Mi viaje. El visitante consulta sin cuenta y entra a registro o acceso cuando necesita viajar. Sesiones separadas por rol; bandeja dedicada al conductor. Toda consulta distingue carga, vacío, error y recuperación. Los datos antiguos conservan su contexto con aviso de desactualización. Las claves de reintento se conservan hasta conocer el resultado del servidor.

La paleta está definida y aplicada. Su estado comercial es propuesta pendiente de aprobación del cliente; el correo todavía no se ha enviado.
