const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function consertarSenhas() {
  try {
    // 1. Liga-se diretamente ao banco com as credenciais que me passou
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'admin',
      database: 'db_smartclass'
    });

    console.log('A gerar um novo hash seguro para "senha123"...');
    
    // 2. O seu próprio Node gera o hash
    const hashCerto = await bcrypt.hash('senha123', 10);
    console.log(`Hash gerado: ${hashCerto}`);

    // 3. Substitui o hash defeituoso de todos os utilizadores
    await connection.query('UPDATE credentials SET password = ?', [hashCerto]);

    console.log('✅ Sucesso! Todas as senhas foram corrigidas no banco de dados!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

consertarSenhas();