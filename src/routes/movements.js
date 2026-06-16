const { Router } = require('express');
const ctrl = require('../controllers/movementController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

router.use(authenticate);

// Resumo para o Dashboard (qualquer usuário autenticado pode consultar)
router.get('/summary', ctrl.summary);

// Movimentações recentes para o Dashboard
router.get('/recent', ctrl.recent);

// Chaves em atraso de devolução — para alertas no painel
router.get('/overdue', ctrl.overdue);

// Histórico completo com filtros — apenas Gestores
router.get('/', authorize('Gestor'), ctrl.list);

module.exports = router;
