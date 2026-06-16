require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function seed() {
  console.log('🌱 Inserindo dados de exemplo...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('senha123', salt);

    // --- 1. Usuários e Credenciais ---
    const usersData = [
      { name: 'Marina Souza', email: 'marina.souza@edu.pe.senac.br', cpf: '111.111.111-11', category: 'Gestor' },
      { name: 'Carlos Eduardo', email: 'carlos.eduardo@edu.pe.senac.br', cpf: '222.222.222-22', category: 'Professor' },
      { name: 'Roberto Alves Gomes', email: 'roberto.alves@edu.pe.senac.br', cpf: '333.333.333-33', category: 'Funcionario' },
      { name: 'Fernanda Lima', email: 'fernanda.lima@edu.pe.senac.br', cpf: '444.444.444-44', category: 'Professor' }
    ];

    for (const u of usersData) {
      // INSERT IGNORE previne erros se o usuário já existir
      const [result] = await connection.query(
        `INSERT IGNORE INTO users (name, email, cpf, category) VALUES (?, ?, ?, ?)`,
        [u.name, u.email, u.cpf, u.category]
      );
      
      // Se inseriu um novo usuário (insertId > 0), vincula a senha na tabela credentials
      if (result.insertId) {
        await connection.query(
          `INSERT INTO credentials (user_id, password) VALUES (?, ?)`,
          [result.insertId, passwordHash]
        );
      }
    }
    console.log('  ✅ Usuários e Credenciais inseridos');

    // --- 2. Salas ---
    await connection.query(`
      INSERT IGNORE INTO rooms (identification) VALUES
        ('Sala 101 - Bloco A'),
        ('Sala 102 - Bloco A'),
        ('Sala 103 - Bloco A'),
        ('Sala 104 - Bloco A'),
        ('Laboratório de Informática - Bloco B')
    `);
    console.log('  ✅ Salas inseridas');

    // --- 3. Chaves (RFID) ---
    // Usando subqueries seguras do MySQL para buscar os IDs das salas
    await connection.query(`
      INSERT IGNORE INTO keys (rfid_tag_uid, room_id) VALUES
        ('A1B2C3D4', (SELECT id FROM rooms WHERE identification = 'Sala 101 - Bloco A')),
        ('E5F6G7H8', (SELECT id FROM rooms WHERE identification = 'Sala 102 - Bloco A')),
        ('I9J0K1L2', (SELECT id FROM rooms WHERE identification = 'Sala 103 - Bloco A')),
        ('M3N4O5P6', (SELECT id FROM rooms WHERE identification = 'Sala 104 - Bloco A'))
    `);
    console.log('  ✅ Chaves (RFID) inseridas');

    // --- 4. Regras de acesso ---
    await connection.query(`
      INSERT IGNORE INTO access_rules (user_id, room_id, allowed_start, allowed_end) VALUES
        (
          (SELECT id FROM users WHERE email = 'carlos.eduardo@edu.pe.senac.br'),
          (SELECT id FROM rooms WHERE identification = 'Sala 101 - Bloco A'),
          '08:00', '22:00'
        ),
        (
          (SELECT id FROM users WHERE email = 'roberto.alves@edu.pe.senac.br'),
          (SELECT id FROM rooms WHERE identification = 'Sala 101 - Bloco A'),
          '05:00', '07:30'
        ),
        (
          (SELECT id FROM users WHERE email = 'fernanda.lima@edu.pe.senac.br'),
          (SELECT id FROM rooms WHERE identification = 'Sala 104 - Bloco A'),
          '08:00', '18:00'
        )
    `);
    console.log('  ✅ Regras de acesso inseridas');

    await connection.commit();
    console.log('🎉 Seed concluído com sucesso!');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Erro no seed:', err.message);
  } finally {
    connection.release();
    // process.exit(0) garante que o script finalize no terminal após o término
    process.exit(0); 
  }
}

seed();