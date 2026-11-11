const path = require("node:path");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { openDatabase, migrate } = require("../backend/src/database/db");
const { seed } = require("../backend/src/database/seed");
const { createApp } = require("../backend/src/app");
const dir = mkdtempSync(path.join(tmpdir(), "voybus-e2e-"));
const db = openDatabase(path.join(dir, "e2e.db"));
migrate(db);
seed(db);
const server = createApp(db, {
  jwtSecret: "e2e-only-secret-more-than-thirty-two-characters",
  origins: ["http://localhost:8082"],
  production: false,
}).listen(3001, "127.0.0.1", () => console.log("API E2E en 3001"));
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () =>
    server.close(() => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
      process.exit(0);
    }),
  );
