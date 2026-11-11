# Borrador de consulta al cliente

Estado: no enviado. Destinatario y fecha de envío por completar por el equipo. Adjuntar la ERS y una captura real de la interfaz que muestre la paleta. Conservar correo y respuesta para la evaluación.

Adjuntos preparados: ERS_VoyBus_Entrega2_v1.docx, [captura de pasajero](evidencia/pasajero_web_movil.png) y [captura de conductor](evidencia/conductor_web_movil.png). Las capturas corresponden a la aplicación web con datos ficticios de prueba.

**Asunto:** VoyBus — Revisión de ERS y alcance de la entrega 2

Estimado/a:

Compartimos la propuesta de ERS de VoyBus para revisar el alcance de la segunda entrega. Desarrollamos una implementación inicial para verificar el flujo, que mantenemos pendiente de su validación.

Proponemos presentar estos nueve requisitos:

- RF01 Registrar pasajero.
- RF02 Iniciar sesión con control de rol.
- RF04 Consultar líneas de transporte.
- RF05 Consultar recorridos de una línea.
- RF06 Consultar paraderos ordenados de un recorrido.
- RF08 Vincular pasajero a un vehículo por código manual.
- RF09 Solicitar parada en el recorrido vinculado.
- RF10 Consultar el estado de una solicitud propia.
- RF14 Consultar solicitudes del servicio como conductor.

Necesitamos confirmar estas decisiones:

1. **RF08:** usar ingreso manual del código en esta entrega y dejar el lector QR para después.
2. **RF09 y RF10:** el pasajero solicita una parada estando a bordo. El destino debe corresponder a un paradero futuro del recorrido del vehículo. El estado pendiente indica que el servidor guardó la solicitud, sin afirmar que el conductor ya la reconoció o atendió.
3. **RF14 y RF15:** en esta entrega el conductor consulta la bandeja de su servicio. Reconocer y marcar solicitudes como atendidas corresponde a una etapa posterior, junto con el inicio/cierre de servicios de RF13.
4. **RF01 y RF02:** el registro público crea pasajeros. Las cuentas de conductor y administrador se preparan por separado. Proponemos sesiones de 60 minutos.
5. **Alcance posterior:** mapa con vehículos y GPS, cancelación, desvinculación y administración quedan fuera de los nueve seleccionados. El catálogo y los servicios de la demostración son ficticios.
6. **Paleta propuesta:** verde oscuro #12634D, azul tinta #132F35, fondo claro #F7F7F0 y acento amarillo #F6CE55. Adjuntamos una captura de su aplicación en la interfaz.

¿Podría confirmar si aprueba estas decisiones e indicar los ajustes que considere necesarios? Si existe una ERS anterior aprobada, agradeceríamos contrastarla para registrar por ID cualquier diferencia con esta propuesta.

Hasta recibir su respuesta mantendremos estas decisiones como pendientes de validación.

Saludos,
Equipo VoyBus
Juan Gomez y Benjamin Gutierrez

## Registro después del envío

Anotar fecha, destinatario, adjuntos, enlace a la evidencia y estado de cada decisión. Registrar aprobación, solicitud de cambio o pendiente de respuesta. No dar por aprobados los puntos sin respuesta explícita.
