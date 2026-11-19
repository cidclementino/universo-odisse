// Páginas do hub. Rotas por hash: #/ (Início), #/ferramentas, #/canais, #/equipe, #/marca, #/biblioteca, #/padroes.
// Tudo vem de dois arquivos: ferramentas.json (aqui) e odisse.json (marca.odisse.com.br).
// A página Marca mora em assets/marca.js; a página Documentos (#/documentos, aberta pela Biblioteca), em assets/documentos.js;
// a página Equipe (#/equipe, seção própria da barra), em assets/equipe.js; a página Ferramentas, em assets/ferramentas.js.

import { criarMarca } from './marca.js';
import { criarDocumentos } from './documentos.js';
import { criarEquipe } from './equipe.js';
import { criarFerramentas, aplicarTextos, textosGuardados, configCanais } from './ferramentas.js';
import { criarEmpresa } from './empresa.js';
import { criarPadroes } from './padroes.js';

const MARCA = 'https://marca.odisse.com.br/';
const API = 'https://universo-hub.reservaprojectbasework.workers.dev';
const vista = document.getElementById('vista');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const semProtocolo = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

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

function cartao(f) {
  const breve = f.status === 'em-breve' || !f.url;
  const tag = breve ? '<span class="u-etiqueta suave">em breve</span>'
    : f.acesso === 'publica' ? '<span class="u-etiqueta">público</span>' : '';
  // ferramenta ou site fora do hub abre em outra aba; o Universo fica aberto
  const novaAba = f.url && !f.url.startsWith(location.origin) ? ' target="_blank" rel="noopener"' : '';
  const titulo = breve ? `<b>${esc(f.nome)}</b>` : `<a class="principal" href="${esc(f.url)}"${novaAba}><b>${esc(f.nome)}</b></a>`;
  const extras = (f.extra || []).map((x) => `<a href="${esc(x.url)}">${esc(x.nome)} →</a>`).join('');
  const host = !breve && f.url ? `<span>${esc(semProtocolo(f.url))}</span>` : '';
  return `<div class="u-cartao item${breve ? ' breve' : ''}">
    <div class="topo">${titulo}${tag}</div>
    ${f.descricao ? `<p>${esc(f.descricao)}</p>` : ''}
    ${host || extras ? `<div class="rodape">${host}${extras}</div>` : ''}
  </div>`;
}

function cabecalho(titulo, texto, lado = '') {
  return `<div class="cab"><div><h1 class="u-titulo">${esc(titulo)}</h1>${texto ? `<p class="u-apoio">${texto}</p>` : ''}</div>
    ${lado ? `<div class="lado u-apoio">${lado}</div>` : ''}</div>`;
}

function blocosDaSecao(secao, compactos = false) {
  return MAPA.grupos.filter((g) => g.secao === secao).map((g) => {
    const itens = MAPA.itens.filter((f) => f.grupo === g.id);
    if (!itens.length) return '';
    return `<section class="bloco"><span class="u-rotulo">${esc(g.nome)}</span>
      <div class="cartoes${compactos ? ' compactos' : ''}">${itens.map(cartao).join('')}</div></section>`;
  }).join('');
}

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

const documentos = criarDocumentos({ esc, api, apiBinario, toque, lerOdisse: () => ODISSE });
const equipe = criarEquipe({ esc, api, apiBinario, toque });
const ferramentas = criarFerramentas({ esc, api, toque, lerMapa: () => MAPA });
const canais = criarFerramentas({ esc, api, toque, lerMapa: () => MAPA, config: configCanais(() => ODISSE) });
const padroes = criarPadroes({ esc });
const empresa = criarEmpresa({ esc, api, toque, lerOdisse: () => ODISSE, gravarOdisse: (d) => { ODISSE = d; } });

// O Estúdio (Cid, 19/11): Empresa · Equipe · Marca · Canais são subpáginas, com abas no alto
const ESTUDIO = ['empresa', 'equipe', 'marca', 'canais'];
function abasEstudio(atual) {
  const subs = MAPA.secoes.filter((s) => s.pai === 'estudio');
  return `<nav class="abas-estudio" aria-label="O Estúdio"><span class="u-rotulo">O Estúdio</span>
    <div class="abas">${subs.map((s) => `<a href="#/${s.id}"${s.id === atual ? ' class="ativa" aria-current="page"' : ''}>${esc(s.nome)}</a>`).join('')}</div></nav>`;
}

// ---- páginas -------------------------------------------------------------

const PAGINAS = {
  inicio() {
    // só o resumo de hoje (Cid, 19/11): atalhos e "em construção" saíram; as ferramentas ficam na página Ferramentas
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return cabecalho('Início', 'O que importa hoje no Odisse.', hoje) +
      `<section class="bloco"><span class="u-rotulo">Hoje</span>
        <div class="aviso">Quando Contatos e funil, Calendário e Horas existirem, este espaço mostra as pendências do dia:
        contatos a responder, próximos posts e horas da semana.</div></section>`;
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

  biblioteca() {
    // modelos de documentos (prévia + download) no alto; o resto da biblioteca em cartões, como antes
    const outros = MAPA.itens.filter((f) => f.secao === 'biblioteca' && f.id !== 'documentos');
    return cabecalho('Biblioteca', '') +
      '<div id="biblioteca-modelos"></div>' +
      `<section class="bloco"><span class="u-rotulo">Acervo e referências</span>
        <div class="cartoes">${outros.map(cartao).join('')}</div></section>`;
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

  // Biblioteca › Padrões de interface (Cid, 19/11): catálogo das disposições e peças, com nome
  padroes() {
    return '<div id="pagina-padroes" class="pagina-padroes"></div>';
  },
};

function depois(rota) {
  if (rota === 'marca') marca.ligar(vista.querySelector('#pagina-marca'));
  if (rota === 'documentos') documentos.ligar(vista.querySelector('#pagina-documentos'));
  if (rota === 'equipe') equipe.ligar(vista.querySelector('#pagina-equipe'));
  if (rota === 'ferramentas') ferramentas.ligar(vista.querySelector('#pagina-ferramentas'));
  if (rota === 'empresa') empresa.ligar(vista.querySelector('#pagina-empresa'));
  if (rota === 'canais') canais.ligar(vista.querySelector('#pagina-canais'));
  if (rota === 'padroes') padroes.ligar(vista.querySelector('#pagina-padroes'));
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
  const sec = MAPA.secoes.find((s) => s.id === r) || MAPA.secoes.find((s) => s.rota === r) || { nome: r === 'padroes' ? 'Padrões de interface' : 'Documentos' };
  document.title = (r === 'inicio' ? 'Universo' : sec.nome + ' — Universo') + ' — Odisse';
  vista.innerHTML = (ESTUDIO.includes(r) ? abasEstudio(r) : '') + PAGINAS[r]() +
    '<footer class="rodape-hub"><button class="u-botao" data-acao="sair">Sair do Universo</button></footer>';
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
  try { await carregar(); } catch { vista.innerHTML = '<p class="u-apoio">Não foi possível carregar o Universo.</p>'; return; }
  mostrar();
  if (!entrar.ligado) { window.addEventListener('hashchange', mostrar); entrar.ligado = true; }
}

function sair() {
  senha.gravar('');
  telaEntrada();
  history.replaceState(null, '', location.pathname + location.search + '#/');
}

document.addEventListener('click', (ev) => { if (ev.target.closest('[data-acao="sair"]')) sair(); });

entrar();
