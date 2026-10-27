/**
 * RFC 2369 + RFC 8058: exibe o botão nativo "Cancelar inscrição" no Gmail,
 * Outlook, Apple Mail etc. Obrigatório para remetentes em massa (Gmail/Yahoo).
 */
export function unsubscribeHeaders(
  oneClickUrl: string,
): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
