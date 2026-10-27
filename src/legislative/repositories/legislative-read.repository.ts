import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { toContainsPattern } from '@src/shared/helpers/like-pattern.helper';
import {
  ChamberEnum,
  VoteTypeEnum,
} from '@src/legislative/constants/legislative.enums';
import { ParliamentarianEntity } from '@src/legislative/entities/parliamentarian.entity';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import { VoteEntity } from '@src/legislative/entities/vote.entity';
import {
  AbsenceRankingQueryDto,
  ListParliamentariansQueryDto,
  ListVotingsQueryDto,
  ParliamentarianVotesQueryDto,
} from '@src/legislative/dtos/legislative-query.dto';

export interface AbsenceRankingRow {
  id: string;
  name: string;
  party: string | null;
  state: string | null;
  chamber: ChamberEnum;
  photoUrl: string | null;
  absences: number;
  justifiedAbsences: number;
  totalVotings: number;
}

/** Todas as consultas usam parâmetros nomeados — nenhum input é concatenado no SQL. */
@Injectable()
export class LegislativeReadRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listVotings(query: ListVotingsQueryDto) {
    const qb = this.dataSource
      .getRepository(VotingEntity)
      .createQueryBuilder('v')
      .orderBy('v.date', 'DESC')
      .addOrderBy('v.registeredAt', 'DESC', 'NULLS LAST')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.chamber)
      qb.andWhere('v.chamber = :chamber', { chamber: query.chamber });
    if (query.from) qb.andWhere('v.date >= :from', { from: query.from });
    if (query.to) qb.andWhere('v.date <= :to', { to: query.to });
    if (query.q) {
      qb.andWhere(
        `(unaccent(v.proposition_label) ILIKE unaccent(:q)
          OR unaccent(v.summary) ILIKE unaccent(:q)
          OR unaccent(v.description) ILIKE unaccent(:q))`,
        { q: toContainsPattern(query.q) },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  findVotingsByEdition(editionId: string) {
    return this.dataSource.getRepository(VotingEntity).find({
      where: { editionId },
      order: { date: 'ASC', registeredAt: 'ASC' },
    });
  }

  /** Placar por partido de uma votação — dado oficial enviado à IA. */
  async partyBreakdown(votingId: string) {
    const rows: Record<string, string>[] = await this.dataSource
      .getRepository(VoteEntity)
      .createQueryBuilder('vote')
      .select(`COALESCE(vote.party_at_vote, 'Sem partido')`, 'party')
      .addSelect(`COUNT(*) FILTER (WHERE vote.type = :yes)`, 'yes')
      .addSelect(`COUNT(*) FILTER (WHERE vote.type = :no)`, 'no')
      .addSelect(
        `COUNT(*) FILTER (WHERE vote.type IN (:...absent))`,
        'notVoted',
      )
      .where('vote.votingId = :votingId', { votingId })
      .setParameters({
        yes: VoteTypeEnum.YES,
        no: VoteTypeEnum.NO,
        absent: [VoteTypeEnum.ABSENT, VoteTypeEnum.JUSTIFIED_ABSENCE],
      })
      .groupBy('party')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();
    return rows.map((row) => ({
      party: row.party,
      yes: Number(row.yes),
      no: Number(row.no),
      notVoted: Number(row.notVoted),
    }));
  }

  findVoting(id: string) {
    return this.dataSource
      .getRepository(VotingEntity)
      .findOne({ where: { id } });
  }

  findVotesOfVoting(votingId: string) {
    return this.dataSource
      .getRepository(VoteEntity)
      .createQueryBuilder('vote')
      .innerJoinAndSelect('vote.parliamentarian', 'p')
      .where('vote.votingId = :votingId', { votingId })
      .orderBy('p.name', 'ASC')
      .getMany();
  }

  async listParliamentarians(query: ListParliamentariansQueryDto) {
    const qb = this.dataSource
      .getRepository(ParliamentarianEntity)
      .createQueryBuilder('p')
      .orderBy('p.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.chamber)
      qb.andWhere('p.chamber = :chamber', { chamber: query.chamber });
    if (query.party)
      qb.andWhere('p.party ILIKE :party', { party: query.party });
    if (query.state) qb.andWhere('p.state = :state', { state: query.state });
    if (query.q) {
      qb.andWhere('unaccent(p.name) ILIKE unaccent(:q)', {
        q: toContainsPattern(query.q),
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** Quem votou "não" (nome e partido no dia), para citar nomes só a partir dos dados. */
  async noVoters(votingId: string, limit: number) {
    const rows: { name: string; party: string | null }[] = await this.dataSource
      .getRepository(VoteEntity)
      .createQueryBuilder('vote')
      .innerJoin('vote.parliamentarian', 'p')
      .select('p.name', 'name')
      .addSelect('vote.party_at_vote', 'party')
      .where('vote.votingId = :votingId', { votingId })
      .andWhere('vote.type = :no', { no: VoteTypeEnum.NO })
      .orderBy('p.name', 'ASC')
      .limit(limit)
      .getRawMany();
    return rows;
  }

  findParliamentarian(id: string) {
    return this.dataSource
      .getRepository(ParliamentarianEntity)
      .findOne({ where: { id } });
  }

  async countVotesByType(parliamentarianId: string) {
    const rows: { type: VoteTypeEnum; count: string }[] = await this.dataSource
      .getRepository(VoteEntity)
      .createQueryBuilder('vote')
      .select('vote.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('vote.parliamentarianId = :parliamentarianId', {
        parliamentarianId,
      })
      .groupBy('vote.type')
      .getRawMany();
    return rows.map((row) => ({ type: row.type, count: Number(row.count) }));
  }

  async listVotesOfParliamentarian(
    parliamentarianId: string,
    query: ParliamentarianVotesQueryDto,
  ) {
    const qb = this.dataSource
      .getRepository(VoteEntity)
      .createQueryBuilder('vote')
      .innerJoinAndSelect('vote.voting', 'v')
      .where('vote.parliamentarianId = :parliamentarianId', {
        parliamentarianId,
      })
      .orderBy('v.date', 'DESC')
      .addOrderBy('v.registeredAt', 'DESC', 'NULLS LAST')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.type) qb.andWhere('vote.type = :type', { type: query.type });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async absenceRanking(
    query: Required<Pick<AbsenceRankingQueryDto, 'from' | 'to' | 'limit'>> &
      Pick<AbsenceRankingQueryDto, 'chamber'>,
  ): Promise<AbsenceRankingRow[]> {
    const qb = this.dataSource
      .getRepository(VoteEntity)
      .createQueryBuilder('vote')
      .innerJoin('vote.voting', 'v')
      .innerJoin('vote.parliamentarian', 'p')
      .select([
        'p.id AS id',
        'p.name AS name',
        'p.party AS party',
        'p.state AS state',
        'p.chamber AS chamber',
        'p.photo_url AS "photoUrl"',
      ])
      .addSelect(`COUNT(*) FILTER (WHERE vote.type = :absent)`, 'absences')
      .addSelect(
        `COUNT(*) FILTER (WHERE vote.type = :justified)`,
        'justifiedAbsences',
      )
      .addSelect('COUNT(*)', 'totalVotings')
      .where('v.date BETWEEN :from AND :to', { from: query.from, to: query.to })
      .setParameters({
        absent: VoteTypeEnum.ABSENT,
        justified: VoteTypeEnum.JUSTIFIED_ABSENCE,
      })
      .groupBy('p.id')
      .having(`COUNT(*) FILTER (WHERE vote.type = :absent) > 0`)
      .orderBy('absences', 'DESC')
      .addOrderBy('p.name', 'ASC')
      .limit(query.limit);

    if (query.chamber)
      qb.andWhere('p.chamber = :chamber', { chamber: query.chamber });

    const rows: Record<string, string>[] = await qb.getRawMany();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      party: row.party,
      state: row.state,
      chamber: row.chamber as ChamberEnum,
      photoUrl: row.photoUrl,
      absences: Number(row.absences),
      justifiedAbsences: Number(row.justifiedAbsences),
      totalVotings: Number(row.totalVotings),
    }));
  }
}
