# SmartClass — Backend API

Backend do **Sistema Inteligente de Controle de Chaves com RFID**, desenvolvido como Projeto Integrador do curso de ADS da Faculdade SENAC.

---

## Stack

| Camada        | Tecnologia                   |
|---------------|------------------------------|
| Runtime       | Node.js ≥ 18                 |
| Framework     | Express.js                   |
| Banco de dados| PostgreSQL                   |
| Autenticação  | JWT (jsonwebtoken)           |
| Segurança     | Helmet, CORS, Rate Limiting  |
| Validação     | express-validator            |
| Hash de senha | bcryptjs                     |

---

## Instalação

```bash
# 1. Clone e instale as dependências
npm install

# 2. Configure o ambiente
cp .env.example .env
# Edite o .env com as credenciais do seu banco PostgreSQL

# 3. Crie as tabelas
npm run db:migrate

# 4. (Opcional) Popule com dados de exemplo
npm run db:seed

# 5. Inicie o servidor
npm run dev        # desenvolvimento (nodemon)
npm start          # produção
```

O servidor sobe em `http://localhost:3000`.

---

## Estrutura de Pastas

```
smartclass-backend/
├── scripts/
│   ├── migrate.js          # Criação das tabelas
│   └── seed.js             # Dados iniciais de desenvolvimento
└── src/
    ├── config/
    │   └── database.js     # Pool de conexão PostgreSQL
    ├── controllers/
    │   ├── authController.js
    │   ├── userController.js
    │   ├── roomController.js
    │   ├── keyController.js
    │   ├── movementController.js
    │   └── iotController.js
    ├── middlewares/
    │   ├── auth.js          # JWT + autorização por categoria + IoT key
    │   └── errorHandler.js  # Tratamento centralizado de erros
    ├── routes/
    │   ├── auth.js
    │   ├── users.js
    │   ├── rooms.js
    │   ├── keys.js
    │   ├── movements.js
    │   └── iot.js
    └── server.js
```

---

## Autenticação

Todas as rotas (exceto `/health` e `/api/iot/*`) exigem um **Bearer Token JWT**.

```
Authorization: Bearer <token>
```

O token é obtido via `POST /api/auth/login`.

### Categorias de usuário e permissões

| Categoria    | Permissões                                          |
|--------------|-----------------------------------------------------|
| `Gestor`     | Acesso total a todas as rotas                       |
| `Professor`  | Leitura de salas, chaves e movimentações recentes   |
| `Funcionario`| Leitura de salas, chaves e movimentações recentes   |

---

## Endpoints

### Auth

| Método | Rota             | Descrição                          | Auth |
|--------|------------------|------------------------------------|------|
| POST   | `/api/auth/login`| Login com e-mail e senha           | Não  |
| GET    | `/api/auth/me`   | Dados do usuário autenticado       | Sim  |

**POST /api/auth/login**
```json
// Request
{ "email": "marina.souza@edu.pe.senac.br", "password": "senha123" }

// Response 200
{
  "token": "eyJ...",
  "user": { "id": 1, "name": "Marina Souza", "email": "...", "category": "Gestor" }
}
```

---

### Usuários

| Método | Rota            | Descrição                  | Permissão |
|--------|-----------------|----------------------------|-----------|
| GET    | `/api/users`    | Lista todos os usuários    | Gestor    |
| GET    | `/api/users/:id`| Busca usuário por ID       | Gestor    |
| POST   | `/api/users`    | Cadastra novo usuário      | Gestor    |
| PUT    | `/api/users/:id`| Atualiza dados do usuário  | Gestor    |
| DELETE | `/api/users/:id`| Desativa usuário           | Gestor    |

**POST /api/users**
```json
{
  "name": "Carlos Eduardo",
  "email": "carlos@edu.pe.senac.br",
  "cpf": "222.222.222-22",
  "category": "Professor",
  "password": "senha123"
}
```

---

### Salas

| Método | Rota              | Descrição                   | Permissão      |
|--------|-------------------|-----------------------------|----------------|
| GET    | `/api/rooms`      | Lista salas + status chave  | Autenticado    |
| GET    | `/api/rooms/:id`  | Sala com regras de acesso   | Autenticado    |
| POST   | `/api/rooms`      | Cadastra sala               | Gestor         |
| DELETE | `/api/rooms/:id`  | Desativa sala               | Gestor         |

### Regras de Acesso

| Método | Rota                   | Descrição                  | Permissão |
|--------|------------------------|----------------------------|-----------|
| GET    | `/api/rooms/rules/all` | Lista todas as regras      | Gestor    |
| POST   | `/api/rooms/rules`     | Cria regra usuário + sala  | Gestor    |
| PUT    | `/api/rooms/rules/:id` | Atualiza horário da regra  | Gestor    |
| DELETE | `/api/rooms/rules/:id` | Remove regra               | Gestor    |

**POST /api/rooms/rules**
```json
{ "user_id": 2, "room_id": 1, "allowed_start": "08:00", "allowed_end": "22:00" }
```

---

### Chaves (RFID)

| Método | Rota                     | Descrição                    | Permissão |
|--------|--------------------------|------------------------------|-----------|
| GET    | `/api/keys`              | Lista todas as chaves        | Autenticado |
| POST   | `/api/keys`              | Cadastra chave + tag RFID    | Gestor    |
| PUT    | `/api/keys/:id/status`   | Altera status manualmente    | Gestor    |
| DELETE | `/api/keys/:id`          | Remove chave (se disponível) | Gestor    |

---

### Movimentações / Logs

| Método | Rota                      | Descrição                                | Permissão   |
|--------|---------------------------|------------------------------------------|-------------|
| GET    | `/api/movements/summary`  | Totais para o Dashboard                  | Autenticado |
| GET    | `/api/movements/recent`   | Últimas 10 movimentações                 | Autenticado |
| GET    | `/api/movements`          | Histórico com filtros e paginação        | Gestor      |

**GET /api/movements** — Query params disponíveis:
- `user_id`, `room_id`, `key_id`, `action` (withdrawal | return)
- `from`, `to` (ISO 8601)
- `limit` (padrão 50, máximo 200), `offset`

**GET /api/movements/summary — Resposta:**
```json
{ "keys_in_use": 4, "available_rooms": 12, "overdue_returns": 1 }
```

---

### IoT (ESP32)

> Estas rotas **não** usam JWT. Usam a header `x-iot-key` com o valor de `IOT_SECRET_KEY` do `.env`.

| Método | Rota                               | Descrição                          |
|--------|------------------------------------|-------------------------------------|
| POST   | `/api/iot/rfid`                   | Registra leitura de tag RFID        |
| GET    | `/api/iot/keys/:rfid_tag_uid/status` | Consulta status de uma chave    |

**POST /api/iot/rfid**
```
Header: x-iot-key: chave_secreta_do_esp32_aqui

Body:
{ "user_id": 2, "rfid_tag_uid": "A1B2C3D4" }

Response 200:
{
  "success": true,
  "action": "withdrawal",
  "message": "Retirada registrada com sucesso.",
  "data": {
    "room": "Sala 101 - Bloco A",
    "key_id": 1,
    "new_status": "in_use",
    "user_name": "Carlos Eduardo",
    "timestamp": "2026-04-29T08:15:00.000Z"
  }
}
```

O ESP32 deve acionar o **buzzer** com beep de sucesso quando `success: true`, e sinal de erro quando `success: false`.

---

## Fluxo completo de autenticação + RFID

```
1. Usuário digita e-mail + senha na interface (Frontend PWA)
2. Frontend → POST /api/auth/login → recebe JWT
3. Frontend armazena o JWT (localStorage/sessionStorage)
4. Frontend envia user_id ao ESP32 via WebSocket ou chamada direta
5. ESP32 habilita o leitor RFID por RFID_READ_TIMEOUT_SECONDS segundos
6. Usuário aproxima a chave do leitor
7. ESP32 → POST /api/iot/rfid { user_id, rfid_tag_uid } com x-iot-key
8. Backend valida permissão, horário e registra movimentação
9. ESP32 recebe resposta e aciona buzzer (sucesso ou erro)
10. Frontend atualiza o Dashboard consultando /api/movements/summary
```

---

## Variáveis de ambiente

| Variável                 | Descrição                                      | Exemplo                    |
|--------------------------|------------------------------------------------|----------------------------|
| `PORT`                   | Porta do servidor                              | `3000`                     |
| `NODE_ENV`               | Ambiente                                       | `development` / `production` |
| `DB_HOST`                | Host do PostgreSQL                             | `localhost`                |
| `DB_PORT`                | Porta do PostgreSQL                            | `5432`                     |
| `DB_USER`                | Usuário do banco                               | `postgres`                 |
| `DB_PASSWORD`            | Senha do banco                                 | `—`                        |
| `DB_NAME`                | Nome do banco                                  | `smartclass`               |
| `JWT_SECRET`             | Chave secreta para assinar tokens              | String longa aleatória     |
| `JWT_EXPIRES_IN`         | Tempo de expiração do token                    | `8h`                       |
| `CORS_ORIGIN`            | Origem(ns) permitida(s)                        | `http://localhost:5173`    |
| `IOT_SECRET_KEY`         | Chave de autenticação do ESP32                 | String aleatória           |
| `RFID_READ_TIMEOUT_SECONDS` | Janela de leitura RFID após login          | `30`                       |
