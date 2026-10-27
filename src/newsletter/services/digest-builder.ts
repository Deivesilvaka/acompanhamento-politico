import { ChamberEnum } from '@src/legislative/constants/legislative.enums';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import {
  DigestPropositionGroup,
  DigestVotingItem,
} from '@src/email/templates/daily-digest.template';
import { formatBrazilianDate } from '@src/shared/helpers/date.helper';

export const MAX_GROUPS_IN_EMAIL = 12;
export const MAX_VOTINGS_PER_GROUP = 3;

const CHAMBER_LABEL: Record<ChamberEnum, string> = {
  [ChamberEnum.CAMARA]: 'Câmara dos Deputados',
  [ChamberEnum.SENADO]: 'Senado Federal',
};

const TYPE_PRIORITY: Record<string, number> = {
  PEC: 0,
  MPV: 1,
  PLV: 1,
  PLP: 2,
  PL: 3,
  PDL: 4,
};

/**
 * Agrupa votações por proposta (uma lei costuma ter várias votações: texto
 * principal, destaques, redação final). Mantém o e-mail curto: as mais
 * relevantes primeiro, o resto vira link para o site.
 */
export function buildDigestGroups(
  votings: VotingEntity[],
  votingUrl: (id: string) => string,
): {
  groups: DigestPropositionGroup[];
  hiddenGroups: number;
  /** Votações de cada grupo exibido (mesma ordem de `groups`), principal primeiro. */
  votingsByGroup: VotingEntity[][];
} {
  const byProposition = new Map<string, VotingEntity[]>();
  for (const voting of votings) {
    const key = `${voting.chamber}:${voting.propositionLabel}`;
    byProposition.set(key, [...(byProposition.get(key) ?? []), voting]);
  }

  const allGroups = [...byProposition.values()]
    .map((items) => {
      // A votação com mais votos nominais costuma ser a do texto principal.
      const ordered = [...items].sort(
        (a, b) => b.yesCount + b.noCount - (a.yesCount + a.noCount),
      );
      const first = ordered[0];
      const dates = [...new Set(items.map((v) => v.date))].sort();

      return {
        priority: TYPE_PRIORITY[first.propositionType] ?? 9,
        ordered,
        group: {
          chamberLabel: CHAMBER_LABEL[first.chamber],
          propositionLabel: first.propositionLabel,
          dateLabel: dates.map(formatBrazilianDate).join(', '),
          summary: first.summary,
          votings: ordered
            .slice(0, MAX_VOTINGS_PER_GROUP)
            .map((v): DigestVotingItem => ({
              description: v.description,
              result: v.result,
              isSecret: v.isSecret,
              yes: v.yesCount,
              no: v.noCount,
              abstention: v.abstentionCount,
              notVoted: v.absentCount + v.justifiedAbsenceCount,
              url: votingUrl(v.id),
            })),
          hiddenVotings: Math.max(0, ordered.length - MAX_VOTINGS_PER_GROUP),
        },
      };
    })
    .sort((a, b) => a.priority - b.priority);

  const shown = allGroups.slice(0, MAX_GROUPS_IN_EMAIL);
  return {
    groups: shown.map(({ group }) => group),
    hiddenGroups: Math.max(0, allGroups.length - MAX_GROUPS_IN_EMAIL),
    votingsByGroup: shown.map(({ ordered }) => ordered),
  };
}

export function periodLabel(start: string, end: string): string {
  return start === end
    ? formatBrazilianDate(start)
    : `${formatBrazilianDate(start)} a ${formatBrazilianDate(end)}`;
}
