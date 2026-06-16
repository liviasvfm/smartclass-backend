const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306, // Porta padrão do MySQL
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartclass',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0
});

// Testa a conexão ao inicializar
pool.getConnection()
  .then((conn) => {
    console.log('✅ Conexão com MySQL estabelecida.');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar ao MySQL:', err.message);
  });

module.exports = pool;