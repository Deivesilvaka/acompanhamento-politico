import { ChatProvider } from '@src/ai/providers/chat-provider';

/** Desenvolvimento local / seed: sem custo e sem chamada externa. */
export class MockProvider implements ChatProvider {
  readonly name = 'mock';
  readonly model = 'mock';
  readonly webSearch = false;

  async complete(_system: string, user: string): Promise<string> {
    const label = user.match(/"proposicao":"([^"]+)"/)?.[1] ?? 'esta proposta';
    return `OBSERVACAO: [Exemplo simulado] Aqui aparecerá a análise editorial sobre ${label}, com contexto da tramitação e contradições entre discurso e voto. Configure AI_OBSERVATIONS_MODE=live para gerar o texto real.\nFONTES: nenhuma`;
  }
}
