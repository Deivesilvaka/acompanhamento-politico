'use strict';
(() => {
  const { api, el, clear, pager, formatDate } = App;
  const form = document.getElementById('filters');
  const list = document.getElementById('list');
  const pagerNode = document.getElementById('pager');
  const LIMIT = 20;

  const period = (e) => (e.periodStart === e.periodEnd ? formatDate(e.periodStart) : `${formatDate(e.periodStart)} a ${formatDate(e.periodEnd)}`);

  async function load(page = 1) {
    const params = new URLSearchParams({ page, limit: LIMIT });
    for (const field of ['q', 'chamber', 'from', 'to']) if (form[field].value.trim()) params.set(field, form[field].value.trim());
    clear(list);
    try {
      const data = await api(`/api/editions?${params}`);
      if (data.items.length === 0) list.append(el('p', { class: 'muted', text: 'Nenhum e-mail enviado com esses filtros.' }));
      data.items.forEach((edition) => list.append(el('article', { class: 'card' }, [
        el('div', { class: 'eyebrow', text: `Enviado em ${formatDate(edition.startedAt)} · votações de ${period(edition)}` }),
        el('h3', { text: edition.subject }),
        el('div', { class: 'counts' }, [
          el('span', { text: `${edition.votingCount} votação(ões)` }),
          el('span', { class: 'yes', text: `${edition.sentCount} entregues ao servidor de e-mail` }),
          edition.failedCount ? el('span', { class: 'no', text: `${edition.failedCount} falhas` }) : null,
          edition.completedAt ? null : el('span', { class: 'absent', text: 'envio em andamento' }),
        ]),
        el('p', {}, [
          el('a', { class: 'button', href: `/api/editions/${encodeURIComponent(edition.id)}/email`, target: '_blank', rel: 'noopener', text: 'Ver o e-mail enviado' }),
          ' ',
          el('a', { class: 'button button-secondary', href: `/edicao?id=${encodeURIComponent(edition.id)}`, text: 'Votações desta edição' }),
        ]),
      ])));
      pager(pagerNode, { page, total: data.total, limit: LIMIT }, load);
    } catch (error) {
      list.append(el('p', { class: 'status error', text: error.message }));
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); load(1); });
  load();
})();
