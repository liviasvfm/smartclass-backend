const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const pool = require('../config/database');

/**
 * POST /api/users
 */
async function create(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { name, email, cpf, category, password } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verifica duplicidade de email ou CPF
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ? OR cpf = ?',
      [email, cpf]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'E-mail ou CPF já cadastrado no sistema.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 1. Insere na tabela 'users'
    const [userResult] = await connection.query(
      `INSERT INTO users (name, email, cpf, category) VALUES (?, ?, ?, ?)`,
      [name, email, cpf, category]
    );

    const newUserId = userResult.insertId;

    // 2. Insere na tabela 'credentials' vinculando ao ID recém-criado
    await connection.query(
      `INSERT INTO credentials (user_id, password) VALUES (?, ?)`,
      [newUserId, passwordHash]
    );

    await connection.commit();

    res.status(201).json({
      id: newUserId,
      name,
      email,
      cpf,
      category,
      active: true
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * GET /api/users
 */
async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      // 👇 CORREÇÃO: Adicionada a cláusula WHERE active = TRUE
      `SELECT id, name, email, cpf, category, active, created_at 
       FROM users 
       WHERE active = TRUE 
       ORDER BY name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id
 */
async function findOne(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, cpf, category, active, created_at FROM users WHERE id = ? AND active = TRUE`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado ou inativo.' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id
 */
async function update(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  // 👇 CORREÇÃO: Agora o backend recebe e salva as edições de email e cpf
  const { name, email, cpf, category } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE users
       SET name = COALESCE(?, name), 
           email = COALESCE(?, email), 
           cpf = COALESCE(?, cpf), 
           category = COALESCE(?, category), 
           updated_at = NOW()
       WHERE id = ? AND active = TRUE`,
      [name, email, cpf, category, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou inativo.' });
    }

    const [updatedUser] = await pool.query(
      `SELECT id, name, email, cpf, category, active, updated_at FROM users WHERE id = ?`,
      [req.params.id]
    );

    res.json(updatedUser[0]);
  } catch (err) {
    // Tratamento caso tentem editar um email para outro já existente
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'E-mail ou CPF já está em uso por outro usuário.' });
    }
    next(err);
  }
}

/**
 * DELETE /api/users/:id
 */
async function remove(req, res, next) {
  try {
    // Mantém o Soft Delete: Excelente para não quebrar o histórico de relatórios!
    const [result] = await pool.query(
      `UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const [user] = await pool.query(`SELECT id, name, active FROM users WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Usuário desativado com sucesso.', user: user[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, findOne, update, remove };