const { pool } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const { UUID_RE } = require('../utils/helpers');

/** Un PRODUCTOR solo ve lo suyo (Política 10). Devuelve su productor_id o lanza 403. */
function productorIdDe(user) {
    if (!user || user.rol !== 'PRODUCTOR' || !user.productor_id) {
    throw new HttpError(
      403,
      'Su usuario no tiene un productor asociado'
    );
  }

  return user.productor_id;
  
}

/** Carga un lote por id numérico o por código de trazabilidad (UUID) respetando el alcance del usuario. */
async function getLote(user, idOrCode, conn = pool) {
    if (!user) {
    throw new HttpError(401, 'Usuario no autenticado');
  }
  const valor = String(idOrCode);
  const byCode = UUID_RE.test(valor);
   if (!byCode && !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, 'Identificador de lote inválido');
  }

  const [rows] = await conn.query(
    `SELECT
        l.*,
        pr.categoria,
        pr.nombre AS producto,
        p.productor_id,
        p.municipio_codigo
     FROM lote l
     JOIN producto pr ON pr.id = l.producto_id
     JOIN predio p ON p.id = l.predio_id
     WHERE ${byCode ? 'l.codigo_trazabilidad' : 'l.id'} = ?
     LIMIT 1`,
    [byCode ? valor : Number(valor)]);
  const lote = rows[0];
  if (!lote || (user.rol === 'PRODUCTOR' && lote.productor_id !== user.productor_id)) {
    throw new HttpError(404, 'Lote no encontrado');
  }
  return lote;
}

/**
 * Consulta un predio.
 *
 * PRODUCTOR: solamente sus predios.
 * Personal institucional: consulta nacional.
 */

async function getPredio(user, id, conn = pool) {
  if (!user) {
    throw new HttpError(401, 'Usuario no autenticado');
  }
  const [rows] = await conn.query(
    `SELECT
        p.*,
        m.nombre AS municipio,
        m.departamento,
        m.zona_priorizada,
        pd.nombre_razon_social AS propietario,
        pd.validado AS productor_validado,
        pd.estado AS productor_estado
     FROM predio p
     JOIN municipio m ON m.codigo_dane = p.municipio_codigo
     JOIN productor pd ON pd.id = p.productor_id
     WHERE p.id = ?`,
    [id]);
  const p = rows[0];
  if (!p || (user.rol === 'PRODUCTOR' && p.productor_id !== user.productor_id)) throw new HttpError(404, 'Predio no encontrado');
  return p;
}

/** Regla 16: un predio está "completo" con propietario, ubicación y área, además de verificado (Regla 15). */
const predioCompleto = (p) =>
  Boolean(p.productor_id && p.area_m2 > 0 && p.latitud != null && p.longitud != null && p.municipio_codigo &&  Number(p.ubicacion_verificada) === 1);

module.exports = { productorIdDe, getLote, getPredio, predioCompleto };
