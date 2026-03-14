const { Router } = require('express');
const { supabase } = require('../config/supabase');
const { autenticar, autenticarAdmin } = require('../middleware/auth');

const router = Router();

// GET /produtos — lista todos os produtos ativos
router.get('/', async (req, res, next) => {
  try {
    const { categoria, disponivel } = req.query;

    let query = supabase.from('produtos').select('*').order('nome');

    if (categoria) query = query.eq('categoria', categoria);
    if (disponivel !== undefined) query = query.eq('disponivel', disponivel === 'true');

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /produtos/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Produto não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /produtos — apenas admin
router.post('/', autenticarAdmin, async (req, res, next) => {
  try {
    const { nome, descricao, preco, categoria, disponivel, imagem_url } = req.body;

    if (!nome || !preco) {
      return res.status(400).json({ erro: 'Nome e preço são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('produtos')
      .insert({ nome, descricao, preco, categoria, disponivel: disponivel ?? true, imagem_url })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /produtos/:id — apenas admin
router.put('/:id', autenticarAdmin, async (req, res, next) => {
  try {
    const { nome, descricao, preco, categoria, disponivel, imagem_url } = req.body;

    const { data, error } = await supabase
      .from('produtos')
      .update({ nome, descricao, preco, categoria, disponivel, imagem_url, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Produto não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /produtos/:id — apenas admin
router.delete('/:id', autenticarAdmin, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
