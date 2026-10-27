import {
  EmailContent,
  EmailLayoutData,
} from '@src/email/templates/template-data';
import {
  primaryButton,
  renderEmailLayout,
} from '@src/email/templates/layout.template';
import { unsubscribeHeaders } from '@src/email/templates/unsubscribe-headers';

export interface WelcomeData extends EmailLayoutData {
  siteUrl: string;
}

export function WelcomeTemplate(data: WelcomeData): EmailContent {
  const title = 'Inscrição confirmada!';
  const html = renderEmailLayout({
    appName: data.appName,
    title,
    preheader:
      'A partir de amanhã você recebe o resumo das votações do Congresso.',
    contentHtml: `
      <p style="margin:0 0 12px">Pronto! Sempre que a Câmara ou o Senado votarem leis importantes, você recebe pela manhã um resumo simples:</p>
      <ul style="margin:0 0 16px;padding-left:20px">
        <li>qual lei foi votada e do que ela trata;</li>
        <li>se foi aprovada ou rejeitada;</li>
        <li>quantos votaram a favor, contra e quantos não votaram.</li>
      </ul>
      <p style="margin:0 0 12px">Quer saber como votou cada deputado ou senador? Está tudo no site:</p>
      ${primaryButton(data.siteUrl, 'Visitar o site')}
      <p style="margin:16px 0 0;font-size:14px;color:#52606d">Os dados vêm direto das fontes oficiais: Dados Abertos da Câmara dos Deputados e do Senado Federal.</p>`,
    unsubscribeUrl: data.unsubscribeUrl,
    footerNote:
      'Você está recebendo este e-mail porque confirmou a inscrição no nosso site.',
  });

  const text = [
    title,
    '',
    'Sempre que a Câmara ou o Senado votarem leis importantes, você recebe um resumo pela manhã.',
    `Site: ${data.siteUrl}`,
    '',
    `Cancelar inscrição: ${data.unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: `${data.appName}: inscrição confirmada`,
    html,
    text,
    headers: unsubscribeHeaders(data.oneClickUnsubscribeUrl),
  };
}
