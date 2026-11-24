// ==========================================================================
// Autenticação do Radar — mesmo molde das outras ferramentas do Odisse (vendas, projetos).
// A senha é conferida pelo Worker (secret RADAR_SENHA), não pelo navegador. Depois de entrar,
// fica lembrada neste computador (localStorage) e vai em cada chamada ao Worker (cabeçalho
// Authorization, posto por js/comum.js). Sem a senha certa, o Worker não entrega nem grava nada.
// ==========================================================================

const AUTH_NAME_KEY = 'odisse-auth-nome';
const AUTH_SENHA_KEY = 'universo:senha'; // a mesma senha do Universo (login único desde 24/11/2026)

function getSenha() {
  try { return localStorage.getItem(AUTH_SENHA_KEY) || ''; } catch (_) { return ''; }
}

function isAuthenticated() {
  return !!getSenha();
}

function getUserName() {
  try { return localStorage.getItem(AUTH_NAME_KEY) || ''; } catch (_) { return ''; }
}

function logout() {
  localStorage.removeItem(AUTH_SENHA_KEY);
  // dados guardados para abrir as páginas mais rápido (ver carregarComCache em comum.js)
  try { Object.keys(localStorage).filter(k => k.startsWith('radar:dados:')).forEach(k => localStorage.removeItem(k)); } catch (_) { /* sem armazenamento */ }
}

// A API recusou a senha (trocada no servidor, por exemplo): sai e volta ao login.
function senhaRecusada() {
  logout();
  irParaLogin();
}

// Leva à entrada do Universo (login único) guardando a página atual, para voltar a ela depois de entrar.
function irParaLogin() {
  try { sessionStorage.setItem('universo:volta', location.pathname + location.search + location.hash); } catch (_) { /* segue sem volta */ }
  location.href = '/#/';
}

// Chame no topo de qualquer página que exija acesso.
function exigirAutenticacao() {
  if (!isAuthenticated()) irParaLogin();
}
