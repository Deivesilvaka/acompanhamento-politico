'use strict';

/** Utilitários compartilhados. Todo dado vindo da API é inserido via textContent (sem innerHTML). */
const App = (() => {
  const CHAMBER = { CAMARA: 'Câmara', SENADO: 'Senado' };
  const RESULT = {
    APPROVED: { label: 'Aprovada', cls: 'yes' },
    REJECTED: { label: 'Rejeitada', cls: 'no' },
    UNKNOWN: { label: 'Resultado não informado', cls: 'muted' },
  };
  const VOTE = {
    YES: 'A favor',
    NO: 'Contra',
    ABSTENTION: 'Abstenção',
    OBSTRUCTION: 'Obstrução',
    PRESIDING: 'Presidindo a sessão',
    SECRET: 'Votou (secreto)',
    PRESENT_NOT_VOTING: 'Presente, sem voto',
    JUSTIFIED_ABSENCE: 'Ausência justificada',
    ABSENT: 'Não votou',
    OTHER: 'Outro',
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      credentials: 'same-origin',
    });
    let data = null;
    try { data = await response.json(); } catch { /* corpo vazio */ }
    if (!response.ok) {
      const message = response.status === 429
        ? 'Muitas tentativas. Aguarde alguns minutos.'
        : (data && typeof data.message === 'string' ? data.message : 'Não foi possível concluir. Tente novamente.');
      throw new Error(message);
    }
    return data;
  }

  /** Cria elemento com texto seguro. */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'text') node.textContent = String(value);
      else if (key === 'class') node.className = value;
      else if (key === 'href') node.setAttribute('href', safeHref(value));
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  }

  /** Só links relativos ao site ou https (bloqueia javascript:, data: etc.). */
  function safeHref(value) {
    const url = new URL(String(value), window.location.origin);
    if (url.origin === window.location.origin) return url.pathname + url.search;
    return url.protocol === 'https:' ? url.href : '#';
  }

  const formatDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
  const param = (name) => new URLSearchParams(window.location.search).get(name);
  const clear = (node) => node.replaceChildren();

  function status(node, message, kind) {
    node.textContent = message;
    node.className = `status ${kind || ''}`;
  }

  function votingCard(voting) {
    const result = RESULT[voting.result] || RESULT.UNKNOWN;
    const c = voting.counts;
    return el('article', { class: 'card' }, [
      el('div', { class: 'eyebrow', text: `${CHAMBER[voting.chamber]} · ${formatDate(voting.date)}` }),
      el('h3', {}, el('a', { href: `/votacao?id=${encodeURIComponent(voting.id)}`, text: voting.propositionLabel })),
      el('p', { class: 'muted', text: voting.summary }),
      el('p', {}, [el('strong', { class: result.cls, text: `${result.label}: ` }), voting.description]),
      voting.isSecret
        ? el('p', { class: 'muted', text: 'Votação secreta: votos individuais não são divulgados.' })
        : el('div', { class: 'counts' }, [
            el('span', { class: 'yes', text: `A favor ${c.yes}` }),
            el('span', { class: 'no', text: `Contra ${c.no}` }),
            el('span', { text: `Abstenção ${c.abstention}` }),
            el('span', { class: 'absent', text: `Não votaram ${c.absent + c.justifiedAbsence}` }),
          ]),
    ]);
  }

  function pager(container, { page, total, limit }, onChange) {
    clear(container);
    const pages = Math.max(1, Math.ceil(total / limit));
    if (pages <= 1) return;
    const prev = el('button', { class: 'button-secondary', type: 'button', text: '← Anterior' });
    const next = el('button', { class: 'button-secondary', type: 'button', text: 'Próxima →' });
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
    prev.addEventListener('click', () => onChange(page - 1));
    next.addEventListener('click', () => onChange(page + 1));
    container.append(prev, el('span', { class: 'muted', text: `Página ${page} de ${pages}` }), next);
  }

  return { api, el, clear, status, param, formatDate, votingCard, pager, CHAMBER, RESULT, VOTE };
})();
