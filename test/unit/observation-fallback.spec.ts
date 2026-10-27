import { ChatProvider } from '@src/ai/providers/chat-provider';
import { generateWithFallback } from '@src/ai/services/observation-fallback';
import { ObservationInput } from '@src/ai/prompts/editorial-observation.prompt';

const input: ObservationInput = {
  chamberLabel: 'Senado Federal',
  propositionLabel: 'PEC 221/2019',
  dateLabel: '14/10/2026',
  summary: 'Reduz a jornada de trabalho.',
  votings: [],
  partyBreakdown: [],
};

const provider = (
  name: string,
  impl: () => Promise<string>,
  webSearch = false,
) => {
  const complete = jest.fn(impl);
  return {
    name,
    model: `${name}-model`,
    webSearch,
    complete,
  } as ChatProvider & {
    complete: jest.Mock;
  };
};

const OK =
  'OBSERVACAO: O fim da escala 6x1 é uma vitória histórica para a classe trabalhadora.\nFONTES: nenhuma';

describe('generateWithFallback', () => {
  it('usa o primeiro provedor quando ele responde', async () => {
    const groq = provider('groq', async () => OK, true);
    const nvidia = provider('nvidia', async () => OK);
    const result = await generateWithFallback([groq, nvidia], input);
    expect(result?.provider).toBe('groq');
    expect(nvidia.complete).not.toHaveBeenCalled();
  });

  it('cai para o segundo quando o primeiro falha (rede, limite, formato)', async () => {
    const groq = provider('groq', async () => {
      throw new Error('HTTP 429');
    });
    const nvidia = provider('nvidia', async () => OK);
    const logs: string[] = [];
    const result = await generateWithFallback([groq, nvidia], input, (m) =>
      logs.push(m),
    );
    expect(result?.provider).toBe('nvidia');
    expect(logs[0]).toContain('HTTP 429');
  });

  it('"sem observação" é resposta válida: não gasta chamada no próximo provedor', async () => {
    const groq = provider('groq', async () => 'SEM_OBSERVACAO');
    const nvidia = provider('nvidia', async () => OK);
    expect(await generateWithFallback([groq, nvidia], input)).toBeNull();
    expect(nvidia.complete).not.toHaveBeenCalled();
  });

  it('se todas as IAs falharem, monta a observação com os votos oficiais', async () => {
    const failing = () =>
      provider('x', async () => {
        throw new Error('HTTP 500');
      });
    const result = await generateWithFallback([failing(), failing()], {
      ...input,
      partyBreakdown: [
        { party: 'PL', yes: 70, no: 11, notVoted: 0 },
        { party: 'NOVO', yes: 0, no: 4, notVoted: 0 },
      ],
    });
    expect(result?.provider).toBe('dados-oficiais');
    expect(result?.text).toContain(
      'Os 15 votos contra vieram de: PL (11), NOVO (4).',
    );
  });

  it('sem IA e sem votos por partido (ex.: votação secreta), segue sem observação', async () => {
    const failing = provider('x', async () => {
      throw new Error('HTTP 500');
    });
    await expect(generateWithFallback([failing], input)).resolves.toBeNull();
  });

  it('modelo que deu timeout é pulado no resto da edição', async () => {
    const health = new Map<string, number>();
    const slow = provider('nvidia', async () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    });
    const backup = provider('backup', async () => OK);
    for (let i = 0; i < 3; i++) {
      await generateWithFallback([slow, backup], input, undefined, health);
    }
    expect(slow.complete).toHaveBeenCalledTimes(1);
    expect(backup.complete).toHaveBeenCalledTimes(3);
  });

  it('informa à IA se ela tem ou não busca na web', async () => {
    const groq = provider('groq', async () => OK, true);
    await generateWithFallback([groq], input);
    expect(groq.complete.mock.calls[0][1]).toContain('Pesquise na web');
    const nvidia = provider('nvidia', async () => OK, false);
    await generateWithFallback([nvidia], input);
    expect(nvidia.complete.mock.calls[0][1]).toContain('NÃO tem acesso à web');
  });
});

describe('circuit breaker por provedor', () => {
  it('depois de 2 falhas na mesma edição, o provedor é pulado', async () => {
    const health = new Map<string, number>();
    const deepseek = provider('nvidia', async () => {
      throw new Error('timeout');
    });
    const backup = provider('nvidia-backup', async () => OK);
    for (let i = 0; i < 4; i++) {
      await generateWithFallback([deepseek, backup], input, undefined, health);
    }
    expect(deepseek.complete).toHaveBeenCalledTimes(2);
    expect(backup.complete).toHaveBeenCalledTimes(4);
  });

  it('texto que contradiz o placar vai para o próximo provedor, sem abrir o circuito', async () => {
    const health = new Map<string, number>();
    const wrong = provider(
      'groq',
      async () =>
        'OBSERVACAO: NOVO foi o único partido a votar contra a PEC, uma vergonha para quem trabalha.\nFONTES: nenhuma',
    );
    const right = provider('nvidia', async () => OK);
    const result = await generateWithFallback(
      [wrong, right],
      {
        ...input,
        partyBreakdown: [
          { party: 'PL', yes: 70, no: 11, notVoted: 0 },
          { party: 'NOVO', yes: 0, no: 4, notVoted: 0 },
        ],
      },
      undefined,
      health,
    );
    expect(result?.provider).toBe('nvidia');
    expect(health.get('groq:groq-model')).toBeUndefined();
  });
});
