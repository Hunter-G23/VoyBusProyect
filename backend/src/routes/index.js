const { Router, json } = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
function photoRoutes(controller, repo, config) {
  const router = Router();
  router.put(
    "/auth/me/foto",
    authenticate(repo, config),
    json({ limit: "704kb" }),
    controller.putPhoto,
  );
  return router;
}
function routes(controller, repo, config) {
  const router = Router();
  const auth = authenticate(repo, config);
  const passenger = requireRole("pasajero");
  router.post("/auth/registro", controller.register);
  router.post("/auth/login", controller.login);
  // Logout clears even expired/missing sessions; only a valid session is revoked.
  const optionalSession = (req, res, next) =>
    auth(req, res, (error) => next(error?.status === 401 ? undefined : error));
  router.post("/auth/logout", optionalSession, controller.logout);
  router.get("/auth/me", auth, controller.me);
  router.patch("/auth/me", auth, controller.updateMe);
  router.post("/auth/contrasena", auth, controller.password);
  router.get("/auth/me/foto", auth, controller.photo);
  router.delete("/auth/me/foto", auth, controller.deletePhoto);
  router.patch("/auth/me/preferencias", auth, controller.preferences);
  router.get("/favoritos", auth, passenger, controller.favorites);
  router.post("/favoritos", auth, passenger, controller.createFavorite);
  router.delete("/favoritos/:id", auth, passenger, controller.deleteFavorite);
  router.get("/viaje/historial", auth, passenger, controller.history);
  router.patch(
    "/admin/lineas/:id/estado",
    auth,
    requireRole("administrador"),
    controller.lineState,
  );
  router.get(
    "/admin/lineas/eventos",
    auth,
    requireRole("administrador"),
    controller.lineEvents,
  );
  router.get("/red/lineas", controller.lines);
  router.get("/red/lineas/:id/recorridos", controller.routes);
  router.get("/red/recorridos/:id/paraderos", controller.stops);
  router.get("/red/vehiculos", controller.vehicles);
  router.get("/red/mapa", controller.map);
  router.get("/red/paraderos/:id/llegadas", controller.arrivals);
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
module.exports = { routes, photoRoutes };
