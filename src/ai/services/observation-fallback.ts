import { ChatProvider } from '@src/ai/providers/chat-provider';
import {
  DATA_FALLBACK_MODEL,
  DATA_FALLBACK_PROVIDER,
} from '@src/ai/constants/ai.constants';
import {
  buildNoVoteFacts,
  EDITORIAL_SYSTEM_PROMPT,
  buildObservationUserMessage,
  ObservationInput,
} from '@src/ai/prompts/editorial-observation.prompt';
import {
  assertConsistentWithVotes,
  assertPartialVotingNotAsWhole,
  assertTimeNumbersFromData,
  InvalidObservationError,
  parseObservation,
  ParsedObservation,
} from '@src/ai/services/observation-parser';

export interface GeneratedObservation extends ParsedObservation {
  provider: string;
  model: string;
}

export type ObservationLogger = (message: string) => void;

/** Falhas por provedor dentro de uma mesma edição (circuit breaker). */
export type ProviderHealth = Map<string, number>;
export const MAX_PROVIDER_FAILURES_PER_RUN = 2;

const providerKey = (p: ChatProvider) => `${p.name}:${p.model}`;

/**
 * Tenta cada provedor em ordem. Erro de rede/limite/formato → próximo.
 * "Sem observação" é resposta válida: não consulta o próximo (economia).
 * Se todos falharem, a observação é montada em código com os votos oficiais:
 * a proposta nunca fica sem observação por falha de IA, e o envio nunca trava.
 */
export async function generateWithFallback(
  providers: ChatProvider[],
  input: ObservationInput,
  log: ObservationLogger = () => undefined,
  health: ProviderHealth = new Map(),
): Promise<GeneratedObservation | null> {
  for (const provider of providers) {
    const key = providerKey(provider);
    // Provedor fora do ar não consome timeout em todas as propostas da edição.
    if ((health.get(key) ?? 0) >= MAX_PROVIDER_FAILURES_PER_RUN) continue;
    try {
      const raw = await provider.complete(
        EDITORIAL_SYSTEM_PROMPT,
        buildObservationUserMessage(input, provider.webSearch),
      );
      const parsed = parseObservation(raw);
      if (!parsed) {
        log(`${provider.name}: sem observação para ${input.propositionLabel}`);
        return null;
      }
      assertConsistentWithVotes(parsed.text, input.partyBreakdown);
      assertPartialVotingNotAsWhole(parsed.text, input);
      // Com web, o número pode vir de fonte consultada (ex.: "44 para 40 horas").
      if (!provider.webSearch) assertTimeNumbersFromData(parsed.text, input);
      return { ...parsed, provider: provider.name, model: provider.model };
    } catch (error) {
      // Texto incoerente é erro do conteúdo desta proposta, não do provedor:
      // não conta para o circuit breaker.
      if ((error as Error).name === 'TimeoutError') {
        // Modelo que não respondeu no prazo provavelmente está fora do ar:
        // pula no resto da edição em vez de gastar um timeout por proposta.
        health.set(key, MAX_PROVIDER_FAILURES_PER_RUN);
      } else if (!(error instanceof InvalidObservationError)) {
        health.set(key, (health.get(key) ?? 0) + 1);
      }
      log(
        `${provider.name} (${provider.model}) falhou em ${input.propositionLabel}: ${(error as Error).message}`,
      );
    }
  }
  return buildDataObservation(input);
}

/**
 * Observação sem IA: só fatos do placar oficial (quem votou contra, por
 * partido). Sem dados por partido (ex.: votação secreta), não há o que dizer.
 */
export function buildDataObservation(
  input: ObservationInput,
): GeneratedObservation | null {
  if (input.partyBreakdown.length === 0) return null;
  return {
    text: buildNoVoteFacts(input.partyBreakdown, input.noVoters).join(' '),
    sources: [],
    provider: DATA_FALLBACK_PROVIDER,
    model: DATA_FALLBACK_MODEL,
  };
}
