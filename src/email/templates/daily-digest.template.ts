import { EMAIL_THEME as t } from '@src/email/constants/email-theme';
import {
  EmailContent,
  EmailLayoutData,
} from '@src/email/templates/template-data';
import {
  primaryButton,
  renderEmailLayout,
} from '@src/email/templates/layout.template';
import { unsubscribeHeaders } from '@src/email/templates/unsubscribe-headers';
import { escapeHtml } from '@src/shared/helpers/html-escape.helper';

export interface DigestVotingItem {
  description: string;
  result: 'APPROVED' | 'REJECTED' | 'UNKNOWN';
  isSecret: boolean;
  yes: number;
  no: number;
  abstention: number;
  /** Ausentes + ausências justificadas. */
  notVoted: number;
  url: string;
}

export interface DigestObservation {
  text: string;
  /** Só domínios (sem link): conteúdo vindo de IA não vira link clicável. */
  sourceDomains: string[];
  /** true = as IAs falharam e o texto foi montado em código com os votos oficiais. */
  automatic?: boolean;
}

export interface DigestPropositionGroup {
  observation?: DigestObservation;
  chamberLabel: string;
  propositionLabel: string;
  dateLabel: string;
  summary: string;
  votings: DigestVotingItem[];
  hiddenVotings: number;
}

export interface DailyDigestData extends EmailLayoutData {
  periodLabel: string;
  groups: DigestPropositionGroup[];
  hiddenGroups: number;
  siteUrl: string;
}

const RESULT_LABEL = {
  APPROVED: { text: 'Aprovada', color: t.approved },
  REJECTED: { text: 'Rejeitada', color: t.rejected },
  UNKNOWN: { text: 'Resultado não informado', color: t.muted },
} as const;

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

function renderVoting(voting: DigestVotingItem): string {
  const result = RESULT_LABEL[voting.result];
  const counts = voting.isSecret
    ? 'Votação secreta: os votos individuais não são divulgados.'
    : `<strong style="color:${t.approved}">A favor ${voting.yes}</strong> &nbsp;·&nbsp; <strong style="color:${t.rejected}">Contra ${voting.no}</strong> &nbsp;·&nbsp; Abstenção ${voting.abstention} &nbsp;·&nbsp; Não votaram ${voting.notVoted}`;

  return `
    <tr><td style="padding:12px 0 0">
      <p style="margin:0 0 4px;font-size:15px"><strong style="color:${result.color}">${result.text}:</strong> ${escapeHtml(truncate(voting.description, 220))}</p>
      <p style="margin:0 0 6px;font-size:15px">${counts}</p>
      <a href="${escapeHtml(voting.url)}" style="font-size:15px;font-weight:600;color:${t.primary}">Ver quem votou →</a>
    </td></tr>`;
}

const OBSERVATION_LABEL =
  'Análise editorial gerada por IA a partir dos dados oficiais e de notícias. É opinião, não dado oficial.';
const AUTOMATIC_OBSERVATION_LABEL =
  'Resumo automático dos votos oficiais por partido (a análise por IA não estava disponível nesta edição).';

const observationLabel = (observation: DigestObservation) =>
  observation.automatic ? AUTOMATIC_OBSERVATION_LABEL : OBSERVATION_LABEL;

function renderObservation(observation?: DigestObservation): string {
  if (!observation) return '';
  const sources = observation.sourceDomains.length
    ? `<p style="margin:6px 0 0;font-size:12px;color:${t.muted}">Fontes consultadas: ${escapeHtml(observation.sourceDomains.join(', '))}</p>`
    : '';
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0">
        <tr><td style="padding:12px 14px;background:#fff7ed;border-left:4px solid #c2410c;border-radius:6px">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#c2410c">Observação</p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:${t.text}">${escapeHtml(observation.text)}</p>
          ${sources}
          <p style="margin:6px 0 0;font-size:11px;color:${t.muted}">${observationLabel(observation)}</p>
        </td></tr>
      </table>`;
}

function renderGroup(group: DigestPropositionGroup): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid ${t.border};border-radius:10px">
    <tr><td style="padding:16px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${t.muted}">${escapeHtml(group.chamberLabel)} · ${escapeHtml(group.dateLabel)}</p>
      <p style="margin:0 0 6px;font-size:18px;font-weight:700">${escapeHtml(group.propositionLabel)}</p>
      <p style="margin:0;font-size:15px;color:${t.muted}">${escapeHtml(truncate(group.summary, 320))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${group.votings.map(renderVoting).join('')}
      </table>
      ${group.hiddenVotings > 0 ? `<p style="margin:10px 0 0;font-size:14px;color:${t.muted}">+ ${group.hiddenVotings} outra(s) votação(ões) desta proposta no site.</p>` : ''}
      ${renderObservation(group.observation)}
    </td></tr>
  </table>`;
}

export function DailyDigestTemplate(data: DailyDigestData): EmailContent {
  const votingCount = data.groups.reduce(
    (sum, g) => sum + g.votings.length + g.hiddenVotings,
    0,
  );
  const title = `Votações no Congresso — ${data.periodLabel}`;

  const html = renderEmailLayout({
    appName: data.appName,
    title,
    preheader: `${data.groups.length + data.hiddenGroups} proposta(s) votada(s). Veja o resultado e quem votou.`,
    contentHtml: `
      <p style="margin:0 0 20px">Estas foram as leis votadas no plenário com registro de voto de cada parlamentar.</p>
      ${data.groups.map(renderGroup).join('')}
      ${data.hiddenGroups > 0 ? `<p style="margin:0 0 12px">E mais ${data.hiddenGroups} proposta(s) no site.</p>` : ''}
      <p style="margin:8px 0 4px">Pesquise qualquer lei ou parlamentar e veja quem faltou às votações:</p>
      ${primaryButton(data.siteUrl, 'Abrir o site')}
      <p style="margin:16px 0 0;font-size:13px;color:${t.muted}">Fonte: Dados Abertos da Câmara dos Deputados e do Senado Federal. "Não votaram" inclui ausências justificadas (licença, missão oficial).</p>`,
    unsubscribeUrl: data.unsubscribeUrl,
    footerNote:
      'Você recebe este resumo porque se inscreveu no nosso site. Não gostou? Sem problema:',
  });

  const text = [
    title,
    '',
    ...data.groups.flatMap((group) => [
      `${group.chamberLabel} · ${group.dateLabel} — ${group.propositionLabel}`,
      truncate(group.summary, 320),
      ...group.votings.flatMap((v) => [
        `  ${RESULT_LABEL[v.result].text}: ${truncate(v.description, 220)}`,
        v.isSecret
          ? '  Votação secreta.'
          : `  A favor ${v.yes} · Contra ${v.no} · Abstenção ${v.abstention} · Não votaram ${v.notVoted}`,
        `  Ver quem votou: ${v.url}`,
      ]),
      ...(group.observation
        ? [
            `  Observação: ${group.observation.text}`,
            `  (${observationLabel(group.observation)})`,
          ]
        : []),
      '',
    ]),
    `Site: ${data.siteUrl}`,
    '',
    `Cancelar inscrição: ${data.unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: `${data.appName}: ${votingCount} votação(ões) no Congresso — ${data.periodLabel}`,
    html,
    text,
    headers: unsubscribeHeaders(data.oneClickUnsubscribeUrl),
  };
}
