class AppError extends Error {
  constructor(status, codigo, mensaje, campos) {
    super(mensaje);
    Object.assign(this, { status, codigo, campos });
  }
}
function fail(status, codigo, mensaje, campos) {
  throw new AppError(status, codigo, mensaje, campos);
}
function positiveId(value) {
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)))
    fail(400, "ID_INVALIDO", "El identificador debe ser un entero positivo.");
  return Number(text);
}
module.exports = { AppError, fail, positiveId };
