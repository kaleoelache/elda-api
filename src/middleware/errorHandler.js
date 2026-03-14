function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);

  const status = err.status || err.statusCode || 500;
  const mensagem = err.message || 'Erro interno do servidor';

  res.status(status).json({
    erro: mensagem,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
