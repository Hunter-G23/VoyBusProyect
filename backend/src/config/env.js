const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
const backendRoot = path.resolve(__dirname, "../..");
function signingKey() {
  if (process.env.JWT_SECRET?.length >= 32) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres.");
  const filename = path.join(backendRoot, ".dev-jwt-secret");
  if (!fs.existsSync(filename))
    fs.writeFileSync(filename, crypto.randomBytes(48).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  return fs.readFileSync(filename, "utf8").trim();
}
module.exports = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  dbPath: path.resolve(
    backendRoot,
    process.env.DB_PATH || "./src/database/voybus.db",
  ),
  jwtSecret: signingKey(),
  production: process.env.NODE_ENV === "production",
  origins: (
    process.env.WEB_ORIGINS || "http://localhost:8081,http://127.0.0.1:8081"
  )
    .split(",")
    .map((x) => x.trim()),
};
