const express = require('express');
const router = express.Router();
const schedulingController = require('../controllers/schedulingController');
const { authenticate } = require('../middlewares/auth'); 

// Aplica o middleware de autenticação em todas as rotas de agendamento
router.use(authenticate);

router.post('/', schedulingController.create);
router.get('/', schedulingController.list);
router.put('/:id/status', schedulingController.updateStatus);

module.exports = router;