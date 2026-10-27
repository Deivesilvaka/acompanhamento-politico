import {
  createSignedToken,
  generateSecureToken,
  hashToken,
  verifySignedToken,
} from '@src/shared/helpers/secure-token.helper';

describe('secure-token.helper', () => {
  const secret = 'x'.repeat(48);
  const id = '3f2b8c1e-9d4a-4b6e-8f1a-2c3d4e5f6a7b';

  it('gera tokens aleatórios de 256 bits em base64url', () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSecureToken()).not.toBe(token);
  });

  it('hash é determinístico e não revela o token', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toContain('abc');
  });

  it('valida token assinado', () => {
    const token = createSignedToken(secret, 'unsubscribe', id);
    expect(verifySignedToken(secret, 'unsubscribe', token)).toBe(id);
  });

  it.each([
    ['assinatura adulterada', (t: string) => `${t.slice(0, -1)}A`],
    [
      'id trocado',
      (t: string) => t.replace(id, '00000000-0000-4000-8000-000000000000'),
    ],
    ['segmentos extras', (t: string) => `${t}.extra`],
    ['sem assinatura', () => id],
  ])('rejeita %s', (_label, mutate) => {
    const token = createSignedToken(secret, 'unsubscribe', id);
    expect(verifySignedToken(secret, 'unsubscribe', mutate(token))).toBeNull();
  });

  it('rejeita token de outro propósito ou outro segredo', () => {
    const token = createSignedToken(secret, 'unsubscribe', id);
    expect(verifySignedToken(secret, 'confirm', token)).toBeNull();
    expect(verifySignedToken('y'.repeat(48), 'unsubscribe', token)).toBeNull();
  });
});
