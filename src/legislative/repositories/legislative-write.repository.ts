import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ChamberEnum } from '@src/legislative/constants/legislative.enums';
import { ParliamentarianEntity } from '@src/legislative/entities/parliamentarian.entity';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import { VoteEntity } from '@src/legislative/entities/vote.entity';

export type ParliamentarianData = Pick<
  ParliamentarianEntity,
  'chamber' | 'externalId' | 'name' | 'party' | 'state' | 'photoUrl'
>;

/** Campos de votação vindos da ingestão — `editionId` nunca é sobrescrito. */
export type VotingData = Omit<
  VotingEntity,
  'id' | 'createdAt' | 'updatedAt' | 'editionId' | 'votes'
>;

export type VoteData = Pick<
  VoteEntity,
  'parliamentarianId' | 'type' | 'rawValue' | 'partyAtVote' | 'stateAtVote'
>;

const INSERT_CHUNK = 200;

@Injectable()
export class LegislativeWriteRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Upsert por (casa, id externo). Retorna mapa id externo -> id interno. */
  async upsertParliamentarians(
    chamber: ChamberEnum,
    data: ParliamentarianData[],
  ): Promise<Map<number, string>> {
    const repository = this.dataSource.getRepository(ParliamentarianEntity);
    const unique = [...new Map(data.map((p) => [p.externalId, p])).values()];

    for (let i = 0; i < unique.length; i += INSERT_CHUNK) {
      await repository.upsert(unique.slice(i, i + INSERT_CHUNK), {
        conflictPaths: ['chamber', 'externalId'],
      });
    }

    const saved = await repository.find({
      select: { id: true, externalId: true },
      where: { chamber, externalId: In(unique.map((p) => p.externalId)) },
    });
    return new Map(saved.map((p) => [p.externalId, p.id]));
  }

  /** Votações já salvas — voto nominal registrado não muda, então não precisam ser rebaixadas. */
  async findStoredExternalIds(
    chamber: ChamberEnum,
    externalIds: string[],
  ): Promise<Set<string>> {
    if (externalIds.length === 0) return new Set();
    const stored = await this.dataSource.getRepository(VotingEntity).find({
      select: { externalId: true },
      where: { chamber, externalId: In(externalIds) },
    });
    return new Set(stored.map((v) => v.externalId));
  }

  /** Salva a votação e substitui seus votos atomicamente (reprocessar é idempotente). */
  async saveVoting(voting: VotingData, votes: VoteData[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(VotingEntity)
        .upsert(voting, { conflictPaths: ['chamber', 'externalId'] });

      const { id: votingId } = await manager
        .getRepository(VotingEntity)
        .findOneOrFail({
          select: { id: true },
          where: { chamber: voting.chamber, externalId: voting.externalId },
        });

      const votesRepository = manager.getRepository(VoteEntity);
      await votesRepository.delete({ votingId });
      for (let i = 0; i < votes.length; i += INSERT_CHUNK) {
        await votesRepository.insert(
          votes
            .slice(i, i + INSERT_CHUNK)
            .map((vote) => ({ ...vote, votingId })),
        );
      }
    });
  }
}
