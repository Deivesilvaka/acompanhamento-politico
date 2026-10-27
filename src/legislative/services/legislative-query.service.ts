import { Injectable, NotFoundException } from '@nestjs/common';
import { LegislativeReadRepository } from '@src/legislative/repositories/legislative-read.repository';
import {
  AbsenceRankingQueryDto,
  ListParliamentariansQueryDto,
  ListVotingsQueryDto,
  ParliamentarianVotesQueryDto,
} from '@src/legislative/dtos/legislative-query.dto';
import {
  toParliamentarianResponse,
  toVoteOfParliamentarianResponse,
  toVoteOfVotingResponse,
  toVotingResponse,
} from '@src/legislative/mappers/legislative-response.mapper';
import { addDays, toBrasiliaDate } from '@src/shared/helpers/date.helper';

const MAX_RANKING_DAYS = 366;

@Injectable()
export class LegislativeQueryService {
  constructor(private readonly readRepository: LegislativeReadRepository) {}

  async listVotings(query: ListVotingsQueryDto) {
    const { items, total } = await this.readRepository.listVotings(query);
    return { items: items.map(toVotingResponse), total, page: query.page };
  }

  async getVoting(id: string) {
    const voting = await this.readRepository.findVoting(id);
    if (!voting) throw new NotFoundException('Votação não encontrada');

    const votes = await this.readRepository.findVotesOfVoting(id);
    return {
      ...toVotingResponse(voting),
      votes: votes.map(toVoteOfVotingResponse),
    };
  }

  async listParliamentarians(query: ListParliamentariansQueryDto) {
    const { items, total } =
      await this.readRepository.listParliamentarians(query);
    return {
      items: items.map(toParliamentarianResponse),
      total,
      page: query.page,
    };
  }

  async getParliamentarian(id: string) {
    const parliamentarian = await this.readRepository.findParliamentarian(id);
    if (!parliamentarian)
      throw new NotFoundException('Parlamentar não encontrado');

    return {
      ...toParliamentarianResponse(parliamentarian),
      stats: await this.readRepository.countVotesByType(id),
    };
  }

  async listVotesOfParliamentarian(
    id: string,
    query: ParliamentarianVotesQueryDto,
  ) {
    const { items, total } =
      await this.readRepository.listVotesOfParliamentarian(id, query);
    return {
      items: items.map(toVoteOfParliamentarianResponse),
      total,
      page: query.page,
    };
  }

  async absenceRanking(query: AbsenceRankingQueryDto) {
    const to = query.to ?? toBrasiliaDate(new Date());
    let from = query.from ?? addDays(to, -30);
    // Limita a janela para evitar consultas agregadas caras (DoS).
    if (from < addDays(to, -MAX_RANKING_DAYS))
      from = addDays(to, -MAX_RANKING_DAYS);

    const items = await this.readRepository.absenceRanking({
      chamber: query.chamber,
      from,
      to,
      limit: query.limit,
    });
    return { from, to, items };
  }
}
