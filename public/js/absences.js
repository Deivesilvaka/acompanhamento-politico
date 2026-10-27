'use strict';
(() => {
  const { api, el, clear, formatDate, CHAMBER } = App;
  const form = document.getElementById('filters');
  const list = document.getElementById('list');
  const period = document.getElementById('period');

  async function load() {
    const params = new URLSearchParams({ limit: 100 });
    for (const field of ['chamber', 'from', 'to']) if (form[field].value) params.set(field, form[field].value);
    clear(list);
    try {
      const data = await api(`/api/parliamentarians/absences?${params}`);
      period.textContent = `Período: ${formatDate(data.from)} a ${formatDate(data.to)}`;
      if (data.items.length === 0) {
        list.append(el('p', { class: 'muted', text: 'Nenhuma ausência registrada no período.' }));
        return;
      }
      list.append(el('div', { class: 'table-wrap' }, el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, ['Parlamentar', 'Casa', 'Não votou', 'Justificadas', 'Votações no período'].map((h) => el('th', { text: h })))),
        el('tbody', {}, data.items.map((row) => el('tr', {}, [
          el('td', {}, [
            el('a', { href: `/parlamentar?id=${encodeURIComponent(row.id)}`, text: row.name }),
            el('span', { class: 'muted', text: ` · ${row.party || '?'}-${row.state || '?'}` }),
          ]),
          el('td', { text: CHAMBER[row.chamber] }),
          el('td', { class: 'absent', text: String(row.absences) }),
          el('td', { class: 'muted', text: String(row.justifiedAbsences) }),
          el('td', { text: String(row.totalVotings) }),
        ]))),
      ])));
    } catch (error) {
      list.append(el('p', { class: 'status error', text: error.message }));
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  load();
})();
