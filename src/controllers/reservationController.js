const pool = require('../config/database');

/**
 * GET /api/reservations/me
 * Retorna os agendamentos futuros e ativos do utilizador autenticado.
 */
async function getMyReservations(req, res, next) {
  try {
    const userId = req.user.id;

    // 1. AUTO-CONCLUSÃO: Procura qualquer reserva no banco que já passou da hora e marca como Concluída
    await pool.query(`
      UPDATE reservations 
      SET status = 'Completed' 
      WHERE status = 'Scheduled' 
        AND CONCAT(reservation_date, ' ', end_time) <= NOW()
    `);

    // 2. Busca APENAS as reservas ativas ('Scheduled') para mostrar no painel
    const [rows] = await pool.query(
      `SELECT 
         res.id,
         DATE_FORMAT(res.reservation_date, '%d/%m/%Y') AS formatted_date,
         res.reservation_date,
         TIME_FORMAT(res.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(res.end_time, '%H:%i') AS end_time,
         res.status,
         r.id AS room_id,
         r.identification AS room_name
       FROM reservations res
       JOIN rooms r ON r.id = res.room_id
       WHERE res.user_id = ? 
         AND res.status = 'Scheduled' 
       ORDER BY res.reservation_date ASC, res.start_time ASC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyReservations };