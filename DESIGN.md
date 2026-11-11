# Diseño de VoyBus

Interfaz para operar con rapidez en un teléfono al usar transporte público. La pantalla principal prioriza la consulta de recorridos, el vínculo con el bus y la confirmación de la solicitud. La vista del conductor prioriza destinos y conteos, sin datos personales del pasajero.

## Sistema visual propuesto

Fondo marfil claro, texto azul tinta y acciones verde oscuro. El color de acento amarillo acompaña la identidad y la secuencia del recorrido sin reemplazar texto de estado. Tipografía nativa legible, jerarquía marcada por tamaño y peso. Las listas de recorridos y paraderos son filas con divisores, sin tarjetas anidadas. Controles táctiles de 48 puntos como mínimo, errores junto al campo y botones con texto explícito.

## Navegación y estados

Dos tareas principales para pasajero: Recorridos y Mi viaje. El visitante consulta sin cuenta y entra a registro o acceso cuando necesita viajar. Sesiones separadas por rol; bandeja dedicada al conductor. Toda consulta distingue carga, vacío, error y recuperación. Los datos antiguos conservan su contexto con aviso de desactualización. Las claves de reintento se conservan hasta conocer el resultado del servidor.

La paleta es una propuesta de implementación y no una aprobación atribuida al cliente.
