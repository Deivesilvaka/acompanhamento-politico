/**
 * - RECIPIENT_PERMANENT: o servidor recusou o destinatário (RCPT TO 5xx, ex.: caixa inexistente).
 * - RECIPIENT_TRANSIENT: recusa temporária do destinatário (RCPT TO 4xx, ex.: caixa cheia).
 * - SERVER: problema do nosso lado ou do provedor (conexão, autenticação, TLS,
 *   remetente, conteúdo). Afeta todos os envios, então não é culpa do inscrito.
 */
export type EmailFailureKind =
  'RECIPIENT_PERMANENT' | 'RECIPIENT_TRANSIENT' | 'SERVER';

/** Erro interno dos jobs de envio — nunca é devolvido ao cliente HTTP. */
export class EmailDeliveryError extends Error {
  constructor(readonly kind: EmailFailureKind) {
    super(`Failed to send email (${kind})`);
  }
}

export function classifySmtpError(error: {
  command?: string;
  responseCode?: number;
}): EmailFailureKind {
  if (error.command?.startsWith('RCPT TO') && error.responseCode) {
    return error.responseCode >= 500
      ? 'RECIPIENT_PERMANENT'
      : 'RECIPIENT_TRANSIENT';
  }
  return 'SERVER';
}
