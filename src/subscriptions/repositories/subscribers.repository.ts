import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { SubscriberEntity } from '@src/subscriptions/entities/subscriber.entity';
import {
  SUBSCRIPTION_RULES,
  SubscriberStatusEnum,
} from '@src/subscriptions/constants/subscription.constants';

@Injectable()
export class SubscribersRepository {
  constructor(
    @InjectRepository(SubscriberEntity)
    private readonly repository: Repository<SubscriberEntity>,
  ) {}

  findByEmail(email: string) {
    return this.repository.findOne({ where: { email } });
  }

  findPendingByTokenHash(tokenHash: string, now: Date) {
    return this.repository.findOne({
      where: {
        confirmationTokenHash: tokenHash,
        status: SubscriberStatusEnum.PENDING,
        confirmationExpiresAt: MoreThan(now),
      },
    });
  }

  create(data: Partial<SubscriberEntity>) {
    return this.repository.save(this.repository.create(data));
  }

  save(subscriber: SubscriberEntity) {
    return this.repository.save(subscriber);
  }

  async deleteById(id: string) {
    await this.repository.delete({ id });
  }

  async deleteExpiredPending(now: Date): Promise<number> {
    const result = await this.repository.delete({
      status: SubscriberStatusEnum.PENDING,
      confirmationExpiresAt: LessThan(now),
    });
    return result.affected ?? 0;
  }

  /**
   * Próximo lote da "fila" de envio: confirmados que ainda não receberam a
   * edição e não esgotaram as tentativas. Paginação por id (keyset), barata
   * mesmo com muitos inscritos.
   */
  findBatchPendingEdition(
    editionId: string,
    afterId: string | null,
    size: number,
  ) {
    return this.repository
      .createQueryBuilder('s')
      .select(['s.id', 's.email'])
      .where('s.status = :status', { status: SubscriberStatusEnum.CONFIRMED })
      .andWhere(
        '(s.last_edition_id IS NULL OR s.last_edition_id <> :editionId)',
        { editionId },
      )
      .andWhere(
        'NOT (s.failed_edition_id IS NOT DISTINCT FROM :editionId AND s.failed_attempts >= :maxAttempts)',
        { maxAttempts: SUBSCRIPTION_RULES.MAX_DELIVERY_ATTEMPTS },
      )
      .andWhere(afterId ? 's.id > :afterId' : '1=1', { afterId })
      .orderBy('s.id', 'ASC')
      .take(size)
      .getMany();
  }

  /** Um UPDATE para vários inscritos entregues. */
  async markEditionSent(ids: string[], editionId: string) {
    if (ids.length === 0) return;
    await this.repository.update(
      { id: In(ids) },
      { lastEditionId: editionId, failedEditionId: null, failedAttempts: 0 },
    );
  }

  /** Falha permanente (ex.: caixa inexistente) esgota as tentativas de uma vez. */
  async markDeliveryFailed(id: string, editionId: string, permanent: boolean) {
    await this.repository
      .createQueryBuilder()
      .update(SubscriberEntity)
      .set({
        failedEditionId: editionId,
        failedAttempts: () =>
          permanent
            ? ':maxAttempts'
            : 'CASE WHEN failed_edition_id IS NOT DISTINCT FROM :editionId THEN failed_attempts + 1 ELSE 1 END',
      })
      .where('id = :id', { id })
      .setParameters({
        editionId,
        maxAttempts: SUBSCRIPTION_RULES.MAX_DELIVERY_ATTEMPTS,
      })
      .execute();
  }

  /** Inscritos que esgotaram as tentativas da edição (para o contador público). */
  countExhausted(editionId: string) {
    return this.repository.count({
      where: {
        failedEditionId: editionId,
        failedAttempts: MoreThanOrEqual(
          SUBSCRIPTION_RULES.MAX_DELIVERY_ATTEMPTS,
        ),
      },
    });
  }

  countConfirmed() {
    return this.repository.count({
      where: {
        status: SubscriberStatusEnum.CONFIRMED,
        confirmedAt: Not(IsNull()),
      },
    });
  }
}
