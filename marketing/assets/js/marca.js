// Dados institucionais lidos da Marca (marca.odisse.com.br/odisse.json), fonte única do Universo.
// Os contatos dos cards (site, telefone, e-mail) saem daqui, por núcleo — não se digitam mais no editor.
// Sem rede, vale a última cópia guardada no navegador e, na falta dela, a reserva abaixo.

const URL_MARCA = 'https://marca.odisse.com.br/odisse.json';
const CHAVE_CACHE = 'universo-marca';

// Reserva: cópia do odisse.json (11/11/2026), só com o que os cards usam.
const RESERVA = {
  contato: { email: 'contato@odisse.com.br', telefone: '+55 83 99122-3088' },
  sites: {
    institucional: 'https://www.odisse.com.br/',
    projetos: 'https://projetos.odisse.com.br/',
    objetos: 'https://www.odisseobjetos.com/',
  },
  redes: { substack: 'https://odisse.substack.com/' },
  nucleos: [
    { id: 'estudio', sites: [], redes: [], cores: { fundo: 'papel', painel: 'ardosia', veu: 'ardosia' } },
    { id: 'arquitetos', sites: ['projetos'], redes: [], cores: { fundo: 'papel', painel: 'areia', veu: 'ardosia' } },
    { id: 'objetos', sites: ['objetos'], redes: [], cores: { fundo: 'papel', painel: 'grafite', veu: 'grafite' } },
    { id: 'elaia', sites: [], redes: ['substack'], cores: { fundo: 'papel', painel: 'pessego', veu: 'terra' } },
  ],
  paleta: [
    { id: 'ardosia', nome: 'Ardósia', valor: '#3F4B57' }, { id: 'papel', nome: 'Papel', valor: '#FAFAF7' },
    { id: 'areia', nome: 'Areia', valor: '#E3D9C6' }, { id: 'nevoa', nome: 'Névoa', valor: '#E6E8EB' },
    { id: 'grafite', nome: 'Grafite', valor: '#2E3036' }, { id: 'pessego', nome: 'Pêssego', valor: '#F2DDBE' },
    { id: 'ocre', nome: 'Ocre', valor: '#BB8248' }, { id: 'ambar', nome: 'Âmbar', valor: '#ECC28F' },
    { id: 'terra', nome: 'Terra', valor: '#4A3726' },
  ],
};

/** Que contatos aparecem no fechamento de cada núcleo (o valor vem da Marca). */
const MOSTRA = {
  estudio: ['site', 'telefone', 'email'],
  arquitetos: ['site', 'telefone', 'email'],
  objetos: ['site', 'email'],
  elaia: ['site'],
};

let dados = RESERVA;
try {
  const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || 'null');
  if (c?.contato) dados = c;
} catch { /* sem storage */ }

const CHAVE_DATA = 'universo-marca-em';
const UM_DIA = 24 * 3600 * 1000;

/** Atualiza a Marca por baixo, no máximo uma vez por dia; até lá vale a cópia guardada. */
export async function carregarMarca({ forcar = false } = {}) {
  try {
    const em = Number(localStorage.getItem(CHAVE_DATA) || 0);
    if (!forcar && dados !== RESERVA && Date.now() - em < UM_DIA) return;
  } catch { /* sem storage */ }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(URL_MARCA, { signal: ctl.signal, cache: 'no-cache' });
    clearTimeout(timer);
    if (!r.ok) return;
    const j = await r.json();
    if (!j?.contato) return;
    dados = j;
    try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(j)); localStorage.setItem(CHAVE_DATA, String(Date.now())); } catch { /* */ }
  } catch { /* fica com o que há */ }
}

const limparUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

/** Contatos do núcleo: { site, telefone, email }, vazios quando o núcleo não os mostra. */
export function contatosDe(nucleoId) {
  const nuc = (dados.nucleos || []).find((x) => x.id === nucleoId) || {};
  const site = (nuc.sites || []).map((k) => dados.sites?.[k]).find(Boolean)
    || (nuc.redes || []).map((k) => dados.redes?.[k]).find(Boolean)
    || dados.sites?.institucional;
  const todos = { site: limparUrl(site), telefone: dados.contato?.telefone || '', email: dados.contato?.email || '' };
  const mostra = MOSTRA[nucleoId] || Object.keys(todos);
  return Object.fromEntries(Object.entries(todos).map(([k, v]) => [k, mostra.includes(k) ? v : '']));
}

/** Cor da paleta da Marca pelo id: { id, nome, valor }. */
export function corDaMarca(id) {
  return (dados.paleta || []).find((c) => c.id === id) || RESERVA.paleta.find((c) => c.id === id) || null;
}

/** Cores de preenchimento do núcleo, na ordem fundo → painel → véu, sem repetir: [{ id, nome, valor }].
 *  O preenchimento colore o fundo do card e o carimbo cheio. */
export function preenchimentosDe(nucleoId) {
  const nuc = (dados.nucleos || []).find((x) => x.id === nucleoId)
    || RESERVA.nucleos.find((x) => x.id === nucleoId) || {};
  const ids = [...new Set(['fundo', 'painel', 'veu'].map((p) => nuc.cores?.[p]).filter(Boolean))];
  return ids.map(corDaMarca).filter(Boolean);
}
