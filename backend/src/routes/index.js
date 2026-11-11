const { Router } = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
function routes(controller, repo, config) {
  const router = Router();
  const auth = authenticate(repo, config);
  const passenger = requireRole("pasajero");
  router.post("/auth/registro", controller.register);
  router.post("/auth/login", controller.login);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", auth, controller.me);
  router.get("/red/lineas", controller.lines);
  router.get("/red/lineas/:id/recorridos", controller.routes);
  router.get("/red/recorridos/:id/paraderos", controller.stops);
  router.get("/viaje/actual", auth, passenger, controller.current);
  router.post("/viaje/vincular", auth, passenger, controller.link);
  router.post("/viaje/solicitudes", auth, passenger, controller.createRequest);
  router.get("/viaje/solicitudes/:id", auth, passenger, controller.request);
  router.get(
    "/conductor/servicio/solicitudes",
    auth,
    requireRole("conductor"),
    controller.inbox,
  );
  return router;
}
module.exports = { routes };
