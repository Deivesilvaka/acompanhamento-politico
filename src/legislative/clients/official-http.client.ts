import { Injectable, Logger } from '@nestjs/common';
import { ALLOWED_API_HOSTS } from '@src/legislative/constants/official-sources';

const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const MAX_RESPONSE_BYTES = 30 * 1024 * 1024;
const USER_AGENT = 'acompanhamento-politico/0.1 (newsletter de dados abertos)';

export class OfficialSourceError extends Error {}

/**
 * Cliente HTTP único para as fontes oficiais. Defesas:
 * - só https e só hosts da allowlist (inclusive em links de paginação vindos da resposta);
 * - timeout por requisição, retry com backoff apenas para erros transitórios;
 * - limite de tamanho da resposta;
 * - sem redirecionamento automático para outros hosts.
 */
@Injectable()
export class OfficialHttpClient {
  private readonly logger = new Logger(OfficialHttpClient.name);

  assertAllowedUrl(rawUrl: string): URL {
    const url = new URL(rawUrl);
    const allowedHosts: readonly string[] = ALLOWED_API_HOSTS;
    if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) {
      throw new OfficialSourceError(`Host não permitido: ${url.hostname}`);
    }
    return url;
  }

  async getJson(rawUrl: string): Promise<unknown> {
    const url = this.assertAllowedUrl(rawUrl);

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request(url);
      } catch (error) {
        const retriable = !(error instanceof OfficialSourceError);
        if (!retriable || attempt >= MAX_RETRIES) throw error;
        const delay = 1000 * 2 ** attempt;
        this.logger.warn(
          `Falha ao consultar ${url.hostname}${url.pathname}, nova tentativa em ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async request(url: URL): Promise<unknown> {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status >= 500 || response.status === 429) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new OfficialSourceError(
        `HTTP ${response.status} em ${url.hostname}${url.pathname}`,
      );
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw new OfficialSourceError('Resposta excede o tamanho máximo');
    }

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_BYTES) {
      throw new OfficialSourceError('Resposta excede o tamanho máximo');
    }

    try {
      return JSON.parse(Buffer.from(body).toString('utf8'));
    } catch {
      throw new OfficialSourceError('Resposta não é JSON válido');
    }
  }
}
