const pool = require('../config/database');

/**
 * GET /api/movements
 * Retorna o histórico de movimentações com filtros opcionais.
 */
async function list(req, res, next) {
  const {
    user_id, room_id, key_id, action,
    from, to,
    limit = 50, offset = 0,
  } = req.query;

  const conditions = [];
  const values = [];

  if (user_id)  { conditions.push(`m.user_id = ?`); values.push(user_id); }
  if (key_id)   { conditions.push(`m.key_id = ?`);  values.push(key_id); }
  if (action)   { conditions.push(`m.action = ?`);  values.push(action); }
  if (from)     { conditions.push(`m.occurred_at >= ?`); values.push(from); }
  if (to)       { conditions.push(`m.occurred_at <= ?`); values.push(to); }
  if (room_id)  { conditions.push(`k.room_id = ?`); values.push(room_id); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const safeLimit  = Math.min(parseInt(limit)  || 50,  200);
  const safeOffset = parseInt(offset) || 0;

  try {
    const [rows] = await pool.query(
      `SELECT
         m.id,
         m.action,
         m.occurred_at,
         u.id    AS user_id,
         u.name  AS user_name,
         u.category,
         k.id    AS key_id,
         k.rfid_tag_uid,
         r.id    AS room_id,
         r.identification AS room_name
       FROM movements m
       JOIN users u ON u.id = m.user_id
       JOIN \`keys\` k ON k.id = m.key_id
       JOIN rooms r ON r.id = k.room_id
       ${where}
       ORDER BY m.occurred_at DESC
       LIMIT ? OFFSET ?`,
      [...values, safeLimit, safeOffset]
    );

    // Contagem total para paginação
    const [count] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM movements m
       JOIN \`keys\` k ON k.id = m.key_id
       ${where}`,
      values
    );

    res.json({
      total:  parseInt(count[0].total),
      limit:  safeLimit,
      offset: safeOffset,
      data:   rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/movements/recent
 * Retorna as últimas 10 movimentações — usado no Dashboard.
 */
async function recent(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id,
         m.action,
         m.occurred_at,
         u.name  AS user_name,
         u.category,
         r.identification AS room_name
       FROM movements m
       JOIN users u ON u.id = m.user_id
       JOIN \`keys\` k ON k.id = m.key_id
       JOIN rooms r ON r.id = k.room_id
       ORDER BY m.occurred_at DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/movements/summary
 * Retorna os totais para os cards do Dashboard.
 */
async function summary(req, res, next) {
  try {
    const [keysInUse] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`keys\` WHERE status = 'in_use'`
    );

    const [availableRooms] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`keys\` WHERE status = 'available'`
    );

    // Considera "atraso" quando a chave está em uso e a regra de devolução expirou
    const [overdue] = await pool.query(
      `SELECT COUNT(DISTINCT m.id) AS total
       FROM movements m
       JOIN \`keys\` k ON k.id  = m.key_id
       JOIN rooms r  ON r.id  = k.room_id
       JOIN access_rules ar ON ar.user_id = m.user_id AND ar.room_id = k.room_id
       WHERE m.action = 'withdrawal'
         AND k.status = 'in_use'
         AND CURRENT_TIME() > ar.allowed_end`
    );

    res.json({
      keysInUse:      parseInt(keysInUse[0].total),
      roomsAvailable: parseInt(availableRooms[0].total),
      overdueReturns: parseInt(overdue[0].total),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/movements/overdue
 * Retorna todas as chaves em atraso de devolução no momento da consulta.
 * Usado pelo painel para exibir alertas em tempo real.
 */
async function overdue(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id             AS movement_id,
        u.id             AS user_id,
        u.name           AS user_name,
        u.email          AS user_email,
        r.identification AS room_name,
        k.rfid_tag_uid,
        ar.allowed_end,
        m.occurred_at    AS withdrawn_at
      FROM movements m
      JOIN users        u  ON u.id  = m.user_id
      JOIN \`keys\`     k  ON k.id  = m.key_id
      JOIN rooms        r  ON r.id  = k.room_id
      JOIN access_rules ar ON ar.user_id = m.user_id AND ar.room_id = k.room_id
      WHERE m.action  = 'withdrawal'
        AND k.status  = 'in_use'
        AND CURRENT_TIME() > ar.allowed_end
      ORDER BY m.occurred_at ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, recent, summary, overdue };