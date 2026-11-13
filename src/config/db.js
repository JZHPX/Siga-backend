const fs = require('fs');
const mysql = require('mysql2/promise');
const { db } = require('./env');

// Regla 9 (Política 5): toda transmisión de datos personales va cifrada -> TLS hacia la BD.
let ssl;
if (db.ssl) {
  const ca = db.sslCa.replace(/\\n/g, '\n').trim();
  ssl = 
    { ca, rejectUnauthorized: true }
};

const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // DATETIME como 'YYYY-MM-DD HH:MM:SS' (necesario para recalcular los hashes)
  timezone: 'Z',          // todo se maneja en UTC
  decimalNumbers: true,
  charset: 'utf8mb4',
});

/** Ejecuta fn(conn) dentro de una transacción. Rollback ante cualquier error (incluye SIGNAL de triggers). */
async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch (_) { /* noop */ }
    throw e;
  } finally {
    conn.release();
  }
}
console.log('SSL habilitado:', db.ssl);
console.log('CA existe:', !!db.sslCa);
console.log('CA comienza correctamente:', db.sslCa?.startsWith('-----BEGIN CERTIFICATE-----'));
console.log('CA termina correctamente:', db.sslCa?.trim().endsWith('-----END CERTIFICATE-----'));

module.exports = { pool, withTx };
pool.getConnection()
  .then(async (conn) => {
    console.log("Conexión exitosa con Aiven");

    const [rows] = await conn.query("SELECT DATABASE() AS database_name");

    console.log("Base de datos:", rows[0].database_name);

    conn.release();
  })
  .catch((err) => {
    console.error("Error conectando con Aiven:");
    console.error(err);
  });
  