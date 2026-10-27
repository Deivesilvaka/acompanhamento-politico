/**
 * Seed local com DADOS REAIS das fontes oficiais (nada é inventado):
 *   npm run db:seed
 *
 * Busca as 2 votações de lei mais recentes de cada casa nos últimos 10 dias.
 * Se não houver (recesso, eleições), recua de 10 em 10 dias até encontrar,
 * limitado a 1 ano. Usa o mesmo pipeline da ingestão diária (allowlist,
 * validação, upsert idempotente) e o mesmo lock — pode rodar várias vezes.
 */
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '@src/config/dataSource';
import { validateEnv } from '@src/config/env.validation';
import { LegislativeModule } from '@src/legislative/legislative.module';
import { IngestionService } from '@src/legislative/services/ingestion.service';
import { ChamberEnum } from '@src/legislative/constants/legislative.enums';
import {
  ADVISORY_LOCKS,
  withAdvisoryLock,
} from '@src/shared/helpers/advisory-lock.helper';
import { addDays, toBrasiliaDate } from '@src/shared/helpers/date.helper';

const VOTINGS_PER_CHAMBER = 2;
const WINDOW_DAYS = 10;
const MAX_DAYS_BACK = 365;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) =>
        dataSourceOptions(configService),
      inject: [ConfigService],
    }),
    LegislativeModule,
  ],
})
class SeedModule {}

const logger = new Logger('Seed');

async function seed(ingestion: IngestionService) {
  const missing = new Map<ChamberEnum, number>(
    Object.values(ChamberEnum).map((chamber) => [chamber, VOTINGS_PER_CHAMBER]),
  );
  const today = toBrasiliaDate(new Date());

  for (
    let daysBack = 0;
    daysBack < MAX_DAYS_BACK && [...missing.values()].some((n) => n > 0);
    daysBack += WINDOW_DAYS
  ) {
    const to = addDays(today, -daysBack);
    const from = addDays(to, -(WINDOW_DAYS - 1));
    const chambers = [...missing].filter(([, n]) => n > 0).map(([c]) => c);

    for (const chamber of chambers) {
      const [summary] = await ingestion.ingestRange(from, to, {
        chambers: [chamber],
        limitPerChamber: missing.get(chamber),
      });
      const found = summary.saved + summary.alreadyStored;
      missing.set(chamber, Math.max(0, missing.get(chamber)! - found));
    }
  }

  for (const [chamber, n] of missing) {
    if (n > 0) {
      logger.warn(
        `${chamber}: faltaram ${n} votação(ões) no último ano (fonte fora do ar?)`,
      );
    }
  }
}

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    // Seed é para ambiente local/teste. Em produção os dados vêm dos jobs agendados.
    if (app.get(ConfigService).get('NODE_ENV') === 'prd') {
      throw new Error('db:seed não roda em produção (NODE_ENV=prd)');
    }

    const result = await withAdvisoryLock(
      app.get(DataSource),
      ADVISORY_LOCKS.INGESTION,
      () => seed(app.get(IngestionService)).then(() => true),
    );
    if (result === null) logger.warn('Ingestão já em execução; tente de novo');
    else logger.log('Seed concluído com dados reais das fontes oficiais.');
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
