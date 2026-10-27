'use strict';
(() => {
  const { api, el, clear, pager, CHAMBER } = App;
  const form = document.getElementById('search-form');
  const list = document.getElementById('list');
  const pagerNode = document.getElementById('pager');
  const LIMIT = 30;

  async function load(page = 1) {
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (form.q.value.trim()) params.set('q', form.q.value.trim());
    if (form.chamber.value) params.set('chamber', form.chamber.value);
    if (form.state.value) params.set('state', form.state.value);
    clear(list);
    try {
      const data = await api(`/api/parliamentarians?${params}`);
      if (data.items.length === 0) list.append(el('p', { class: 'muted', text: 'Ninguém encontrado.' }));
      const rows = data.items.map((p) => el('tr', {}, [
        el('td', {}, el('a', { href: `/parlamentar?id=${encodeURIComponent(p.id)}`, text: p.name })),
        el('td', { text: CHAMBER[p.chamber] }),
        el('td', { text: p.party || '—' }),
        el('td', { text: p.state || '—' }),
      ]));
      if (rows.length) {
        list.append(el('div', { class: 'table-wrap' }, el('table', { class: 'table' }, [
          el('thead', {}, el('tr', {}, ['Nome', 'Casa', 'Partido', 'UF'].map((h) => el('th', { text: h })))),
          el('tbody', {}, rows),
        ])));
      }
      pager(pagerNode, { page, total: data.total, limit: LIMIT }, load);
    } catch (error) {
      list.append(el('p', { class: 'status error', text: error.message }));
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); load(1); });
  load();
})();
