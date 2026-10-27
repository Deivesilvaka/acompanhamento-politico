import {
  OBSERVATION_MAX_CHARS,
  OBSERVATION_MAX_SOURCES,
} from '@src/ai/constants/ai.constants';
import {
  NO_OBSERVATION_TOKEN,
  ObservationInput,
  partialVotingSubject,
} from '@src/ai/prompts/editorial-observation.prompt';

export interface ParsedObservation {
  text: string;
  /** URLs https consultadas pela IA (guardadas para auditoria). */
  sources: string[];
}

/** Resposta inválida/vazia — o chamador tenta o próximo provedor. */
export class InvalidObservationError extends Error {}

/**
 * A saída da IA é input NÃO confiável (a busca na web pode trazer prompt
 * injection). Daqui só sai texto puro, curto, sem links nem marcação.
 * Retorna `null` quando a IA decide que não há observação.
 */
export function parseObservation(raw: string): ParsedObservation | null {
  const content = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // raciocínio de modelos "thinking"
    .trim();

  if (!content) throw new InvalidObservationError('Resposta vazia');
  if (content.toUpperCase().includes(NO_OBSERVATION_TOKEN)) return null;

  const observationMatch = content.match(
    /OBSERVA[CÇ][AÃ]O:\s*([\s\S]*?)(?:\bFONTES:|$)/i,
  );
  if (!observationMatch) {
    throw new InvalidObservationError('Formato inesperado');
  }

  const text = truncateAtSentence(sanitizeText(observationMatch[1]));
  if (text.length < 40) throw new InvalidObservationError('Texto curto demais');

  const sourcesMatch = content.match(/FONTES:\s*([\s\S]*)$/i);
  return { text, sources: extractSources(sourcesMatch?.[1] ?? '') };
}

const SAYS_ONLY = /(?<!\p{L})[uú]nic[oa]s?(?!\p{L})/iu;
const SAYS_AGAINST = /(?<!\p{L})(contra|se op[oô]s|se opuseram)(?!\p{L})/iu;

/**
 * Checagem em código do erro mais comum dos modelos: dizer que um grupo foi
 * o "único" a votar contra quando outros partidos também votaram contra.
 * Texto que contradiz o placar oficial é descartado (tenta o próximo provedor).
 */
export function assertConsistentWithVotes(
  text: string,
  breakdown: ObservationInput['partyBreakdown'],
): void {
  const partiesWithNo = breakdown
    .filter(({ no }) => no > 0)
    .map(({ party }) => party);
  if (partiesWithNo.length < 2) return;

  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!SAYS_ONLY.test(sentence) || !SAYS_AGAINST.test(sentence)) continue;
    const named = partiesWithNo.filter((party) =>
      new RegExp(`(?<!\\p{L})${escapeRegex(party)}(?!\\p{L})`, 'iu').test(
        sentence,
      ),
    );
    if (named.length < partiesWithNo.length) {
      throw new InvalidObservationError(
        `Diz "únicos contra", mas ${partiesWithNo.length} partidos votaram contra`,
      );
    }
  }
}

const SAYS_DECIDED =
  /(?<!\p{L})(foi|foram|acabou|acabaram)\s+(aprovad|rejeitad)/iu;
const NAMES_PART =
  /(?<!\p{L})(subemenda|emenda|destaque|requerimento|prefer[eê]ncia|reda[cç][aã]o)(?!\p{L})/iu;

/**
 * Se a votação principal foi sobre uma parte (ex.: subemenda), recusa frase
 * que diz que a proposta "foi aprovada/rejeitada" sem nomear a parte.
 */
export function assertPartialVotingNotAsWhole(
  text: string,
  input: Pick<ObservationInput, 'votings'>,
): void {
  if (!partialVotingSubject(input)) return;
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (SAYS_DECIDED.test(sentence) && !NAMES_PART.test(sentence)) {
      throw new InvalidObservationError(
        'Trata votação de uma parte como se fosse do projeto inteiro',
      );
    }
  }
}

const NUMBER_WORDS: Record<string, number> = {
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
};
const TIME_UNIT = '(?:dias?|horas?|semanas?|m[eê]s|meses|anos?)';
const NUMBER_WITH_UNIT = new RegExp(
  `(?<!\\p{L})(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s+${TIME_UNIT}(?!\\p{L})`,
  'giu',
);

/**
 * Para modelos SEM web: número ligado a tempo ("quatro dias", "36 horas")
 * precisa estar na ementa ou na descrição oficial. O Nemotron inventou
 * "jornada de quatro dias" para uma PEC que prevê 2 dias de repouso.
 */
export function assertTimeNumbersFromData(
  text: string,
  input: Pick<ObservationInput, 'summary' | 'votings'>,
): void {
  const official = [input.summary, ...input.votings.map((v) => v.description)]
    .join(' ')
    .toLowerCase();
  const officialNumbers = new Set(
    [...official.matchAll(/\d+/g)].map(([n]) => Number(n)),
  );
  for (const [, raw] of text.matchAll(NUMBER_WITH_UNIT)) {
    const word = raw.toLowerCase();
    const value = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word];
    if (!officialNumbers.has(value) && !official.includes(word)) {
      throw new InvalidObservationError(
        `Número "${raw}" ligado a tempo não está nos dados oficiais`,
      );
    }
  }
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function sanitizeText(text: string): string {
  return text
    .replace(/【[^】]*】/g, '') // marcadores de citação do browser_search
    .replace(/\[\d+(?:†[^\]]*)?\]/g, '')
    .replace(/<[^>]*>/g, '') // qualquer tag HTML
    .replace(/https?:\/\/\S+/gi, '') // links nunca vão no corpo (anti-phishing)
    .replace(/www\.\S+/gi, '')
    .replace(/[*_`#>]+/g, '') // markdown
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, ' ') // controle / bidi
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

export function truncateAtSentence(
  text: string,
  max = OBSERVATION_MAX_CHARS,
): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastStop = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  return lastStop > max * 0.5
    ? slice.slice(0, lastStop + 1)
    : `${slice.slice(0, max - 1).trimEnd()}…`;
}

function extractSources(raw: string): string[] {
  const urls = raw.match(/https:\/\/[^\s<>"'【]+/gi) ?? [];
  const valid = urls
    .map((url) => url.replace(/[.,;)\]]+$/, ''))
    .filter((url) => {
      try {
        return new URL(url).protocol === 'https:';
      } catch {
        return false;
      }
    });
  return [...new Set(valid)].slice(0, OBSERVATION_MAX_SOURCES);
}

/** Só o domínio vai para o e-mail — sem link clicável vindo da IA. */
export function sourceDomains(sources: string[]): string[] {
  return [
    ...new Set(
      sources.map((s) => new URL(s).hostname.replace(/^www\d*\./, '')),
    ),
  ];
}
