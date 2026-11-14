// Páginas do hub. Rotas por hash: #/ (Início), #/ferramentas, #/canais, #/marca, #/biblioteca.
// Tudo vem de dois arquivos: ferramentas.json (aqui) e odisse.json (marca.odisse.com.br).
// A página Marca mora em assets/marca.js.

import { criarMarca } from './marca.js';

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
}

// ---- peças ---------------------------------------------------------------

function cartao(f) {
  const breve = f.status === 'em-breve' || !f.url;
  const tag = breve ? '<span class="u-etiqueta suave">em breve</span>'
    : f.acesso === 'publica' ? '<span class="u-etiqueta">público</span>' : '';
  const titulo = breve ? `<b>${esc(f.nome)}</b>` : `<a class="principal" href="${esc(f.url)}"><b>${esc(f.nome)}</b></a>`;
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

const marca = criarMarca({
  esc, api, toque, MARCA,
  lerOdisse: () => ODISSE,
  gravarOdisse: (d) => { ODISSE = d; },
});

// ---- páginas -------------------------------------------------------------

const PAGINAS = {
  inicio() {
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const atalhos = MAPA.itens.filter((f) => f.url && f.status !== 'em-breve' && f.acesso === 'interna');
    const proximos = MAPA.itens.filter((f) => f.secao === 'ferramentas' && f.status === 'em-breve');
    return cabecalho('Início', 'O que importa hoje no Odisse.', hoje) +
      `<section class="bloco"><span class="u-rotulo">Hoje</span>
        <div class="aviso">Quando Contatos e funil, Calendário e Horas existirem, este espaço mostra as pendências do dia:
        contatos a responder, próximos posts e horas da semana.</div></section>
      <section class="bloco"><span class="u-rotulo">Atalhos</span>
        <div class="cartoes compactos">${atalhos.map(cartao).join('')}</div></section>
      <section class="bloco"><span class="u-rotulo">Em construção</span>
        <div class="cartoes compactos">${proximos.map(cartao).join('')}</div></section>`;
  },

  ferramentas() {
    return cabecalho('Ferramentas', 'Onde se trabalha. As internas pedem a própria senha, por enquanto.') + blocosDaSecao('ferramentas');
  },

  canais() {
    const nomes = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', substack: 'Substack' };
    const redes = ODISSE ? Object.entries(ODISSE.redes).map(([id, url]) => cartao({
      nome: nomes[id] || id, url, acesso: 'publica', status: 'no-ar',
      descricao: id === 'substack' ? 'Elaia: ensaios e podcast' : semProtocolo(url).replace(/^[^/]+\//, '').replace(/\/$/, ''),
    })) : [];
    // o grupo "redes" não tem itens no mapa: os endereços vêm do odisse.json, fonte única
    return cabecalho('Canais', 'O que o público vê: sites, redes e publicações. Os endereços das redes vêm dos dados da Marca.') +
      blocosDaSecao('canais') +
      `<section class="bloco"><span class="u-rotulo">Redes e publicações</span>
        <div class="cartoes">${redes.join('') || '<p class="u-apoio">Não foi possível ler os dados da Marca.</p>'}</div></section>`;
  },

  biblioteca() {
    return cabecalho('Biblioteca', 'O que se reutiliza: imagens, referências técnicas, modelos e procedimentos.') + blocosDaSecao('biblioteca');
  },

  marca() {
    return '<div id="pagina-marca" class="pagina-marca"></div>';
  },
};

function depois(rota) {
  if (rota === 'marca') marca.ligar(vista.querySelector('#pagina-marca'));
}

function rota() {
  const id = (location.hash.match(/^#\/([^/?]+)/) || [])[1] || 'inicio';
  return PAGINAS[id] ? id : 'inicio';
}

function mostrar() {
  if (document.body.classList.contains('u-trancado')) return;
  const r = rota();
  const sec = MAPA.secoes.find((s) => s.id === r);
  document.title = (r === 'inicio' ? 'Universo' : sec.nome + ' — Universo') + ' — Odisse';
  vista.innerHTML = PAGINAS[r]() +
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
