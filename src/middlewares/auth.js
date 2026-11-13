const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { jwt: jwtCfg } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const signToken = (u) =>
  jwt.sign({ sub: u.id, rol: u.rol }, jwtCfg.secret, { expiresIn: jwtCfg.expiresIn });

/**
 * Valida el JWT y recarga al usuario desde la BD en cada petición:
 * así un cambio de rol/entidad o una desactivación surte efecto de inmediato (Regla 20).
 */
async function authenticate(req, _res, next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) throw new HttpError(401, 'Token requerido');
    let payload;
    try { payload = jwt.verify(h.slice(7), jwtCfg.secret); }
    catch { throw new HttpError(401, 'Token inválido o expirado'); }

    const [rows] = await pool.query(
       `SELECT
          u.id,
          u.email,
          u.nombre,
          u.rol,
          u.activo,
          u.entidad_id,
          e.sigla AS entidad_sigla,
          p.id AS productor_id
       FROM usuario u
       LEFT JOIN entidad e ON e.id = u.entidad_id
       LEFT JOIN productor p ON p.usuario_id = u.id
       WHERE u.id = ?
       LIMIT 1`, [payload.sub]);
    const u = rows[0];
    if (!u || !u.activo) throw new HttpError(401, 'Usuario inexistente o inactivo');
    req.user = u;
    next();
  } catch (e) { next(e); }
}

/** Permite solo los roles indicados (Política 10 / Regla 19). */
const roles = (...allowed) => (req, _res, next) => {
  if (!req.user) {
    return next(new HttpError(401, 'Usuario no autenticado'));
  }

  if (!allowed.includes(req.user.rol)) {
    return next(
      new HttpError(403, 'No tiene permisos para esta operación')
    );
  }

  next();
};


/** ADMIN siempre; ENTIDAD solo si su sigla está en la lista (ej. DIAN, ICA, ANT). */
const entidad = (...siglas) => (req, _res, next) => {
  const u = req.user;

  if (!u) {
    return next(new HttpError(401, 'Usuario no autenticado'));
  }

  if (u.rol === 'ADMIN') return next();

  if (
    u.rol === 'ENTIDAD' &&
    siglas.includes(u.entidad_sigla)
  ) {
    return next();
  }

  next(
    new HttpError(
      403,
      `Operación reservada a: ${siglas.join(', ')}`
    )
  );
};

/**
 * Permisos de consulta:
 * - PRODUCTOR: acceso limitado a sus registros.
 * - EXTENSIONISTA: acceso nacional.
 * - ENTIDAD: acceso nacional de consulta.
 * - ADMIN: acceso nacional.
 */

const isStaff = (u) =>
  ['EXTENSIONISTA', 'ENTIDAD', 'ADMIN'].includes(u?.rol);

/**
 * Comprueba si un usuario pertenece a una institución.
 */
const perteneceEntidad = (u, sigla) =>
  u?.rol === 'ENTIDAD' && u.entidad_sigla === sigla;

/**
 * Comprueba si puede consultar globalmente.
 */
const puedeConsultarGlobal = (u) =>
  isStaff(u);

/**
 * Comprueba si puede administrar usuarios.
 */
const puedeAdministrarUsuarios = (u) =>
  u?.rol === 'ADMIN';

module.exports = {
  signToken,
  authenticate,
  roles,
  entidad,
  isStaff,
  perteneceEntidad,
  puedeConsultarGlobal,
  puedeAdministrarUsuarios
};
