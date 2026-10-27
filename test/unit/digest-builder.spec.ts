import {
  buildDigestGroups,
  MAX_GROUPS_IN_EMAIL,
  periodLabel,
} from '@src/newsletter/services/digest-builder';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import {
  ChamberEnum,
  VotingResultEnum,
} from '@src/legislative/constants/legislative.enums';

const voting = (overrides: Partial<VotingEntity>): VotingEntity =>
  ({
    id: 'id',
    chamber: ChamberEnum.CAMARA,
    date: '2026-10-14',
    propositionType: 'PL',
    propositionLabel: 'PL 1/2026',
    summary: 'Ementa',
    description: 'Votação',
    result: VotingResultEnum.APPROVED,
    isSecret: false,
    yesCount: 10,
    noCount: 5,
    abstentionCount: 0,
    absentCount: 3,
    justifiedAbsenceCount: 1,
    ...overrides,
  }) as VotingEntity;

describe('buildDigestGroups', () => {
  it('agrupa por proposta, prioriza PEC e soma ausências', () => {
    const { groups } = buildDigestGroups(
      [
        voting({ id: 'a', propositionLabel: 'PL 1/2026' }),
        voting({ id: 'b', propositionLabel: 'PL 1/2026', yesCount: 300 }),
        voting({
          id: 'c',
          propositionLabel: 'PEC 2/2026',
          propositionType: 'PEC',
        }),
      ],
      (id) => `/votacao?id=${id}`,
    );
    expect(groups.map((g) => g.propositionLabel)).toEqual([
      'PEC 2/2026',
      'PL 1/2026',
    ]);
    expect(groups[1].votings[0].url).toBe('/votacao?id=b');
    expect(groups[1].votings[0].notVoted).toBe(4);
  });

  it('limita o tamanho do e-mail', () => {
    const many = Array.from({ length: MAX_GROUPS_IN_EMAIL + 3 }, (_, i) =>
      voting({ id: String(i), propositionLabel: `PL ${i}/2026` }),
    );
    const { groups, hiddenGroups } = buildDigestGroups(many, (id) => id);
    expect(groups).toHaveLength(MAX_GROUPS_IN_EMAIL);
    expect(hiddenGroups).toBe(3);
  });

  it('formata o período', () => {
    expect(periodLabel('2026-10-14', '2026-10-14')).toBe('14/10/2026');
    expect(periodLabel('2026-10-14', '2026-10-15')).toBe(
      '14/10/2026 a 15/10/2026',
    );
  });
});
