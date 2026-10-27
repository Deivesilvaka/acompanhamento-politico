import { VoteTypeEnum } from '@src/legislative/constants/legislative.enums';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const CAMARA_VOTES: Record<string, VoteTypeEnum> = {
  sim: VoteTypeEnum.YES,
  nao: VoteTypeEnum.NO,
  abstencao: VoteTypeEnum.ABSTENTION,
  obstrucao: VoteTypeEnum.OBSTRUCTION,
  'artigo 17': VoteTypeEnum.PRESIDING,
};

/** Códigos do Senado: https://legis.senado.leg.br/dadosabertos/docs (lista de votos). */
const SENADO_VOTES: Record<string, VoteTypeEnum> = {
  sim: VoteTypeEnum.YES,
  nao: VoteTypeEnum.NO,
  abstencao: VoteTypeEnum.ABSTENTION,
  'p-od': VoteTypeEnum.OBSTRUCTION,
  obstrucao: VoteTypeEnum.OBSTRUCTION,
  votou: VoteTypeEnum.SECRET,
  'p-nrv': VoteTypeEnum.PRESENT_NOT_VOTING,
  presente: VoteTypeEnum.PRESENT_NOT_VOTING,
  ncom: VoteTypeEnum.ABSENT,
  ap: VoteTypeEnum.JUSTIFIED_ABSENCE,
  ls: VoteTypeEnum.JUSTIFIED_ABSENCE,
  lp: VoteTypeEnum.JUSTIFIED_ABSENCE,
  lap: VoteTypeEnum.JUSTIFIED_ABSENCE,
  lg: VoteTypeEnum.JUSTIFIED_ABSENCE,
  la: VoteTypeEnum.JUSTIFIED_ABSENCE,
  mis: VoteTypeEnum.JUSTIFIED_ABSENCE,
  rep: VoteTypeEnum.JUSTIFIED_ABSENCE,
};

export function mapCamaraVote(raw: string): VoteTypeEnum {
  return CAMARA_VOTES[normalize(raw)] ?? VoteTypeEnum.OTHER;
}

export function mapSenadoVote(raw: string): VoteTypeEnum {
  const value = normalize(raw);
  if (value.startsWith('presidente')) return VoteTypeEnum.PRESIDING;
  return SENADO_VOTES[value] ?? VoteTypeEnum.OTHER;
}

export interface VoteCounts {
  yesCount: number;
  noCount: number;
  abstentionCount: number;
  absentCount: number;
  justifiedAbsenceCount: number;
  otherCount: number;
}

export function countVotes(types: VoteTypeEnum[]): VoteCounts {
  const counts: VoteCounts = {
    yesCount: 0,
    noCount: 0,
    abstentionCount: 0,
    absentCount: 0,
    justifiedAbsenceCount: 0,
    otherCount: 0,
  };
  for (const type of types) {
    switch (type) {
      case VoteTypeEnum.YES:
        counts.yesCount++;
        break;
      case VoteTypeEnum.NO:
        counts.noCount++;
        break;
      case VoteTypeEnum.ABSTENTION:
        counts.abstentionCount++;
        break;
      case VoteTypeEnum.ABSENT:
        counts.absentCount++;
        break;
      case VoteTypeEnum.JUSTIFIED_ABSENCE:
        counts.justifiedAbsenceCount++;
        break;
      default:
        counts.otherCount++;
    }
  }
  return counts;
}
