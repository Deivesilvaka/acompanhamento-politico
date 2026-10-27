import 'reflect-metadata';
import { validateEnv } from '@src/config/env.validation';

const validEnv = {
  NODE_ENV: 'local',
  APP_NAME: 'Teste',
  PUBLIC_URL: 'http://localhost:3000',
  TRUST_PROXY_HOPS: '0',
  UNSUBSCRIBE_TOKEN_SECRET: 's'.repeat(40),
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'db',
  DB_SSL: 'false',
  MAIL_HOST: 'localhost',
  MAIL_PORT: '1025',
  MAIL_SECURE: 'false',
  MAIL_ALLOW_SELF_SIGNED: 'true',
  MAIL_USER: 'u',
  MAIL_PASSWORD: 'p',
  MAIL_MAX_PER_SECOND: '10',
  MAIL_SENDER_DEFAULT: 'no-reply@example.com',
  MAIL_SENDER_NAME_DEFAULT: 'Teste',
  INGESTION_CRON: '0 18,23 * * *',
  DIGEST_CRON: '0 5 * * *',
  DIGEST_RETRY_CRON: '*/15 5-17 * * *',
  INGESTION_LOOKBACK_DAYS: '3',
  AI_OBSERVATIONS_MODE: 'off',
  AI_TIMEOUT_SECONDS: '60',
  AI_MAX_WAIT_SECONDS: '300',
};

describe('validateEnv (fail secure)', () => {
  it('converte tipos corretamente ("false" continua false)', () => {
    const env = validateEnv(validEnv);
    expect(env.DB_SSL).toBe(false);
    expect(env.MAIL_SECURE).toBe(false);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it('recusa segredo curto', () => {
    expect(() =>
      validateEnv({ ...validEnv, UNSUBSCRIBE_TOKEN_SECRET: 'curto' }),
    ).toThrow(/UNSUBSCRIBE_TOKEN_SECRET/);
  });

  it('não expõe valores de segredos na mensagem de erro', () => {
    expect(() => validateEnv({ ...validEnv, DB_PASSWORD: '' })).toThrow(
      /^(?!.*s{40})/,
    );
  });

  it('em produção exige https e proíbe certificado autoassinado', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'prd' })).toThrow(
      /https/,
    );
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'prd',
        PUBLIC_URL: 'https://x.com.br',
      }),
    ).toThrow(/MAIL_ALLOW_SELF_SIGNED/);
  });
});

describe('validateEnv (IA)', () => {
  const base = {
    NODE_ENV: 'local',
    APP_NAME: 'T',
    PUBLIC_URL: 'http://localhost:3000',
    TRUST_PROXY_HOPS: '0',
    UNSUBSCRIBE_TOKEN_SECRET: 's'.repeat(40),
    DB_HOST: 'h',
    DB_PORT: '5432',
    DB_USERNAME: 'u',
    DB_PASSWORD: 'p',
    DB_NAME: 'd',
    DB_SSL: 'false',
    MAIL_HOST: 'h',
    MAIL_PORT: '1025',
    MAIL_SECURE: 'false',
    MAIL_ALLOW_SELF_SIGNED: 'true',
    MAIL_USER: 'u',
    MAIL_PASSWORD: 'p',
    MAIL_MAX_PER_SECOND: '10',
    MAIL_SENDER_DEFAULT: 'a@b.com',
    MAIL_SENDER_NAME_DEFAULT: 'T',
    INGESTION_CRON: '0 18 * * *',
    DIGEST_CRON: '0 5 * * *',
    DIGEST_RETRY_CRON: '*/15 5-17 * * *',
    INGESTION_LOOKBACK_DAYS: '1',
    AI_TIMEOUT_SECONDS: '60',
    AI_MAX_WAIT_SECONDS: '300',
  };

  it('modo live sem nenhuma chave não sobe (fail secure)', () => {
    expect(() =>
      validateEnv({ ...base, AI_OBSERVATIONS_MODE: 'live' }),
    ).toThrow(/GROQ_API_KEY/);
  });

  it('modo live com ao menos uma chave sobe; mock não exige chave', () => {
    expect(() =>
      validateEnv({ ...base, AI_OBSERVATIONS_MODE: 'live', GROQ_API_KEY: 'k' }),
    ).not.toThrow();
    expect(() =>
      validateEnv({ ...base, AI_OBSERVATIONS_MODE: 'mock' }),
    ).not.toThrow();
  });
});
