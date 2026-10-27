import { DataSource } from 'typeorm';

export const ADVISORY_LOCKS = {
  INGESTION: 71_001,
  DIGEST: 71_002,
} as const;

/**
 * Garante execução única de jobs mesmo com várias réplicas da API
 * (evita e-mail duplicado para o inscrito). Retorna `null` se outro
 * processo já detém o lock.
 */
export async function withAdvisoryLock<T>(
  dataSource: DataSource,
  key: number,
  task: () => Promise<T>,
): Promise<T | null> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    const [{ locked }] = await runner.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [key],
    );
    if (!locked) return null;
    try {
      return await task();
    } finally {
      await runner.query('SELECT pg_advisory_unlock($1)', [key]);
    }
  } finally {
    await runner.release();
  }
}
