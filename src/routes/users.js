const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/auth');
const normalizeCategory = require('../middlewares/normalizeCategory');

const router = Router();

// Todas as rotas de usuários exigem autenticação
router.use(authenticate);

router.get('/',    authorize('Gestor'),               ctrl.list);
router.get('/:id', authorize('Gestor'),               ctrl.findOne);

router.post(
  '/',
  authorize('Gestor'),
  normalizeCategory,
  [
    body('name').trim().notEmpty().withMessage('Nome é obrigatório.'),
    body('email').isEmail().withMessage('E-mail inválido.'),
    body('cpf')
      .matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
      .withMessage('CPF deve estar no formato 000.000.000-00.'),
    body('category')
      .isIn(['Professor', 'Gestor', 'Funcionario'])
      .withMessage('Categoria inválida.'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Senha deve ter ao menos 6 caracteres.'),
  ],
  ctrl.create
);

router.put(
  '/:id',
  authorize('Gestor'),
  normalizeCategory,
  [
    body('name').optional().trim().notEmpty(),
    body('category').optional().isIn(['Professor', 'Gestor', 'Funcionario']),
    body('active').optional().isBoolean(),
  ],
  ctrl.update
);

router.delete('/:id', authorize('Gestor'), ctrl.remove);

module.exports = router;
