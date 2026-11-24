// ==========================================================================
// Configuração compartilhada entre login.html e o app (index.html)
// ==========================================================================
const CONFIG = {
  // A senha de acesso NÃO fica aqui: é conferida pelo Worker (secret
  // VENDAS_SENHA na Cloudflare). Ver README.md → "Acesso".

  // URL do Worker do Cloudflare que guarda a numeração e o histórico de
  // propostas (ver worker/README.md para colocar no ar). Deixe vazio
  // ('') para usar um contador local, sem histórico compartilhado.
  workerUrl: 'https://odisse-orcamentos-api.reservaprojectbasework.workers.dev'
};
