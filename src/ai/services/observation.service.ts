import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiObservationsModeEnum,
  DEFAULT_GROQ_MODEL,
  DEFAULT_NVIDIA_MODEL,
} from '@src/ai/constants/ai.constants';
import { ChatProvider } from '@src/ai/providers/chat-provider';
import { GroqProvider } from '@src/ai/providers/groq.provider';
import { NvidiaProvider } from '@src/ai/providers/nvidia.provider';
import { MockProvider } from '@src/ai/providers/mock.provider';
import { ObservationInput } from '@src/ai/prompts/editorial-observation.prompt';
import {
  GeneratedObservation,
  generateWithFallback,
  ProviderHealth,
} from '@src/ai/services/observation-fallback';

const splitModels = (value: string | undefined, fallback: string) =>
  (value || fallback)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

/**
 * Observação editorial por proposta. Ordem: Groq (com busca na web) →
 * NVIDIA (DeepSeek e demais modelos configurados). Falha de todas = sem
 * observação; o envio do resumo nunca depende da IA.
 */
@Injectable()
export class ObservationService {
  private readonly logger = new Logger(ObservationService.name);
  private readonly providers: ChatProvider[];
  readonly mode: AiObservationsModeEnum;

  constructor(config: ConfigService) {
    this.mode = config.getOrThrow<AiObservationsModeEnum>(
      'AI_OBSERVATIONS_MODE',
    );
    const timeoutMs = config.getOrThrow<number>('AI_TIMEOUT_SECONDS') * 1000;
    const maxWait = config.getOrThrow<number>('AI_MAX_WAIT_SECONDS');

    if (this.mode === AiObservationsModeEnum.MOCK) {
      this.providers = [new MockProvider()];
      return;
    }

    const groqKey = config.get<string>('GROQ_API_KEY');
    const nvidiaKey = config.get<string>('NVIDIA_API_KEY');
    this.providers = [
      ...(groqKey
        ? splitModels(config.get('GROQ_MODEL'), DEFAULT_GROQ_MODEL).map(
            (model) => new GroqProvider(groqKey, model, timeoutMs, maxWait),
          )
        : []),
      ...(nvidiaKey
        ? splitModels(config.get('NVIDIA_MODEL'), DEFAULT_NVIDIA_MODEL).map(
            (model) => new NvidiaProvider(nvidiaKey, model, timeoutMs, maxWait),
          )
        : []),
    ];
  }

  get enabled(): boolean {
    return (
      this.mode !== AiObservationsModeEnum.OFF && this.providers.length > 0
    );
  }

  /** Use o mesmo `health` para todas as propostas de uma edição. */
  async generate(
    input: ObservationInput,
    health: ProviderHealth = new Map(),
  ): Promise<GeneratedObservation | null> {
    if (!this.enabled) return null;
    return generateWithFallback(
      this.providers,
      input,
      (message) => this.logger.warn(message),
      health,
    );
  }
}
