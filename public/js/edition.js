'use strict';
(() => {
  const { api, el, clear, param, formatDate, votingCard } = App;
  const root = document.getElementById('content');
  const id = param('id');

  if (!id) {
    root.append(el('p', { class: 'status error', text: 'Edição não informada.' }));
    return;
  }
  api(`/api/editions/${encodeURIComponent(id)}`)
    .then((edition) => {
      clear(root);
      root.append(
        el('div', { class: 'eyebrow', text: `Enviado em ${formatDate(edition.startedAt)}` }),
        el('h1', { text: edition.subject }),
        el('div', { class: 'counts' }, [
          el('span', { text: `${edition.recipientCount} destinatário(s)` }),
          el('span', { class: 'yes', text: `${edition.sentCount} entregues` }),
          el('span', { class: 'no', text: `${edition.failedCount} falhas` }),
        ]),
        el('p', {}, el('a', { href: `/api/editions/${encodeURIComponent(edition.id)}/email`, target: '_blank', rel: 'noopener', text: 'Ver o e-mail exatamente como foi enviado ↗' })),
        el('h2', { text: 'Votações incluídas' }),
        ...edition.votings.map(votingCard),
      );
    })
    .catch((error) => { clear(root); root.append(el('p', { class: 'status error', text: error.message })); });
})();
