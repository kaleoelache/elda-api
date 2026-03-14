const { Router } = require('express');
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const { supabaseAdmin } = require('../config/supabase');
const { autenticar, autenticarAdmin } = require('../middleware/auth');
const { emailStatusPagamento } = require('../config/resend');

const router = Router();

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

// POST /pagamentos/pix — gera cobrança PIX para um pedido
router.post('/pix', autenticar, async (req, res, next) => {
  try {
    const { pedido_id } = req.body;

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(*)')
      .eq('id', pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const payment = new Payment(mpClient);
    const resultado = await payment.create({
      body: {
        transaction_amount: Number(pedido.total),
        description: `Pedido #${pedido.id} — Elda Bolos e Doces`,
        payment_method_id: 'pix',
        payer: {
          email: pedido.clientes.email,
          first_name: pedido.clientes.nome.split(' ')[0],
          last_name: pedido.clientes.nome.split(' ').slice(1).join(' '),
        },
        notification_url: `${process.env.APP_URL}/pagamentos/webhook`,
        external_reference: String(pedido.id),
      },
    });

    // Salva o pagamento no banco
    const { error: pagError } = await supabaseAdmin.from('pagamentos').insert({
      pedido_id: pedido.id,
      mp_payment_id: String(resultado.id),
      metodo: 'pix',
      status: resultado.status,
      valor: resultado.transaction_amount,
      qr_code: resultado.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: resultado.point_of_interaction?.transaction_data?.qr_code_base64,
    });

    if (pagError) throw pagError;

    res.status(201).json({
      pagamento_id: resultado.id,
      status: resultado.status,
      qr_code: resultado.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: resultado.point_of_interaction?.transaction_data?.qr_code_base64,
      expiracao: resultado.date_of_expiration,
    });
  } catch (err) {
    next(err);
  }
});

// POST /pagamentos/cartao — processa pagamento com cartão
router.post('/cartao', autenticar, async (req, res, next) => {
  try {
    const { pedido_id, token, parcelas, email_pagador } = req.body;

    if (!token || !parcelas) {
      return res.status(400).json({ erro: 'Token do cartão e parcelas são obrigatórios' });
    }

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(*)')
      .eq('id', pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const payment = new Payment(mpClient);
    const resultado = await payment.create({
      body: {
        transaction_amount: Number(pedido.total),
        token,
        description: `Pedido #${pedido.id} — Elda Bolos e Doces`,
        installments: Number(parcelas),
        payer: { email: email_pagador || pedido.clientes.email },
        notification_url: `${process.env.APP_URL}/pagamentos/webhook`,
        external_reference: String(pedido.id),
      },
    });

    const { error: pagError } = await supabaseAdmin.from('pagamentos').insert({
      pedido_id: pedido.id,
      mp_payment_id: String(resultado.id),
      metodo: 'cartao',
      status: resultado.status,
      valor: resultado.transaction_amount,
      parcelas: resultado.installments,
    });

    if (pagError) throw pagError;

    res.status(201).json({
      pagamento_id: resultado.id,
      status: resultado.status,
      status_detail: resultado.status_detail,
    });
  } catch (err) {
    next(err);
  }
});

// POST /pagamentos/webhook — recebe notificações do Mercado Pago
router.post('/webhook', async (req, res, next) => {
  try {
    const { type, data } = req.body;

    if (type !== 'payment') return res.status(200).send();

    const payment = new Payment(mpClient);
    const resultado = await payment.get({ id: data.id });

    const status = resultado.status; // approved, pending, rejected
    const pedidoId = resultado.external_reference;

    // Atualiza o pagamento no banco
    await supabaseAdmin
      .from('pagamentos')
      .update({ status, updated_at: new Date() })
      .eq('mp_payment_id', String(data.id));

    // Atualiza o status do pedido se aprovado
    if (status === 'approved') {
      await supabaseAdmin
        .from('pedidos')
        .update({ status: 'confirmado', updated_at: new Date() })
        .eq('id', pedidoId);
    }

    // Envia e-mail de atualização
    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(*)')
      .eq('id', pedidoId)
      .single();

    if (pedido?.clientes) {
      emailStatusPagamento(pedido, pedido.clientes, status).catch(console.error);
    }

    res.status(200).send();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send(); // Sempre 200 para o MP não retentar
  }
});

// GET /pagamentos/pedido/:pedidoId — consulta pagamentos de um pedido
router.get('/pedido/:pedidoId', autenticar, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pagamentos')
      .select('*')
      .eq('pedido_id', req.params.pedidoId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
