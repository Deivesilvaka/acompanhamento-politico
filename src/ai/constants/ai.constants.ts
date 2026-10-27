/** Hosts permitidos para chamadas de IA (allowlist, mesma ideia das fontes oficiais). */
export const AI_ALLOWED_HOSTS = [
  'api.groq.com',
  'integrate.api.nvidia.com',
] as const;

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const NVIDIA_CHAT_URL =
  'https://integrate.api.nvidia.com/v1/chat/completions';

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
export const DEFAULT_NVIDIA_MODEL = 'deepseek-ai/deepseek-v4.1-flash';

/** Último recurso quando todas as IAs falham: texto montado em código com os votos oficiais. */
export const DATA_FALLBACK_PROVIDER = 'dados-oficiais';
export const DATA_FALLBACK_MODEL = 'votos-por-partido';

export enum AiObservationsModeEnum {
  /** Chama as IAs de verdade (Groq com busca na web; NVIDIA como reserva). */
  LIVE = 'live',
  /** Texto simulado, sem custo — para desenvolvimento local. */
  MOCK = 'mock',
  /** Resumo sai sem observações. */
  OFF = 'off',
}

/** Limites do texto publicado no e-mail. */
export const OBSERVATION_MAX_CHARS = 600;
export const OBSERVATION_MAX_SOURCES = 3;
