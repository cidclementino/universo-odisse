// Cliente da API do Universo (Cloudflare Worker + KV — ver worker/).
// Endereço e senha ficam no navegador de quem usa (localStorage; a senha é a do Universo).

const CHAVE = 'universo-nuvem';
export const URL_PADRAO = (() => {
  try { return localStorage.getItem('universo-api') || 'https://universo-odisse.reservaprojectbasework.workers.dev'; } catch { return 'https://universo-odisse.reservaprojectbasework.workers.dev'; }
})();

// O Marketing mora no Universo (universo.odisse.com.br/marketing/) e a senha é a do Universo
// (localStorage 'universo:senha', a mesma do Worker). Aqui fica só o endereço da API, se alguém o trocou.
const CHAVE_SENHA = 'universo:senha';
const lerSenha = () => { try { return localStorage.getItem(CHAVE_SENHA) || ''; } catch { return ''; } };

export function config() {
  const senha = lerSenha();
  if (!senha) return null;
  let c = null;
  try { c = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch { /* sem cópia */ }
  return { ...(c || {}), senha };
}
export function salvarConfig(c) {
  try {
    if (c) {
      if (c.url && c.url !== URL_PADRAO) localStorage.setItem(CHAVE, JSON.stringify({ url: c.url }));
      if (c.senha) localStorage.setItem(CHAVE_SENHA, c.senha);
    } else {
      localStorage.removeItem(CHAVE);
      localStorage.removeItem(CHAVE_SENHA);
    }
  } catch { /* navegador sem armazenamento */ }
}
export const ativa = () => !!config()?.senha;

async function req(caminho, opc = {}) {
  const c = { url: URL_PADRAO, ...config() };
  if (!c.senha) throw new Error('senha incorreta');
  const res = await fetch(c.url.replace(/\/$/, '') + caminho, {
    ...opc,
    headers: { Authorization: `Bearer ${c.senha}`, ...(opc.headers || {}) },
  });
  if (res.status === 401) throw new Error('senha incorreta');
  if (!res.ok) throw new Error(`erro ${res.status}`);
  return res;
}

export async function testar(c) {
  const res = await fetch(c.url.replace(/\/$/, '') + '/api/publicacoes', { headers: { Authorization: `Bearer ${c.senha}` } });
  if (res.status === 401) throw new Error('Senha incorreta.');
  if (!res.ok) throw new Error(`O servidor respondeu ${res.status}.`);
  return true;
}

export const listar = async () => (await req('/api/publicacoes')).json();
export const ler = async (id) => (await req(`/api/publicacoes/${encodeURIComponent(id)}`)).json();
export const gravar = (pub) =>
  req(`/api/publicacoes/${encodeURIComponent(pub.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pub),
  });

export async function enviarImg(ref, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  await req(`/api/imagens/${encodeURIComponent(ref)}`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
}
export async function existeImg(ref) {
  try {
    await req(`/api/imagens/${encodeURIComponent(ref)}`, { method: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}
export async function baixarImg(ref) {
  const blob = await (await req(`/api/imagens/${encodeURIComponent(ref)}`)).blob();
  return new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  });
}

// ---- Instagram (métricas) ---------------------------------------------------
/** Chamada JSON que devolve a mensagem de erro do servidor, quando houver. */
async function reqIG(caminho, metodo = 'GET', corpo) {
  const c = { url: URL_PADRAO, ...config() };
  if (!c.senha) throw new Error('senha incorreta');
  const res = await fetch(c.url.replace(/\/$/, '') + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${c.senha}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('senha incorreta');
  if (!res.ok) throw new Error(dados.error || `erro ${res.status}`);
  return dados;
}
export const igMetricas = () => reqIG('/api/instagram/metricas');
export const igConectar = (token, igId) => reqIG('/api/instagram/conectar', 'POST', { token, igId });
export const igLogin = (dados) => reqIG('/api/instagram/login', 'POST', dados);
export const igDesconectar = () => reqIG('/api/instagram/conectar', 'DELETE');
export const igColetar = () => reqIG('/api/instagram/coletar', 'POST');
export const igVincular = (mediaId, pub) => reqIG(`/api/instagram/vinculos/${mediaId}`, 'PUT', { pub });
export async function igMiniatura(mediaId) {
  return (await req(`/api/instagram/miniaturas/${mediaId}`)).blob();
}

/** Imagem já em binário (ex.: JPG exportado para o pool de mídias). */
export async function enviarBlob(ref, blob) {
  await req(`/api/imagens/${encodeURIComponent(ref)}`, { method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
}
export const baixarBlob = async (ref) => (await req(`/api/imagens/${encodeURIComponent(ref)}`)).blob();

// ---- Pool de mídias -----------------------------------------------------------
export const poolListar = async () => (await req('/api/pool')).json();
export const poolGravar = (item) => req(`/api/pool/${encodeURIComponent(item.id)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
});
export const poolApagar = (id) => req(`/api/pool/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Configurações comuns (ex.: pastas do Pinterest) ------------------------
export const lerConfig = (chave) => reqIG(`/api/config/${encodeURIComponent(chave)}`);
export const gravarConfig = (chave, valor) => reqIG(`/api/config/${encodeURIComponent(chave)}`, 'PUT', valor);

// ---- Métricas: etiquetas e concorrentes ------------------------------------
export const etiquetar = (chave, dados) => reqIG(`/api/metricas/etiquetas/${encodeURIComponent(chave)}`, 'PUT', dados);
export const concAdicionar = (usuario) => reqIG('/api/concorrentes', 'POST', { usuario });
export const concRemover = (usuario) => reqIG(`/api/concorrentes/${encodeURIComponent(usuario)}`, 'DELETE');
export const concAtualizar = (usuario) => reqIG(`/api/concorrentes/${encodeURIComponent(usuario)}`, 'POST');
