const { Router } = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { autenticarAdmin } = require('../middleware/auth');

const router = Router();

// Todas as rotas de ingredientes são restritas a admin

// GET /ingredientes
router.get('/', autenticarAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ingredientes')
      .select('*')
      .order('nome');

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /ingredientes/estoque-baixo — itens abaixo do estoque mínimo
router.get('/estoque-baixo', autenticarAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ingredientes')
      .select('*')
      .lt('quantidade_estoque', supabaseAdmin.raw('estoque_minimo'))
      .order('nome');

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /ingredientes/:id
router.get('/:id', autenticarAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ingredientes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /ingredientes
router.post('/', autenticarAdmin, async (req, res, next) => {
  try {
    const { nome, unidade, quantidade_estoque, estoque_minimo, preco_unitario } = req.body;

    if (!nome || !unidade) {
      return res.status(400).json({ erro: 'Nome e unidade são obrigatórios' });
    }

    const { data, error } = await supabaseAdmin
      .from('ingredientes')
      .insert({ nome, unidade, quantidade_estoque: quantidade_estoque ?? 0, estoque_minimo: estoque_minimo ?? 0, preco_unitario })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /ingredientes/:id
router.put('/:id', autenticarAdmin, async (req, res, next) => {
  try {
    const { nome, unidade, quantidade_estoque, estoque_minimo, preco_unitario } = req.body;

    const { data, error } = await supabaseAdmin
      .from('ingredientes')
      .update({ nome, unidade, quantidade_estoque, estoque_minimo, preco_unitario, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /ingredientes/:id/estoque — atualiza apenas o estoque
router.patch('/:id/estoque', autenticarAdmin, async (req, res, next) => {
  try {
    const { quantidade } = req.body;

    if (quantidade === undefined) {
      return res.status(400).json({ erro: 'Quantidade é obrigatória' });
    }

    const { data, error } = await supabaseAdmin
      .from('ingredientes')
      .update({ quantidade_estoque: quantidade, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /ingredientes/:id
router.delete('/:id', autenticarAdmin, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('ingredientes')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
