const pool = require('../config/database');

async function create(req, res, next) {
  const { user_id, room_id, scheduled_date, start_time, end_time } = req.body;
  
  try {
    // Apontamos para a tabela "reservations" e a coluna "reservation_date"
    const [result] = await pool.query(
      `INSERT INTO reservations (user_id, room_id, reservation_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, 'Scheduled')`,
      [user_id, room_id, scheduled_date, start_time, end_time]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      status: 'Scheduled',
      message: 'Agendamento criado com sucesso.'
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    // AUTO-CONCLUSÃO: Garante que a tela da Gestão veja as reservas vencidas como Concluídas
    await pool.query(`
      UPDATE reservations 
      SET status = 'Completed' 
      WHERE status = 'Scheduled' 
        AND CONCAT(reservation_date, ' ', end_time) <= NOW()
    `);

    const [rows] = await pool.query(`
      SELECT
        s.id, 
        s.reservation_date AS scheduled_date, 
        s.start_time, 
        s.end_time, 
        s.status,
        u.name AS user_name, u.category,
        r.identification AS room_name
      FROM reservations s
      JOIN users u ON u.id = s.user_id
      JOIN rooms r ON r.id = s.room_id
      ORDER BY s.reservation_date DESC, s.start_time ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  const { status } = req.body;
  
  if (!['Scheduled', 'Completed', 'Canceled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use Scheduled, Completed ou Canceled.' });
  }

  try {
    // Atualizamos a tabela correta
    const [result] = await pool.query(
      `UPDATE reservations SET status = ? WHERE id = ?`,
      [status, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }
    
    res.json({ message: 'Status atualizado com sucesso.', status });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, updateStatus };