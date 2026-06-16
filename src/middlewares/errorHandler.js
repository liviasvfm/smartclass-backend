/**
 * Middleware de tratamento de erros centralizado.
 * Deve ser registado APÓS todas as rotas no server.js.
 */
function errorHandler(err, req, res, next) {
  // Erros de validação do express-validator são tratados nos controllers,
  // mas qualquer erro não capturado cai aqui.
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  // Erros do MySQL com código conhecido
  
  // ER_DUP_ENTRY: Violação de restrição UNIQUE (ex: e-mail ou CPF já existentes)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Registo duplicado. Verifique os dados informados.' });
  }
  
  // ER_ROW_IS_REFERENCED_2 / ER_NO_REFERENCED_ROW_2: Violação de chave estrangeira (Foreign Key)
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Referência inválida. O recurso relacionado não existe ou está em uso.' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Erro interno do servidor.';

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;