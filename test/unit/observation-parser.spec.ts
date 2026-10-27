import {
  assertConsistentWithVotes,
  assertPartialVotingNotAsWhole,
  assertTimeNumbersFromData,
  InvalidObservationError,
  parseObservation,
  sanitizeText,
  sourceDomains,
  truncateAtSentence,
} from '@src/ai/services/observation-parser';

describe('parseObservation', () => {
  it('retorna null quando a IA não tem observação', () => {
    expect(parseObservation('SEM_OBSERVACAO')).toBeNull();
    expect(
      parseObservation('<think>pensando</think>\nSEM_OBSERVACAO'),
    ).toBeNull();
  });

  it('extrai texto e fontes https', () => {
    const result = parseObservation(
      'OBSERVACAO: A PEC reduz a jornada sem cortar salário, uma vitória para quem trabalha.\nFONTES: https://agenciabrasil.ebc.com.br/x http://inseguro.com/y https://www12.senado.leg.br/z',
    );
    expect(result?.text).toBe(
      'A PEC reduz a jornada sem cortar salário, uma vitória para quem trabalha.',
    );
    expect(result?.sources).toEqual([
      'https://agenciabrasil.ebc.com.br/x',
      'https://www12.senado.leg.br/z',
    ]);
  });

  it('corta FONTES mesmo quando vem na mesma linha do texto', () => {
    const result = parseObservation(
      'OBSERVACAO: A PEC reduz a jornada sem cortar salário, uma vitória para quem trabalha. FONTES: (votação 14/10) https://senado.leg.br/a',
    );
    expect(result?.text).toBe(
      'A PEC reduz a jornada sem cortar salário, uma vitória para quem trabalha.',
    );
    expect(result?.sources).toEqual(['https://senado.leg.br/a']);
  });

  it('remove marcadores de citação, links, HTML e markdown do texto (anti prompt injection)', () => {
    const result = parseObservation(
      'OBSERVACAO: **Atenção**: <script>alert(1)</script>clique em https://phishing.example/login para votar【1†L17-L19】 e veja www.golpe.com hoje mesmo.\nFONTES: nenhuma',
    );
    expect(result?.text).not.toMatch(/https?:|www\.|<|【|\*\*/);
    expect(result?.sources).toEqual([]);
  });

  it('formato inesperado ou texto vazio é erro (tenta o próximo provedor)', () => {
    expect(() => parseObservation('')).toThrow(InvalidObservationError);
    expect(() => parseObservation('Olá, tudo bem?')).toThrow(
      InvalidObservationError,
    );
    expect(() => parseObservation('OBSERVACAO: curto')).toThrow(
      InvalidObservationError,
    );
  });

  it('corta textos longos no fim de uma frase', () => {
    const long = `${'Frase completa sobre o projeto. '.repeat(30)}`;
    const result = truncateAtSentence(sanitizeText(long), 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('.')).toBe(true);
  });

  it('mostra só os domínios das fontes', () => {
    expect(
      sourceDomains([
        'https://www.camara.leg.br/a',
        'https://g1.globo.com/b',
        'https://www.camara.leg.br/c',
      ]),
    ).toEqual(['camara.leg.br', 'g1.globo.com']);
  });
});

describe('assertConsistentWithVotes', () => {
  const camara = [
    { party: 'PL', yes: 70, no: 11, notVoted: 5 },
    { party: 'NOVO', yes: 0, no: 4, notVoted: 0 },
    { party: 'MDB', yes: 40, no: 2, notVoted: 1 },
    { party: 'PT', yes: 65, no: 0, notVoted: 2 },
  ];

  it('rejeita "únicos contra" quando outros partidos também votaram contra', () => {
    expect(() =>
      assertConsistentWithVotes(
        'Novo e PL foram os únicos a votar contra a PEC. Ela foi aprovada.',
        camara,
      ),
    ).toThrow(InvalidObservationError);
  });

  it('aceita quando cita todos os partidos ou não fala em "únicos"', () => {
    expect(() =>
      assertConsistentWithVotes(
        'PL, NOVO e MDB foram os únicos a votar contra.',
        camara,
      ),
    ).not.toThrow();
    expect(() =>
      assertConsistentWithVotes(
        'O PL deu 11 dos 17 votos contra a PEC.',
        camara,
      ),
    ).not.toThrow();
  });

  it('"único voto contra" é válido quando só um partido votou contra', () => {
    expect(() =>
      assertConsistentWithVotes('O único que se opôs foi Mourão.', [
        { party: 'REPUBLICANOS', yes: 5, no: 1, notVoted: 0 },
        { party: 'PT', yes: 9, no: 0, notVoted: 0 },
      ]),
    ).not.toThrow();
  });
});

describe('assertPartialVotingNotAsWhole', () => {
  const voting = (description: string) => ({
    votings: [
      {
        description,
        result: 'Rejeitada',
        yes: 252,
        no: 176,
        abstention: 0,
        notVoted: 0,
        isSecret: false,
      },
    ],
  });
  const subemenda = voting(
    'Rejeitada a Subemenda Substitutiva ao Projeto de Lei Complementar nº 281, de 2019.',
  );

  it('recusa "o projeto foi rejeitado" quando só a subemenda foi', () => {
    expect(() =>
      assertPartialVotingNotAsWhole(
        'O PLP 281/2019 foi rejeitado com 252 votos a favor.',
        subemenda,
      ),
    ).toThrow(InvalidObservationError);
  });

  it('aceita quando nomeia a parte votada', () => {
    expect(() =>
      assertPartialVotingNotAsWhole(
        'A subemenda ao PLP 281/2019 foi rejeitada mesmo com 252 votos a favor.',
        subemenda,
      ),
    ).not.toThrow();
  });

  it('votação do texto principal não sofre restrição', () => {
    expect(() =>
      assertPartialVotingNotAsWhole(
        'A PEC foi aprovada com folga.',
        voting(
          'Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 221.',
        ),
      ),
    ).not.toThrow();
  });
});

describe('assertTimeNumbersFromData', () => {
  const senado = {
    summary:
      'Altera o art. 7º da Constituição Federal para reduzir a duração máxima semanal do trabalho e prever 2 (dois) dias de repouso semanal remunerado.',
    votings: [
      { description: 'Votação nominal da PEC 221/2019, em segundo turno.' },
    ],
  } as Parameters<typeof assertTimeNumbersFromData>[1];

  it('recusa número de dias que não está na ementa (por extenso ou algarismo)', () => {
    for (const text of [
      'A PEC garante a jornada de quatro dias sem corte de salário.',
      'A PEC garante a semana de 4 dias.',
    ]) {
      expect(() => assertTimeNumbersFromData(text, senado)).toThrow(
        InvalidObservationError,
      );
    }
  });

  it('aceita o que está na ementa, por extenso ou algarismo', () => {
    expect(() =>
      assertTimeNumbersFromData(
        'A PEC garante dois dias de repouso; são 2 dias de folga por semana.',
        senado,
      ),
    ).not.toThrow();
  });

  it('números sem unidade de tempo (placar) não são afetados', () => {
    expect(() =>
      assertTimeNumbersFromData('Aprovada por 75 a 1.', senado),
    ).not.toThrow();
  });
});
