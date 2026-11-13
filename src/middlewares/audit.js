const { pool } = require('../config/db');

const ACCION = { GET: 'CONSULTA', POST: 'CREAR', PUT: 'ACTUALIZAR', PATCH: 'ACTUALIZAR', DELETE: 'ELIMINAR' };
// Lecturas que exponen datos personales y deben quedar en bitácora (Regla 9)
const GET_AUDITADOS = /^\/api\/(productores|predios|usuarios|auditoria)/;

async function registrarAuditoria({ usuario_id = null, accion, tabla = null, registro = null, detalle = null, ip = null }) {
  try {
    await pool.query(
      'INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalle, ip) VALUES (?,?,?,?,?,?)',
      [usuario_id, accion, tabla, registro == null ? null : String(registro), detalle ? JSON.stringify(detalle) : null, ip]
    );
  } catch (e) {
    console.error('[auditoria] no se pudo registrar:', e.message);
  }
}

/** Bitácora automática de quién consultó/modificó datos y cuándo (Política 5 / Regla 9). */
function auditMiddleware(req, res, next) {
  res.on('finish', () => {
    if (!req.user) return;

    const path = req.originalUrl.split('?')[0];
    const method = req.method;
    const status = res.statusCode;

    const esConsultaSensible =
      method === 'GET' && GET_AUDITADOS.test(path);

    const esEscritura =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!esConsultaSensible && !esEscritura) return;

    let accion = ACCION[method];

    if (esEscritura && status >= 400) {
      accion = `INTENTO_${accion}`;
    }

    const segmentos = path
      .replace(/^\/api\//, '')
      .split('/')
      .filter(Boolean);

    registrarAuditoria({
      usuario_id: req.user.id,
      accion,
      tabla: segmentos[0] || null,
      registro: req.params?.id ?? segmentos[1] ?? null,
      detalle: {
        ruta: path,
        metodo: method,
        estado: status,
      },
      ip: req.ip,
    });
  });

  next();
}

module.exports = {
  auditMiddleware,
  registrarAuditoria,
};
