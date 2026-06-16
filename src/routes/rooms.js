const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/roomController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

// Aplica autenticação em todas as rotas
router.use(authenticate);

// ── Regras de Acesso ───────────────────────────────────────────────────────
// ⚠️ IMPORTANTE: Rotas com caminhos fixos (/rules) DEVEM ficar ANTES das rotas dinâmicas (/:id)

router.get('/rules', ctrl.listRules);

router.post(
  '/rules',
  authorize('Gestor'),
  [
    body('user_id').isInt({ min: 1 }).withMessage('user_id inválido.'),
    body('room_id').isInt({ min: 1 }).withMessage('room_id inválido.'),
    body('allowed_start').matches(/^\d{2}:\d{2}$/).withMessage('Horário inválido (HH:MM).'),
    body('allowed_end').matches(/^\d{2}:\d{2}$/).withMessage('Horário inválido (HH:MM).'),
    body('allowed_days').notEmpty().withMessage('Selecione pelo menos um dia da semana.'), // 👈 NOVA VALIDAÇÃO
  ],
  ctrl.createRule
);

router.put('/rules/:id',    authorize('Gestor'), ctrl.updateRule);
router.delete('/rules/:id', authorize('Gestor'), ctrl.removeRule);


// ── Salas ──────────────────────────────────────────────────────────────────
router.get('/',    ctrl.listRooms);

router.post(
  '/',
  authorize('Gestor'),
  [body('identification').trim().notEmpty().withMessage('Identificação é obrigatória.')],
  ctrl.createRoom
);

// ⚠️ Rotas com parâmetros dinâmicos (/:id) sempre no final do arquivo
router.get('/:id', ctrl.findRoom);
router.delete('/:id', authorize('Gestor'), ctrl.removeRoom);

module.exports = router;