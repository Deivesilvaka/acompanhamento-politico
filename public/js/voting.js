'use strict';
(() => {
  const { api, el, clear, param, formatDate, RESULT, CHAMBER, VOTE } = App;
  const root = document.getElementById('content');

  const GROUP_ORDER = ['YES', 'NO', 'ABSTENTION', 'OBSTRUCTION', 'ABSENT', 'JUSTIFIED_ABSENCE', 'PRESENT_NOT_VOTING', 'SECRET', 'PRESIDING', 'OTHER'];
  const GROUP_CLASS = { YES: 'yes', NO: 'no', ABSENT: 'absent' };

  function render(voting, filter) {
    clear(root);
    const result = RESULT[voting.result] || RESULT.UNKNOWN;
    document.title = `${voting.propositionLabel} · Acompanhamento Político`;

    root.append(
      el('div', { class: 'eyebrow', text: `${CHAMBER[voting.chamber]} · ${formatDate(voting.date)}` }),
      el('h1', { text: voting.propositionLabel }),
      el('p', { class: 'lead', text: voting.summary }),
      el('div', { class: 'card' }, [
        el('p', {}, [el('strong', { class: result.cls, text: `${result.label}: ` }), voting.description]),
        el('a', { href: voting.sourceUrl, rel: 'noopener noreferrer', target: '_blank', text: 'Ver na fonte oficial ↗' }),
      ]),
    );

    if (voting.isSecret) {
      root.append(el('p', { class: 'notice', text: 'Votação secreta: a fonte oficial informa apenas quem votou, não como votou.' }));
    }

    const filterInput = el('input', { type: 'search', placeholder: 'Filtrar por nome, partido ou UF', 'aria-label': 'Filtrar parlamentares', value: filter });
    filterInput.addEventListener('input', () => renderGroups(voting, filterInput.value));
    root.append(el('h2', { text: 'Como cada parlamentar votou' }), el('div', { class: 'filters' }, filterInput), el('div', { id: 'groups', class: 'vote-groups' }));
    root.append(el('p', { class: 'notice small', text: '"Não votou" significa que o parlamentar estava em exercício e não registrou voto nesta votação. Pode haver motivos como atividade em comissão; na Câmara, a fonte oficial não informa justificativa por votação.' }));
    renderGroups(voting, filter);
  }

  function renderGroups(voting, filter) {
    const container = document.getElementById('groups');
    clear(container);
    const term = filter.trim().toLowerCase();
    const groups = new Map();
    for (const vote of voting.votes) {
      const haystack = `${vote.parliamentarian.name} ${vote.party || ''} ${vote.state || ''}`.toLowerCase();
      if (term && !haystack.includes(term)) continue;
      if (!groups.has(vote.type)) groups.set(vote.type, []);
      groups.get(vote.type).push(vote);
    }
    for (const type of GROUP_ORDER) {
      const votes = groups.get(type);
      if (!votes) continue;
      container.append(el('section', { class: 'card vote-group' }, [
        el('h3', { class: GROUP_CLASS[type] || '', text: `${VOTE[type]} (${votes.length})` }),
        el('ul', {}, votes.map((vote) => el('li', {}, [
          el('a', { href: `/parlamentar?id=${encodeURIComponent(vote.parliamentarian.id)}`, text: vote.parliamentarian.name }),
          el('span', { class: 'muted', text: ` · ${vote.party || '?'}-${vote.state || '?'}` }),
        ]))),
      ]));
    }
    if (!container.children.length) container.append(el('p', { class: 'muted', text: 'Ninguém encontrado com esse filtro.' }));
  }

  const id = param('id');
  if (!id) {
    root.append(el('p', { class: 'status error', text: 'Votação não informada.' }));
    return;
  }
  api(`/api/votings/${encodeURIComponent(id)}`)
    .then((voting) => render(voting, ''))
    .catch((error) => { clear(root); root.append(el('p', { class: 'status error', text: error.message })); });
})();
