import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SubscriptionsService } from '@src/subscriptions/services/subscriptions.service';
import {
  CreateSubscriptionDto,
  OneClickUnsubscribeBodyDto,
  TokenDto,
} from '@src/subscriptions/dtos/subscription.dto';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

@ApiTags('Inscrições na newsletter')
@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: FIFTEEN_MINUTES } })
  @ApiOperation({ summary: 'Pede inscrição (envia e-mail de confirmação)' })
  @ApiAcceptedResponse({
    description: 'Resposta genérica, exista ou não o e-mail',
  })
  subscribe(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.subscribe(dto.email);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @ApiOperation({ summary: 'Confirma a inscrição (double opt-in)' })
  @ApiOkResponse()
  confirm(@Body() dto: TokenDto) {
    return this.subscriptionsService.confirm(dto.token);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @ApiOperation({ summary: 'Cancela a inscrição e apaga o e-mail' })
  @ApiOkResponse()
  unsubscribe(@Body() dto: TokenDto) {
    return this.subscriptionsService.unsubscribe(dto.token);
  }

  /** Chamado pelos próprios clientes de e-mail (Gmail, Outlook…) — RFC 8058. */
  @Post('one-click-unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @ApiOperation({
    summary: 'Cancelamento em um clique (List-Unsubscribe-Post)',
  })
  oneClickUnsubscribe(
    @Query() query: TokenDto,
    @Body() _body: OneClickUnsubscribeBodyDto,
  ) {
    return this.subscriptionsService.unsubscribe(query.token);
  }
}
