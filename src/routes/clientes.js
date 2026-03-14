const { Router } = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { autenticar, autenticarAdmin } = require('../middleware/auth');

const router = Router();

// GET /clientes — apenas admin
router.get('/', autenticarAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .order('nome');

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /clientes/me — cliente autenticado vê seu próprio perfil
router.get('/me', autenticar, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('user_id', req.usuario.id)
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Perfil não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /clientes/:id — apenas admin
router.get('/:id', autenticarAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('*, pedidos(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Cliente não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /clientes — cria perfil após registro no Supabase Auth
router.post('/', autenticar, async (req, res, next) => {
  try {
    const { nome, telefone, endereco } = req.body;

    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        user_id: req.usuario.id,
        email: req.usuario.email,
        nome,
        telefone,
        endereco,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /clientes/me — cliente atualiza próprio perfil
router.put('/me', autenticar, async (req, res, next) => {
  try {
    const { nome, telefone, endereco } = req.body;

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update({ nome, telefone, endereco, updated_at: new Date() })
      .eq('user_id', req.usuario.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Perfil não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
