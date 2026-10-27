'use strict';
(() => {
  const { api, el, clear, status, votingCard, pager } = App;

  // Inscrição
  const form = document.getElementById('subscribe-form');
  const formStatus = document.getElementById('subscribe-status');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    status(formStatus, 'Enviando…');
    try {
      const result = await api('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.value,
          acceptedTerms: form.acceptedTerms.checked,
        }),
      });
      status(formStatus, `${result.message} Confira sua caixa de entrada (e o spam).`, 'ok');
      form.reset();
    } catch (error) {
      status(formStatus, error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  // Votações
  const list = document.getElementById('votings');
  const pagerNode = document.getElementById('votings-pager');
  const search = document.getElementById('search-form');
  const LIMIT = 10;

  async function load(page = 1) {
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (search.q.value.trim()) params.set('q', search.q.value.trim());
    if (search.chamber.value) params.set('chamber', search.chamber.value);
    clear(list);
    list.append(el('p', { class: 'muted', text: 'Carregando…' }));
    try {
      const data = await api(`/api/votings?${params}`);
      clear(list);
      if (data.items.length === 0) list.append(el('p', { class: 'muted', text: 'Nenhuma votação encontrada.' }));
      data.items.forEach((voting) => list.append(votingCard(voting)));
      pager(pagerNode, { page, total: data.total, limit: LIMIT }, load);
    } catch (error) {
      clear(list);
      list.append(el('p', { class: 'status error', text: error.message }));
    }
  }

  search.addEventListener('submit', (event) => {
    event.preventDefault();
    load(1);
  });
  load();
})();
