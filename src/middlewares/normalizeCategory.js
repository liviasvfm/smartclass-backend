/**
 * Normaliza o campo `category` do body antes da validação.
 *
 * O frontend envia "Funcionário" (com acento), mas o banco armazena
 * "Funcionario" (sem acento). Este middleware faz a correção automaticamente
 * para que o frontend não precise ser alterado.
 *
 * Mapeamento completo:
 *   "Funcionário" → "Funcionario"
 *   "Professor"   → "Professor"   (sem alteração)
 *   "Gestor"      → "Gestor"      (sem alteração)
 */
function normalizeCategory(req, res, next) {
  if (req.body && typeof req.body.category === 'string') {
    const map = {
      'Funcionário': 'Funcionario',
      'funcionário': 'Funcionario',
      'funcionario': 'Funcionario',
      'professor':   'Professor',
      'gestor':      'Gestor',
    };
    req.body.category = map[req.body.category] ?? req.body.category;
  }
  next();
}

module.exports = normalizeCategory;
