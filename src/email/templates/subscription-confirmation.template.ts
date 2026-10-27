import {
  EmailContent,
  EmailLayoutData,
} from '@src/email/templates/template-data';
import {
  primaryButton,
  renderEmailLayout,
} from '@src/email/templates/layout.template';

export interface SubscriptionConfirmationData extends EmailLayoutData {
  confirmationUrl: string;
  expiresInHours: number;
}

export function SubscriptionConfirmationTemplate(
  data: SubscriptionConfirmationData,
): EmailContent {
  const title = 'Confirme sua inscrição';
  const html = renderEmailLayout({
    appName: data.appName,
    title,
    preheader: 'Falta só um clique para receber o resumo diário do Congresso.',
    contentHtml: `
      <p style="margin:0 0 12px">Recebemos um pedido para enviar a este e-mail o resumo diário das leis votadas no Congresso Nacional: o que foi aprovado, quem votou a favor, contra e quem não votou.</p>
      <p style="margin:0 0 12px">Para começar a receber, confirme:</p>
      ${primaryButton(data.confirmationUrl, 'Confirmar inscrição')}
      <p style="margin:16px 0 0;font-size:14px;color:#52606d">O link vale por ${data.expiresInHours} horas. Se não foi você, ignore este e-mail: sem confirmação, nada será enviado e o endereço é apagado automaticamente.</p>`,
    unsubscribeUrl: data.unsubscribeUrl,
    unsubscribeLabel: 'Não fui eu, remover meu e-mail',
    footerNote:
      'Você recebeu este e-mail porque alguém o cadastrou no nosso site.',
  });

  const text = [
    title,
    '',
    'Recebemos um pedido para enviar a este e-mail o resumo diário das leis votadas no Congresso Nacional.',
    '',
    `Confirmar inscrição: ${data.confirmationUrl}`,
    `O link vale por ${data.expiresInHours} horas. Se não foi você, ignore este e-mail.`,
    '',
    `Não fui eu, remover meu e-mail: ${data.unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: `${data.appName}: confirme sua inscrição`,
    html,
    text,
  };
}
