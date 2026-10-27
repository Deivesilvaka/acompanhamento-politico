import { VoteTypeEnum } from '@src/legislative/constants/legislative.enums';
import {
  countVotes,
  mapCamaraVote,
  mapSenadoVote,
} from '@src/legislative/mappers/vote-type.mapper';

describe('vote-type.mapper', () => {
  it.each([
    ['Sim', VoteTypeEnum.YES],
    ['Não', VoteTypeEnum.NO],
    ['Abstenção', VoteTypeEnum.ABSTENTION],
    ['Obstrução', VoteTypeEnum.OBSTRUCTION],
    ['Artigo 17', VoteTypeEnum.PRESIDING],
    ['desconhecido', VoteTypeEnum.OTHER],
  ])('Câmara: %s', (raw, expected) => {
    expect(mapCamaraVote(raw)).toBe(expected);
  });

  it.each([
    ['Sim', VoteTypeEnum.YES],
    ['Não', VoteTypeEnum.NO],
    ['Votou', VoteTypeEnum.SECRET],
    ['P-NRV', VoteTypeEnum.PRESENT_NOT_VOTING],
    ['NCom', VoteTypeEnum.ABSENT],
    ['AP', VoteTypeEnum.JUSTIFIED_ABSENCE],
    ['MIS', VoteTypeEnum.JUSTIFIED_ABSENCE],
    ['LS', VoteTypeEnum.JUSTIFIED_ABSENCE],
    ['Presidente (art. 51 RISF)', VoteTypeEnum.PRESIDING],
  ])('Senado: %s', (raw, expected) => {
    expect(mapSenadoVote(raw)).toBe(expected);
  });

  it('conta votos por categoria', () => {
    expect(
      countVotes([
        VoteTypeEnum.YES,
        VoteTypeEnum.YES,
        VoteTypeEnum.NO,
        VoteTypeEnum.ABSENT,
        VoteTypeEnum.JUSTIFIED_ABSENCE,
        VoteTypeEnum.PRESIDING,
      ]),
    ).toEqual({
      yesCount: 2,
      noCount: 1,
      abstentionCount: 0,
      absentCount: 1,
      justifiedAbsenceCount: 1,
      otherCount: 1,
    });
  });
});
