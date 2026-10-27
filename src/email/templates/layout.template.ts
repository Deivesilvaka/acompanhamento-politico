import { EMAIL_THEME as t } from '@src/email/constants/email-theme';
import { escapeHtml } from '@src/shared/helpers/html-escape.helper';

export interface EmailLayoutOptions {
  appName: string;
  title: string;
  /** Texto curto exibido na prévia da caixa de entrada. */
  preheader: string;
  /** HTML já escapado pelo template chamador. */
  contentHtml: string;
  unsubscribeUrl: string;
  unsubscribeLabel?: string;
  footerNote: string;
}

export function primaryButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0">
  <tr><td style="border-radius:8px;background:${t.primary}">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-family:${t.font};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/**
 * Layout base de todos os e-mails. O botão de cancelar inscrição fica SEMPRE
 * no final, grande e com contraste — sair deve ser tão fácil quanto entrar.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  const unsubscribeLabel = options.unsubscribeLabel ?? 'Cancelar inscrição';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${t.background}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.background}">
      <tr>
        <td align="center" style="padding:24px 12px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
            <tr>
              <td style="padding:0 4px 16px;font-family:${t.font};font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${t.primary}">
                ${escapeHtml(options.appName)}
              </td>
            </tr>
            <tr>
              <td style="background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:28px 24px;font-family:${t.font};font-size:16px;line-height:1.55;color:${t.text}">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${t.text}">${escapeHtml(options.title)}</h1>
                ${options.contentHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 12px 8px;font-family:${t.font};font-size:14px;line-height:1.5;color:${t.muted}">
                <p style="margin:0 0 16px">${escapeHtml(options.footerNote)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td style="border:2px solid ${t.danger};border-radius:8px;background:#ffffff">
                      <a href="${escapeHtml(options.unsubscribeUrl)}" style="display:inline-block;padding:12px 28px;font-family:${t.font};font-size:16px;font-weight:700;color:${t.danger};text-decoration:none">${escapeHtml(unsubscribeLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:12px 0 0;font-size:13px">Um clique e pronto. Seu e-mail é apagado da nossa base.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
