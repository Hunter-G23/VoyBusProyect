# VoyBusProyect
# Backend

Backend REST para VoyBus, una app móvil de transporte público que permite consultar
líneas, recorridos y paraderos, visualizar vehículos en circulación, y enviar
solicitudes digitales de parada.

Proyecto desarrollado para el curso **Desarrollo de Soluciones Móviles — 2026-20**.

## Stack

- **Node.js** + **Express** — servidor y API REST
- **SQLite** — base de datos
- **JWT** — autenticación
- **bcrypt** — hash de contraseñas

## Requisitos previos

- Node.js 18 o superior
- npm

## Instalación

```bash
git clone <https://github.com/Hunter-G23/VoyBusProyect.git>
cd Backend_VoyBus
npm install
```

## Variables de entorno

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

| Variable     | Descripción                              | Ejemplo               |
|--------------|-------------------------------------------|------------------------|
| `PORT`       | Puerto donde corre el servidor            | `3000`                 |
| `JWT_SECRET` | Clave secreta para firmar tokens          | `cambia_esto_por_algo_seguro` |
| `DB_PATH`    | Ruta del archivo de base de datos SQLite  | `./src/database/voybus.db` |


## Preparar la base de datos

Crear el esquema:

```bash
npm run migrate
```

Cargar datos iniciales (líneas, paraderos, vehículos y usuarios demo):

```bash
npm run seed
```

## Ejecutar el servidor

Modo desarrollo (con recarga automática):

```bash
npm run dev
```

Modo producción:

```bash
npm start
```

El servidor debe quedar disponible en `http://localhost:3000`.

## Cuentas demo

Creadas automáticamente al correr `npm run seed`:

| Rol       | Correo                     | Contraseña     |
|-----------|-----------------------------|----------------|
| Pasajero  | pasajero.demo@voybus.cl     | `[pendiente]`  |
| Conductor | conductor.demo@voybus.cl    | `[pendiente]`  |
| Admin     | admin.demo@voybus.cl        | `[pendiente]`  |

> Actualizar esta tabla con las contraseñas reales una vez implementado `seed.js`.

## Estructura del proyecto

```
src/
├── api/              # Punto de entrada de rutas (versionado si aplica)
├── config/           # Configuración (BD, variables de entorno)
├── controllers/       # Manejo de requests/responses
├── database/          # Esquema SQL y seeds
├── middlewares/       # Autenticación, roles, validación, errores
├── models/             # Acceso a datos
├── routes/             # Definición de endpoints por módulo
├── services/           # Lógica de negocio
└── utils/              # Helpers (JWT, hash, formato de respuestas)
```

## Scripts disponibles

| Comando          | Descripción                              |
|-------------------|--------------------------------------------|
| `npm run dev`     | Levanta el servidor con nodemon            |
| `npm start`       | Levanta el servidor en modo producción     |
| `npm run migrate` | Crea las tablas en la base de datos        |
| `npm run seed`    | Carga datos iniciales de prueba            |

## Guía rápida de pruebas

1. **Registro**: `POST /api/auth/registro` con nombre, correo, contraseña y confirmación.
2. **Inicio de sesión**: `POST /api/auth/login` con correo y contraseña. Devuelve un token JWT.
3. **Consultar líneas**: `GET /api/red/lineas` (no requiere autenticación).
4. **Consultar paraderos de un recorrido**: `GET /api/red/recorridos/:id/paraderos`.
5. **Vincularse a un vehículo**: `POST /api/viaje/vincular` con el código del vehículo (QR o manual).
6. **Solicitar parada**: `POST /api/viaje/solicitudes` con el `paradero_id` de destino.
7. **Seguimiento de solicitud**: `GET /api/viaje/solicitudes/:id`.

> `[pendiente]` completar con los endpoints reales y ejemplos de body/response a medida
> que se implemente cada módulo.

## Convenciones del repositorio

- Ramas: `main` → `dev` → ramas individuales por integrante.
- Commits siguiendo [Conventional Commits](https://www.conventionalcommits.org/).
- Código organizado por capa (`routes` → `controllers` → `services` → `models`),
  con un archivo por entidad en cada capa.

## Integrantes

| Nombre |  
|--------|
| `Benjamin Gutierrez` |
| `Juan Gomez` |
