/**
 * Scheduler de alertas de atraso (RF: "geração de alertas em caso de atraso")
 *
 * Roda a cada ALERT_INTERVAL_MS milissegundos e verifica quais chaves
 * ainda estão em uso após o horário permitido de devolução.
 *
 * Estratégia atual: log no console + endpoint de consulta.
 * Para produção: substituir o console.warn pelo serviço de notificação
 * desejado (e-mail via Nodemailer, webhook, push notification etc.).
 */

const pool = require('../config/database');

const ALERT_INTERVAL_MS = 5 * 60 * 1000; // verifica a cada 5 minutos

async function checkOverdueKeys() {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id             AS movement_id,
        u.name           AS user_name,
        u.email          AS user_email,
        r.identification AS room_name,
        ar.allowed_end,
        m.occurred_at    AS withdrawn_at
      FROM movements m
      JOIN users          u  ON u.id  = m.user_id
      JOIN \`keys\`         k  ON k.id  = m.key_id
      JOIN rooms          r  ON r.id  = k.room_id
      JOIN access_rules  ar ON ar.user_id = m.user_id AND ar.room_id = k.room_id
      WHERE m.action   = 'withdrawal'
        AND k.status   = 'in_use'
        AND CURRENT_TIME() > ar.allowed_end
      ORDER BY m.occurred_at ASC
    `);

    if (rows.length === 0) return;

    console.warn(`\n⚠️  [ALERTA] ${rows.length} chave(s) com devolução em atraso:`);
    rows.forEach(row => {
      console.warn(
        `   → ${row.user_name} (${row.user_email}) | ${row.room_name}` +
        ` | Limite: ${String(row.allowed_end).slice(0, 5)}` +
        ` | Retirada em: ${new Date(row.withdrawn_at).toLocaleString('pt-BR')}`
      );
      // ── Ponto de extensão ────────────────────────────────────────────────
      // Descomente e configure para enviar notificações reais:
      //
      // await sendEmailAlert(row.user_email, row.room_name, row.allowed_end);
      // await sendWebhookAlert(row);
      // ────────────────────────────────────────────────────────────────────
    });
  } catch (err) {
    console.error('[alertScheduler] Erro ao verificar atrasos:', err.message);
  }
}

function startAlertScheduler() {
  console.log(`🔔 Scheduler de alertas iniciado (intervalo: ${ALERT_INTERVAL_MS / 60000} min)`);
  setInterval(checkOverdueKeys, ALERT_INTERVAL_MS);
  checkOverdueKeys(); // Executa imediatamente ao iniciar
}

module.exports = { startAlertScheduler, checkOverdueKeys };