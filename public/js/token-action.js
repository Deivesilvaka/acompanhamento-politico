'use strict';
/**
 * Confirmar / cancelar inscrição. A ação exige um clique (POST): links abertos
 * por antivírus ou pré-visualização do e-mail não confirmam nem cancelam sozinhos.
 */
(() => {
  const { api, status, param } = App;
  const button = document.getElementById('action');
  const output = document.getElementById('action-status');
  const endpoint = button.dataset.endpoint;
  const token = param('token');

  // Remove o token da barra de endereço/histórico.
  if (token) window.history.replaceState(null, '', window.location.pathname);

  if (!token) {
    button.disabled = true;
    status(output, button.dataset.missing || 'Use o link recebido por e-mail.', 'error');
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    status(output, 'Processando…');
    try {
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify({ token }) });
      status(output, result.message, 'ok');
      button.classList.add('hidden');
    } catch (error) {
      status(output, error.message, 'error');
      button.disabled = false;
    }
  });
})();
