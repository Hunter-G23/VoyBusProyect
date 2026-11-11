const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { fail } = require("../utils/errors");
const dummyHash = bcrypt.hashSync("credenciales-ficticias-de-comparacion", 12);
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function authService(db, repo, config) {
  return {
    async register(body) {
      // RF01
      const errors = {};
      const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
      const correo = normalizeEmail(body.correo);
      if (nombre.length < 2 || nombre.length > 80)
        errors.nombre = "Escribe un nombre de 2 a 80 caracteres.";
      if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
        errors.correo = "Escribe un correo válido.";
      const password = body.contrasena;
      if (
        typeof password !== "string" ||
        [...password].length < 8 ||
        [...password].length > 64 ||
        Buffer.byteLength(password, "utf8") > 72
      )
        errors.contrasena =
          "Usa entre 8 y 64 caracteres, con máximo de 72 bytes.";
      if (typeof password !== "string" || body.confirmacion !== password)
        errors.confirmacion = "Las contraseñas deben coincidir.";
      if (Object.hasOwn(body, "rol"))
        errors.rol = "El registro público solo crea pasajeros.";
      if (Object.keys(errors).length)
        fail(400, "DATOS_INVALIDOS", "Revisa los campos indicados.", errors);
      const hash = await bcrypt.hash(password, 12);
      let result;
      try {
        result = db
          .prepare(
            "INSERT INTO usuario(nombre,correo,password_hash,rol,creado_en) VALUES(?,?,?,'pasajero',?)",
          )
          .run(nombre, correo, hash, new Date().toISOString());
      } catch (error) {
        if (String(error.message).includes("UNIQUE"))
          fail(409, "CORREO_REGISTRADO", "Este correo ya tiene una cuenta.", {
            correo: "Usa otro correo o inicia sesión.",
          });
        throw error;
      }
      return repo.userById(Number(result.lastInsertRowid));
    },
    async login(body) {
      // RF02
      const user = repo.userByEmail(normalizeEmail(body.correo));
      const valid = await bcrypt.compare(
        typeof body.contrasena === "string" ? body.contrasena : "",
        user?.password_hash || dummyHash,
      );
      if (!user?.activo || !valid)
        fail(401, "CREDENCIALES_INVALIDAS", "Correo o contraseña incorrectos.");
      const token = jwt.sign({}, config.jwtSecret, {
        algorithm: "HS256",
        subject: String(user.id),
        expiresIn: "60m",
        issuer: "voybus",
        audience: "voybus-app",
      });
      return { token, usuario: repo.userById(user.id), expira_en: 3600 };
    },
  };
}
module.exports = { authService };
