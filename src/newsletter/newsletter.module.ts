import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '@src/email/email.module';
import { LegislativeModule } from '@src/legislative/legislative.module';
import { SubscriptionsModule } from '@src/subscriptions/subscriptions.module';
import { NewsletterEditionEntity } from '@src/newsletter/entities/newsletter-edition.entity';
import { EditionObservationEntity } from '@src/newsletter/entities/edition-observation.entity';
import { AiModule } from '@src/ai/ai.module';
import { DigestService } from '@src/newsletter/services/digest.service';
import { JobsScheduler } from '@src/newsletter/services/jobs.scheduler';
import { EditionsArchiveService } from '@src/newsletter/services/editions-archive.service';
import { EditionsController } from '@src/newsletter/controllers/editions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NewsletterEditionEntity,
      EditionObservationEntity,
    ]),
    AiModule,
    EmailModule,
    LegislativeModule,
    SubscriptionsModule,
  ],
  controllers: [EditionsController],
  providers: [DigestService, JobsScheduler, EditionsArchiveService],
})
export class NewsletterModule {}
