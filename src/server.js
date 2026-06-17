require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const roomRoutes      = require('./routes/rooms');
const keyRoutes       = require('./routes/keys');
const movementRoutes  = require('./routes/movements');
const iotRoutes       = require('./routes/iot');
const schedulingRoutes = require('./routes/scheduling');
const reservationRoutes = require('./routes/reservations');
const errorHandler    = require('./middlewares/errorHandler');
const { startAlertScheduler } = require('./utils/alertScheduler');


const app = express();

app.set('trust proxy', 1);

// ─── Segurança ─────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-iot-key'],
}));

// Rate limiting global — 200 req/min por IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns segundos.' },
}));

// Rate limiting mais restrito para login — evita brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// ─── Parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Rotas ─────────────────────────────────────────────────────────────────
app.use('/api/auth',      loginLimiter, authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/rooms',     roomRoutes);
app.use('/api/keys',      keyRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/iot',       iotRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/reservations', reservationRoutes);

// ─── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// ─── Error handler centralizado ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

// O scheduler é iniciado aqui, fora do callback do listen, garantindo
// que rode exatamente uma vez por processo — independente de quantas
// vezes o evento 'listening' dispare (ex: testes, reload, clusters).
startAlertScheduler();

app.listen(PORT, () => {
  console.log(`\n🚀 SmartClass Backend rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:   http://localhost:${PORT}/health\n`);
});

module.exports = app;
