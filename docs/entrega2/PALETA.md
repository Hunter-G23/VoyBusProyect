# Paleta de color de VoyBus

Versión 1.0 · 11 de noviembre de 2026.

**Definida por el equipo y aplicada en la interfaz. Pendiente de aprobación del cliente.** La consulta por correo y su respuesta son evidencias distintas de esta definición técnica.

## Criterio de diseño

VoyBus debe permitir leer un recorrido, identificar el vehículo y solicitar una parada con rapidez. Elegimos una base clara con texto oscuro y un verde profundo para que las acciones principales se reconozcan de forma consistente. El amarillo acompaña la señalización del recorrido y del vehículo, en cantidades pequeñas.

La decisión mantiene la identidad que ya se utiliza en la aplicación. Se aplican los criterios de sistema visual consistente, color contenido y contraste de [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md), adaptados a esta tarea de paleta para una aplicación móvil. Esta revisión no rediseña la navegación ni incorpora los efectos de una página promocional.

## Colores y funciones

| Color | HEX | Token de código | Uso |
| --- | --- | --- | --- |
| Verde profundo | #12634D | green | Botones principales, selección activa e iconos de confirmación de una operación guardada. |
| Azul tinta | #132F35 | ink | Texto principal, títulos, identificadores y fondo del resumen del vehículo. |
| Marfil claro | #F7F7F0 | background | Fondo general de las pantallas. |
| Blanco | #FFFFFF | paper | Superficies de lectura y texto sobre verde o azul tinta. |
| Amarillo de señalización | #F6CE55 | yellow | Numeración del recorrido y detalles del bus, con texto azul tinta. |
| Gris verdoso | #526769 | muted | Fechas, coordenadas, etiquetas y texto de apoyo. |
| Rojo de error | #9B2C2C | error | Mensajes de validación y avisos de fallo, siempre acompañados de texto. |
| Separador claro | #D6DFD9 | line | Divisiones decorativas entre filas y áreas. |
| Verde claro de superficie | #E8EEE9 | surface | Fondo de botones secundarios, con texto azul tinta. |
| Borde de control | #71867C | border | Contorno visible de campos sobre blanco o marfil. |
| Texto sobre fondo oscuro | #D6E8DE | onDark | Información secundaria del vehículo sobre azul tinta. |
| Verde al pulsar | #0D4B3B | greenPressed | Estado pulsado del botón principal, con texto blanco. |

La fuente de los valores es `colors` en `front/src/ui.tsx`. No crear versiones de un mismo color dentro de cada pantalla.

## Aplicación en las pantallas

- **Registro y acceso:** fondo marfil, campos blancos con borde de control, etiquetas azul tinta, botón verde y errores rojos junto al campo.
- **Recorridos y paraderos:** texto azul tinta, divisiones claras y numeración amarilla con texto oscuro. La primera posición se identifica con verde y texto blanco. El código y nombre del paradero permanecen visibles.
- **Mi viaje:** resumen del vehículo azul tinta, texto blanco y texto de apoyo claro. La selección y la acción de solicitar parada se identifican con verde.
- **Comprobante:** superficie blanca y mensaje explícito de estado. El icono verde de envío confirma que el servidor guardó la solicitud; no significa que el conductor la reconoció o atendió.
- **Conductor:** resumen azul tinta y conteos en verde. Cada destino conserva nombre, posición y cantidad. El amarillo acompaña el icono del vehículo.

## Reglas de uso

1. Usar un único color de acción principal, el verde. El amarillo es señalización, sin competir con los botones.
2. Mantener la mayor parte de la pantalla en fondos claros. Evitar grandes superficies amarillas o rojas y degradados añadidos.
3. Usar azul tinta sobre amarillo. No usar blanco sobre amarillo ni amarillo como texto pequeño sobre blanco o marfil.
4. Mantener nombre, icono o texto junto a toda información de estado. No depender únicamente de la diferencia entre rojo y verde.
5. Reservar los separadores claros para decoración. Los campos usan el borde #71867C, con mayor contraste.
6. Usar verde oscuro #0D4B3B al pulsar el botón principal. Los controles deshabilitados conservan su etiqueta y se diferencian también mediante su estado de accesibilidad.
7. Esta versión define un tema claro. Un tema oscuro requiere otra revisión de combinaciones y no se considera definido por invertir los colores.

## Contraste calculado

Se calculó la relación de luminancia sRGB de los valores HEX sin transparencia. Los valores se muestran redondeados a dos decimales; los umbrales se contrastan con el resultado sin redondear.

| Primer plano | Fondo | Relación | Uso revisado |
| --- | --- | --- | --- |
| Blanco #FFFFFF | Verde #12634D | 7.20:1 | Texto de botón principal. |
| Azul tinta #132F35 | Marfil #F7F7F0 | 13.14:1 | Texto principal. |
| Gris verdoso #526769 | Blanco #FFFFFF | 6.00:1 | Texto secundario. |
| Gris verdoso #526769 | Marfil #F7F7F0 | 5.57:1 | Texto secundario. |
| Azul tinta #132F35 | Amarillo #F6CE55 | 9.34:1 | Numeración y señalización con texto. |
| Rojo #9B2C2C | Blanco #FFFFFF | 7.53:1 | Texto de error. |
| Borde #71867C | Blanco #FFFFFF | 3.89:1 | Límite de campos. |
| Borde #71867C | Marfil #F7F7F0 | 3.61:1 | Límite de campos. |
| Texto claro #D6E8DE | Azul tinta #132F35 | 11.08:1 | Información secundaria del vehículo. |

Como referencia se usan los criterios de [contraste de texto de WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), 4.5:1 para texto normal, y [contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), 3:1 para información visual necesaria para identificar controles y estados. Estas comprobaciones de color no certifican la accesibilidad completa de la app ni la lectura bajo todas las condiciones de luz. Sigue pendiente la revisión en teléfono físico.

## Envío y aprobación

Adjuntar [PALETA_VoyBus_v1.pdf](PALETA_VoyBus_v1.pdf) y las capturas reales de [pasajero](evidencia/pasajero_web_movil.png) y [conductor](evidencia/conductor_web_movil.png). El texto listo para enviar está en el [correo unificado de ERS y paleta](CORREO_CLIENTE.md), con las funciones posteriores separadas del alcance de la entrega 2.

Registrar después del envío la fecha, destinatario, versión adjunta y respuesta. Hasta recibir una confirmación explícita, el estado es **pendiente de aprobación del cliente**.
