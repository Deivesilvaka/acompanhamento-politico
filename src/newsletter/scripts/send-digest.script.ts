/**
 * Envio manual da edição pendente (mesma rotina do cron, com o mesmo lock):
 *   npm run digest:send            (envio do dia + pendências)
 *   npm run digest:send -- --retry (só retoma pendências, como o job de 15 min)
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '@src/config/dataSource';
import { validateEnv } from '@src/config/env.validation';
import { EmailModule } from '@src/email/email.module';
import { SubscriptionsModule } from '@src/subscriptions/subscriptions.module';
import { NewsletterEditionEntity } from '@src/newsletter/entities/newsletter-edition.entity';
import { EditionObservationEntity } from '@src/newsletter/entities/edition-observation.entity';
import { AiModule } from '@src/ai/ai.module';
import { LegislativeModule } from '@src/legislative/legislative.module';
import { DigestService } from '@src/newsletter/services/digest.service';
import {
  ADVISORY_LOCKS,
  withAdvisoryLock,
} from '@src/shared/helpers/advisory-lock.helper';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) =>
        dataSourceOptions(configService),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      NewsletterEditionEntity,
      EditionObservationEntity,
    ]),
    AiModule,
    LegislativeModule,
    EmailModule,
    SubscriptionsModule,
  ],
  providers: [DigestService],
})
class SendDigestScriptModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(
    SendDigestScriptModule,
  );
  try {
    const result = await withAdvisoryLock(
      app.get(DataSource),
      ADVISORY_LOCKS.DIGEST,
      () =>
        app
          .get(DigestService)
          .sendPendingEdition({
            createIfMissing: !process.argv.includes('--retry'),
          })
          .then(() => true),
    );
    if (result === null)
      console.warn('Envio já em execução em outra instância');
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
