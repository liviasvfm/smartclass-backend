const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/database');

/**
 * POST /api/auth/login
 */
/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  
  // 1. O que o Node está a receber do Frontend?
  console.log(`\n--- TENTATIVA DE LOGIN ---`);
  console.log(`E-mail recebido: "${email}"`);
  console.log(`Palavra-passe recebida: "${password}"`);

  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.category, u.active, c.password 
       FROM users u
       JOIN credentials c ON u.id = c.user_id
       WHERE u.email = ?`,
      [email]
    );

    const user = rows[0];

    // 2. O banco de dados encontrou alguém com este e-mail?
    if (!user) {
      console.log(`❌ Falha: Nenhum utilizador encontrado com o e-mail "${email}".`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    
    console.log(`✅ Utilizador encontrado no banco:`, { id: user.id, name: user.name, hashNoBanco: user.password });

    if (!user.active) {
      return res.status(403).json({ error: 'Conta desativada. Contate o administrador.' });
    }

    // 3. A comparação matemática do bcrypt validou a palavra-passe?
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log(`Resultado do Bcrypt (A senha bate com o hash?): ${passwordMatch}`);

    if (!passwordMatch) {
      console.log(`❌ Falha: A palavra-passe inserida não corresponde ao hash do banco.`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    console.log(`✅ Sucesso! Gerando Token JWT...`);
    const token = jwt.sign(
      { id: user.id, email: user.email, category: user.category },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        category: user.category,
      },
    });
  } catch (err) {
    console.error('Erro interno no login:', err);
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, cpf, category, active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, me };