# VoyBus

Aplicación móvil académica de transporte público para Desarrollo de Soluciones Móviles, UCN, segundo semestre de 2026. El pasajero consulta la red, se vincula manualmente al servicio de un vehículo y solicita una parada. El conductor recibe solicitudes del servicio que tiene asignado.

## Usuarios y alcance

Pasajeros en transporte público y conductores con el vehículo detenido. Entrega 2 implementa RF01, RF02, RF04, RF05, RF06, RF08, RF09, RF10 y RF14 de docs/entrega2/ERS_VoyBus_Entrega2_v1.docx. El resto del documento especifica etapas posteriores. Catálogo y servicios iniciales son datos ficticios reproducibles.

## Plataforma

React Native y Expo para Android e iOS, con versión web para revisar el flujo. Express, Node 24 y SQLite en el backend. Sesión nativa en SecureStore; sesión web mediante cookie HttpOnly. Las solicitudes se confirman solo después de persistirlas. La bandeja se consulta cada cinco segundos cuando está visible.

## Decisiones abiertas

La paleta visual y las decisiones de la ERS aún requieren consulta al cliente. No hay integración GPS, timbre físico ni operación de transporte real. No se afirma haber medido cumplimiento de metas de rendimiento o validado en dispositivos que no se hayan probado.
