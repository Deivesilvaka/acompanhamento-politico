import { AI_ALLOWED_HOSTS } from '@src/ai/constants/ai.constants';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'acompanhamento-politico/0.1';

export class AiProviderError extends Error {}

/**
 * POST para APIs de IA compatíveis com OpenAI. Só hosts da allowlist, só https,
 * sem redirect, com timeout e limite de tamanho. A chave nunca é logada.
 */
export async function postChatCompletion(
  rawUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  maxWaitSeconds = 0,
): Promise<string> {
  try {
    return await requestOnce(rawUrl, apiKey, body, timeoutMs);
  } catch (error) {
    // Limite de tokens por minuto do plano gratuito: espera o que o provedor
    // pedir (até maxWaitSeconds) e tenta 1 vez. Mais barato que trocar de IA.
    if (
      error instanceof RateLimitError &&
      error.retryAfterSeconds <= maxWaitSeconds
    ) {
      await new Promise((r) => setTimeout(r, error.retryAfterSeconds * 1000));
      return requestOnce(rawUrl, apiKey, body, timeoutMs);
    }
    throw error;
  }
}

export class RateLimitError extends AiProviderError {
  constructor(readonly retryAfterSeconds: number) {
    super(`HTTP 429 (retry-after ${retryAfterSeconds}s)`);
  }
}

async function requestOnce(
  rawUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<string> {
  const url = new URL(rawUrl);
  const hosts: readonly string[] = AI_ALLOWED_HOSTS;
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname)) {
    throw new AiProviderError(`Host não permitido: ${url.hostname}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await response.arrayBuffer();
  if (raw.byteLength > MAX_RESPONSE_BYTES) {
    throw new AiProviderError('Resposta excede o tamanho máximo');
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new RateLimitError(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.ceil(retryAfter)
        : 60,
    );
  }
  if (!response.ok) {
    // Só o status: o corpo pode ecoar o prompt.
    throw new AiProviderError(`HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(raw).toString('utf8'));
  } catch {
    throw new AiProviderError('Resposta não é JSON');
  }

  const content = (
    payload as { choices?: { message?: { content?: unknown } }[] }
  ).choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new AiProviderError('Resposta sem conteúdo');
  }
  return content;
}
