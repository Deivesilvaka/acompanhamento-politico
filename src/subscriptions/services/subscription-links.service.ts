import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createSignedToken,
  verifySignedToken,
} from '@src/shared/helpers/secure-token.helper';
import { TOKEN_PURPOSE_UNSUBSCRIBE } from '@src/subscriptions/constants/subscription.constants';

/** Monta os links públicos usados nos e-mails. Sempre a partir de PUBLIC_URL (nunca do Host da requisição). */
@Injectable()
export class SubscriptionLinksService {
  private readonly publicUrl: string;
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.publicUrl = configService
      .getOrThrow<string>('PUBLIC_URL')
      .replace(/\/+$/, '');
    this.secret = configService.getOrThrow<string>('UNSUBSCRIBE_TOKEN_SECRET');
  }

  siteUrl(path = '/'): string {
    return `${this.publicUrl}${path}`;
  }

  confirmationUrl(token: string): string {
    return `${this.publicUrl}/confirmar?token=${encodeURIComponent(token)}`;
  }

  unsubscribeUrl(subscriberId: string): string {
    return `${this.publicUrl}/cancelar?token=${encodeURIComponent(this.unsubscribeToken(subscriberId))}`;
  }

  oneClickUnsubscribeUrl(subscriberId: string): string {
    return `${this.publicUrl}/api/subscriptions/one-click-unsubscribe?token=${encodeURIComponent(this.unsubscribeToken(subscriberId))}`;
  }

  votingUrl(votingId: string): string {
    return `${this.publicUrl}/votacao?id=${encodeURIComponent(votingId)}`;
  }

  verifyUnsubscribeToken(token: string): string | null {
    return verifySignedToken(this.secret, TOKEN_PURPOSE_UNSUBSCRIBE, token);
  }

  private unsubscribeToken(subscriberId: string): string {
    return createSignedToken(
      this.secret,
      TOKEN_PURPOSE_UNSUBSCRIBE,
      subscriberId,
    );
  }
}
