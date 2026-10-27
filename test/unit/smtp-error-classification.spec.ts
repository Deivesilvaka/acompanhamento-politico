import { classifySmtpError } from '@src/email/errors/email-delivery.error';

describe('classifySmtpError', () => {
  it.each([
    [{ command: 'RCPT TO', responseCode: 550 }, 'RECIPIENT_PERMANENT'],
    [{ command: 'RCPT TO', responseCode: 452 }, 'RECIPIENT_TRANSIENT'],
    // Falhas do servidor/remetente nunca podem "queimar" as tentativas dos inscritos.
    [{ command: 'AUTH PLAIN', responseCode: 535 }, 'SERVER'],
    [{ command: 'MAIL FROM', responseCode: 550 }, 'SERVER'],
    [{ command: 'DATA', responseCode: 554 }, 'SERVER'],
    [{ command: 'CONN', responseCode: 421 }, 'SERVER'],
    [{ command: 'CONN' }, 'SERVER'],
    [{}, 'SERVER'],
  ])(
    '%j -> %s',
    (error: { command?: string; responseCode?: number }, expected) => {
      expect(classifySmtpError(error)).toBe(expected);
    },
  );
});
