'use strict';
(() => {
  const { api, el, clear, param, pager, formatDate, CHAMBER, VOTE } = App;
  const root = document.getElementById('content');
  const history = document.getElementById('history');
  const pagerNode = document.getElementById('pager');
  const filter = document.getElementById('type-filter');
  const id = param('id');
  const LIMIT = 20;
  const CLASS = { YES: 'yes', NO: 'no', ABSENT: 'absent' };

  function renderProfile(p) {
    document.title = `${p.name} · Acompanhamento Político`;
    const stats = Object.fromEntries(p.stats.map((s) => [s.type, s.count]));
    const total = p.stats.reduce((sum, s) => sum + s.count, 0);
    clear(root);
    root.append(
      el('div', { class: 'person' }, [
        p.photoUrl ? el('img', { src: p.photoUrl, alt: `Foto de ${p.name}`, loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
        el('div', {}, [
          el('div', { class: 'eyebrow', text: CHAMBER[p.chamber] }),
          el('h1', { text: p.name }),
          el('p', { class: 'muted', text: `${p.party || '—'} · ${p.state || '—'}` }),
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('p', { text: `Votações nominais acompanhadas: ${total}` }),
        el('div', { class: 'counts' }, [
          el('span', { class: 'yes', text: `A favor ${stats.YES || 0}` }),
          el('span', { class: 'no', text: `Contra ${stats.NO || 0}` }),
          el('span', { text: `Abstenção ${stats.ABSTENTION || 0}` }),
          el('span', { class: 'absent', text: `Não votou ${stats.ABSENT || 0}` }),
          el('span', { class: 'muted', text: `Ausência justificada ${stats.JUSTIFIED_ABSENCE || 0}` }),
        ]),
      ]),
    );
  }

  async function loadHistory(page = 1) {
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (filter.value) params.set('type', filter.value);
    clear(history);
    const data = await api(`/api/parliamentarians/${encodeURIComponent(id)}/votes?${params}`);
    if (data.items.length === 0) history.append(el('p', { class: 'muted', text: 'Nenhum voto encontrado.' }));
    data.items.forEach(({ type, voting }) => history.append(el('article', { class: 'card' }, [
      el('div', { class: 'eyebrow', text: formatDate(voting.date) }),
      el('h3', {}, el('a', { href: `/votacao?id=${encodeURIComponent(voting.id)}`, text: voting.propositionLabel })),
      el('p', { class: 'muted small', text: voting.description }),
      el('span', { class: `badge ${CLASS[type] || ''}`, text: VOTE[type] }),
    ])));
    pager(pagerNode, { page, total: data.total, limit: LIMIT }, loadHistory);
  }

  if (!id) {
    root.append(el('p', { class: 'status error', text: 'Parlamentar não informado.' }));
    return;
  }
  filter.addEventListener('change', () => loadHistory(1).catch(() => {}));
  api(`/api/parliamentarians/${encodeURIComponent(id)}`)
    .then((p) => { renderProfile(p); return loadHistory(); })
    .catch((error) => { clear(root); root.append(el('p', { class: 'status error', text: error.message })); });
})();
