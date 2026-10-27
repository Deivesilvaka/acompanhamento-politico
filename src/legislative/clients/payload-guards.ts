/**
 * Validação mínima dos payloads externos. Dados de API oficial continuam sendo
 * input não confiável: tipos são conferidos antes de chegar ao banco.
 */
export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, maxLength = 5000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export function asInteger(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isSafeInteger(parsed)
    ? parsed
    : null;
}

export function asIsoDate(value: unknown): string | null {
  const text = asString(value, 30);
  return text && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

export function asState(value: unknown): string | null {
  const text = asString(value, 2);
  return text && /^[A-Z]{2}$/.test(text) ? text : null;
}
