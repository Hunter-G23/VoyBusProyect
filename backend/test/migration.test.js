const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase, migrate } = require("../src/database/db");

test("v2 migra las tablas anteriores sin perder filas y puede repetirse", () => {
  const db = openDatabase(":memory:");
  try {
    // Deliberately define the old tables, independently of the current schema and git history.
    db.exec(`CREATE TABLE usuario(id INTEGER PRIMARY KEY,nombre TEXT NOT NULL,correo TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,rol TEXT NOT NULL CHECK(rol IN ('pasajero','conductor','administrador')),activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)),creado_en TEXT NOT NULL);
      CREATE TABLE linea(id INTEGER PRIMARY KEY,codigo TEXT NOT NULL UNIQUE,nombre TEXT NOT NULL,activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0,1)));
      CREATE TABLE recorrido(id INTEGER PRIMARY KEY,linea_id INTEGER NOT NULL REFERENCES linea(id),nombre TEXT NOT NULL,sentido TEXT NOT NULL,origen TEXT NOT NULL,destino TEXT NOT NULL,activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)));
      CREATE TABLE paradero(id INTEGER PRIMARY KEY,codigo TEXT NOT NULL UNIQUE,nombre TEXT NOT NULL,latitud REAL NOT NULL CHECK(latitud BETWEEN -90 AND 90),longitud REAL NOT NULL CHECK(longitud BETWEEN -180 AND 180),activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)));
      CREATE TABLE recorrido_paradero(id INTEGER PRIMARY KEY,recorrido_id INTEGER NOT NULL REFERENCES recorrido(id),paradero_id INTEGER NOT NULL REFERENCES paradero(id),posicion INTEGER NOT NULL CHECK(posicion>0),UNIQUE(recorrido_id,posicion));
      CREATE TABLE vehiculo(id INTEGER PRIMARY KEY,patente TEXT NOT NULL UNIQUE,codigo_vinculacion TEXT NOT NULL UNIQUE,activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)));
      CREATE TABLE servicio(id INTEGER PRIMARY KEY,vehiculo_id INTEGER NOT NULL REFERENCES vehiculo(id),conductor_id INTEGER NOT NULL REFERENCES usuario(id),recorrido_id INTEGER NOT NULL REFERENCES recorrido(id),estado TEXT NOT NULL CHECK(estado IN ('activo','finalizado')),ultima_posicion INTEGER NOT NULL DEFAULT 0 CHECK(ultima_posicion>=0),inicio TEXT NOT NULL,fin TEXT);
      CREATE TABLE vinculo_viaje(id INTEGER PRIMARY KEY,pasajero_id INTEGER NOT NULL REFERENCES usuario(id),servicio_id INTEGER NOT NULL REFERENCES servicio(id),estado TEXT NOT NULL CHECK(estado IN ('activo','cerrado')),inicio TEXT NOT NULL,fin TEXT);
      CREATE TABLE solicitud_parada(id INTEGER PRIMARY KEY,vinculo_id INTEGER NOT NULL REFERENCES vinculo_viaje(id),destino_id INTEGER NOT NULL REFERENCES recorrido_paradero(id),clave_idempotencia TEXT NOT NULL,estado TEXT NOT NULL CHECK(estado IN ('pendiente','reconocida','atendida','cancelada','expirada')),creada_en TEXT NOT NULL,actualizada_en TEXT NOT NULL,UNIQUE(vinculo_id,clave_idempotencia));
      CREATE TABLE evento_solicitud(id INTEGER PRIMARY KEY,solicitud_id INTEGER NOT NULL REFERENCES solicitud_parada(id),actor_id INTEGER REFERENCES usuario(id),estado_anterior TEXT,estado_nuevo TEXT NOT NULL,fecha TEXT NOT NULL);
      CREATE TABLE posicion_vehiculo(id INTEGER PRIMARY KEY,servicio_id INTEGER NOT NULL REFERENCES servicio(id),latitud REAL NOT NULL CHECK(latitud BETWEEN -90 AND 90),longitud REAL NOT NULL CHECK(longitud BETWEEN -180 AND 180),medida_en TEXT NOT NULL);
      INSERT INTO usuario VALUES(10,'Legacy driver','legacy@example.test','hash','conductor',1,'2025-01-01');
      INSERT INTO linea VALUES(10,'OLD','Legacy line',0);
      INSERT INTO recorrido VALUES(10,10,'Legacy route','Ida','A','B',1);
      INSERT INTO paradero VALUES(10,'OLDSTOP','Legacy stop',-23.6,-70.4,1);
      INSERT INTO recorrido_paradero VALUES(10,10,10,1);
      INSERT INTO vehiculo VALUES(10,'OLD001','OLD001',1);
      INSERT INTO servicio VALUES(10,10,10,10,'activo',0,'2025-01-01',NULL);
      INSERT INTO vinculo_viaje VALUES(10,10,10,'cerrado','2025-01-01','2025-01-02');
      INSERT INTO solicitud_parada VALUES(10,10,10,'legacy-key','atendida','2025-01-01','2025-01-02');
      INSERT INTO evento_solicitud VALUES(10,10,10,NULL,'atendida','2025-01-02');
      INSERT INTO posicion_vehiculo VALUES(10,10,-23.6,-70.4,'2025-01-01');`);
    migrate(db);
    migrate(db);
    assert.equal(
      db.prepare("SELECT estado FROM linea WHERE id=10").get().estado,
      "inactiva",
    );
    assert.equal(
      db.prepare("SELECT sesion_version FROM usuario WHERE id=10").get()
        .sesion_version,
      0,
    );
    assert.equal(
      db.prepare("SELECT origen FROM posicion_vehiculo WHERE id=10").get()
        .origen,
      "simulacion",
    );
    assert.equal(
      db.prepare("SELECT codigo FROM recorrido WHERE id=10").get().codigo,
      "OLD",
    );
    for (const table of [
      "usuario",
      "linea",
      "recorrido",
      "paradero",
      "recorrido_paradero",
      "vehiculo",
      "servicio",
      "vinculo_viaje",
      "solicitud_parada",
      "evento_solicitud",
      "posicion_vehiculo",
    ])
      assert.equal(
        db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
        1,
        table,
      );
    for (const table of [
      "favorito",
      "usuario_foto",
      "preferencia_notificacion",
      "linea_estado_evento",
    ])
      assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0);
    db.exec("UPDATE linea SET estado='temporal' WHERE id=10");
    assert.equal(
      db.prepare("SELECT activa FROM linea WHERE id=10").get().activa,
      0,
    );
    db.exec("UPDATE linea SET activa=1 WHERE id=10");
    assert.equal(
      db.prepare("SELECT estado FROM linea WHERE id=10").get().estado,
      "activa",
    );
    migrate(db);
    assert.equal(
      db.prepare("SELECT estado FROM linea WHERE id=10").get().estado,
      "activa",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
