const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@eldabolos.com.br';

async function enviarEmail({ para, assunto, html }) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: para,
    subject: assunto,
    html,
  });

  if (error) throw new Error(`Erro ao enviar e-mail: ${error.message}`);
  return data;
}

async function emailConfirmacaoPedido(pedido, cliente) {
  return enviarEmail({
    para: cliente.email,
    assunto: `Pedido #${pedido.id} confirmado — Elda Bolos e Doces`,
    html: `
      <h2>Olá, ${cliente.nome}!</h2>
      <p>Seu pedido <strong>#${pedido.id}</strong> foi confirmado com sucesso.</p>
      <p><strong>Total:</strong> R$ ${Number(pedido.total).toFixed(2)}</p>
      <p><strong>Retirada/Entrega:</strong> ${new Date(pedido.data_entrega).toLocaleDateString('pt-BR')}</p>
      <br>
      <p>Qualquer dúvida, entre em contato conosco.</p>
      <p>Elda Bolos e Doces 🍰</p>
    `,
  });
}

async function emailStatusPagamento(pedido, cliente, status) {
  const mensagens = {
    aprovado: `Seu pagamento do pedido <strong>#${pedido.id}</strong> foi <strong>aprovado</strong>! Já estamos preparando tudo com carinho. 🎂`,
    pendente: `Seu pagamento do pedido <strong>#${pedido.id}</strong> está <strong>pendente</strong>. Assim que confirmado, você receberá outro e-mail.`,
    rejeitado: `Infelizmente o pagamento do pedido <strong>#${pedido.id}</strong> foi <strong>recusado</strong>. Por favor, tente novamente ou entre em contato.`,
  };

  return enviarEmail({
    para: cliente.email,
    assunto: `Atualização de pagamento — Pedido #${pedido.id}`,
    html: `
      <h2>Olá, ${cliente.nome}!</h2>
      <p>${mensagens[status] || `Status do pagamento: ${status}`}</p>
      <br>
      <p>Elda Bolos e Doces 🍰</p>
    `,
  });
}

module.exports = { enviarEmail, emailConfirmacaoPedido, emailStatusPagamento };
