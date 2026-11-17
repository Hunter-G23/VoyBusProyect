const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { fail } = require("../utils/errors");
const { transaction } = require("../database/db");
const dummyHash = bcrypt.hashSync("credenciales-ficticias-de-comparacion", 12);
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function validateName(value, errors) {
  const nombre = typeof value === "string" ? value.trim() : "";
  if (nombre.length < 2 || nombre.length > 80)
    errors.nombre = "Escribe un nombre de 2 a 80 caracteres.";
  return nombre;
}
function validatePassword(
  password,
  confirmation,
  errors,
  field = "contrasena",
) {
  if (
    typeof password !== "string" ||
    [...password].length < 8 ||
    [...password].length > 64 ||
    Buffer.byteLength(password, "utf8") > 72
  )
    errors[field] = "Usa entre 8 y 64 caracteres, con máximo de 72 bytes.";
  if (typeof password !== "string" || confirmation !== password)
    errors.confirmacion = "Las contraseñas deben coincidir.";
}
function check(errors) {
  if (Object.keys(errors).length)
    fail(400, "DATOS_INVALIDOS", "Revisa los campos indicados.", errors);
}
function authService(db, repo, config) {
  function session(id) {
    const token = jwt.sign({ sv: repo.sessionVersion(id) }, config.jwtSecret, {
      algorithm: "HS256",
      subject: String(id),
      expiresIn: "60m",
      issuer: "voybus",
      audience: "voybus-app",
    });
    return { token, usuario: repo.userById(id), expira_en: 3600 };
  }
  return {
    async register(body) {
      // RF01
      const errors = {};
      const nombre = validateName(body.nombre, errors);
      const correo = normalizeEmail(body.correo);
      if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
        errors.correo = "Escribe un correo válido.";
      const password = body.contrasena;
      validatePassword(password, body.confirmacion, errors);
      if (Object.hasOwn(body, "rol"))
        errors.rol = "El registro público solo crea pasajeros.";
      check(errors);
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
      const current =
        user &&
        db
          .prepare(
            "SELECT activo,password_hash,sesion_version FROM usuario WHERE id=?",
          )
          .get(user.id);
      if (
        !current?.activo ||
        !valid ||
        current.password_hash !== user.password_hash ||
        current.sesion_version !== user.sesion_version
      )
        fail(401, "CREDENCIALES_INVALIDAS", "Correo o contraseña incorrectos.");
      return session(user.id);
    },
    update(id, body) {
      const errors = {};
      const nombre = validateName(body.nombre, errors);
      check(errors);
      db.prepare("UPDATE usuario SET nombre=? WHERE id=?").run(nombre, id);
      return repo.userById(id);
    },
    async password(id, body) {
      const previous = db
        .prepare("SELECT password_hash,sesion_version FROM usuario WHERE id=?")
        .get(id);
      if (
        !(await bcrypt.compare(
          typeof body.actual === "string" ? body.actual : "",
          previous.password_hash,
        ))
      )
        fail(
          401,
          "CONTRASENA_INCORRECTA",
          "La contraseña actual no es correcta.",
        );
      const errors = {};
      validatePassword(body.nueva, body.confirmacion, errors, "nueva");
      check(errors);
      const hash = await bcrypt.hash(body.nueva, 12);
      // Compare-and-swap: a concurrent password change cannot reuse the old credentials.
      const result = db
        .prepare(
          `UPDATE usuario SET password_hash=?,sesion_version=sesion_version+1
        WHERE id=? AND password_hash=? AND sesion_version=? AND activo=1`,
        )
        .run(hash, id, previous.password_hash, previous.sesion_version);
      if (!result.changes)
        fail(401, "SESION_INVALIDA", "Tu sesión cambió. Vuelve a ingresar.");
      return session(id);
    },
    photo(id) {
      const photo = db
        .prepare("SELECT tipo,datos FROM usuario_foto WHERE usuario_id=?")
        .get(id);
      if (!photo)
        fail(404, "FOTO_NO_DISPONIBLE", "No tienes una foto de perfil.");
      return photo;
    },
    putPhoto(id, body) {
      const { tipo, datos_base64 } = body;
      if (
        typeof datos_base64 !== "string" ||
        !["image/jpeg", "image/png"].includes(tipo)
      )
        fail(400, "FOTO_INVALIDA", "Envía una imagen JPEG o PNG en base64.");
      if (datos_base64.length > 4 * Math.ceil(524288 / 3))
        fail(413, "FOTO_EXTENSA", "La foto no puede superar 512 KB.");
      if (
        !datos_base64.length ||
        datos_base64.length % 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(datos_base64)
      )
        fail(400, "FOTO_INVALIDA", "El contenido base64 no es válido.");
      const datos = Buffer.from(datos_base64, "base64");
      if (datos.length > 524288)
        fail(413, "FOTO_EXTENSA", "La foto no puede superar 512 KB.");
      const firma =
        tipo === "image/png"
          ? Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
          : Buffer.from([255, 216, 255]);
      if (
        datos.toString("base64") !== datos_base64 ||
        !datos.subarray(0, firma.length).equals(firma)
      )
        fail(
          400,
          "FOTO_INVALIDA",
          "El contenido no corresponde a una imagen JPEG o PNG válida.",
        );
      db.prepare(
        `INSERT INTO usuario_foto(usuario_id,tipo,datos,actualizada_en) VALUES(?,?,?,?)
        ON CONFLICT(usuario_id) DO UPDATE SET tipo=excluded.tipo,datos=excluded.datos,actualizada_en=excluded.actualizada_en`,
      ).run(id, tipo, datos, new Date().toISOString());
      return repo.userById(id);
    },
    deletePhoto(id) {
      db.prepare("DELETE FROM usuario_foto WHERE usuario_id=?").run(id);
    },
    preferences(id, body) {
      if (Object.hasOwn(body, "idioma") && !["es", "en"].includes(body.idioma))
        fail(400, "IDIOMA_INVALIDO", "Elige español o inglés.");
      if (
        Object.hasOwn(body, "notificaciones") &&
        (!body.notificaciones ||
          typeof body.notificaciones !== "object" ||
          Array.isArray(body.notificaciones) ||
          Object.entries(body.notificaciones).some(
            ([tipo, activa]) =>
              !["estado_linea_favorita", "solicitud"].includes(tipo) ||
              typeof activa !== "boolean",
          ))
      )
        fail(
          400,
          "PREFERENCIAS_INVALIDAS",
          "Indica un valor booleano para cada tipo de notificación.",
        );
      transaction(db, () => {
        if (body.idioma)
          db.prepare("UPDATE usuario SET idioma=? WHERE id=?").run(
            body.idioma,
            id,
          );
        for (const [tipo, activa] of Object.entries(body.notificaciones || {}))
          db.prepare(
            `INSERT INTO preferencia_notificacion(usuario_id,tipo,activa) VALUES(?,?,?)
            ON CONFLICT(usuario_id,tipo) DO UPDATE SET activa=excluded.activa`,
          ).run(id, tipo, Number(activa));
      });
      return repo.userById(id);
    },
  };
}
module.exports = { authService };
