const jwt = require("jsonwebtoken");
const { fail } = require("../utils/errors");
function authenticate(repo, config) {
  return (req, res, next) => {
    try {
      let token;
      if (req.headers.authorization) {
        const match = /^Bearer (\S+)$/.exec(req.headers.authorization);
        if (!match) fail(401, "SESION_INVALIDA", "Vuelve a iniciar sesión.");
        token = match[1];
      } else {
        token = req.headers.cookie
          ?.split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("voybus_session="))
          ?.slice(15);
      }
      let payload;
      try {
        payload = jwt.verify(token, config.jwtSecret, {
          algorithms: ["HS256"],
          issuer: "voybus",
          audience: "voybus-app",
        });
      } catch {
        fail(
          401,
          "SESION_INVALIDA",
          "Tu sesión venció o no es válida. Vuelve a ingresar.",
        );
      }
      const user = repo.userById(Number(payload.sub));
      if (!user?.activo)
        fail(
          401,
          "SESION_INVALIDA",
          "Tu sesión venció o no es válida. Vuelve a ingresar.",
        );
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
const requireRole = (role) => (req, res, next) => {
  if (req.user.rol !== role)
    return next(
      Object.assign(new Error("No tienes permiso para realizar esta acción."), {
        status: 403,
        codigo: "ACCESO_DENEGADO",
      }),
    );
  next();
};
module.exports = { authenticate, requireRole };
