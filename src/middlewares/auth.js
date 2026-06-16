const jwt = require('jsonwebtoken');

/**
 * Verifica o token JWT no header Authorization.
 * Injeta req.user com { id, email, category } se válido.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, category, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

/**
 * Restringe acesso a determinadas categorias de usuário.
 * Uso: authorize('Gestor') ou authorize('Gestor', 'Professor')
 */
function authorize(...allowedCategories) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (!allowedCategories.includes(req.user.category)) {
      return res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
    }
    next();
  };
}

/**
 * Valida a chave secreta do ESP32 enviada no header x-iot-key.
 * Usada nas rotas de IoT para evitar chamadas não autorizadas.
 */
function authenticateIoT(req, res, next) {
  const iotKey = req.headers['x-iot-key'];

  if (!iotKey || iotKey !== process.env.IOT_SECRET_KEY) {
    return res.status(401).json({ error: 'Autenticação IoT falhou. Chave inválida.' });
  }
  next();
}

module.exports = { authenticate, authorize, authenticateIoT };
