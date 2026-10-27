/**
 * Carga manual (backfill) sem expor endpoint administrativo:
 *   npm run ingest -- 2026-10-01 2026-10-26
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from '@src/config/dataSource';
import { validateEnv } from '@src/config/env.validation';
import { LegislativeModule } from '@src/legislative/legislative.module';
import { IngestionService } from '@src/legislative/services/ingestion.service';
import { addDays, toBrasiliaDate } from '@src/shared/helpers/date.helper';

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
class IngestScriptModule {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function run() {
  const today = toBrasiliaDate(new Date());
  const [from = addDays(today, -7), to = today] = process.argv.slice(2);
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
    throw new Error('Uso: npm run ingest -- AAAA-MM-DD AAAA-MM-DD');
  }

  const app = await NestFactory.createApplicationContext(IngestScriptModule);
  try {
    // A API da Câmara limita o intervalo de datas por consulta: processa em janelas de 30 dias.
    for (let start = from; start <= to; start = addDays(start, 31)) {
      const end = addDays(start, 30) < to ? addDays(start, 30) : to;
      await app.get(IngestionService).ingestRange(start, end);
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
