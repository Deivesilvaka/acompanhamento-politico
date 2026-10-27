import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// Lê o valor original: a conversão implícita transformaria "false" em true.
const toBoolean = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}) => obj[key] === true || obj[key] === 'true';

export class EnvironmentVariables {
  @IsIn(['local', 'dev', 'hml', 'prd', 'test'])
  NODE_ENV: string;

  @IsOptional()
  @IsInt()
  APP_PORT?: number;

  @IsString()
  @IsNotEmpty()
  APP_NAME: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  PUBLIC_URL: string;

  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS: number;

  @IsString()
  @MinLength(32)
  UNSUBSCRIBE_TOKEN_SECRET: string;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @Transform(toBoolean)
  @IsBoolean()
  DB_SSL: boolean;

  @IsString()
  @IsNotEmpty()
  MAIL_HOST: string;

  @IsInt()
  MAIL_PORT: number;

  @Transform(toBoolean)
  @IsBoolean()
  MAIL_SECURE: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  MAIL_ALLOW_SELF_SIGNED: boolean;

  @IsString()
  MAIL_USER: string;

  @IsString()
  MAIL_PASSWORD: string;

  @IsInt()
  @Min(1)
  @Max(100)
  MAIL_MAX_PER_SECOND: number;

  @IsString()
  @IsNotEmpty()
  MAIL_SENDER_DEFAULT: string;

  @IsString()
  @IsNotEmpty()
  MAIL_SENDER_NAME_DEFAULT: string;

  @IsString()
  INGESTION_CRON: string;

  @IsString()
  DIGEST_CRON: string;

  @IsString()
  DIGEST_RETRY_CRON: string;

  @IsInt()
  @Min(1)
  @Max(30)
  INGESTION_LOOKBACK_DAYS: number;

  @IsIn(['live', 'mock', 'off'])
  AI_OBSERVATIONS_MODE: string;

  @IsInt()
  @Min(5)
  @Max(180)
  AI_TIMEOUT_SECONDS: number;

  @IsInt()
  @Min(0)
  @Max(900)
  AI_MAX_WAIT_SECONDS: number;

  @IsOptional()
  @IsString()
  GROQ_API_KEY?: string;

  @IsOptional()
  @IsString()
  GROQ_MODEL?: string;

  @IsOptional()
  @IsString()
  NVIDIA_API_KEY?: string;

  @IsOptional()
  @IsString()
  NVIDIA_MODEL?: string;
}

/**
 * Fail secure: a aplicação não sobe com configuração ausente ou insegura.
 */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    // Só os nomes das variáveis — nunca os valores, que podem conter segredos.
    const names = errors.map((error) => error.property).join(', ');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${names}`);
  }

  if (
    validated.AI_OBSERVATIONS_MODE === 'live' &&
    !validated.GROQ_API_KEY &&
    !validated.NVIDIA_API_KEY
  ) {
    throw new Error(
      'AI_OBSERVATIONS_MODE=live exige GROQ_API_KEY e/ou NVIDIA_API_KEY',
    );
  }

  if (validated.NODE_ENV === 'prd') {
    if (!validated.PUBLIC_URL.startsWith('https://')) {
      throw new Error('PUBLIC_URL deve usar https em produção');
    }
    if (validated.MAIL_ALLOW_SELF_SIGNED) {
      throw new Error('MAIL_ALLOW_SELF_SIGNED não é permitido em produção');
    }
  }

  return validated;
}
