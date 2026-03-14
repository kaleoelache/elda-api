require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

const produtosRouter = require('./routes/produtos');
const pedidosRouter = require('./routes/pedidos');
const clientesRouter = require('./routes/clientes');
const ingredientesRouter = require('./routes/ingredientes');
const pagamentosRouter = require('./routes/pagamentos');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Segurança
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — 100 req/min por IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em instantes.' },
}));

// Webhook do Mercado Pago precisa do body raw
app.use('/pagamentos/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas
app.use('/produtos', produtosRouter);
app.use('/pedidos', pedidosRouter);
app.use('/clientes', clientesRouter);
app.use('/ingredientes', ingredientesRouter);
app.use('/pagamentos', pagamentosRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Tratamento de erros
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🍰 Elda API rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
