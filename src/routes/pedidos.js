const { Router } = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { autenticar, autenticarAdmin } = require('../middleware/auth');
const { emailConfirmacaoPedido } = require('../config/resend');

const router = Router();

// GET /pedidos — admin vê todos, cliente vê só os seus
router.get('/', autenticar, async (req, res, next) => {
  try {
    const isAdmin = req.usuario?.user_metadata?.role === 'admin';

    let query = supabaseAdmin
      .from('pedidos')
      .select('*, itens_pedido(*, produtos(*)), clientes(*)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('user_id', req.usuario.id)
        .single();

      if (!cliente) return res.json([]);
      query = query.eq('cliente_id', cliente.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /pedidos/:id
router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pedidos')
      .select('*, itens_pedido(*, produtos(*)), clientes(*), pagamentos(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Pedido não encontrado' });

    const isAdmin = req.usuario?.user_metadata?.role === 'admin';
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('user_id', req.usuario.id)
      .single();

    if (!isAdmin && data.cliente_id !== cliente?.id) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /pedidos — cliente cria pedido
router.post('/', autenticar, async (req, res, next) => {
  try {
    const { itens, data_entrega, observacoes, endereco_entrega } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ erro: 'Pelo menos um item é obrigatório' });
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('user_id', req.usuario.id)
      .single();

    if (clienteError || !cliente) {
      return res.status(400).json({ erro: 'Perfil de cliente não encontrado. Crie seu perfil primeiro.' });
    }

    // Calcula o total buscando os preços dos produtos
    const ids = itens.map((i) => i.produto_id);
    const { data: produtos, error: produtosError } = await supabaseAdmin
      .from('produtos')
      .select('id, preco')
      .in('id', ids);

    if (produtosError) throw produtosError;

    const precoMap = Object.fromEntries(produtos.map((p) => [p.id, p.preco]));
    const total = itens.reduce((acc, item) => {
      return acc + (precoMap[item.produto_id] || 0) * item.quantidade;
    }, 0);

    // Cria o pedido
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        cliente_id: cliente.id,
        total,
        status: 'pendente',
        data_entrega,
        observacoes,
        endereco_entrega,
      })
      .select()
      .single();

    if (pedidoError) throw pedidoError;

    // Insere os itens
    const itensFmt = itens.map((item) => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: precoMap[item.produto_id],
      subtotal: precoMap[item.produto_id] * item.quantidade,
    }));

    const { error: itensError } = await supabaseAdmin.from('itens_pedido').insert(itensFmt);
    if (itensError) throw itensError;

    // Envia e-mail de confirmação (não bloqueia a resposta)
    emailConfirmacaoPedido(pedido, cliente).catch(console.error);

    res.status(201).json({ ...pedido, itens: itensFmt });
  } catch (err) {
    next(err);
  }
});

// PATCH /pedidos/:id/status — apenas admin
router.patch('/:id/status', autenticarAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const statusValidos = ['pendente', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado'];

    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use: ${statusValidos.join(', ')}` });
    }

    const { data, error } = await supabaseAdmin
      .from('pedidos')
      .update({ status, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Pedido não encontrado' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
