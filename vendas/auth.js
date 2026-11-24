// ==========================================================================
// Autenticação — a senha é conferida pelo Worker (servidor), não pelo
// navegador. Depois de entrar, ela fica lembrada neste computador
// (localStorage) e vai em cada chamada à API (cabeçalho Authorization).
// Sem a senha certa, o Worker não entrega nem grava nada.
// ==========================================================================


const AUTH_SENHA_KEY = 'universo:senha'; // a mesma senha do Universo (login único)

function getSenha() {
  try { return localStorage.getItem(AUTH_SENHA_KEY) || ''; } catch (_) { return ''; }
}

// Cabeçalhos para as chamadas ao Worker.
function cabecalhosAuth(extra = {}) {
  return { ...extra, Authorization: `Bearer ${getSenha()}` };
}

function isAuthenticated() {
  return !!getSenha();
}

function logout() {
  localStorage.removeItem(AUTH_SENHA_KEY);
}

// A API recusou a senha (trocada no servidor, por exemplo): sai e volta ao login.
function senhaRecusada() {
  logout();
  irParaLogin();
}

// Leva à entrada do Universo (login único) guardando a página atual, para voltar a ela depois de entrar.
function irParaLogin() {
  try { sessionStorage.setItem('universo:volta', location.pathname + location.search + location.hash); } catch (_) { /* segue sem volta */ }
  window.location.href = '/#/';
}

// Redireciona para o login se não estiver autenticado. Chame no topo de
// qualquer página que exija acesso.
function exigirAutenticacao() {
  if (!isAuthenticated()) irParaLogin();
}

// Arquivos do site com número de versão (?v=) ficam guardados pelo service worker até a próxima versão.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

// Nome de quem entrou: com a senha única do Universo não há login por pessoa (fica vazio até o login individual).
function getUserName() { return ''; }
