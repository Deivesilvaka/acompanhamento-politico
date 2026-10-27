import {
  buildNoVoteFacts,
  buildObservationUserMessage,
  summarizePartyPositions,
} from '@src/ai/prompts/editorial-observation.prompt';

describe('summarizePartyPositions', () => {
  it('classifica pela maioria de 2/3 dos votos sim + não', () => {
    const positions = summarizePartyPositions([
      { party: 'PL', yes: 77, no: 3, notVoted: 10 },
      { party: 'PT', yes: 0, no: 61, notVoted: 6 },
      { party: 'UNIÃO', yes: 9, no: 30, notVoted: 20 },
      { party: 'PSD', yes: 31, no: 20, notVoted: 3 },
      { party: 'CIDADANIA', yes: 0, no: 0, notVoted: 4 },
    ]);
    expect(positions).toEqual({
      majorityYes: ['PL (77 a favor, 3 contra)'],
      majorityNo: ['PT (0 a favor, 61 contra)', 'UNIÃO (9 a favor, 30 contra)'],
      divided: ['PSD (31 a favor, 20 contra)'],
    });
  });

  it('envia à IA as posições já calculadas, não a tabela crua', () => {
    const message = buildObservationUserMessage(
      {
        chamberLabel: 'Câmara dos Deputados',
        propositionLabel: 'PLP 1/2026',
        dateLabel: '14/10/2026',
        summary: 'Ementa',
        votings: [],
        partyBreakdown: [{ party: 'PT', yes: 0, no: 61, notVoted: 6 }],
      },
      false,
    );
    expect(message).toContain('"maioria_contra":["PT (0 a favor, 61 contra)"]');
    expect(message).not.toContain('nao_votaram":6');
  });
});

describe('buildNoVoteFacts', () => {
  it('aponta o partido que mais votou contra mesmo sendo maioria a favor', () => {
    const facts = buildNoVoteFacts([
      { party: 'PL', yes: 70, no: 11, notVoted: 5 },
      { party: 'NOVO', yes: 0, no: 4, notVoted: 0 },
      { party: 'PT', yes: 65, no: 0, notVoted: 2 },
    ]);
    expect(facts).toEqual([
      'Os 15 votos contra vieram de: PL (11), NOVO (4).',
      'PL: 11 votos contra, mas a maioria do partido (70) votou a favor.',
      'NOVO: a maioria votou contra (4 contra, 0 a favor).',
    ]);
  });

  it('voto isolado não vira posição do partido', () => {
    const facts = buildNoVoteFacts([
      { party: 'REPUBLICANOS', yes: 3, no: 1, notVoted: 0 },
      { party: 'PT', yes: 9, no: 0, notVoted: 0 },
    ]);
    expect(facts[0]).toBe('O único voto contra veio de: REPUBLICANOS (1).');
    expect(facts[1]).toContain('não representa a posição do partido');
  });

  it('com poucos votos contra, cita os nomes vindos do banco', () => {
    const facts = buildNoVoteFacts(
      [{ party: 'REPUBLICANOS', yes: 5, no: 1, notVoted: 0 }],
      [{ name: 'Fulano de Tal', party: 'REPUBLICANOS' }],
    );
    expect(facts).toContain('Votou contra: Fulano de Tal (REPUBLICANOS).');
  });

  it('sem votos contra', () => {
    expect(
      buildNoVoteFacts([{ party: 'PT', yes: 9, no: 0, notVoted: 0 }]),
    ).toEqual(['Ninguém votou contra na votação principal.']);
  });
});
