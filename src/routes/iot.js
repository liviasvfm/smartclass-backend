const { Router } = require('express');
const { handleRfidRead, getKeyStatus } = require('../controllers/iotController');
const { syncOfflineReadings } = require('../controllers/syncController');
const { authenticateIoT } = require('../middlewares/auth');

const router = Router();

// Todas as rotas IoT exigem a chave secreta do ESP32
router.use(authenticateIoT);

/**
 * POST /api/iot/rfid
 * Registra leitura de tag RFID após autenticação do usuário.
 */
router.post('/rfid', handleRfidRead);

/**
 * GET /api/iot/keys/:rfid_tag_uid/status
 * Consulta o status de uma chave pelo UID.
 */
router.get('/keys/:rfid_tag_uid/status', getKeyStatus);

/**
 * POST /api/iot/sync
 * Sincroniza leituras armazenadas offline no ESP32 (RNF005).
 * Chamado pelo ESP32 ao reconectar à internet.
 */
router.post('/sync', syncOfflineReadings);

module.exports = router;
