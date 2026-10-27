import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Token aleatório de 256 bits, seguro para ir em URL. */
export function generateSecureToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens de alta entropia não precisam de bcrypt: SHA-256 basta e permite
 * busca indexada. Guardamos só o hash; um vazamento do banco não expõe links válidos.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(secret: string, purpose: string, subject: string): string {
  return createHmac('sha256', secret)
    .update(`${purpose}:${subject}`)
    .digest('base64url');
}

/**
 * Token assinado (HMAC) e sem estado, para links que precisam funcionar em
 * qualquer e-mail já enviado (ex.: cancelar inscrição). Formato: `<uuid>.<assinatura>`.
 */
export function createSignedToken(
  secret: string,
  purpose: string,
  subjectId: string,
): string {
  return `${subjectId}.${sign(secret, purpose, subjectId)}`;
}

/** Retorna o id assinado ou `null` se o token for inválido. Comparação em tempo constante. */
export function verifySignedToken(
  secret: string,
  purpose: string,
  token: string,
): string | null {
  const [subjectId, signature, ...rest] = token.split('.');
  if (rest.length > 0 || !subjectId || !signature) return null;
  if (!UUID_PATTERN.test(subjectId)) return null;

  const expected = Buffer.from(sign(secret, purpose, subjectId));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return null;

  return timingSafeEqual(expected, received) ? subjectId : null;
}
