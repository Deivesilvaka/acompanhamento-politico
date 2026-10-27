import { escapeHtml } from '@src/shared/helpers/html-escape.helper';
import { EmailContent } from '@src/email/templates/template-data';
import { unsubscribeHeaders } from '@src/email/templates/unsubscribe-headers';

/**
 * Marcadores usados para renderizar o resumo UMA vez por edição. No envio,
 * só os links pessoais de cancelamento são trocados (custo O(1) por inscrito,
 * sem re-renderizar template). Não contêm caracteres que o escapeHtml altera.
 */
export const UNSUBSCRIBE_URL_PLACEHOLDER = '__UNSUBSCRIBE_URL__';
export const ONE_CLICK_URL_PLACEHOLDER = '__ONE_CLICK_UNSUBSCRIBE_URL__';

export function personalizeContent(
  content: Pick<EmailContent, 'subject' | 'html' | 'text'>,
  unsubscribeUrl: string,
  oneClickUnsubscribeUrl: string,
): EmailContent {
  return {
    subject: content.subject,
    html: content.html.replaceAll(
      UNSUBSCRIBE_URL_PLACEHOLDER,
      escapeHtml(unsubscribeUrl),
    ),
    text: content.text.replaceAll(UNSUBSCRIBE_URL_PLACEHOLDER, unsubscribeUrl),
    headers: unsubscribeHeaders(oneClickUnsubscribeUrl),
  };
}
