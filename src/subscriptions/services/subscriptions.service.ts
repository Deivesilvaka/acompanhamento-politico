import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import { EmailService } from '@src/email/services/email.service';
import { EmailTemplateEnum } from '@src/email/enums/email-templates.enum';
import {
  generateSecureToken,
  hashToken,
} from '@src/shared/helpers/secure-token.helper';
import { SubscribersRepository } from '@src/subscriptions/repositories/subscribers.repository';
import { SubscriptionLinksService } from '@src/subscriptions/services/subscription-links.service';
import { SubscriberEntity } from '@src/subscriptions/entities/subscriber.entity';
import {
  GENERIC_SUBSCRIBE_MESSAGE,
  SUBSCRIPTION_RULES,
  SubscriberStatusEnum,
} from '@src/subscriptions/constants/subscription.constants';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly appName: string;

  constructor(
    private readonly subscribersRepository: SubscribersRepository,
    private readonly links: SubscriptionLinksService,
    private readonly emailService: EmailService,
    configService: ConfigService,
  ) {
    this.appName = configService.getOrThrow<string>('APP_NAME');
  }

  /**
   * Double opt-in. A resposta é sempre a mesma e o envio do e-mail não é
   * aguardado — nem o conteúdo nem o tempo de resposta revelam se o e-mail
   * já está cadastrado (anti-enumeração).
   */
  async subscribe(email: string): Promise<{ message: string }> {
    const now = new Date();
    const existing = await this.subscribersRepository.findByEmail(email);

    if (existing?.status === SubscriberStatusEnum.CONFIRMED) {
      return { message: GENERIC_SUBSCRIBE_MESSAGE };
    }

    const cooldownStart = new Date(
      now.getTime() - SUBSCRIPTION_RULES.RESEND_COOLDOWN_MINUTES * MINUTE_MS,
    );
    if (
      existing?.confirmationSentAt &&
      existing.confirmationSentAt > cooldownStart
    ) {
      return { message: GENERIC_SUBSCRIBE_MESSAGE };
    }

    const token = generateSecureToken();
    const tokenFields = {
      confirmationTokenHash: hashToken(token),
      confirmationExpiresAt: new Date(
        now.getTime() + SUBSCRIPTION_RULES.CONFIRMATION_TTL_HOURS * HOUR_MS,
      ),
      confirmationSentAt: now,
      consentVersion: SUBSCRIPTION_RULES.CONSENT_VERSION,
    };

    let subscriber: SubscriberEntity;
    try {
      subscriber = existing
        ? await this.subscribersRepository.save(
            Object.assign(existing, tokenFields),
          )
        : await this.subscribersRepository.create({
            email,
            status: SubscriberStatusEnum.PENDING,
            ...tokenFields,
          });
    } catch (error) {
      // Corrida entre duas requisições com o mesmo e-mail: a outra já cuidou do envio.
      if (error instanceof QueryFailedError) {
        return { message: GENERIC_SUBSCRIBE_MESSAGE };
      }
      throw error;
    }

    void this.emailService
      .sendTemplate(
        EmailTemplateEnum.SUBSCRIPTION_CONFIRMATION,
        subscriber.email,
        {
          appName: this.appName,
          confirmationUrl: this.links.confirmationUrl(token),
          expiresInHours: SUBSCRIPTION_RULES.CONFIRMATION_TTL_HOURS,
          unsubscribeUrl: this.links.unsubscribeUrl(subscriber.id),
          oneClickUnsubscribeUrl: this.links.oneClickUnsubscribeUrl(
            subscriber.id,
          ),
        },
      )
      .catch(() =>
        this.logger.warn(
          `Confirmação não enviada para inscrito ${subscriber.id}`,
        ),
      );

    return { message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  async confirm(token: string): Promise<{ message: string }> {
    const subscriber = await this.subscribersRepository.findPendingByTokenHash(
      hashToken(token),
      new Date(),
    );
    if (!subscriber) {
      throw new BadRequestException(
        'Link inválido ou expirado. Faça a inscrição novamente.',
      );
    }

    subscriber.status = SubscriberStatusEnum.CONFIRMED;
    subscriber.confirmedAt = new Date();
    // Token de uso único.
    subscriber.confirmationTokenHash = null;
    subscriber.confirmationExpiresAt = null;
    await this.subscribersRepository.save(subscriber);
    this.logger.log(`Inscrição confirmada: ${subscriber.id}`);

    void this.emailService
      .sendTemplate(EmailTemplateEnum.WELCOME, subscriber.email, {
        appName: this.appName,
        siteUrl: this.links.siteUrl(),
        unsubscribeUrl: this.links.unsubscribeUrl(subscriber.id),
        oneClickUnsubscribeUrl: this.links.oneClickUnsubscribeUrl(
          subscriber.id,
        ),
      })
      .catch(() =>
        this.logger.warn(
          `Boas-vindas não enviada para inscrito ${subscriber.id}`,
        ),
      );

    return { message: 'Inscrição confirmada! Você receberá o próximo resumo.' };
  }

  /**
   * Idempotente e sem enumeração: token válido apaga o inscrito; a resposta de
   * sucesso é a mesma se ele já tiver sido removido. Token adulterado = 400.
   */
  async unsubscribe(token: string): Promise<{ message: string }> {
    const subscriberId = this.links.verifyUnsubscribeToken(token);
    if (!subscriberId) {
      throw new BadRequestException('Link de cancelamento inválido.');
    }

    await this.subscribersRepository.deleteById(subscriberId);
    this.logger.log(`Inscrição cancelada: ${subscriberId}`);
    return {
      message: 'Inscrição cancelada. Seu e-mail foi apagado da nossa base.',
    };
  }

  async purgeExpiredPending(): Promise<void> {
    const removed = await this.subscribersRepository.deleteExpiredPending(
      new Date(),
    );
    if (removed > 0) {
      this.logger.log(
        `${removed} inscrição(ões) não confirmada(s) removida(s)`,
      );
    }
  }
}
