import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

const baseOptions = {
  type: 'postgres' as const,
  // gen_random_uuid() nativo do Postgres 13+ (UUID v4 criptograficamente aleatório).
  uuidExtension: 'pgcrypto' as const,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../shared/database/migrations/*.{ts,js}'],
  synchronize: false,
  migrationsTransactionMode: 'each' as const,
};

export const dataSourceOptions = (
  configService: ConfigService,
): DataSourceOptions => ({
  ...baseOptions,
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  ssl: configService.get<boolean>('DB_SSL')
    ? { rejectUnauthorized: true }
    : false,
  // Logar queries vazaria e-mails de inscritos nos logs (LGPD).
  logging: ['error', 'migration'],
});

ConfigModule.forRoot();

// Usado apenas pela CLI do TypeORM (migrations).
const dataSource = new DataSource({
  ...baseOptions,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

export default dataSource;
