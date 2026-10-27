export enum SubscriberStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
}

export const SUBSCRIPTION_RULES = {
  CONFIRMATION_TTL_HOURS: 24,
  /** Intervalo mínimo entre e-mails de confirmação para o mesmo endereço (anti e-mail bombing). */
  RESEND_COOLDOWN_MINUTES: 10,
  /** Versão do texto de consentimento/política de privacidade aceito (LGPD art. 8º). */
  CONSENT_VERSION: '2026-10-27',
  /** Tentativas de entrega de uma mesma edição antes de desistir daquele inscrito. */
  MAX_DELIVERY_ATTEMPTS: 5,
} as const;

export const TOKEN_PURPOSE_UNSUBSCRIBE = 'unsubscribe';

/** Resposta idêntica para e-mail novo, pendente ou já inscrito: não revela quem está na base. */
export const GENERIC_SUBSCRIBE_MESSAGE =
  'Se o e-mail for válido, você receberá uma mensagem para confirmar a inscrição.';
