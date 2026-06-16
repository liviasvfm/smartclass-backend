const pool = require('../config/database');

/**
 * POST /api/iot/sync
 * Sincroniza leituras RFID armazenadas localmente no ESP32 durante
 * períodos sem conexão à internet (RNF005 - Confiabilidade/Contingência).
 */
async function syncOfflineReadings(req, res, next) {
  const { readings } = req.body;

  if (!Array.isArray(readings) || readings.length === 0) {
    return res.status(400).json({ error: 'Campo "readings" deve ser um array não vazio.' });
  }

  if (readings.length > 500) {
    return res.status(400).json({ error: 'Máximo de 500 leituras por sincronização.' });
  }

  const results = { processed: 0, skipped: 0, errors: [] };
  
  // No MySQL usamos getConnection para gerenciar transações
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ordena por timestamp para processar na ordem correta dos eventos
    const sorted = [...readings].sort(
      (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
    );

    for (const reading of sorted) {
      const { user_id, rfid_tag_uid, action, occurred_at } = reading;

      // Validação mínima de cada entrada
      if (!user_id || !rfid_tag_uid || !action || !occurred_at) {
        results.errors.push({ reading, reason: 'Campos obrigatórios ausentes.' });
        results.skipped++;
        continue;
      }

      if (!['withdrawal', 'return'].includes(action)) {
        results.errors.push({ reading, reason: `Ação inválida: "${action}".` });
        results.skipped++;
        continue;
      }

      // Busca a chave pelo UID
      const [keyRows] = await connection.query(
        'SELECT id FROM keys WHERE rfid_tag_uid = ?',
        [rfid_tag_uid]
      );

      if (!keyRows[0]) {
        results.errors.push({ reading, reason: `Tag RFID "${rfid_tag_uid}" não encontrada.` });
        results.skipped++;
        continue;
      }

      // Verifica se o usuário existe
      const [userRows] = await connection.query(
        'SELECT id FROM users WHERE id = ? AND active = TRUE',
        [user_id]
      );

      if (!userRows[0]) {
        results.errors.push({ reading, reason: `Usuário ${user_id} não encontrado ou inativo.` });
        results.skipped++;
        continue;
      }

      const keyId = keyRows[0].id;

      // Idempotência: ignora se já existe registro idêntico
      const [existing] = await connection.query(
        `SELECT id FROM movements
         WHERE user_id = ? AND key_id = ? AND occurred_at = ?`,
        [user_id, keyId, occurred_at]
      );

      if (existing.length > 0) {
        results.skipped++;
        continue;
      }

      // Insere com o timestamp original do ESP32
      await connection.query(
        `INSERT INTO movements (user_id, key_id, action, occurred_at)
         VALUES (?, ?, ?, ?)`,
        [user_id, keyId, action, occurred_at]
      );

      results.processed++;
    }

    // Adaptação MySQL: Substitui o DISTINCT ON por um INNER JOIN com MAX(id)
    // Isso garante que o status da chave seja atualizado com base no ÚLTIMO registro inserido
    await connection.query(`
      UPDATE keys k
      INNER JOIN (
          SELECT m.key_id, m.action
          FROM movements m
          INNER JOIN (
              SELECT key_id, MAX(id) AS max_id
              FROM movements
              GROUP BY key_id
          ) latest_mov ON m.id = latest_mov.max_id
      ) sub ON k.id = sub.key_id
      SET k.status = IF(sub.action = 'withdrawal', 'in_use', 'available'),
          k.updated_at = NOW();
    `);

    await connection.commit();

    res.json({
      message: 'Sincronização concluída.',
      processed: results.processed,
      skipped:   results.skipped,
      errors:    results.errors,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

module.exports = { syncOfflineReadings };