const { Router } = require('express');
const { body } = require('express-validator');
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Informe um e-mail válido.'),
    body('password').notEmpty().withMessage('A senha é obrigatória.'),
  ],
  login
);

router.get('/me', authenticate, me);

module.exports = router;
