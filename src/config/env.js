require("dotenv").config();

const need = (k, d) => {
  const v =
    process.env[k] !== undefined && process.env[k] !== ""
      ? process.env[k]
      : d;

  if (v === undefined) {
    throw new Error(`Falta la variable de entorno ${k}`);
  }

  return v;
};

const sslValue = need("DB_SSL", "true").toLowerCase();

if (!["true", "false"].includes(sslValue)) {
  throw new Error("DB_SSL debe ser true o false");
}

module.exports = {
  env: need("NODE_ENV", "development"),
  port: Number(need("PORT", "3000")),
  corsOrigin: need("CORS_ORIGIN", "*"),

  publicBaseUrl: need(
    "PUBLIC_BASE_URL",
    "http://192.168.1.8:3000"
  ),

  db: {
    host: need("DB_HOST", "localhost"),
    port: Number(need("DB_PORT", "3306")),
    user: need("DB_USER", "root"),
    password: need("DB_PASSWORD", ""),
    database: need("DB_NAME", "siga_mvp"),
    sslCa: process.env.DB_SSL_CA,
    ssl: sslValue === "true",
  },

  jwt: {
    secret: need("JWT_SECRET"),
    expiresIn: need("JWT_EXPIRES_IN", "8h"),
  },
};