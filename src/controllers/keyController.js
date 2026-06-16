const { validationResult } = require('express-validator');
const pool = require('../config/database');

/**
 * POST /api/keys
 * Cadastra uma nova chave RFID vinculada a uma sala.
 */
async function create(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { rfid_tag_uid, room_id } = req.body;

  try {
    // MySQL usa colchetes [result] e não suporta RETURNING
    const [result] = await pool.query(
      `INSERT INTO \`keys\` (rfid_tag_uid, room_id) VALUES (?, ?)`,
      [rfid_tag_uid, room_id]
    );
    
    // Devolvemos o objeto criado usando o insertId gerado pelo MySQL
    res.status(201).json({
      id: result.insertId,
      rfid_tag_uid,
      room_id,
      status: 'available',
      created_at: new Date()
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') { // Código MySQL para registro duplicado
      return res.status(409).json({ error: 'Essa tag RFID já está cadastrada.' });
    }
    next(err);
  }
}

/**
 * GET /api/keys
 * Lista todas as chaves com sala associada.
 */
async function list(req, res, next) {
  try {
    // Array destructuring [rows] para mysql2
    const [rows] = await pool.query(
      `SELECT
         k.id, k.rfid_tag_uid, k.status, k.created_at,
         r.id             AS room_id,
         r.identification AS room_name
       FROM \`keys\` k
       JOIN rooms r ON r.id = k.room_id
       ORDER BY r.identification`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/keys/:id/status
 * Permite que a gestão force a alteração manual do status de uma chave E GERE O LOG.
 */
async function updateStatus(req, res, next) {
  const { status } = req.body;
  const keyId = req.params.id;
  
  // O middleware 'authenticate' na rota garante que o req.user.id existe
  const operatorId = req.user ? req.user.id : null; 

  if (!operatorId) {
    return res.status(401).json({ error: 'Operador não identificado. Rota sem middleware de autenticação.' });
  }

  if (!['available', 'in_use'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use "available" ou "in_use".' });
  }

  // Capturamos uma conexão específica do pool para usar a Transação
  const connection = await pool.getConnection();

  try {
    // Inicia a transação: ou tudo funciona, ou nada é gravado
    await connection.beginTransaction();

    // 1. Atualiza a tabela de chaves
    const [updateResult] = await connection.query(
      `UPDATE \`keys\` SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, keyId]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Chave não encontrada.' });
    }

    // 2. Determina a ação para o log
    const actionType = status === 'in_use' ? 'withdrawal' : 'return';

    // 3. Grava a movimentação do claviculário
    await connection.query(
      `INSERT INTO movements (user_id, key_id, action, occurred_at) VALUES (?, ?, ?, NOW())`,
      [operatorId, keyId, actionType]
    );

    // Confirma as alterações nas duas tabelas
    await connection.commit();

    res.json({ message: 'Status atualizado e movimentação registrada com sucesso.', id: keyId, status });
  } catch (err) {
    // Se ocorrer algum erro (ex: falha de internet), desfaz o UPDATE da chave
    await connection.rollback();
    next(err);
  } finally {
    // Liberta a conexão para não sobrecarregar o banco de dados
    connection.release();
  }
}

/**
 * DELETE /api/keys/:id
 * Remove uma chave do sistema (apenas se não estiver em uso).
 */
async function remove(req, res, next) {
  try {
    const [key] = await pool.query(
      `SELECT status FROM \`keys\` WHERE id = ?`,
      [req.params.id]
    );

    if (!key[0]) return res.status(404).json({ error: 'Chave não encontrada.' });
    
    if (key[0].status === 'in_use') {
      return res.status(409).json({ error: 'Não é possível remover uma chave que está em uso no momento.' });
    }

    await pool.query(`DELETE FROM \`keys\` WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Chave RFID removida do sistema com sucesso.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, updateStatus, remove };