const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Valida o token JWT do Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }

    req.usuario = user;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Falha na autenticação' });
  }
}

// Middleware para rotas administrativas (verifica role no metadata)
async function autenticarAdmin(req, res, next) {
  await autenticar(req, res, async () => {
    const role = req.usuario?.user_metadata?.role;
    if (role !== 'admin') {
      return res.status(403).json({ erro: 'Acesso restrito a administradores' });
    }
    next();
  });
}

module.exports = { autenticar, autenticarAdmin };
