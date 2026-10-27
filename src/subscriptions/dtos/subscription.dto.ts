import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** 32 bytes em base64url, opcionalmente prefixado por `<uuid>.` (token assinado). */
const TOKEN_PATTERN = /^(?:[0-9a-f-]{36}\.)?[A-Za-z0-9_-]{43}$/i;

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'pessoa@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({
    allow_display_name: false,
    allow_ip_domain: false,
    require_tld: true,
  })
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Aceite da política de privacidade',
    example: true,
  })
  @Equals(true, { message: 'É preciso aceitar a política de privacidade' })
  acceptedTerms: boolean;
}

export class TokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  @Matches(TOKEN_PATTERN)
  token: string;
}

/** Corpo enviado pelos clientes de e-mail no one-click (RFC 8058). */
export class OneClickUnsubscribeBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  'List-Unsubscribe'?: string;
}
