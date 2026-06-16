const { validationResult } = require('express-validator');
const pool = require('../config/database');

// ─── SALAS ────────────────────────────────────────────────────────────────────

/**
 * POST /api/rooms
 * Cria uma nova sala.
 */
async function createRoom(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { identification } = req.body;

  try {
    // O MySQL não suporta RETURNING, então pegamos o insertId
    const [result] = await pool.query(
      `INSERT INTO rooms (identification) VALUES (?)`,
      [identification]
    );
    
    res.status(201).json({
      id: result.insertId,
      identification,
      active: true
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') { // Código do MySQL para registro duplicado
      return res.status(409).json({ error: 'Já existe uma sala com essa identificação.' });
    }
    next(err);
  }
}

/**
 * GET /api/rooms
 * Lista todas as salas com o status da chave associada.
 */
async function listRooms(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.id,
         r.identification,
         r.active,
         r.created_at,
         k.id         AS key_id,
         k.rfid_tag_uid,
         k.status     AS key_status
       FROM rooms r
       LEFT JOIN \`keys\` k ON k.room_id = r.id
       ORDER BY r.identification ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/:id
 * Retorna uma sala com suas regras de acesso ativas.
 */
async function findRoom(req, res, next) {
  try {
    const [room] = await pool.query(
      `SELECT id, identification, active, created_at FROM rooms WHERE id = ?`,
      [req.params.id]
    );
    if (!room[0]) return res.status(404).json({ error: 'Sala não encontrada.' });

    const [rules] = await pool.query(
      `SELECT
         ar.id,
         u.id   AS user_id,
         u.name AS user_name,
         u.category,
         ar.allowed_start,
         ar.allowed_end
       FROM access_rules ar
       JOIN users u ON u.id = ar.user_id
       WHERE ar.room_id = ?
       ORDER BY u.name`,
      [req.params.id]
    );

    res.json({ ...room[0], access_rules: rules });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/rooms/:id
 * Remove (desativa) uma sala.
 */
async function removeRoom(req, res, next) {
  try {
    const [result] = await pool.query(
      `UPDATE rooms SET active = FALSE WHERE id = ?`,
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }
    
    res.json({ message: 'Sala desativada com sucesso.', room: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
}

// ─── REGRAS DE ACESSO ─────────────────────────────────────────────────────────

/**
 * GET /api/rooms/rules
 * Lista todas as regras de acesso (para a tabela do frontend).
 */
async function listRules(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         ar.id,
         u.id           AS user_id,
         u.name         AS user_name,
         u.category,
         r.id           AS room_id,
         r.identification AS room_name,
         TIME_FORMAT(ar.allowed_start, '%H:%i') AS allowed_start,
         TIME_FORMAT(ar.allowed_end, '%H:%i') AS allowed_end,
         ar.allowed_days -- 👈 BUSCA OS DIAS DO BANCO
       FROM access_rules ar
       JOIN users u ON u.id = ar.user_id
       JOIN rooms r ON r.id = ar.room_id
       ORDER BY u.name, r.identification`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms/rules
 * Vincula um usuário a uma sala com horário permitido.
 */
async function createRule(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { user_id, room_id, allowed_start, allowed_end, allowed_days } = req.body; // 👈 RECEBE O CAMPO

  try {
    const [result] = await pool.query(
      `INSERT INTO access_rules (user_id, room_id, allowed_start, allowed_end, allowed_days)
       VALUES (?, ?, ?, ?, ?)`, // 👈 INSERE NO BANCO
      [user_id, room_id, allowed_start, allowed_end, allowed_days]
    );
    
    res.status(201).json({
      id: result.insertId,
      user_id,
      room_id,
      allowed_start,
      allowed_end,
      allowed_days
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Regra já existe para este utilizador e sala.' });
    }
    next(err);
  }
}

/**
 * PUT /api/rooms/rules/:id
 * Atualiza uma regra de acesso existente (usuário, sala e horários).
 */
async function updateRule(req, res, next) {
  const { user_id, room_id, allowed_start, allowed_end, allowed_days } = req.body; // 👈 RECEBE O CAMPO
  try {
    const [result] = await pool.query(
      `UPDATE access_rules
       SET user_id = ?, room_id = ?, allowed_start = ?, allowed_end = ?, allowed_days = ?
       WHERE id = ?`, // 👈 ATUALIZA NO BANCO
      [user_id, room_id, allowed_start, allowed_end, allowed_days, req.params.id]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Regra não encontrada.' });
    
    res.json({ message: 'Regra atualizada com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Conflito: Este utilizador já possui uma regra ativa para esta sala.' });
    }
    next(err);
  }
}

/**
 * DELETE /api/rooms/rules/:id
 * Remove uma regra de acesso.
 */
async function removeRule(req, res, next) {
  try {
    const [result] = await pool.query(
      `DELETE FROM access_rules WHERE id = ?`,
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Regra não encontrada.' });
    }
    
    res.json({ message: 'Regra de acesso removida com sucesso.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRoom, listRooms, findRoom, removeRoom,
  listRules, createRule, updateRule, removeRule,
};