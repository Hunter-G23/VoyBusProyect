const config = require("./config/env");
const { openDatabase, migrate } = require("./database/db");
const { createApp } = require("./app");
const db = openDatabase(config.dbPath);
migrate(db);
const server = createApp(db, config).listen(config.port, config.host, () =>
  console.log(`VoyBus API disponible en puerto ${config.port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
