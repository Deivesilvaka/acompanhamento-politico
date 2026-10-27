import { DailyDigestTemplate } from '@src/email/templates/daily-digest.template';
import { SubscriptionConfirmationTemplate } from '@src/email/templates/subscription-confirmation.template';
import { WelcomeTemplate } from '@src/email/templates/welcome.template';
import {
  ONE_CLICK_URL_PLACEHOLDER,
  personalizeContent,
  UNSUBSCRIBE_URL_PLACEHOLDER,
} from '@src/email/templates/personalization';

const base = {
  appName: 'Acompanhamento Político',
  unsubscribeUrl: 'https://site.example/cancelar?token=abc',
  oneClickUnsubscribeUrl: 'https://site.example/api/one-click?token=abc',
};

const digestData = {
  ...base,
  periodLabel: '14/10/2026',
  siteUrl: 'https://site.example/',
  hiddenGroups: 0,
  groups: [
    {
      chamberLabel: 'Senado Federal',
      propositionLabel: 'PEC 221/2019',
      dateLabel: '14/10/2026',
      summary: '<script>alert(1)</script> Reduz a jornada',
      hiddenVotings: 0,
      votings: [
        {
          description: 'Aprovada em 1º turno',
          result: 'APPROVED' as const,
          isSecret: false,
          yes: 75,
          no: 1,
          abstention: 0,
          notVoted: 2,
          url: 'https://site.example/votacao?id=1',
        },
      ],
    },
  ],
};

describe('templates de e-mail', () => {
  it.each([
    [
      'confirmação',
      SubscriptionConfirmationTemplate({
        ...base,
        confirmationUrl: 'https://site.example/confirmar?token=t',
        expiresInHours: 24,
      }),
      'Não fui eu, remover meu e-mail',
    ],
    [
      'boas-vindas',
      WelcomeTemplate({ ...base, siteUrl: 'https://site.example/' }),
      'Cancelar inscrição',
    ],
    ['resumo diário', DailyDigestTemplate(digestData), 'Cancelar inscrição'],
  ])(
    '%s tem botão de cancelamento visível no final, em HTML e texto',
    (_name, content, label) => {
      const buttonIndex = content.html.lastIndexOf(label);
      expect(buttonIndex).toBeGreaterThan(content.html.length * 0.7);
      expect(content.html).toContain(
        'href="https://site.example/cancelar?token=abc"',
      );
      expect(content.text).toContain(base.unsubscribeUrl);
    },
  );

  it('escapa dados vindos das fontes externas', () => {
    const { html } = DailyDigestTemplate(digestData);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('resumo e boas-vindas trazem cabeçalhos de one-click unsubscribe (RFC 8058)', () => {
    expect(DailyDigestTemplate(digestData).headers).toEqual({
      'List-Unsubscribe': `<${base.oneClickUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('renderiza uma vez e personaliza só o link de cada inscrito', () => {
    const shared = DailyDigestTemplate({
      ...digestData,
      unsubscribeUrl: UNSUBSCRIBE_URL_PLACEHOLDER,
      oneClickUnsubscribeUrl: ONE_CLICK_URL_PLACEHOLDER,
    });
    const personal = personalizeContent(
      shared,
      'https://site.example/cancelar?token=x&y',
      'https://site.example/one-click?token=x',
    );
    expect(personal.html).not.toContain(UNSUBSCRIBE_URL_PLACEHOLDER);
    expect(personal.html).toContain('cancelar?token=x&amp;y');
    expect(personal.text).toContain('cancelar?token=x&y');
    expect(personal.headers?.['List-Unsubscribe']).toBe(
      '<https://site.example/one-click?token=x>',
    );
    // O conteúdo compartilhado não é alterado (seguro reutilizar entre inscritos).
    expect(shared.html).toContain(UNSUBSCRIBE_URL_PLACEHOLDER);
  });

  it('mostra a observação da IA escapada, rotulada como opinião e sem links clicáveis', () => {
    const data = {
      ...digestData,
      groups: [
        {
          ...digestData.groups[0],
          observation: {
            text: 'Vitória da classe trabalhadora <b>histórica</b>.',
            sourceDomains: ['agenciabrasil.ebc.com.br'],
          },
        },
      ],
    };
    const { html, text } = DailyDigestTemplate(data);
    expect(html).toContain(
      'Vitória da classe trabalhadora &lt;b&gt;histórica&lt;/b&gt;.',
    );
    expect(html).toContain('Análise editorial gerada por IA');
    expect(html).toContain('Fontes consultadas: agenciabrasil.ebc.com.br');
    expect(html).not.toContain('href="https://agenciabrasil');
    expect(text).toContain('Observação: Vitória da classe trabalhadora');
  });

  it('observação automática (IAs fora) tem rótulo próprio, sem fingir ser IA', () => {
    const { html, text } = DailyDigestTemplate({
      ...digestData,
      groups: [
        {
          ...digestData.groups[0],
          observation: {
            text: 'Os 15 votos contra vieram de: PL (11), NOVO (4).',
            sourceDomains: [],
            automatic: true,
          },
        },
      ],
    });
    expect(html).toContain('Resumo automático dos votos oficiais');
    expect(html).not.toContain('Análise editorial gerada por IA');
    expect(text).toContain('Resumo automático dos votos oficiais');
  });

  it('sem observação, não renderiza o bloco', () => {
    expect(DailyDigestTemplate(digestData).html).not.toContain(
      'Análise editorial gerada por IA',
    );
  });
});
