import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  EMAIL_SEND_CONCURRENCY,
  EmailService,
} from '@src/email/services/email.service';
import { EmailDeliveryError } from '@src/email/errors/email-delivery.error';
import {
  DailyDigestTemplate,
  DigestPropositionGroup,
} from '@src/email/templates/daily-digest.template';
import {
  ONE_CLICK_URL_PLACEHOLDER,
  personalizeContent,
  UNSUBSCRIBE_URL_PLACEHOLDER,
} from '@src/email/templates/personalization';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import { VotingResultEnum } from '@src/legislative/constants/legislative.enums';
import { LegislativeReadRepository } from '@src/legislative/repositories/legislative-read.repository';
import { EditionObservationEntity } from '@src/newsletter/entities/edition-observation.entity';
import { ObservationService } from '@src/ai/services/observation.service';
import { DATA_FALLBACK_PROVIDER } from '@src/ai/constants/ai.constants';
import { FEW_NO_VOTES } from '@src/ai/prompts/editorial-observation.prompt';
import { GeneratedObservation } from '@src/ai/services/observation-fallback';
import { sourceDomains } from '@src/ai/services/observation-parser';
import { NewsletterEditionEntity } from '@src/newsletter/entities/newsletter-edition.entity';
import { SubscribersRepository } from '@src/subscriptions/repositories/subscribers.repository';
import { SubscriptionLinksService } from '@src/subscriptions/services/subscription-links.service';
import {
  buildDigestGroups,
  periodLabel,
} from '@src/newsletter/services/digest-builder';

const BATCH_SIZE = 200;

const RESULT_LABEL: Record<VotingResultEnum, string> = {
  [VotingResultEnum.APPROVED]: 'Aprovada',
  [VotingResultEnum.REJECTED]: 'Rejeitada',
  [VotingResultEnum.UNKNOWN]: 'Resultado não informado',
};

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private readonly appName: string;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(NewsletterEditionEntity)
    private readonly editions: Repository<NewsletterEditionEntity>,
    private readonly subscribers: SubscribersRepository,
    private readonly links: SubscriptionLinksService,
    private readonly emailService: EmailService,
    private readonly observationService: ObservationService,
    private readonly legislativeRepository: LegislativeReadRepository,
    configService: ConfigService,
  ) {
    this.appName = configService.getOrThrow<string>('APP_NAME');
  }

  /**
   * Processa a fila de envio. Primeiro termina edições inacabadas (falhas
   * temporárias de execuções anteriores); depois, se `createIfMissing`, cria
   * e envia a edição do dia.
   */
  async sendPendingEdition({ createIfMissing = true } = {}): Promise<void> {
    const unfinishedId = await this.findUnfinishedEditionId();
    if (unfinishedId) {
      const completed = await this.deliverEdition(unfinishedId);
      if (!completed || !createIfMissing) return;
    }
    if (!createIfMissing) return;

    const editionId = await this.createEdition();
    if (!editionId) {
      this.logger.log('Nenhuma votação nova: nenhum e-mail enviado hoje.');
      return;
    }
    await this.deliverEdition(editionId);
  }

  /**
   * Uma passada pela fila (lotes de BATCH_SIZE, EMAIL_SEND_CONCURRENCY envios
   * simultâneos). Retorna `true` quando ninguém mais está pendente; se houve
   * falha temporária, a edição fica aberta e o job de retry continua depois.
   */
  private async deliverEdition(editionId: string): Promise<boolean> {
    const edition = await this.editions.findOneOrFail({
      where: { id: editionId },
      select: {
        id: true,
        subject: true,
        html: true,
        text: true,
        sentCount: true,
        startedAt: true,
        completedAt: true,
      },
    });
    edition.startedAt ??= new Date();

    let transientFailures = 0;
    let serverFailure = false;
    let afterId: string | null = null;
    for (;;) {
      const batch = await this.subscribers.findBatchPendingEdition(
        edition.id,
        afterId,
        BATCH_SIZE,
      );
      if (batch.length === 0) break;
      afterId = batch[batch.length - 1].id;

      for (let i = 0; i < batch.length; i += EMAIL_SEND_CONCURRENCY) {
        const chunk = batch.slice(i, i + EMAIL_SEND_CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map((subscriber) =>
            this.emailService.sendContent(
              subscriber.email,
              personalizeContent(
                edition,
                this.links.unsubscribeUrl(subscriber.id),
                this.links.oneClickUnsubscribeUrl(subscriber.id),
              ),
            ),
          ),
        );

        const delivered: string[] = [];
        for (const [index, result] of results.entries()) {
          const subscriber = chunk[index];
          if (result.status === 'fulfilled') {
            delivered.push(subscriber.id);
            continue;
          }
          const kind =
            result.reason instanceof EmailDeliveryError
              ? result.reason.kind
              : 'SERVER';
          if (kind === 'SERVER') {
            // Falha do provedor, não do inscrito: não consome tentativa dele.
            serverFailure = true;
            continue;
          }
          if (kind === 'RECIPIENT_TRANSIENT') transientFailures++;
          await this.subscribers.markDeliveryFailed(
            subscriber.id,
            edition.id,
            kind === 'RECIPIENT_PERMANENT',
          );
          this.logger.warn(
            `Resumo não enviado para inscrito ${subscriber.id} (${kind === 'RECIPIENT_PERMANENT' ? 'definitivo' : 'nova tentativa depois'})`,
          );
        }

        // Marca a cada lote pequeno: se o processo cair, no máximo
        // EMAIL_SEND_CONCURRENCY e-mails são reenviados na retomada.
        await this.subscribers.markEditionSent(delivered, edition.id);
        edition.sentCount += delivered.length;

        // Circuit breaker: provedor fora do ar ou credencial inválida. Continuar
        // só gastaria tempo/cota com timeouts; o job de retry tenta de novo depois.
        if (serverFailure) break;
      }
      await this.saveCounters(edition);
      if (serverFailure) break;
    }

    if (serverFailure) {
      this.logger.error(
        `Edição ${edition.id}: servidor de e-mail indisponível, envio pausado até o próximo retry`,
      );
    }
    const completed = transientFailures === 0 && !serverFailure;
    if (completed) edition.completedAt = new Date();
    await this.saveCounters(edition);
    this.logger.log(
      completed
        ? `Edição ${edition.id} concluída: ${edition.sentCount} enviados, ${edition.failedCount} sem entrega`
        : `Edição ${edition.id}: ${transientFailures} falha(s) temporária(s), nova tentativa no próximo ciclo`,
    );
    return completed;
  }

  private async saveCounters(edition: NewsletterEditionEntity) {
    edition.failedCount = await this.subscribers.countExhausted(edition.id);
    edition.recipientCount = edition.sentCount + edition.failedCount;
    await this.editions.update(edition.id, {
      recipientCount: edition.recipientCount,
      sentCount: edition.sentCount,
      failedCount: edition.failedCount,
      startedAt: edition.startedAt,
      completedAt: edition.completedAt ?? null,
    });
  }

  private async findUnfinishedEditionId(): Promise<string | null> {
    const edition = await this.editions.findOne({
      select: { id: true },
      where: { completedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return edition?.id ?? null;
  }

  /**
   * Cria a edição com todas as votações ainda não enviadas e renderiza o
   * e-mail UMA vez (com as observações da IA), já salvando o conteúdo para o
   * arquivo público. A IA roda fora da transação para não segurar o banco.
   */
  private async createEdition(): Promise<string | null> {
    const votings = await this.dataSource.getRepository(VotingEntity).find({
      where: { editionId: IsNull() },
      order: { date: 'ASC' },
    });
    if (votings.length === 0) return null;

    const periodStart = votings[0].date;
    const periodEnd = votings[votings.length - 1].date;
    const { groups, hiddenGroups, votingsByGroup } = buildDigestGroups(
      votings,
      (id) => this.links.votingUrl(id),
    );

    const observations = await this.generateObservations(
      groups,
      votingsByGroup,
    );
    observations.forEach((observation, index) => {
      if (observation) {
        groups[index].observation = {
          text: observation.text,
          sourceDomains: sourceDomains(observation.sources),
          automatic: observation.provider === DATA_FALLBACK_PROVIDER,
        };
      }
    });

    const content = DailyDigestTemplate({
      appName: this.appName,
      periodLabel: periodLabel(periodStart, periodEnd),
      groups,
      hiddenGroups,
      siteUrl: this.links.siteUrl(),
      unsubscribeUrl: UNSUBSCRIBE_URL_PLACEHOLDER,
      oneClickUnsubscribeUrl: ONE_CLICK_URL_PLACEHOLDER,
    });

    return this.dataSource.transaction(async (manager) => {
      const edition = await manager
        .getRepository(NewsletterEditionEntity)
        .save({
          periodStart,
          periodEnd,
          votingCount: votings.length,
          subject: content.subject.slice(0, 255),
          html: content.html,
          text: content.text,
          recipientCount: 0,
          sentCount: 0,
          failedCount: 0,
          startedAt: null,
          completedAt: null,
        });
      await manager
        .createQueryBuilder()
        .update(VotingEntity)
        .set({ editionId: edition.id })
        .where('id IN (:...ids)', { ids: votings.map((v) => v.id) })
        .andWhere('edition_id IS NULL')
        .execute();

      const rows = observations.flatMap((observation, index) =>
        observation
          ? [
              {
                editionId: edition.id,
                chamber: votingsByGroup[index][0].chamber,
                propositionLabel: votingsByGroup[index][0].propositionLabel,
                provider: observation.provider,
                model: observation.model,
                content: observation.text,
                sources: observation.sources,
              },
            ]
          : [],
      );
      if (rows.length > 0) {
        await manager.getRepository(EditionObservationEntity).insert(rows);
      }
      return edition.id;
    });
  }

  /**
   * Uma chamada de IA por proposta exibida (nunca por inscrito). Sequencial
   * para respeitar o limite dos planos gratuitos. Falha = sem observação.
   */
  private async generateObservations(
    groups: DigestPropositionGroup[],
    votingsByGroup: VotingEntity[][],
  ): Promise<(GeneratedObservation | null)[]> {
    if (!this.observationService.enabled) return groups.map(() => null);

    const results: (GeneratedObservation | null)[] = [];
    const providerHealth = new Map<string, number>();
    for (const [index, group] of groups.entries()) {
      const groupVotings = votingsByGroup[index];
      try {
        const partyBreakdown = await this.legislativeRepository.partyBreakdown(
          groupVotings[0].id,
        );
        const mainVoting = groupVotings[0];
        // Nomes só quando são poucos votos contra (o fato cabe numa frase).
        const noVoters =
          mainVoting.noCount > 0 && mainVoting.noCount <= FEW_NO_VOTES
            ? await this.legislativeRepository.noVoters(
                mainVoting.id,
                FEW_NO_VOTES,
              )
            : [];
        results.push(
          await this.observationService.generate(
            {
              chamberLabel: group.chamberLabel,
              propositionLabel: group.propositionLabel,
              dateLabel: group.dateLabel,
              summary: group.summary,
              votings: groupVotings.slice(0, 5).map((v) => ({
                description: v.description,
                result: RESULT_LABEL[v.result],
                yes: v.yesCount,
                no: v.noCount,
                abstention: v.abstentionCount,
                notVoted: v.absentCount + v.justifiedAbsenceCount,
                isSecret: v.isSecret,
              })),
              partyBreakdown,
              noVoters,
            },
            providerHealth,
          ),
        );
      } catch (error) {
        this.logger.warn(
          `Observação não gerada para ${group.propositionLabel}: ${(error as Error).message}`,
        );
        results.push(null);
      }
    }

    const generated = results.filter(Boolean).length;
    this.logger.log(
      `Observações por IA: ${generated} de ${groups.length} propostas`,
    );
    return results;
  }
}
