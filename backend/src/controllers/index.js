const asyncAction = (action) => async (req, res, next) => {
  try {
    await action(req, res);
  } catch (error) {
    next(error);
  }
};
function controllers(services, config) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/api",
    maxAge: 3600000,
  };
  return {
    register: asyncAction(async (req, res) =>
      res.status(201).json({ usuario: await services.auth.register(req.body) }),
    ),
    login: asyncAction(async (req, res) => {
      const data = await services.auth.login(req.body);
      res.cookie("voybus_session", data.token, cookieOptions).json(data);
    }),
    logout: (req, res) =>
      res.clearCookie("voybus_session", cookieOptions).status(204).end(),
    me: (req, res) => res.json({ usuario: req.user }),
    lines: (req, res) => res.json({ lineas: services.red.lines() }),
    routes: (req, res) => res.json(services.red.routes(req.params.id)),
    stops: (req, res) => res.json(services.red.stops(req.params.id)),
    current: (req, res) => res.json(services.viaje.current(req.user.id)),
    link: (req, res) => {
      const data = services.viaje.link(req.user.id, req.body);
      res.status(data.creado ? 201 : 200).json(data);
    },
    createRequest: (req, res) => {
      const data = services.viaje.createRequest(req.user.id, req.body);
      res.status(data.creada ? 201 : 200).json(data);
    },
    request: (req, res) =>
      res.json({
        solicitud: services.viaje.getRequest(req.user.id, req.params.id),
      }),
    inbox: (req, res) =>
      res.json(services.conductor.inbox(req.user.id, req.query.servicio_id)),
  };
}
module.exports = { controllers };
