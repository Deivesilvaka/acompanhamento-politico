import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DataSource } from 'typeorm';
import { IngestionService } from '@src/legislative/services/ingestion.service';
import { DigestService } from '@src/newsletter/services/digest.service';
import { SubscriptionsService } from '@src/subscriptions/services/subscriptions.service';
import {
  ADVISORY_LOCKS,
  withAdvisoryLock,
} from '@src/shared/helpers/advisory-lock.helper';
import {
  addDays,
  SCHEDULER_TIME_ZONE,
  toBrasiliaDate,
} from '@src/shared/helpers/date.helper';

/**
 * Agenda diária (fuso de Brasília), sem infraestrutura extra — o Postgres é a fila:
 * 1. 18:00 e 23:00 ingestão das votações nas fontes oficiais (à noite, longe dos envios);
 * 2. 05:00 envio do resumo em lotes;
 * 3. a cada 15 min (5h–17h) retomada de envios com falha temporária;
 * 4. limpeza horária de inscrições não confirmadas.
 */
@Injectable()
export class JobsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly dataSource: DataSource,
    private readonly ingestionService: IngestionService,
    private readonly digestService: DigestService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  onApplicationBootstrap() {
    this.register(
      'ingestion',
      this.configService.getOrThrow('INGESTION_CRON'),
      () => this.runIngestion(),
    );
    this.register('digest', this.configService.getOrThrow('DIGEST_CRON'), () =>
      this.runDigest(),
    );
    this.register(
      'digest-retry',
      this.configService.getOrThrow('DIGEST_RETRY_CRON'),
      () => this.runDigest({ createIfMissing: false }),
    );
    this.register('purge-pending', '0 * * * *', () =>
      this.subscriptionsService.purgeExpiredPending(),
    );
  }

  async runIngestion() {
    const lookback = this.configService.getOrThrow<number>(
      'INGESTION_LOOKBACK_DAYS',
    );
    const today = toBrasiliaDate(new Date());
    const result = await withAdvisoryLock(
      this.dataSource,
      ADVISORY_LOCKS.INGESTION,
      () => this.ingestionService.ingestRange(addDays(today, -lookback), today),
    );
    if (result === null)
      this.logger.warn('Ingestão já em execução em outra instância');
  }

  async runDigest(options: { createIfMissing?: boolean } = {}) {
    const result = await withAdvisoryLock(
      this.dataSource,
      ADVISORY_LOCKS.DIGEST,
      () => this.digestService.sendPendingEdition(options).then(() => true),
    );
    if (result === null)
      this.logger.warn('Envio já em execução em outra instância');
  }

  private register(
    name: string,
    cronTime: string,
    task: () => Promise<unknown>,
  ) {
    const job = CronJob.from({
      cronTime,
      timeZone: SCHEDULER_TIME_ZONE,
      waitForCompletion: true,
      onTick: async () => {
        try {
          await task();
        } catch (error) {
          this.logger.error(`Job ${name} falhou`, (error as Error).stack);
        }
      },
    });
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
    this.logger.log(
      `Job ${name} agendado: "${cronTime}" (${SCHEDULER_TIME_ZONE})`,
    );
  }
}
