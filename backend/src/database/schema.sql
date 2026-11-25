PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS usuario (
 id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, rol TEXT NOT NULL CHECK(rol IN ('pasajero','conductor','administrador')),
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)), creado_en TEXT NOT NULL,
 sesion_version INTEGER NOT NULL DEFAULT 0,
 idioma TEXT NOT NULL DEFAULT 'es' CHECK(idioma IN ('es','en'))
);
CREATE TABLE IF NOT EXISTS linea (
 id INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0,1)),
 color TEXT, color_texto TEXT, electrica INTEGER NOT NULL DEFAULT 0 CHECK(electrica IN (0,1)),
 estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','inactiva','temporal')), fuente TEXT,
 modo_estado TEXT NOT NULL DEFAULT 'manual' CHECK(modo_estado IN ('auto','manual'))
);
CREATE TABLE IF NOT EXISTS recorrido (
 id INTEGER PRIMARY KEY, linea_id INTEGER NOT NULL REFERENCES linea(id), nombre TEXT NOT NULL,
 sentido TEXT NOT NULL, origen TEXT NOT NULL, destino TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)),
 codigo TEXT, variante INTEGER NOT NULL DEFAULT 0 CHECK(variante IN (0,1))
);
CREATE TABLE IF NOT EXISTS paradero (
 id INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
 latitud REAL NOT NULL CHECK(latitud BETWEEN -90 AND 90), longitud REAL NOT NULL CHECK(longitud BETWEEN -180 AND 180),
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE IF NOT EXISTS recorrido_paradero (
 id INTEGER PRIMARY KEY, recorrido_id INTEGER NOT NULL REFERENCES recorrido(id),
 paradero_id INTEGER NOT NULL REFERENCES paradero(id), posicion INTEGER NOT NULL CHECK(posicion > 0), UNIQUE(recorrido_id,posicion)
);
CREATE TABLE IF NOT EXISTS vehiculo (
 id INTEGER PRIMARY KEY, patente TEXT NOT NULL UNIQUE, codigo_vinculacion TEXT NOT NULL UNIQUE,
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE IF NOT EXISTS servicio (
 id INTEGER PRIMARY KEY, vehiculo_id INTEGER NOT NULL REFERENCES vehiculo(id), conductor_id INTEGER NOT NULL REFERENCES usuario(id),
 recorrido_id INTEGER NOT NULL REFERENCES recorrido(id), estado TEXT NOT NULL CHECK(estado IN ('activo','finalizado')),
 ultima_posicion INTEGER NOT NULL DEFAULT 0 CHECK(ultima_posicion >= 0), inicio TEXT NOT NULL, fin TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS servicio_vehiculo_activo ON servicio(vehiculo_id) WHERE estado='activo';
CREATE UNIQUE INDEX IF NOT EXISTS servicio_conductor_activo ON servicio(conductor_id) WHERE estado='activo';
CREATE TABLE IF NOT EXISTS vinculo_viaje (
 id INTEGER PRIMARY KEY, pasajero_id INTEGER NOT NULL REFERENCES usuario(id), servicio_id INTEGER NOT NULL REFERENCES servicio(id),
 estado TEXT NOT NULL CHECK(estado IN ('activo','cerrado')), inicio TEXT NOT NULL, fin TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS vinculo_pasajero_activo ON vinculo_viaje(pasajero_id) WHERE estado='activo';
CREATE INDEX IF NOT EXISTS vinculo_servicio ON vinculo_viaje(servicio_id);
CREATE TABLE IF NOT EXISTS solicitud_parada (
 id INTEGER PRIMARY KEY, vinculo_id INTEGER NOT NULL REFERENCES vinculo_viaje(id), destino_id INTEGER NOT NULL REFERENCES recorrido_paradero(id),
 clave_idempotencia TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('pendiente','reconocida','atendida','cancelada','expirada')),
 creada_en TEXT NOT NULL, actualizada_en TEXT NOT NULL, UNIQUE(vinculo_id,clave_idempotencia)
);
CREATE UNIQUE INDEX IF NOT EXISTS solicitud_vinculo_activa ON solicitud_parada(vinculo_id) WHERE estado IN ('pendiente','reconocida');
CREATE TABLE IF NOT EXISTS evento_solicitud (
 id INTEGER PRIMARY KEY, solicitud_id INTEGER NOT NULL REFERENCES solicitud_parada(id), actor_id INTEGER REFERENCES usuario(id),
 estado_anterior TEXT, estado_nuevo TEXT NOT NULL, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posicion_vehiculo (
 id INTEGER PRIMARY KEY, servicio_id INTEGER NOT NULL REFERENCES servicio(id),
 latitud REAL NOT NULL CHECK(latitud BETWEEN -90 AND 90), longitud REAL NOT NULL CHECK(longitud BETWEEN -180 AND 180), medida_en TEXT NOT NULL,
 origen TEXT NOT NULL DEFAULT 'gps' CHECK(origen IN ('simulacion','gps'))
);
CREATE INDEX IF NOT EXISTS posicion_vehiculo_servicio_medida ON posicion_vehiculo(servicio_id, medida_en);
CREATE TABLE IF NOT EXISTS favorito (
 id INTEGER PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuario(id), linea_id INTEGER NOT NULL REFERENCES linea(id),
 recorrido_id INTEGER REFERENCES recorrido(id), creado_en TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS favorito_linea_unico ON favorito(usuario_id,linea_id) WHERE recorrido_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS favorito_recorrido_unico ON favorito(usuario_id,linea_id,recorrido_id) WHERE recorrido_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS usuario_foto (
 usuario_id INTEGER PRIMARY KEY REFERENCES usuario(id), tipo TEXT NOT NULL CHECK(tipo IN ('image/jpeg','image/png')),
 datos BLOB NOT NULL CHECK(length(datos)<=524288), actualizada_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferencia_notificacion (
 usuario_id INTEGER NOT NULL REFERENCES usuario(id), tipo TEXT NOT NULL CHECK(tipo IN ('estado_linea_favorita','solicitud')),
 activa INTEGER NOT NULL CHECK(activa IN (0,1)), PRIMARY KEY(usuario_id,tipo)
);
CREATE TABLE IF NOT EXISTS linea_estado_evento (
 id INTEGER PRIMARY KEY, linea_id INTEGER NOT NULL REFERENCES linea(id),
 estado_anterior TEXT NOT NULL CHECK(estado_anterior IN ('activa','inactiva','temporal')),
 estado_nuevo TEXT NOT NULL CHECK(estado_nuevo IN ('activa','inactiva','temporal')),
 admin_id INTEGER NOT NULL REFERENCES usuario(id), fecha TEXT NOT NULL,
 modo_anterior TEXT CHECK(modo_anterior IN ('auto','manual')),
 modo_nuevo TEXT CHECK(modo_nuevo IN ('auto','manual'))
);
CREATE INDEX IF NOT EXISTS linea_estado_evento_linea ON linea_estado_evento(linea_id,id);
