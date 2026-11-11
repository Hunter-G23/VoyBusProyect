const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
function openDatabase(filename) {
  if (filename !== ":memory:")
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;",
  );
  return db;
}
function migrate(db) {
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
}
function transaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
module.exports = { openDatabase, migrate, transaction };
