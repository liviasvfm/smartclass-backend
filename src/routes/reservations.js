const { Router } = require('express');
const ctrl = require('../controllers/reservationController');
const { authenticate } = require('../middlewares/auth');

const router = Router();

// Protege todas as rotas de agendamento com autenticação JWT
router.use(authenticate);

// Rota para o usuário logado buscar apenas as suas próprias reservas
router.get('/me', ctrl.getMyReservations);

module.exports = router;