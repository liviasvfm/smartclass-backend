require('dotenv').config();
const pool = require('../src/config/database');

const createTables = `

  -- Tabela de usuários do sistema
  CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150)        NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    cpf         VARCHAR(14)  UNIQUE NOT NULL,
    -- ATENÇÃO: "Funcionario" sem acento — padrão definido para evitar divergência com o frontend
    category    VARCHAR(30)         NOT NULL CHECK (category IN ('Professor', 'Gestor', 'Funcionario')),
    password    VARCHAR(255)        NOT NULL,
    active      BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
  );

  -- Tabela de salas / ambientes
  CREATE TABLE IF NOT EXISTS rooms (
    id              SERIAL PRIMARY KEY,
    identification  VARCHAR(100) UNIQUE NOT NULL,
    active          BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
  );

  -- Chaves físicas associadas a cada sala
  CREATE TABLE IF NOT EXISTS keys (
    id            SERIAL PRIMARY KEY,
    rfid_tag_uid  VARCHAR(100) UNIQUE NOT NULL,
    status        VARCHAR(20)         NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use')),
    room_id       INTEGER             NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
  );

  -- Regras de uso: quais usuários podem retirar quais salas e em que horários
  CREATE TABLE IF NOT EXISTS access_rules (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    room_id         INTEGER     NOT NULL REFERENCES rooms(id)  ON DELETE CASCADE,
    allowed_start   TIME        NOT NULL,
    allowed_end     TIME        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, room_id)
  );

  -- Registro de todas as movimentações de chaves (log completo)
  CREATE TABLE IF NOT EXISTS movements (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id),
    key_id      INTEGER         NOT NULL REFERENCES keys(id),
    action      VARCHAR(20)     NOT NULL CHECK (action IN ('withdrawal', 'return')),
    occurred_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
  );

  -- Índices para consultas frequentes
  CREATE INDEX IF NOT EXISTS idx_movements_user_id   ON movements(user_id);
  CREATE INDEX IF NOT EXISTS idx_movements_key_id    ON movements(key_id);
  CREATE INDEX IF NOT EXISTS idx_movements_occurred  ON movements(occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_keys_rfid           ON keys(rfid_tag_uid);
  CREATE INDEX IF NOT EXISTS idx_access_rules_user   ON access_rules(user_id);
`;

async function migrate() {
  console.log('🔄 Executando migrações...');
  try {
    await pool.query(createTables);
    console.log('✅ Tabelas criadas/verificadas com sucesso.');
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
