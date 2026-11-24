// Páginas do hub. Rotas por hash: #/ (Início, em assets/inicio.js), #/financeiro (assets/financeiro.js), #/credenciais (assets/credenciais.js), #/ferramentas, #/canais, #/equipe, #/marca, #/biblioteca, #/padroes, #/precos (Mapa de preços, em assets/precos.js),
// #/pastas (Estrutura de pastas, em assets/pastas.js), #/acervo (Acervo de imagens, em assets/acervo.js).
// Tudo vem de dois arquivos: ferramentas.json (aqui) e odisse.json (marca.odisse.com.br).
// A página Marca mora em assets/marca.js; a página Documentos (#/documentos, aberta pela Biblioteca), em assets/documentos.js;
// a página Equipe (#/equipe, seção própria da barra), em assets/equipe.js; a página Ferramentas, em assets/ferramentas.js.

import { criarMarca } from './marca.js';
import { criarDocumentos } from './documentos.js';
import { criarEquipe } from './equipe.js';
import { criarFerramentas, aplicarTextos, textosGuardados, configCanais } from './ferramentas.js';
import { criarEmpresa } from './empresa.js';
import { criarPadroes } from './padroes.js';
import { criarInicio } from './inicio.js';
import { criarPrecos } from './precos.js';
import { criarPastas } from './pastas.js';
import { criarAcervo } from './acervo.js';
import { criarKpis } from './kpis.js';
import { criarCredenciais } from './credenciais.js';
import { criarFinanceiro } from './financeiro.js';
import { contagensDe, arvoreDe } from './inicio.js';
import { lerCopia } from './memoria.js';
import { montarCasca, abas } from '../base/v2/componentes.js';

const MARCA = 'https://marca.odisse.com.br/';
const API = 'https://universo-hub.reservaprojectbasework.workers.dev';
const vista = document.getElementById('vista');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let MAPA = null;   // ferramentas.json
let ODISSE = null; // odisse.json da marca

async function carregar() {
  const [mapa, odisse] = await Promise.all([
    fetch('ferramentas.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch(MARCA + 'odisse.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => null),
  ]);
  MAPA = mapa; ODISSE = odisse;
  aplicarTextos(MAPA, textosGuardados()); // descrições editadas no lápis (última cópia; a página Ferramentas confere)
}

// ---- peças ---------------------------------------------------------------

function toque(texto) {
  let el = document.querySelector('.toque');
  if (!el) { el = document.createElement('div'); el.className = 'toque'; document.body.appendChild(el); }
  el.textContent = texto; el.classList.add('on');
  clearTimeout(toque.t); toque.t = setTimeout(() => el.classList.remove('on'), 1600);
}


// ---- servidor do hub (senha da equipe) -----------------------------------------

const senha = {
  ler() { try { return localStorage.getItem('universo:senha') || ''; } catch { return ''; } },
  gravar(v) { try { v ? localStorage.setItem('universo:senha', v) : localStorage.removeItem('universo:senha'); } catch {} },
};

async function api(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + encodeURIComponent(senha.ler()), ...(opcoes.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

// Para corpo ou resposta que não são JSON (imagens): devolve a Response.
function apiBinario(caminho, opcoes = {}) {
  return fetch(API + caminho, {
    ...opcoes,
    headers: { Authorization: 'Bearer ' + encodeURIComponent(senha.ler()), ...(opcoes.headers || {}) },
  });
}

const marca = criarMarca({
  esc, api, toque, MARCA,
  lerOdisse: () => ODISSE,
  gravarOdisse: (d) => { ODISSE = d; },
});

const cred = criarCredenciais({ esc, api, apiBinario, toque });
const documentos = criarDocumentos({ esc, api, apiBinario, toque, lerOdisse: () => ODISSE });
const equipe = criarEquipe({ esc, api, apiBinario, toque, cred });
const ferramentas = criarFerramentas({ esc, api, toque, lerMapa: () => MAPA });
const canais = criarFerramentas({ esc, api, toque, lerMapa: () => MAPA, config: configCanais(() => ODISSE) });
const padroes = criarPadroes({ esc });
let casca = null; // menu lateral, topo e painel (base/v2; Cid, 24/11)
const inicio = criarInicio({ api, toque, lerCasca: () => casca });
const precos = criarPrecos({ esc, api });
const pastas = criarPastas({ esc, api, toque });
const kpis = criarKpis({ esc, api, toque });
const financeiro = criarFinanceiro({ esc, api, toque });
const acervo = criarAcervo({ esc, api, apiBinario, toque });
const empresa = criarEmpresa({ esc, api, toque, cred, lerOdisse: () => ODISSE, gravarOdisse: (d) => { ODISSE = d; } });

// Perfil (antes "O Estúdio"; Cid, 19/11 e 23/11): Empresa · Equipe · Marca · Canais · Credenciais são subpáginas, com Abas no alto
const ESTUDIO = ['empresa', 'equipe', 'marca', 'canais', 'credenciais'];
function abasEstudio(atual) {
  const subs = MAPA.secoes.filter((s) => s.pai === 'estudio');
  return abas('Perfil', subs.map((s) => ({ href: `#/${s.id}`, rotulo: s.nome, ativa: s.id === atual })));
}
// Biblioteca (Cid, 24/11): Modelos de documentos · Acervo de imagens · Estrutura de pastas · Padrões de interface, com Abas
const BIBLIOTECA = [['biblioteca', 'Modelos de documentos'], ['acervo', 'Acervo de imagens'], ['pastas', 'Estrutura de pastas'], ['padroes', 'Padrões de interface']];
const abasBiblioteca = (atual) => abas('Biblioteca', BIBLIOTECA.map(([id, rotulo]) => ({ href: `#/${id}`, rotulo, ativa: id === atual })));

// ---- páginas -------------------------------------------------------------

const PAGINAS = {
  inicio() {
    // panorama do dia (Cid, 19/11): só ações — aviso do balanço do mês, novidades do Radar e publicações de
    // hoje (assets/inicio.js). As métricas de ontem foram para os KPIs.
    return '<div id="pagina-inicio" class="pagina-inicio"></div>';
  },

  // KPIs (Cid, 19/11): seção do menu principal, atalho em Ferramentas › Gestão (assets/kpis.js)
  kpis() {
    return '<div id="pagina-kpis" class="pagina-kpis"></div>';
  },

  // Financeiro (Cid, 20/11): seção do menu principal, atalho em Ferramentas › Gestão; por ora, Despesas fixas
  // com a previsão de custos do ano (assets/financeiro.js)
  financeiro() {
    return '<div id="pagina-financeiro" class="pagina-financeiro"></div>';
  },

  ferramentas() {
    return '<div id="pagina-ferramentas" class="pagina-ferramentas"></div>';
  },

  canais() {
    return '<div id="pagina-canais" class="pagina-ferramentas"></div>';
  },

  empresa() {
    return '<div id="pagina-empresa" class="pagina-empresa"></div>';
  },

  // O Estúdio › Credenciais (Cid, 19/11): documentos para editais e concursos (assets/credenciais.js)
  credenciais() {
    return '<div id="pagina-credenciais" class="pagina-credenciais"></div>';
  },

  // Biblioteca › Modelos de documentos (prévia + download); as outras partes da Biblioteca são abas
  biblioteca() {
    return '<div class="cab"><h1 class="u-titulo">Modelos de documentos</h1></div><div id="biblioteca-modelos"></div>';
  },

  marca() {
    return '<div id="pagina-marca" class="pagina-marca"></div>';
  },

  documentos() {
    return '<div id="pagina-documentos" class="pagina-documentos"></div>';
  },

  equipe() {
    return '<div id="pagina-equipe" class="pagina-equipe"></div>';
  },

  // Ferramentas › Comercial › Mapa de preços (Cid, 19/11): contratos só de projeto e concursos, do Radar
  precos() {
    return '<div id="pagina-precos" class="pagina-precos"></div>';
  },

  // Biblioteca › Padrões de interface (Cid, 19/11): catálogo das disposições e peças, com nome
  padroes() {
    return '<div id="pagina-padroes" class="pagina-padroes"></div>';
  },

  // Biblioteca › Estrutura de pastas (Cid, 19/11): norma e retrato do Drive das pastas do estúdio
  pastas() {
    return '<div id="pagina-pastas" class="pagina-pastas"></div>';
  },

  // Biblioteca › Acervo de imagens (Cid, 19/11): banco único de imagens de projetos, objetos e coleções
  acervo() {
    return '<div id="pagina-acervo" class="pagina-acervo"></div>';
  },
};

function depois(rota) {
  if (rota === 'inicio') inicio.ligar(vista.querySelector('#pagina-inicio'));
  if (rota === 'marca') marca.ligar(vista.querySelector('#pagina-marca'));
  if (rota === 'documentos') documentos.ligar(vista.querySelector('#pagina-documentos'));
  if (rota === 'equipe') equipe.ligar(vista.querySelector('#pagina-equipe'));
  if (rota === 'ferramentas') ferramentas.ligar(vista.querySelector('#pagina-ferramentas'));
  if (rota === 'empresa') empresa.ligar(vista.querySelector('#pagina-empresa'));
  if (rota === 'credenciais') cred.ligar(vista.querySelector('#pagina-credenciais'));
  if (rota === 'canais') canais.ligar(vista.querySelector('#pagina-canais'));
  if (rota === 'padroes') padroes.ligar(vista.querySelector('#pagina-padroes'));
  if (rota === 'precos') precos.ligar(vista.querySelector('#pagina-precos'));
  if (rota === 'pastas') pastas.ligar(vista.querySelector('#pagina-pastas'));
  if (rota === 'kpis') kpis.ligar(vista.querySelector('#pagina-kpis'));
  if (rota === 'financeiro') financeiro.ligar(vista.querySelector('#pagina-financeiro'));
  if (rota === 'acervo') acervo.ligar(vista.querySelector('#pagina-acervo'));
  if (rota === 'biblioteca') documentos.ligarModelos(vista.querySelector('#biblioteca-modelos'));
}

const APELIDOS = { estudio: 'empresa', emissao: 'documentos' }; // seções que abrem outra página

function rota() {
  const id = (location.hash.match(/^#\/([^/?]+)/) || [])[1] || 'inicio';
  if (APELIDOS[id]) { history.replaceState(null, '', '#/' + APELIDOS[id]); return APELIDOS[id]; }
  return PAGINAS[id] ? id : 'inicio';
}

function mostrar() {
  if (document.body.classList.contains('u-trancado')) return;
  const r = rota();
  const sec = MAPA.secoes.find((s) => s.id === r) || MAPA.secoes.find((s) => s.rota === r) || { nome: { padroes: 'Padrões de interface', precos: 'Mapa de preços', pastas: 'Estrutura de pastas', acervo: 'Acervo de imagens' }[r] || 'Documentos' };
  document.title = (r === 'inicio' ? 'Universo' : sec.nome + ' — Universo') + ' — Odisse';
  vista.innerHTML = (ESTUDIO.includes(r) ? abasEstudio(r) : BIBLIOTECA.some(([id]) => id === r) ? abasBiblioteca(r) : '') + PAGINAS[r]();
  depois(r);
  window.scrollTo(0, 0);
}

// ---- entrada: a mesma senha da equipe abre o hub inteiro ---------------------
// A senha é conferida no servidor do hub e fica lembrada neste computador.

function telaEntrada(msg = '') {
  document.body.classList.add('u-trancado');
  document.title = 'Universo — Odisse';
  vista.innerHTML = `<form class="entrada u-cartao" data-form="entrada">
      <div class="marca-entrada" role="img" aria-label="Odisse"><span class="selo"></span><span class="logotipo"></span></div>
      <span class="u-rotulo">Universo</span>
      <label class="u-campo"><span>Senha da equipe</span>
        <input type="password" name="senha" autocomplete="current-password" required autofocus></label>
      ${msg ? `<p class="erro">${esc(msg)}</p>` : ''}
      <button class="u-botao forte" type="submit">Entrar</button>
    </form>`;
  vista.querySelector('input').focus();
  vista.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    senha.gravar(ev.target.elements.senha.value);
    entrar();
  });
}

async function entrar() {
  if (!senha.ler()) return telaEntrada();
  vista.innerHTML = '<p class="u-apoio">Carregando…</p>';
  let r;
  try { r = await api('/api/estado'); } catch (e) { r = { status: 0, error: e.message }; }
  if (r.status === 401) { senha.gravar(''); return telaEntrada('Senha incorreta.'); }
  if (r.status !== 200) {
    console.warn('Universo: entrada falhou', r);
    return telaEntrada(`Não foi possível falar com o servidor do Universo (${r.status ? 'resposta ' + r.status : 'sem resposta'}${r.error ? ': ' + r.error : ''}). Tente de novo em instantes.`);
  }
  document.body.classList.remove('u-trancado');
  // login único (24/11): quem chegou de uma ferramenta sem senha volta para a página onde estava
  try {
    const volta = sessionStorage.getItem('universo:volta');
    if (volta) { sessionStorage.removeItem('universo:volta'); if (volta.startsWith('/') && !volta.startsWith('//')) { location.replace(volta); return; } }
  } catch { /* segue no hub */ }
  try { await carregar(); } catch { vista.innerHTML = '<p class="u-apoio">Não foi possível carregar o Universo.</p>'; return; }
  if (!casca) {
    // padrão novo (Cid, 23–24/11): menu lateral por função, topo com "Ir para" e o conteúdo num painel
    casca = await montarCasca({ conteudo: vista, hub: true, mapa: MAPA, aoSair: sair });
    const copia = lerCopia('inicio');
    casca.contar(contagensDe(copia));
    casca.arvore('projetos', arvoreDe(copia));
  }
  mostrar();
  if (!entrar.ligado) { window.addEventListener('hashchange', mostrar); entrar.ligado = true; }
}

function sair() {
  senha.gravar('');
  history.replaceState(null, '', location.pathname + location.search + '#/');
  location.reload(); // volta à tela de entrada, sem o menu
}

entrar();
