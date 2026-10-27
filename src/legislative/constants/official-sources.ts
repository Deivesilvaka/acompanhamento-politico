/**
 * Fontes oficiais (dados abertos) — únicas origens de dados legislativos.
 * Hosts fixos: a API nunca segue URLs fora desta lista (proteção contra SSRF).
 */
export const CAMARA_API_BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';
export const SENADO_API_BASE_URL = 'https://legis.senado.leg.br/dadosabertos';

export const ALLOWED_API_HOSTS = [
  'dadosabertos.camara.leg.br',
  'legis.senado.leg.br',
] as const;

export const ALLOWED_PHOTO_HOSTS = [
  'www.camara.leg.br',
  'www.senado.leg.br',
] as const;

/** Órgão "Plenário" da Câmara na API de dados abertos. */
export const CAMARA_PLENARY_ID = 180;

/**
 * Tipos de proposição considerados "leis importantes":
 * projetos de lei, leis complementares, emendas constitucionais,
 * medidas provisórias e decretos legislativos.
 */
export const RELEVANT_PROPOSITION_TYPES = [
  'PL',
  'PLP',
  'PEC',
  'MPV',
  'PLV',
  'PDL',
] as const;

export const camaraPropositionUrl = (id: number) =>
  `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

export const senadoMatterUrl = (code: number) =>
  `https://www25.senado.leg.br/web/atividade/materias/-/materia/${code}`;

export const senadorPhotoUrl = (code: number) =>
  `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${code}.jpg`;
