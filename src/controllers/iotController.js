const pool = require('../config/database');

/**
 * POST /api/iot/rfid
 * Recebido pelo ESP32 após o usuário se autenticar e aproximar a chave.
 *
 * Body esperado:
 * { "user_id": 2, "rfid_tag_uid": "A1B2C3D4" }
 *
 * Header obrigatório:
 * x-iot-key: <IOT_SECRET_KEY>
 *
 * Fluxo:
 * 1. Valida o UID da tag RFID
 * 2. Verifica se o usuário tem regra de acesso para a sala correspondente
 * 3. Verifica se está dentro do horário permitido
 * 4. Alterna o status da chave (available ↔ in_use)
 * 5. Registra a movimentação no log
 * 6. Responde com o resultado para o ESP32 acionar o buzzer
 */
async function handleRfidRead(req, res, next) {
  const { user_id, rfid_tag_uid } = req.body;

  if (!user_id || !rfid_tag_uid) {
    return res.status(400).json({
      success: false,
      action: null,
      message: 'user_id e rfid_tag_uid são obrigatórios.',
    });
  }

  // No mysql2, obtemos a conexão assim para gerenciar a transação
  const connection = await pool.getConnection();

  try {
    // Inicia a transação de forma nativa
    await connection.beginTransaction();

    // 1. Localiza a chave pelo UID da tag
    const [keyRows] = await connection.query(
      `SELECT k.id, k.status, k.room_id, r.identification AS room_name
       FROM keys k
       JOIN rooms r ON r.id = k.room_id
       WHERE k.rfid_tag_uid = ?`,
      [rfid_tag_uid]
    );

    if (!keyRows[0]) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        action: null,
        message: 'Tag RFID não reconhecida no sistema.',
      });
    }

    const key = keyRows[0];

    // 2. Verifica se o usuário existe e está ativo
    const [userRows] = await connection.query(
      'SELECT id, name, active FROM users WHERE id = ?',
      [user_id]
    );

    if (!userRows[0] || !userRows[0].active) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        action: null,
        message: 'Usuário inativo ou não encontrado.',
      });
    }

    // 3. Verifica regra de acesso para esta sala
    const [ruleRows] = await connection.query(
      `SELECT id, allowed_start, allowed_end
       FROM access_rules
       WHERE user_id = ? AND room_id = ?`,
      [user_id, key.room_id]
    );

    if (!ruleRows[0]) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        action: null,
        message: `Usuário não tem permissão para acessar a ${key.room_name}.`,
      });
    }

    // 4. Verifica horário permitido
    const rule = ruleRows[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); // "HH:MM:SS"

    // String() garante que a formatação não quebre dependendo do retorno do driver
    const startStr = String(rule.allowed_start).slice(0, 8);
    const endStr   = String(rule.allowed_end).slice(0, 8);

    if (currentTime < startStr || currentTime > endStr) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        action: null,
        message: `Acesso fora do horário permitido (${startStr.slice(0,5)} – ${endStr.slice(0,5)}).`,
      });
    }

    // 5. Alterna status da chave e determina a ação
    const newStatus = key.status === 'available' ? 'in_use' : 'available';
    const action    = key.status === 'available' ? 'withdrawal' : 'return';

    await connection.query(
      `UPDATE keys SET status = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, key.id]
    );

    // 6. Registra movimentação no log
    await connection.query(
      `INSERT INTO movements (user_id, key_id, action) VALUES (?, ?, ?)`,
      [user_id, key.id, action]
    );

    // Confirma a transação
    await connection.commit();

    const actionLabel = action === 'withdrawal' ? 'Retirada' : 'Devolução';

    res.json({
      success: true,
      action,
      message: `${actionLabel} registrada com sucesso.`,
      data: {
        room:       key.room_name,
        key_id:     key.id,
        new_status: newStatus,
        user_name:  userRows[0].name,
        timestamp:  now.toISOString(),
      },
    });
  } catch (err) {
    // Reverte em caso de erro
    await connection.rollback();
    next(err);
  } finally {
    // Libera a conexão de volta para o pool
    connection.release();
  }
}

/**
 * GET /api/iot/keys/:rfid_tag_uid/status
 * Consulta rápida do status de uma chave pelo UID.
 * O ESP32 pode usar isso para verificar disponibilidade antes de registrar.
 */
async function getKeyStatus(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT k.id, k.rfid_tag_uid, k.status, r.identification AS room
       FROM keys k
       JOIN rooms r ON r.id = k.room_id
       WHERE k.rfid_tag_uid = ? `,
      [req.params.rfid_tag_uid]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Tag não encontrada.' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { handleRfidRead, getKeyStatus };