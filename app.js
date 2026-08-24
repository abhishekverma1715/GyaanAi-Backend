require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const compression   = require('compression');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { authRouter, chatRouter } = require('./routes/index');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy for Render / Cloudflare / Vercel
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS Configuration for Production (Vercel + Localhost) ────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or non-browser requests
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback allow to avoid unexpected deployment blocks
  },
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Rate Limiting ─────────────────────────────────────────────
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 300,
  message: { message: 'Too many requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 min
  max: 20,
  message: { message: 'AI rate limit reached. Please wait 1 minute.' },
});

app.use('/api/', globalLimit);
app.use('/api/chat/conversations', aiLimit);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());  // Prevent NoSQL injection
app.use(compression());    // Gzip responses

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const cache    = require('./config/cache');
  res.json({
    status:      'ok',
    service:     'GyaanAI API v3',
    database:    mongoose.connection.readyState === 1 ? 'mongodb' : 'memory',
    aiProvider:  process.env.AI_PROVIDER || 'gemini',
    cache:       cache.stats(),
    uptime:      Math.floor(process.uptime()) + 's',
    timestamp:   new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);

// ── Root ──────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: '🧠 GyaanAI API v3', health: '/health' }));

// ── Error Handlers ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
