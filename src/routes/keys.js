const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/keyController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);

router.post(
  '/',
  authorize('Gestor'),
  [
    body('rfid_tag_uid').trim().notEmpty().withMessage('UID da tag é obrigatório.'),
    body('room_id').isInt({ min: 1 }).withMessage('room_id inválido.'),
  ],
  ctrl.create
);

router.put('/:id/status', authorize('Gestor'), ctrl.updateStatus);
router.delete('/:id',     authorize('Gestor'), ctrl.remove);

module.exports = router;
