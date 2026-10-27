import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '@src/email/email.module';
import { SubscriberEntity } from '@src/subscriptions/entities/subscriber.entity';
import { SubscriptionsController } from '@src/subscriptions/controllers/subscriptions.controller';
import { SubscriptionsService } from '@src/subscriptions/services/subscriptions.service';
import { SubscriptionLinksService } from '@src/subscriptions/services/subscription-links.service';
import { SubscribersRepository } from '@src/subscriptions/repositories/subscribers.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriberEntity]), EmailModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionLinksService,
    SubscribersRepository,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionLinksService,
    SubscribersRepository,
  ],
})
export class SubscriptionsModule {}
