// ==========================================================================
// Autenticação — a senha é conferida pelo Worker (servidor), não pelo
// navegador. Depois de entrar, ela fica lembrada neste computador
// (localStorage) e vai em cada chamada à API (cabeçalho Authorization).
// Sem a senha certa, o Worker não entrega nem grava nada.
// ==========================================================================


const AUTH_SENHA_KEY = 'universo:senha'; // a mesma senha do Universo (login único desde 24/11/2026)

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
  // dados guardados para abrir as páginas mais rápido (Universo.lerComCache)
  try { Object.keys(localStorage).filter((k) => k.startsWith('cache:')).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* sem armazenamento */ }
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

// Nome de quem entrou: com a senha única do Universo não há login por pessoa (fica vazio até o login individual).
function getUserName() { return ''; }
