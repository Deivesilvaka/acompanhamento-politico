import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { NewsletterEditionEntity } from '@src/newsletter/entities/newsletter-edition.entity';
import { ListEditionsQueryDto } from '@src/newsletter/dtos/list-editions-query.dto';
import { LegislativeReadRepository } from '@src/legislative/repositories/legislative-read.repository';
import { toVotingResponse } from '@src/legislative/mappers/legislative-response.mapper';
import { SubscriptionLinksService } from '@src/subscriptions/services/subscription-links.service';
import { toContainsPattern } from '@src/shared/helpers/like-pattern.helper';
import { UNSUBSCRIBE_URL_PLACEHOLDER } from '@src/email/templates/personalization';

const toEditionResponse = (e: NewsletterEditionEntity) => ({
  id: e.id,
  periodStart: e.periodStart,
  periodEnd: e.periodEnd,
  subject: e.subject,
  votingCount: e.votingCount,
  recipientCount: e.recipientCount,
  sentCount: e.sentCount,
  failedCount: e.failedCount,
  startedAt: e.startedAt,
  completedAt: e.completedAt,
});

/** Arquivo público de tudo o que foi enviado aos inscritos. */
@Injectable()
export class EditionsArchiveService {
  constructor(
    @InjectRepository(NewsletterEditionEntity)
    private readonly editions: Repository<NewsletterEditionEntity>,
    private readonly legislativeRepository: LegislativeReadRepository,
    private readonly links: SubscriptionLinksService,
  ) {}

  async list(query: ListEditionsQueryDto) {
    const qb = this.editions
      .createQueryBuilder('e')
      .where('e.started_at IS NOT NULL')
      .orderBy('e.created_at', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.from) qb.andWhere('e.period_end >= :from', { from: query.from });
    if (query.to) qb.andWhere('e.period_start <= :to', { to: query.to });
    if (query.q) {
      qb.andWhere('unaccent(e.text) ILIKE unaccent(:q)', {
        q: toContainsPattern(query.q),
      });
    }
    if (query.chamber) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM votings v WHERE v.edition_id = e.id AND v.chamber = :chamber)',
        { chamber: query.chamber },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(toEditionResponse), total, page: query.page };
  }

  async get(id: string) {
    const edition = await this.editions.findOne({
      where: { id, startedAt: Not(IsNull()) },
    });
    if (!edition) throw new NotFoundException('Edição não encontrada');

    const votings = await this.legislativeRepository.findVotingsByEdition(id);
    return {
      ...toEditionResponse(edition),
      votings: votings.map(toVotingResponse),
    };
  }

  /** HTML exatamente como enviado; o link pessoal vira a página genérica de cancelamento. */
  async getEmailHtml(id: string): Promise<string> {
    const edition = await this.editions.findOne({
      select: { id: true, html: true },
      where: { id, startedAt: Not(IsNull()) },
    });
    if (!edition) throw new NotFoundException('Edição não encontrada');
    return edition.html.replaceAll(
      UNSUBSCRIBE_URL_PLACEHOLDER,
      this.links.siteUrl('/cancelar'),
    );
  }
}
