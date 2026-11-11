const express = require("express");
const cors = require("cors");
const { repository } = require("./models/repository");
const { authService } = require("./services/auth");
const { redService } = require("./services/red");
const { viajeService } = require("./services/viaje");
const { conductorService } = require("./services/conductor");
const { controllers } = require("./controllers");
const { routes } = require("./routes");
function createApp(db, config) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    // Native requests have no Origin. Browser writes must come from an explicit allowed origin.
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin))
      return res
        .status(403)
        .json({
          error: {
            codigo: "ORIGEN_NO_PERMITIDO",
            mensaje: "Origen de la aplicación no autorizado.",
          },
        });
    next();
  });
  app.use(cors({ origin: config.origins, credentials: true }));
  app.use(express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    if (
      ["POST", "PUT", "PATCH"].includes(req.method) &&
      (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    )
      req.body = {};
    next();
  });
  app.get("/api/health", (req, res) =>
    res.json({ estado: "ok", proyecto: "VoyBus" }),
  );
  const repo = repository(db);
  const services = {
    auth: authService(db, repo, config),
    red: redService(db),
    viaje: viajeService(db, repo),
    conductor: conductorService(db),
  };
  app.use("/api", routes(controllers(services, config), repo, config));
  app.use((req, res) =>
    res
      .status(404)
      .json({
        error: {
          codigo: "RUTA_NO_ENCONTRADA",
          mensaje: "Este recurso no está disponible.",
        },
      }),
  );
  app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({
          error: {
            codigo: "JSON_INVALIDO",
            mensaje: "El contenido enviado no es válido.",
          },
        });
    if (error.type === "entity.too.large")
      return res
        .status(413)
        .json({
          error: {
            codigo: "CONTENIDO_EXTENSO",
            mensaje: "El contenido enviado es demasiado extenso.",
          },
        });
    const status = error.status || 500;
    if (status >= 500) console.error("Error interno en", req.method, req.path); // No bodies, secrets or tokens.
    res
      .status(status)
      .json({
        error: {
          codigo: status >= 500 ? "ERROR_INTERNO" : error.codigo,
          mensaje:
            status >= 500
              ? "No pudimos completar la operación. Inténtalo nuevamente."
              : error.message,
          ...(error.campos ? { campos: error.campos } : {}),
        },
      });
  });
  return app;
}
module.exports = { createApp };
