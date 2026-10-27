import { Injectable, Logger } from '@nestjs/common';
import {
  CamaraClient,
  CamaraDeputy,
} from '@src/legislative/clients/camara.client';
import { SenadoClient } from '@src/legislative/clients/senado.client';
import {
  ALLOWED_PHOTO_HOSTS,
  camaraPropositionUrl,
  RELEVANT_PROPOSITION_TYPES,
  senadoMatterUrl,
  senadorPhotoUrl,
} from '@src/legislative/constants/official-sources';
import {
  ChamberEnum,
  VoteTypeEnum,
  VotingResultEnum,
} from '@src/legislative/constants/legislative.enums';
import {
  countVotes,
  mapCamaraVote,
  mapSenadoVote,
} from '@src/legislative/mappers/vote-type.mapper';
import {
  LegislativeWriteRepository,
  VoteData,
} from '@src/legislative/repositories/legislative-write.repository';

export interface IngestionOptions {
  /** Casas a consultar (padrão: Câmara e Senado). */
  chambers?: ChamberEnum[];
  /**
   * Para assim que houver N votações de lei (novas ou já salvas) por casa,
   * percorrendo das mais recentes para as mais antigas. Usado pelo seed.
   */
  limitPerChamber?: number;
}

export interface IngestionSummary {
  chamber: ChamberEnum;
  saved: number;
  /** Já estavam no banco (ex.: rodada das 23h após a das 18h). */
  alreadyStored: number;
  skipped: number;
  failed: number;
}

/** Pausa entre chamadas à Câmara para não sobrecarregar o serviço público. */
const CAMARA_REQUEST_INTERVAL_MS = 150;

const isRelevantType = (type: string) =>
  (RELEVANT_PROPOSITION_TYPES as readonly string[]).includes(type);

const toResult = (approved: boolean | null) =>
  approved === null
    ? VotingResultEnum.UNKNOWN
    : approved
      ? VotingResultEnum.APPROVED
      : VotingResultEnum.REJECTED;

/** Só guarda fotos https dos portais oficiais (a URL acaba no <img> do site). */
export function safePhotoUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const hosts: readonly string[] = ALLOWED_PHOTO_HOSTS;
    return url.protocol === 'https:' && hosts.includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly camaraClient: CamaraClient,
    private readonly senadoClient: SenadoClient,
    private readonly writeRepository: LegislativeWriteRepository,
  ) {}

  async ingestRange(
    from: string,
    to: string,
    options: IngestionOptions = {},
  ): Promise<IngestionSummary[]> {
    const { chambers = Object.values(ChamberEnum), limitPerChamber } = options;
    const summaries: IngestionSummary[] = [];
    // Uma fonte fora do ar não impede a ingestão da outra.
    for (const [chamber, ingest] of [
      [ChamberEnum.CAMARA, () => this.ingestCamara(from, to, limitPerChamber)],
      [ChamberEnum.SENADO, () => this.ingestSenado(from, to, limitPerChamber)],
    ] as const) {
      if (!chambers.includes(chamber)) continue;
      try {
        summaries.push(await ingest());
      } catch (error) {
        this.logger.error(
          `Falha ao ingerir ${chamber} (${from} a ${to}): ${(error as Error).message}`,
        );
        summaries.push({
          chamber,
          saved: 0,
          alreadyStored: 0,
          skipped: 0,
          failed: 1,
        });
      }
    }
    for (const summary of summaries) {
      this.logger.log(
        `${summary.chamber} ${from}..${to}: ${summary.saved} novas, ${summary.alreadyStored} já salvas, ${summary.skipped} ignoradas, ${summary.failed} falhas`,
      );
    }
    return summaries;
  }

  private async ingestCamara(
    from: string,
    to: string,
    limit?: number,
  ): Promise<IngestionSummary> {
    const summary: IngestionSummary = {
      chamber: ChamberEnum.CAMARA,
      saved: 0,
      alreadyStored: 0,
      skipped: 0,
      failed: 0,
    };
    const deputiesByDate = new Map<string, CamaraDeputy[]>();
    const listed = await this.camaraClient.listPlenaryVotings(from, to);
    const votings = limit ? [...listed].reverse() : listed;
    const stored = await this.writeRepository.findStoredExternalIds(
      ChamberEnum.CAMARA,
      votings.map((v) => v.id),
    );

    for (const voting of votings) {
      if (limit && summary.saved + summary.alreadyStored >= limit) break;
      // Economia: evita 2+ chamadas à Câmara e o upsert de 513 deputados por votação.
      if (stored.has(voting.id)) {
        summary.alreadyStored++;
        continue;
      }
      try {
        const votes = await this.camaraClient.getVotes(voting.id);
        await this.pause();
        // Votação simbólica: não há registro individual de voto.
        if (votes.length === 0) {
          summary.skipped++;
          continue;
        }

        const detail = await this.camaraClient.getVotingDetail(voting.id);
        await this.pause();
        const proposition = detail.propositions.find((p) =>
          isRelevantType(p.type),
        );
        if (!proposition) {
          summary.skipped++;
          continue;
        }

        if (!deputiesByDate.has(voting.date)) {
          deputiesByDate.set(
            voting.date,
            await this.camaraClient.listDeputiesInOffice(voting.date),
          );
        }
        const inOffice = deputiesByDate.get(voting.date) ?? [];

        const ids = await this.writeRepository.upsertParliamentarians(
          ChamberEnum.CAMARA,
          [...inOffice, ...votes.map((v) => v.deputy)].map((deputy) => ({
            chamber: ChamberEnum.CAMARA,
            externalId: deputy.id,
            name: deputy.name,
            party: deputy.party,
            state: deputy.state,
            photoUrl: safePhotoUrl(deputy.photoUrl),
          })),
        );

        const voterIds = new Set(votes.map((v) => v.deputy.id));
        const voteRows: VoteData[] = [
          ...votes.map(({ deputy, voteType }) => ({
            parliamentarianId: ids.get(deputy.id)!,
            type: mapCamaraVote(voteType),
            rawValue: voteType,
            partyAtVote: deputy.party,
            stateAtVote: deputy.state,
          })),
          // Em exercício na data, sem voto registrado. A API da Câmara não
          // informa justificativa (licença/missão) por votação.
          ...inOffice
            .filter((deputy) => !voterIds.has(deputy.id))
            .map((deputy) => ({
              parliamentarianId: ids.get(deputy.id)!,
              type: VoteTypeEnum.ABSENT,
              rawValue: null,
              partyAtVote: deputy.party,
              stateAtVote: deputy.state,
            })),
        ].filter((row) => row.parliamentarianId);

        await this.writeRepository.saveVoting(
          {
            chamber: ChamberEnum.CAMARA,
            externalId: voting.id,
            date: voting.date,
            registeredAt: voting.registeredAt
              ? new Date(`${voting.registeredAt}-03:00`)
              : null,
            propositionType: proposition.type,
            propositionLabel: `${proposition.type} ${proposition.number}/${proposition.year}`,
            summary: proposition.summary,
            description: voting.description,
            result: toResult(detail.approved),
            isSecret: false,
            sourceUrl: camaraPropositionUrl(proposition.id),
            ...countVotes(voteRows.map((row) => row.type)),
          },
          voteRows,
        );
        summary.saved++;
      } catch (error) {
        summary.failed++;
        this.logger.warn(
          `Votação da Câmara ${voting.id} não processada: ${(error as Error).message}`,
        );
      }
    }
    return summary;
  }

  private async ingestSenado(
    from: string,
    to: string,
    limit?: number,
  ): Promise<IngestionSummary> {
    const summary: IngestionSummary = {
      chamber: ChamberEnum.SENADO,
      saved: 0,
      alreadyStored: 0,
      skipped: 0,
      failed: 0,
    };
    const listed = await this.senadoClient.listVotings(from, to);
    const votings = limit
      ? [...listed].sort((a, b) => b.date.localeCompare(a.date))
      : listed;
    const stored = await this.writeRepository.findStoredExternalIds(
      ChamberEnum.SENADO,
      votings.map((v) => v.id),
    );

    for (const voting of votings) {
      if (limit && summary.saved + summary.alreadyStored >= limit) break;
      if (stored.has(voting.id)) {
        summary.alreadyStored++;
        continue;
      }
      if (
        !isRelevantType(voting.propositionType) ||
        voting.votes.length === 0
      ) {
        summary.skipped++;
        continue;
      }
      try {
        const ids = await this.writeRepository.upsertParliamentarians(
          ChamberEnum.SENADO,
          voting.votes.map((vote) => ({
            chamber: ChamberEnum.SENADO,
            externalId: vote.senatorCode,
            name: vote.name,
            party: vote.party,
            state: vote.state,
            photoUrl: senadorPhotoUrl(vote.senatorCode),
          })),
        );

        const voteRows: VoteData[] = voting.votes
          .map((vote) => ({
            parliamentarianId: ids.get(vote.senatorCode)!,
            type: mapSenadoVote(vote.voteCode),
            rawValue: vote.voteCode,
            partyAtVote: vote.party,
            stateAtVote: vote.state,
          }))
          .filter((row) => row.parliamentarianId);

        await this.writeRepository.saveVoting(
          {
            chamber: ChamberEnum.SENADO,
            externalId: voting.id,
            date: voting.date,
            registeredAt: null,
            propositionType: voting.propositionType,
            propositionLabel: voting.propositionLabel,
            summary: voting.summary,
            description: voting.description,
            result: toResult(voting.approved),
            isSecret: voting.isSecret,
            sourceUrl: voting.matterCode
              ? senadoMatterUrl(voting.matterCode)
              : 'https://www25.senado.leg.br/web/atividade/votacoes',
            ...countVotes(voteRows.map((row) => row.type)),
          },
          voteRows,
        );
        summary.saved++;
      } catch (error) {
        summary.failed++;
        this.logger.warn(
          `Votação do Senado ${voting.id} não processada: ${(error as Error).message}`,
        );
      }
    }
    return summary;
  }

  private pause() {
    return new Promise((resolve) =>
      setTimeout(resolve, CAMARA_REQUEST_INTERVAL_MS),
    );
  }
}
