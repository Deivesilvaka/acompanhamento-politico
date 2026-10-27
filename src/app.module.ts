import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from '@src/app.controller';
import { dataSourceOptions } from '@src/config/dataSource';
import { validateEnv } from '@src/config/env.validation';
import { ThrottlerProvider } from '@src/shared/providers/throttler/throttler.provider';
import { LegislativeModule } from '@src/legislative/legislative.module';
import { SubscriptionsModule } from '@src/subscriptions/subscriptions.module';
import { NewsletterModule } from '@src/newsletter/newsletter.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        dataSourceOptions(configService),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    LegislativeModule,
    SubscriptionsModule,
    NewsletterModule,
  ],
  controllers: [AppController],
  providers: [ThrottlerProvider],
})
export class AppModule {}
