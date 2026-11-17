const fs = require("node:fs");
const path = require("node:path");
const { transaction } = require("./db");

function migrate(db) {
  transaction(db, () => {
    db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
    function add(table, column, definition) {
      if (
        db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .some((c) => c.name === column)
      )
        return false;
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      return true;
    }
    add("usuario", "sesion_version", "INTEGER NOT NULL DEFAULT 0");
    add(
      "usuario",
      "idioma",
      "TEXT NOT NULL DEFAULT 'es' CHECK(idioma IN ('es','en'))",
    );
    add("linea", "color", "TEXT");
    add("linea", "color_texto", "TEXT");
    add(
      "linea",
      "electrica",
      "INTEGER NOT NULL DEFAULT 0 CHECK(electrica IN (0,1))",
    );
    if (
      add(
        "linea",
        "estado",
        "TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','inactiva','temporal'))",
      )
    )
      db.exec(
        "UPDATE linea SET estado=CASE WHEN activa=1 THEN 'activa' ELSE 'inactiva' END",
      );
    add("linea", "fuente", "TEXT");
    if (add("recorrido", "codigo", "TEXT"))
      db.exec(
        "UPDATE recorrido SET codigo=(SELECT codigo FROM linea WHERE id=recorrido.linea_id)",
      );
    add(
      "recorrido",
      "variante",
      "INTEGER NOT NULL DEFAULT 0 CHECK(variante IN (0,1))",
    );
    // Before RF07 all persisted positions were produced by the simulator.
    if (
      add(
        "posicion_vehiculo",
        "origen",
        "TEXT NOT NULL DEFAULT 'gps' CHECK(origen IN ('simulacion','gps'))",
      )
    )
      db.exec("UPDATE posicion_vehiculo SET origen='simulacion'");
    db.exec(`CREATE TRIGGER IF NOT EXISTS linea_estado_insert AFTER INSERT ON linea BEGIN
      UPDATE linea SET estado=CASE WHEN NEW.activa=0 AND NEW.estado='activa' THEN 'inactiva' ELSE NEW.estado END,
        activa=CASE WHEN NEW.activa=0 OR NEW.estado!='activa' THEN 0 ELSE 1 END WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS linea_estado_update AFTER UPDATE OF estado ON linea
      WHEN NEW.activa != (NEW.estado='activa') BEGIN
        UPDATE linea SET activa=(NEW.estado='activa') WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS linea_activa_update AFTER UPDATE OF activa ON linea
      WHEN NEW.activa != (NEW.estado='activa') BEGIN
        UPDATE linea SET estado=CASE WHEN NEW.activa=1 THEN 'activa' ELSE 'inactiva' END WHERE id=NEW.id;
      END;`);
  });
}
if (require.main === module) {
  const { dbPath } = require("../config/env");
  const { openDatabase } = require("./db");
  const db = openDatabase(dbPath);
  try {
    migrate(db);
    console.log("Esquema preparado.");
  } finally {
    db.close();
  }
}
module.exports = { migrate };
