const { dbPath } = require("../config/env");
const { openDatabase, migrate } = require("./db");
const db = openDatabase(dbPath);
try {
  migrate(db);
  console.log("Esquema preparado.");
} finally {
  db.close();
}
