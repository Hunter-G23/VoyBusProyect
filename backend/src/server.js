const config = require("./config/env");
const { openDatabase, migrate } = require("./database/db");
const { createApp } = require("./app");
const { repository } = require("./models/repository");
const { simuladorService } = require("./services/simulador");
const db = openDatabase(config.dbPath);
migrate(db);
const now = () => new Date();
const simulador = config.simularGps
  ? simuladorService(db, repository(db), now)
  : null;
const server = createApp(db, config, now).listen(config.port, config.host, () => {
  simulador?.start();
  console.log(`VoyBus API disponible en puerto ${config.port}`);
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    simulador?.stop();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
