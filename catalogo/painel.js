// Catálogo de serviços — painel das landing pages do servicos.odisse.com.br, dentro do Universo
// (universo.odisse.com.br/catalogo/). O site público e a biblioteca de módulos continuam em servicos.odisse.com.br:
// os módulos vêm de lá (SITE + /assets/lp/blocos.js) e as miniaturas e prévias são desenhadas com o endereço de lá.
// Senha: a do Universo (localStorage 'universo:senha'); sem senha, volta ao Início para entrar.
//
// Páginas (pelo endereço, #/…):
//   #/                      Catálogo (Registro). A linha abre a subpágina do produto.
//   #/novo                  Produto novo (Ficha)
//   #/produto/<id>          Subpágina do produto, aba Ficha (situação, cartão no site, notas)
//   #/produto/<id>/pagina   Subpágina do produto, aba Landing page (montador por blocos)
//   #/inicio                Página inicial do site (mesmo montador)
//   #/modulos               Biblioteca de módulos (os padrões de que toda landing page é feita)
//
// O montador não mexe na página: escolhem-se os módulos da biblioteca (assets/lp/blocos.js) e preenchem-se
// campos simples. O desenho é sempre o da biblioteca; mudou a biblioteca, mudaram todas as páginas.
// Abre com a última cópia guardada neste navegador e confere a nuvem por baixo.

import {
  TIPOS, GRUPOS, tipoDe, CAMPOS_PAGINA, novoBloco, limparPagina, desenharBloco, desenharPagina, urlImagem, SLUG, RESERVADOS,
} from 'https://servicos.odisse.com.br/assets/lp/blocos.js';

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? `http://${location.hostname}:8787` : 'https://servicos-odisse.reservaprojectbasework.workers.dev';
const SITE = 'https://servicos.odisse.com.br';
const CHAVE_SENHA = 'universo:senha'; // a senha do Universo (login único), guardada como texto
const CHAVE_COPIA = 'servicos-painel-catalogo';
const CHAVE_PAGINAS = 'servicos-painel-paginas';
const CHAVE_FILTROS = 'servicos-painel-filtros';
const CHAVE_BLOCOS = 'servicos-painel-blocos';
const CHAVE_SRV_PGT = 'servicos-painel-servicos-pgt';

const TRILHOS = [
  ['cliente', 'Cliente final', 'Cliente'],
  ['corretores', 'Corretores', 'Corretores'],
  ['construtoras', 'Construtoras e incorporadoras', 'Construtoras'],
  ['escritorios', 'Escritórios', 'Escritórios'],
];
const DEGRAUS = [['entrada', 'Entrada (grátis)', 'pessego'], ['leve', 'Pago leve', 'areia'], ['contrato', 'Contrato', '']];
const SITUACOES = [
  ['no-ar', 'No ar', 'ok'],
  ['desenvolvimento', 'Em desenvolvimento', 'atencao'],
  ['a-desenvolver', 'A desenvolver', 'tracejada'],
  ['pausado', 'Pausado', ''],
  ['arquivado', 'Arquivado', ''],
];
const nomeDe = (lista, id) => (lista.find((x) => x[0] === id) || [id, id])[1];
// blocos sugeridos para uma landing page nova (a ordem das páginas de projeto que já existem)
const SUGERIDOS = ['abertura', 'itens-numerados', 'projetos', 'escopo', 'perguntas', 'autoria', 'numeros', 'chamada-final'];

// ícones SVG (design.md: nunca caracteres de texto)
const svg = (d, w = 1.6) => `<svg class="ic" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  cima: svg('<path d="M3.5 8.5 7 5l3.5 3.5"/>'),
  baixo: svg('<path d="M3.5 5.5 7 9l3.5-3.5"/>'),
  fechar: svg('<path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/>'),
  externo: svg('<path d="M8 2.5h3.5V6M11.5 2.5 6.5 7.5M10 8.5v3H2.5V4h3"/>'),
  ok: svg('<path d="M3 7.2 5.8 10 11 4"/>', 1.8),
  alca: '<svg class="ic" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3.5" r="1.1"/><circle cx="9" cy="3.5" r="1.1"/><circle cx="5" cy="7" r="1.1"/><circle cx="9" cy="7" r="1.1"/><circle cx="5" cy="10.5" r="1.1"/><circle cx="9" cy="10.5" r="1.1"/></svg>',
  mais: svg('<path d="M7 3v8M3 7h8"/>', 1.8),
};
// alça de arrastar (⋮⋮ em caixa): arrasta com o mouse; com o teclado, ↑ ↓ mudam a ordem
const alca = (nome) => `<button type="button" class="caixa alca" data-alca aria-label="Arrastar ${esc(nome)} (setas para mudar a ordem)" title="Arraste para mudar a ordem">${IC.alca}</button>`;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const copiar = (p) => JSON.parse(JSON.stringify(p));
const slugDe = (s) => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const quando = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };

let senha = '';
let catalogo = null;            // { versao, atualizado, produtos }
let paginas = ler(CHAVE_PAGINAS, []); // resumo das landing pages [{ id, slug, publicada, pendente, casca, … }]
let filtros = { situacao: 'todos', trilho: 'todos', ...ler(CHAVE_FILTROS, {}), busca: '' };
let rota = { nome: 'catalogo' };
let ed = null;                  // o que está aberto para edição: { tipo: 'produto' | 'pagina', … }
let gravando = false;
let hashAtual = location.hash;
const fechados = ler(CHAVE_BLOCOS, {});

// ---------------------------------------------------------------- API

async function api(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: { Authorization: `Bearer ${senha}`, ...(opcoes.body && !(opcoes.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opcoes.headers || {}) },
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const e = new Error(dados?.error || `erro ${r.status}`);
    e.status = r.status; e.dados = dados;
    throw e;
  }
  return dados;
}

async function gravarCatalogo(produtos, mensagemOk) {
  if (gravando) return false;
  gravando = true;
  try {
    catalogo = await api('/api/admin/catalogo', { method: 'PUT', body: JSON.stringify({ versao: catalogo.versao, produtos }) });
    guardar(CHAVE_COPIA, catalogo);
    if (mensagemOk) avisar(mensagemOk, 'ok');
    return true;
  } catch (e) {
    if (e.status === 409 && e.dados?.catalogo) {
      catalogo = e.dados.catalogo;
      guardar(CHAVE_COPIA, catalogo);
      avisar('O catálogo foi mudado em outro lugar e foi recarregado: confira e faça a mudança de novo.', 'erro');
    } else if (e.status === 401) {
      sair();
    } else {
      avisar('Não consegui gravar: ' + e.message, 'erro');
    }
    return false;
  } finally {
    gravando = false;
  }
}

// Serviços do Plano Geral de Trabalho (Universo), para ligar cada produto a um serviço
let servicosPgt = ler(CHAVE_SRV_PGT, []);
async function carregarServicosPgt() {
  try {
    const d = await api('/api/admin/servicos-pgt');
    servicosPgt = d.servicos || [];
    guardar(CHAVE_SRV_PGT, servicosPgt);
  } catch { /* fica a cópia (ou só o valor gravado) */ }
}

async function carregarPaginas() {
  try {
    const d = await api('/api/admin/paginas');
    paginas = d.paginas;
    guardar(CHAVE_PAGINAS, paginas);
  } catch { /* fica a cópia */ }
}
const resumoDe = (id) => paginas.find((p) => p.id === id);
function trocarResumo(r) {
  paginas = [...paginas.filter((p) => p.id !== r.id), r];
  guardar(CHAVE_PAGINAS, paginas);
}

// imagem: reduzida aqui no navegador (WebP) e guardada na API
async function enviarImagem(arquivo, prefixo, max = 1600) {
  const { reduzir } = await import('/base/v1/imagens.js');
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const m = await reduzir(bmp, max);
  bmp.close?.();
  const ref = `${prefixo}-${Date.now().toString(36)}`.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80);
  await api(`/api/admin/imagens/${ref}`, { method: 'PUT', body: m.blob, headers: { 'Content-Type': m.blob.type } });
  return { ref, w: m.w, h: m.h };
}

// ---------------------------------------------------------------- entrada

// A entrada é a do Universo: sem senha (ou senha recusada), guarda o endereço e volta ao Início para entrar;
// depois de entrar, o Início traz de volta para cá (sessionStorage 'universo:volta').
function irParaEntrada() {
  try { sessionStorage.setItem('universo:volta', location.href); } catch { /* */ }
  location.href = '/#/';
}
const lerSenha = () => { try { return localStorage.getItem(CHAVE_SENHA) || ''; } catch { return ''; } };

function sair() {
  senha = '';
  try { localStorage.removeItem(CHAVE_SENHA); } catch { /* */ }
  ed = null; marcarMudanca();
  irParaEntrada();
}

async function entrar(s) {
  senha = s;
  const copia = ler(CHAVE_COPIA, null);
  if (copia) { catalogo = copia; mostrarPainel(); }
  try {
    const [c] = await Promise.all([api('/api/admin/catalogo'), carregarPaginas(), carregarServicosPgt()]);
    catalogo = c;
    guardar(CHAVE_COPIA, catalogo);
    if ($('#pagina').hidden) mostrarPainel();
    else if (!sujo()) desenhar();
  } catch (e) {
    if (e.status === 401) return sair();
    if (catalogo) avisar('Sem conexão com a API: mostrando a última cópia deste computador.', 'erro');
    else { $('#pagina').hidden = false; $('#pagina').innerHTML = `<p class="aviso erro">Não consegui falar com a API: ${esc(e.message)}</p>`; }
  }
}

function mostrarPainel() {
  $('#pagina').hidden = false;
  lerRota();
  desenhar();
}

// ---------------------------------------------------------------- rotas

function lerRota() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (p[0] === 'produto' && p[1]) rota = { nome: 'produto', id: decodeURIComponent(p[1]), aba: p[2] === 'pagina' ? 'pagina' : 'ficha' };
  else if (p[0] === 'novo') rota = { nome: 'produto', id: null, aba: 'ficha' };
  else if (p[0] === 'inicio') rota = { nome: 'inicio' };
  else if (p[0] === 'modulos' || p[0] === 'blocos') rota = { nome: 'modulos' };
  else rota = { nome: 'catalogo' };
}

addEventListener('hashchange', () => {
  if (!catalogo) return;
  if (sujo() && !confirm('Há mudanças não salvas. Sair assim mesmo?')) {
    history.replaceState(null, '', hashAtual || '#/');
    return;
  }
  hashAtual = location.hash;
  ed = null;
  lerRota();
  desenhar();
  scrollTo(0, 0);
});

function desenhar() {
  if (!catalogo) return;
  const secao = rota.nome === 'inicio' ? 'inicio' : rota.nome === 'modulos' ? 'modulos' : 'catalogo';
  document.querySelectorAll('#secoes a').forEach((a) => { if (a.dataset.secao === secao) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (rota.nome === 'catalogo') desenharCatalogo();
  else if (rota.nome === 'produto') desenharProduto();
  else if (rota.nome === 'inicio') desenharInicio();
  else if (rota.nome === 'modulos') desenharBiblioteca();
}

let avisoTimer;
function avisar(msg, tipo = '') {
  const a = $('#avisoGeral');
  if (!a) { if (tipo === 'erro') alert(msg); return; }
  a.className = `aviso ${tipo}`;
  a.textContent = msg;
  a.hidden = false;
  clearTimeout(avisoTimer);
  if (tipo === 'ok') avisoTimer = setTimeout(() => { a.hidden = true; }, 4000);
}

// ================================================================ CATÁLOGO

function situacaoEtq(id) {
  const s = SITUACOES.find((x) => x[0] === id) || [id, id, ''];
  return `<span class="etq ${s[2]}">${esc(s[1])}</span>`;
}
function degrauEtq(id) {
  const d = DEGRAUS.find((x) => x[0] === id) || [id, id, ''];
  return `<span class="etq ${d[2]}">${esc(d[1])}</span>`;
}
function noSiteEtq(p) {
  if (!p.noSite) return '<span class="etq">fora do grid</span>';
  if (p.situacao !== 'no-ar') return '<span class="etq tracejada">quando no ar</span>';
  if (!p.publico.titulo || !p.publico.link) return '<span class="etq problema">falta título ou link</span>';
  return '<span class="etq ok">no grid</span>';
}
function paginaEtq(id) {
  const r = resumoDe(id);
  if (!r) return '<span class="sem">—</span>';
  if (!r.publicada) return '<span class="etq tracejada">rascunho</span>';
  if (r.pendente) return '<span class="etq atencao">mudanças</span>';
  return '<span class="etq ok">publicada</span>';
}

function visiveis() {
  const b = semAcento(filtros.busca);
  return catalogo.produtos.filter((p) => {
    if (filtros.situacao === 'todos' ? p.situacao === 'arquivado' : p.situacao !== filtros.situacao) return false;
    if (filtros.trilho !== 'todos' && p.trilho !== filtros.trilho) return false;
    if (b && !semAcento(`${p.nome} ${p.publico.titulo} ${p.publico.texto} ${p.notas}`).includes(b)) return false;
    return true;
  });
}

function cartaoSite(pub) {
  const im = pub.imagem;
  const url = im?.ref ? `${API}/img/${im.ref}` : im?.caminho || im?.dataUrl || '';
  return `<div class="cartao-site${url ? '' : ' sem-img'}">
    ${url ? `<div class="bg" style="background-image:url('${esc(url)}')"></div>` : ''}
    <div class="veu"></div>
    <div class="txt"><h4>${esc(pub.titulo || 'Sem título')}</h4>${pub.texto ? `<p>${esc(pub.texto)}</p>` : ''}<span>${esc(pub.chamada || 'Saiba mais')} →</span></div>
  </div>`;
}

function desenharCatalogo() {
  document.title = 'Odisse · Catálogo de serviços';
  const d = catalogo.atualizado ? new Date(catalogo.atualizado) : null;
  $('#pagina').innerHTML = `
    <div class="cabecalho">
      <h1 class="u-titulo">Catálogo de serviços</h1>
      <div class="cab-acoes">
        <span class="u-apoio">${d ? `Atualizado em ${quando(catalogo.atualizado)}` : 'Catálogo inicial, ainda não gravado'}</span>
        <a class="u-botao forte" href="#/novo">+ Novo produto</a>
      </div>
    </div>
    <div class="filtros">
      <div class="seletor" id="selSituacao" role="radiogroup" aria-label="Situação"></div>
      <div class="seletor" id="selTrilho" role="radiogroup" aria-label="Trilho"></div>
      <label class="busca"><input type="search" id="busca" placeholder="Buscar" aria-label="Buscar produto" value="${esc(filtros.busca)}"></label>
      <button class="limpar" id="btLimpar" type="button" hidden>limpar</button>
    </div>
    <div class="aviso" id="avisoGeral" hidden></div>
    <div class="regua cat" aria-hidden="true"><span>Produto</span><span>Trilho</span><span>Degrau</span><span>Situação</span><span>No site</span><span>Landing page</span><span></span></div>
    <div class="registro" id="lista"></div>
    <section class="secao">
      <h2 class="u-subtitulo">Grid no site</h2>
      <div class="grid-previa" id="gridPrevia"></div>
    </section>
    <section class="secao notas">
      <div><h3 class="u-rotulo">Como o grid se forma</h3>
        <p>Entra no grid de serviços da página <a href="${SITE}/inicio/" target="_blank" rel="noopener">/inicio/</a> todo produto <b>no ar</b>, marcado para aparecer no site, com título e link. A ordem do grid é a ordem desta lista (setas à direita de cada linha). O site lê o catálogo a cada visita, com até um minuto de atraso.</p></div>
      <div><h3 class="u-rotulo">Landing pages</h3>
        <p>Abra o produto e vá em <b>Landing page</b> para montar a página dele com os módulos da biblioteca. As páginas guardam só os textos e as imagens; o desenho é o da <a href="#/modulos">biblioteca de módulos</a>, o mesmo em todas.</p></div>
      <div><h3 class="u-rotulo">Nada se apaga</h3>
        <p>Produto que saiu dos planos vai para <b>Arquivados</b>. Cada gravação do catálogo guarda o anterior (as 20 últimas versões ficam no servidor).</p></div>
    </section>`;
  desenharSeletores();
  desenharLista();
  desenharGridPrevia();

  $('#selSituacao').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    filtros.situacao = b.dataset.v; guardar(CHAVE_FILTROS, { situacao: filtros.situacao, trilho: filtros.trilho }); desenharSeletores(); desenharLista();
  });
  $('#selTrilho').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    filtros.trilho = b.dataset.v; guardar(CHAVE_FILTROS, { situacao: filtros.situacao, trilho: filtros.trilho }); desenharSeletores(); desenharLista();
  });
  $('#busca').addEventListener('input', (e) => { filtros.busca = e.target.value; desenharSeletores(); desenharLista(); });
  $('#btLimpar').addEventListener('click', () => {
    filtros = { situacao: 'todos', trilho: 'todos', busca: '' }; guardar(CHAVE_FILTROS, filtros); desenharCatalogo();
  });
  $('#lista').addEventListener('click', (e) => {
    const mv = e.target.closest('[data-mover]');
    const linha = e.target.closest('.linha');
    if (!linha) return;
    if (mv) { e.stopPropagation(); mover(linha.dataset.id, Number(mv.dataset.mover)); return; }
    if (getSelection().toString()) return;
    location.hash = `#/produto/${encodeURIComponent(linha.dataset.id)}`;
  });
  $('#lista').addEventListener('keydown', (e) => {
    const linha = e.target.closest('.linha');
    if (linha && e.target === linha && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = `#/produto/${encodeURIComponent(linha.dataset.id)}`; }
  });
}

function desenharSeletores() {
  const conta = (f) => catalogo.produtos.filter(f).length;
  const sit = [['todos', 'Todos', conta((p) => p.situacao !== 'arquivado')],
    ...SITUACOES.map(([id, nome]) => [id, id === 'arquivado' ? 'Arquivados' : id === 'pausado' ? 'Pausados' : nome, conta((p) => p.situacao === id)])];
  $('#selSituacao').innerHTML = sit.map(([id, nome, n]) =>
    `<button type="button" role="radio" data-v="${id}" aria-checked="${filtros.situacao === id}">${esc(nome)} <span class="n">${n}</span></button>`).join('');
  const tri = [['todos', 'Todos os trilhos'], ...TRILHOS.map(([id, , curto]) => [id, curto])];
  $('#selTrilho').innerHTML = tri.map(([id, nome]) =>
    `<button type="button" role="radio" data-v="${id}" aria-checked="${filtros.trilho === id}">${esc(nome)}</button>`).join('');
  $('#btLimpar').hidden = filtros.situacao === 'todos' && filtros.trilho === 'todos' && !filtros.busca;
}

function desenharLista() {
  const lista = visiveis();
  if (!lista.length) { $('#lista').innerHTML = '<div class="vazio">Nenhum produto com estes filtros.</div>'; return; }
  $('#lista').innerHTML = lista.map((p, i) => {
    const sub = p.publico.titulo && p.publico.texto ? `${p.publico.titulo} · ${p.publico.texto}` : (p.publico.texto || p.publico.titulo || p.notas || '');
    const classe = p.situacao === 'a-desenvolver' ? ' tracejada' : p.situacao === 'arquivado' ? ' arquivada' : '';
    return `<div class="linha cat${classe}" role="link" tabindex="0" data-id="${esc(p.id)}">
      <div class="linha-nome"><b>${esc(p.nome)}</b><small>${esc(sub) || '<span class="sem">—</span>'}</small></div>
      <div class="linha-etqs">
        <span class="col"><span class="etq">${esc(nomeDe(TRILHOS, p.trilho))}</span></span>
        <span class="col">${degrauEtq(p.degrau)}</span>
        <span class="col">${situacaoEtq(p.situacao)}</span>
        <span class="col">${noSiteEtq(p)}</span>
        <span class="col">${paginaEtq(p.id)}</span>
      </div>
      <div class="linha-cmd">
        <button class="caixa" type="button" data-mover="-1" aria-label="Subir ${esc(p.nome)}" title="Subir" ${i === 0 ? 'disabled' : ''}>${IC.cima}</button>
        <button class="caixa" type="button" data-mover="1" aria-label="Descer ${esc(p.nome)}" title="Descer" ${i === lista.length - 1 ? 'disabled' : ''}>${IC.baixo}</button>
      </div>
    </div>`;
  }).join('');
}

function desenharGridPrevia() {
  const noGrid = catalogo.produtos.filter((p) => p.situacao === 'no-ar' && p.noSite && p.publico.titulo && p.publico.link);
  $('#gridPrevia').innerHTML = noGrid.length ? noGrid.map((p) => cartaoSite(p.publico)).join('') : '<div class="vazio">Nenhum produto no ar marcado para o site.</div>';
}

// mover dentro da lista visível: troca de lugar com o vizinho visível no catálogo inteiro
async function mover(id, passo) {
  const lista = visiveis();
  const i = lista.findIndex((p) => p.id === id);
  const vizinho = lista[i + passo];
  if (!vizinho) return;
  const produtos = catalogo.produtos.slice();
  const a = produtos.findIndex((p) => p.id === id);
  const b = produtos.findIndex((p) => p.id === vizinho.id);
  [produtos[a], produtos[b]] = [produtos[b], produtos[a]];
  if (await gravarCatalogo(produtos)) { desenharLista(); desenharGridPrevia(); }
  document.querySelector(`.linha[data-id="${CSS.escape(id)}"] [data-mover="${passo}"]`)?.focus();
}

// ================================================================ PEÇAS COMUNS (Bloco, campos)

function bloco(id, titulo, corpo, { extra = '', classe = '', cabExtra = '' } = {}) {
  // os blocos de uma landing page começam recolhidos (a página tem muitos); o resto começa aberto
  const fechado = (id.startsWith('b-') ? fechados[id] !== false : fechados[id]) ? ' fechado' : '';
  return `<section class="bloco${fechado}${classe ? ` ${classe}` : ''}" data-bloco="${esc(id)}">
    <div class="bloco-cab">${cabExtra}<h3 class="bloco-h"><button type="button" class="bloco-alterna" aria-expanded="${!fechado}">${titulo}</button></h3>${extra}<button type="button" class="caixa bloco-seta" data-alterna aria-label="Recolher ou abrir">${IC.baixo}</button></div>
    <div class="bloco-corpo">${corpo}</div>
  </section>`;
}

function alternarBloco(b) {
  b.classList.toggle('fechado');
  b.querySelector('.bloco-alterna')?.setAttribute('aria-expanded', !b.classList.contains('fechado'));
  fechados[b.dataset.bloco] = b.classList.contains('fechado');
  guardar(CHAVE_BLOCOS, fechados);
}

function conta(c, valor) { return c.max ? `<span class="conta" data-conta>${(valor || '').length} / ${c.max}</span>` : ''; }

// campo simples a partir do esquema da biblioteca (texto, área, link, imagem, chave, textos, lista)
function campo(c, valor, caminho) {
  const dica = c.dica ? `<small>${esc(c.dica)}</small>` : '';
  const at = `data-c="${esc(caminho)}"`;
  switch (c.tipo) {
    case 'texto':
    case 'link':
      return `<label class="u-campo${c.tipo === 'link' ? ' link' : ''}${(c.max || 0) > 60 ? ' medio' : ''}"><span>${esc(c.rotulo)}${conta(c, valor)}</span><input type="text" ${at} value="${esc(valor)}" ${c.max ? `maxlength="${c.max}"` : ''} spellcheck="${c.tipo === 'texto'}">${dica}</label>`;
    case 'area':
      return `<label class="u-campo largo"><span>${esc(c.rotulo)}${conta(c, valor)}</span><textarea ${at} rows="${c.max > 700 ? 7 : c.max > 300 ? 4 : 3}" ${c.max ? `maxlength="${c.max}"` : ''}>${esc(valor)}</textarea>${dica || (c.max > 300 ? '<small>Linha em branco separa parágrafos.</small>' : '')}</label>`;
    case 'chave':
      return `<label class="chave largo"><input type="checkbox" ${at} ${valor ? 'checked' : ''}> ${esc(c.rotulo)}</label>`;
    case 'imagem': {
      const u = urlImagem(valor, API);
      return `<div class="u-campo imagem-campo-l ${esc(c.formato || '')}"><span>${esc(c.rotulo)}</span>
        <div class="imagem-campo">
          <div class="imagem-mini f-${esc(c.formato || 'paisagem')}${u ? '' : ' vazia'}" ${u ? `style="background-image:url('${esc(u)}')"` : ''}>${u ? '' : 'sem imagem'}</div>
          <div class="imagem-acoes">
            <button type="button" class="u-botao" data-imagem="${esc(caminho)}" data-formato="${esc(c.formato || '')}">${u ? 'Trocar imagem' : 'Enviar imagem'}</button>
            ${u ? `<button type="button" class="u-botao perigo" data-tirar-imagem="${esc(caminho)}">Tirar imagem</button>` : ''}
            ${dica}
          </div>
        </div></div>`;
    }
    case 'textos': {
      const itens = Array.isArray(valor) ? valor : [];
      return `<div class="u-campo largo"><span>${esc(c.rotulo)}</span><div class="pilha-textos" data-ordenavel="${esc(caminho)}">
        ${itens.map((x, i) => `<div class="pt-linha" data-i="${i}">${alca(`${c.rotulo} ${i + 1}`)}<input type="text" data-c="${esc(caminho)}.${i}" value="${esc(x)}" maxlength="${c.maxItem || 200}" aria-label="${esc(c.rotulo)} ${i + 1}">
          <button type="button" class="caixa" data-item="tira" data-lista="${esc(caminho)}" data-i="${i}" aria-label="Tirar" title="Tirar">${IC.fechar}</button></div>`).join('')}
      </div>${itens.length < (c.max || 20) ? `<button type="button" class="acrescentar" data-item="mais" data-lista="${esc(caminho)}">+ Acrescentar item</button>` : ''}</div>`;
    }
    case 'lista': {
      const itens = Array.isArray(valor) ? valor : [];
      const min = c.min || 0;
      // itens com só campos curtos viram linhas compactas; os outros, cartões em grade
      const curtos = c.campos.every((s) => s.tipo === 'texto' && (s.max || 200) <= 60);
      return `<div class="u-campo largo"><span>${esc(c.rotulo)}</span>${dica}<div class="pilha-itens${curtos ? ' curtos' : ''}" data-ordenavel="${esc(caminho)}">
        ${itens.map((it, i) => `<div class="item" data-i="${i}">
          <div class="item-cab">${alca(`${c.rotuloItem || 'Item'} ${i + 1}`)}<b>${esc(c.rotuloItem || 'Item')} ${i + 1}</b>
            ${itens.length > min ? `<button type="button" class="caixa" data-item="tira" data-lista="${esc(caminho)}" data-i="${i}" aria-label="Tirar" title="Tirar">${IC.fechar}</button>` : ''}</div>
          <div class="item-campos">${c.campos.map((s) => campo(s, it?.[s.id], `${caminho}.${i}.${s.id}`)).join('')}</div>
        </div>`).join('')}
      </div>${itens.length < (c.max || 20) ? `<button type="button" class="acrescentar" data-item="mais" data-lista="${esc(caminho)}">+ Acrescentar ${esc((c.rotuloItem || 'item').toLowerCase())}</button>` : ''}</div>`;
    }
    default: return '';
  }
}

// miniatura de um módulo: o desenho de verdade, num quadro reduzido (sem clique)
const PAGINA_EXEMPLO = { formulario: '/formulario/', chamada: 'Quero Solicitar um Orçamento', whatsapp: true };
function docMini(tipoId, dados, pagina) {
  let html = desenharBloco({ tipo: tipoId, dados: dados || tipoDe(tipoId).exemplo }, { pagina: pagina || PAGINA_EXEMPLO, api: API, vazias: true });
  if (tipoId === 'abertura-servicos') {
    const c = (t) => `<a class="lp-servico sem-imagem"><div class="lp-servico-veu"></div><div class="lp-servico-txt"><h3>${t}</h3><p>Texto curto do serviço.</p><span class="lp-servico-cta">Ver projeto →</span></div></a>`;
    html = html.replace('data-grid-servicos></div>', `data-grid-servicos style="--colunas:3">${c('Projeto Residencial')}${c('Interiores')}${c('Planejador da obra')}</div>`);
  }
  return `<!doctype html><html><head><base href="${SITE}/"><link rel="stylesheet" href="https://marca.odisse.com.br/v1/marca.css"><link rel="stylesheet" href="/assets/lp/blocos.css"><style>html,body{overflow:hidden;pointer-events:none}.lp-tela{min-height:900px}</style></head><body class="lp">${html}</body></html>`;
}
function miniatura(tipoId, dados, pagina) {
  return `<div class="mini"><iframe tabindex="-1" aria-hidden="true" loading="lazy" srcdoc="${esc(docMini(tipoId, dados, pagina))}"></iframe></div>`;
}
const escalaMini = new ResizeObserver((es) => es.forEach((e) => e.target.style.setProperty('--escala', e.contentRect.width / 1440)));
const ligarMinis = (el) => el.querySelectorAll('.mini').forEach((m) => escalaMini.observe(m));

// caminhos: "p.titulo" (página), "b.<uid>.campo[.i[.sub]]" (bloco), "pr.campo" / "pr.publico.campo" (produto)
function alvo(caminho) {
  const partes = caminho.split('.');
  let obj;
  if (partes[0] === 'p') obj = ed.rascunho;
  else if (partes[0] === 'pr') obj = ed.rascunho;
  else if (partes[0] === 'b') { obj = ed.rascunho.blocos.find((b) => b.uid === partes[1])?.dados; partes.splice(0, 1); }
  partes.splice(0, 1);
  const chave = partes.pop();
  for (const k of partes) obj = obj?.[k];
  return { obj, chave };
}
const lerCaminho = (c) => { const { obj, chave } = alvo(c); return obj?.[chave]; };
const porCaminho = (c, v) => { const { obj, chave } = alvo(c); if (obj) obj[chave] = v; };

// ================================================================ SUBPÁGINA DO PRODUTO

function opcoesServicoPgt(v) {
  const grupo = (d, rot) => {
    const l = servicosPgt.filter((x) => (x.dinamica || 'fluxo') === d);
    return l.length ? `<optgroup label="${rot}">${l.map((x) => `<option value="${esc(x.id)}" ${v === x.id ? 'selected' : ''}>${esc(x.sigla + ' · ' + x.nome)}</option>`).join('')}</optgroup>` : '';
  };
  const conhecido = servicosPgt.some((x) => x.id === v);
  return `<option value="">Nenhum</option>${v && !conhecido ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : ''}${grupo('fluxo', 'Em fluxo')}${grupo('ilha', 'Em ilha')}`;
}

const vazio = () => ({ id: '', nome: '', trilho: filtros.trilho !== 'todos' ? filtros.trilho : 'cliente', degrau: 'contrato', situacao: 'a-desenvolver', noSite: true, servicoPgt: '',
  publico: { titulo: '', texto: '', chamada: '', link: '', imagem: null }, notas: '' });

function cabecalhoProduto(p, aba) {
  const id = encodeURIComponent(p.id);
  const abas = p.id
    ? `<nav class="abas-caixa" aria-label="Subpáginas do produto"><a href="#/produto/${id}" class="${aba === 'ficha' ? 'ativa' : ''}">Ficha</a><a href="#/produto/${id}/pagina" class="${aba === 'pagina' ? 'ativa' : ''}">Landing page</a></nav>`
    : '<nav class="abas-caixa"><a class="ativa">Ficha</a></nav>';
  return `<div class="abas-caixa-linha"><span class="u-rotulo">Produto</span>${abas}</div>
    <nav class="u-trilha" aria-label="Caminho"><a href="#/">Catálogo</a><span class="sep">/</span><span aria-current="page" id="trilhaNome">${esc(p.nome || 'Produto novo')}</span></nav>`;
}

function desenharProduto() {
  const p = rota.id ? catalogo.produtos.find((x) => x.id === rota.id) : vazio();
  if (!p) {
    $('#pagina').innerHTML = `<nav class="u-trilha"><a href="#/">Catálogo</a></nav><div class="vazio">Produto não encontrado.</div>`;
    return;
  }
  document.title = `Odisse · ${p.nome || 'Produto novo'}`;
  if (rota.aba === 'pagina' && p.id) return desenharMontador({ id: p.id, produto: p });
  ed = { tipo: 'produto', original: copiar(p), rascunho: copiar(p), novo: !p.id, arquivo: null };
  desenharFicha();
}

function desenharFicha() {
  const p = ed.rascunho;
  const im = p.publico.imagem;
  const imgUrl = im?.ref ? `${API}/img/${im.ref}` : im?.caminho || im?.dataUrl || '';
  const pg = p.id ? resumoDe(p.id) : null;
  const sugerido = pg ? (pg.casca ? `/${pg.slug}/` : `/lp/?p=${pg.slug}`) : '';
  const opc = (lista, v) => lista.map(([id, n]) => `<option value="${id}" ${v === id ? 'selected' : ''}>${esc(n)}</option>`).join('');

  const situacao = `
    <label class="u-campo largo"><span>Nome interno${conta({ max: 120 }, p.nome)}</span><input type="text" data-c="pr.nome" value="${esc(p.nome)}" maxlength="120"></label>
    <div class="grupo-campo largo"><span class="rotulo-campo">Situação</span><div class="seletor pequeno" role="radiogroup" data-seletor="pr.situacao">${SITUACOES.map(([id, n]) =>
      `<button type="button" role="radio" data-v="${id}" aria-checked="${p.situacao === id}">${esc(n)}</button>`).join('')}</div></div>
    <label class="u-campo"><span>Trilho</span><select data-c="pr.trilho">${opc(TRILHOS, p.trilho)}</select></label>
    <label class="u-campo"><span>Degrau</span><select data-c="pr.degrau">${opc(DEGRAUS, p.degrau)}</select></label>
    <label class="u-campo largo"><span>Serviço do PGT</span><select data-c="pr.servicoPgt">${opcoesServicoPgt(p.servicoPgt)}</select>
      <small>${servicosPgt.length ? 'O serviço do Plano Geral de Trabalho a que este produto se liga (vários produtos podem apontar para o mesmo).' : 'A lista dos serviços vem do Universo e ainda não chegou: o valor gravado fica.'}</small></label>
    <label class="chave largo"><input type="checkbox" data-c="pr.noSite" ${p.noSite ? 'checked' : ''}> Aparece no grid do site quando estiver no ar</label>
    ${ed.novo ? '' : `<div class="dica largo">Código <span class="etq codigo">${esc(p.id)}</span></div>`}`;

  const site = `
    <label class="u-campo largo"><span>Título no cartão${conta({ max: 120 }, p.publico.titulo)}</span><input type="text" data-c="pr.publico.titulo" value="${esc(p.publico.titulo)}" maxlength="120"></label>
    <label class="u-campo largo"><span>Texto${conta({ max: 240 }, p.publico.texto)}</span><textarea data-c="pr.publico.texto" rows="3" maxlength="240">${esc(p.publico.texto)}</textarea></label>
    <label class="u-campo"><span>Chamada${conta({ max: 40 }, p.publico.chamada)}</span><input type="text" data-c="pr.publico.chamada" value="${esc(p.publico.chamada)}" maxlength="40"><small>Ex.: Ver projeto, Fazer meu plano</small></label>
    <label class="u-campo"><span>Link</span><input type="text" data-c="pr.publico.link" value="${esc(p.publico.link)}" spellcheck="false">
      <small>${sugerido && sugerido !== p.publico.link ? `Landing page deste produto: <button type="button" class="link-texto" data-usar-link="${esc(sugerido)}">usar ${esc(sugerido)}</button>` : 'Página do servicos (/residencial/) ou endereço completo'}</small></label>
    <div class="grupo-campo largo"><span class="rotulo-campo">Imagem de capa</span>
      <div class="imagem-campo">
        <div class="imagem-mini f-retrato${imgUrl ? '' : ' vazia'}" ${imgUrl ? `style="background-image:url('${esc(imgUrl)}')"` : ''}>${imgUrl ? '' : 'sem imagem'}</div>
        <div class="imagem-acoes">
          <button type="button" class="u-botao" data-capa>${imgUrl ? 'Trocar imagem' : 'Enviar imagem'}</button>
          ${imgUrl ? '<button type="button" class="u-botao perigo" data-tirar-capa>Tirar imagem</button>' : ''}
          <small class="dica">Vertical, 4:5. Convertida para WebP aqui no navegador.</small>
        </div>
      </div>
    </div>
    <div class="largo"><div class="u-rotulo previa-rotulo">Como sai no site</div><div class="previa-cartao" id="previaCartao">${cartaoSite(p.publico)}</div></div>`;

  const notas = `<label class="u-campo largo"><span>O que falta, decisões, dependências${conta({ max: 4000 }, p.notas)}</span><textarea data-c="pr.notas" rows="8" maxlength="4000">${esc(p.notas)}</textarea></label>`;

  const pgBloco = p.id ? (pg
    ? `<div class="largo resumo-pagina"><span class="etq ${pg.publicada ? (pg.pendente ? 'atencao' : 'ok') : 'tracejada'}">${pg.publicada ? (pg.pendente ? 'mudanças não publicadas' : 'publicada') : 'rascunho'}</span>
        <span>/${esc(pg.slug)}/ · ${pg.blocos} módulos</span></div>
       <a class="u-botao meia" href="#/produto/${encodeURIComponent(p.id)}/pagina">Abrir a landing page</a>`
    : `<p class="largo dica-texto">Este produto ainda não tem landing page.</p><a class="u-botao meia" href="#/produto/${encodeURIComponent(p.id)}/pagina">Montar landing page</a>`) : '';

  $('#pagina').innerHTML = `${cabecalhoProduto(p, 'ficha')}
    <div class="cabecalho"><h1 class="u-titulo" id="tituloPagina">${esc(p.nome || 'Produto novo')}</h1>
      <div class="cab-acoes">${situacaoEtq(p.situacao)}</div></div>
    <div class="aviso" id="avisoGeral" hidden></div>
    <div class="blocos-fluxo" style="--bloco-larg:520px">
      ${bloco('ficha-situacao', 'Situação', `<div class="grade">${situacao}</div>`)}
      ${p.id ? bloco('ficha-pagina', 'Landing page', `<div class="grade">${pgBloco}</div>`) : ''}
      ${bloco('ficha-site', 'Cartão no site', `<div class="grade">${site}</div>`)}
      ${bloco('ficha-notas', 'Notas internas', notas)}
    </div>
    ${ed.novo || p.situacao === 'arquivado' ? '' : '<div class="rodape-acoes"><button type="button" class="u-botao perigo" data-arquivar>Arquivar produto</button></div>'}`;
  marcarMudanca();
  if (ed.novo) setTimeout(() => $('[data-c="pr.nome"]')?.focus(), 0);
}

async function salvarProduto() {
  const p = ed.rascunho;
  p.nome = p.nome.trim();
  if (!p.nome) { avisar('Dê um nome ao produto.', 'erro'); $('[data-c="pr.nome"]')?.focus(); return; }
  if (p.situacao === 'no-ar' && p.noSite && (!p.publico.titulo.trim() || !p.publico.link.trim())) {
    if (!confirm('No ar e marcado para o site, mas sem título ou link: não vai aparecer no grid. Salvar assim mesmo?')) return;
  }
  ocupado(true);
  try {
    if (ed.novo) {
      const base = slugDe(p.nome) || 'produto';
      let id = base, n = 2;
      while (catalogo.produtos.some((x) => x.id === id) || id === 'inicio') id = `${base}-${n++}`;
      p.id = id;
    }
    if (ed.arquivo) { p.publico.imagem = await enviarImagem(ed.arquivo, p.id); ed.arquivo = null; }
    const limpo = copiar(p);
    if (limpo.publico.imagem?.dataUrl) limpo.publico.imagem = null;
    const produtos = ed.novo ? [...catalogo.produtos, limpo] : catalogo.produtos.map((x) => (x.id === p.id ? limpo : x));
    const novo = ed.novo;
    if (await gravarCatalogo(produtos, novo ? `“${p.nome}” entrou no catálogo.` : `“${p.nome}” salvo.`)) {
      ed.original = copiar(limpo); ed.rascunho = copiar(limpo); ed.novo = false;
      if (novo) { hashAtual = `#/produto/${encodeURIComponent(p.id)}`; history.replaceState(null, '', hashAtual); rota = { nome: 'produto', id: p.id, aba: 'ficha' }; }
      desenharFicha();
      avisar(novo ? `“${p.nome}” entrou no catálogo.` : `“${p.nome}” salvo.`, 'ok');
    }
  } catch (e) {
    avisar('Não consegui salvar: ' + e.message, 'erro');
  } finally {
    ocupado(false);
  }
}

// ================================================================ MONTADOR DA LANDING PAGE

function desenharInicio() {
  document.title = 'Odisse · Página inicial';
  desenharMontador({ id: 'inicio', produto: null });
}

async function desenharMontador({ id, produto }) {
  const cab = produto
    ? cabecalhoProduto(produto, 'pagina') + `<div class="cabecalho"><h1 class="u-titulo">${esc(produto.nome)}</h1><div class="cab-acoes" id="acoesPagina"></div></div>`
    : `<div class="cabecalho"><h1 class="u-titulo">Página inicial</h1><div class="cab-acoes" id="acoesPagina"></div></div>`;
  $('#pagina').innerHTML = `${cab}<div class="aviso" id="avisoGeral" hidden></div><div id="montador"><div class="vazio">Carregando…</div></div>`;
  ed = { tipo: 'pagina', id, produto, registro: null, original: null, rascunho: null, criando: null };
  const resumo = resumoDe(id);
  if (!resumo && id !== 'inicio') {
    // confere a nuvem (pode ter sido criada em outro computador)
    await carregarPaginas();
    if (ed?.id !== id) return;
    if (!resumoDe(id)) return desenharCriacao();
  }
  try {
    const d = await api(`/api/admin/paginas/${encodeURIComponent(id)}`);
    if (ed?.id !== id) return;
    abrirRegistro(d.registro, d.resumo);
  } catch (e) {
    if (e.status === 404) return desenharCriacao();
    if (e.status === 401) return sair();
    $('#montador').innerHTML = `<div class="aviso erro">Não consegui abrir a página: ${esc(e.message)}</div>`;
  }
}

function abrirRegistro(registro, resumo) {
  ed.registro = registro;
  ed.original = copiar(registro.rascunho);
  ed.rascunho = copiar(registro.rascunho);
  ed.criando = null;
  if (resumo) trocarResumo(resumo);
  desenharEditor();
}

// ---------- criação: escolher os blocos da biblioteca

function desenharCriacao() {
  const p = ed.produto;
  const local = p?.publico.link?.match(/^\/([a-z0-9-]+)\/?$/)?.[1];
  ed.criando = ed.criando || { escolha: new Set(SUGERIDOS), base: '', slug: local && !RESERVADOS.has(local) ? local : slugDe(p?.nome || '') };
  const c = ed.criando;
  const bases = paginas.filter((x) => x.id !== 'inicio');
  $('#acoesPagina').innerHTML = '';
  $('#montador').innerHTML = `
    <div class="vazio grande">Este produto ainda não tem landing page. Escolha os módulos da biblioteca que vão compor a página e preencha os textos depois, módulo a módulo.</div>
    <section class="secao">
      <h2 class="u-subtitulo">Montar landing page</h2>
      <div class="criar-linha">
        <label class="u-campo"><span>Endereço</span><div class="campo-endereco"><span>servicos.odisse.com.br/</span><input type="text" id="novoSlug" value="${esc(c.slug)}" maxlength="60" spellcheck="false"><span>/</span></div></label>
        <div class="grupo-campo"><span class="rotulo-campo">Começar com</span><div class="seletor" id="selBase" role="radiogroup">
          <button type="button" role="radio" data-v="" aria-checked="${!c.base}">Módulos escolhidos, em branco</button>
          ${bases.map((b) => `<button type="button" role="radio" data-v="${esc(b.id)}" aria-checked="${c.base === b.id}">Cópia de /${esc(b.slug)}/</button>`).join('')}
        </div></div>
      </div>
      <div id="escolhaBlocos" ${c.base ? 'hidden' : ''}>
        <div class="u-rotulo previa-rotulo">Módulos (<span id="nEscolha">${c.escolha.size}</span> escolhidos; a ordem pode mudar depois)</div>
        ${vitrineTipos((t) => `<label class="tipo-cartao escolhivel${c.escolha.has(t.id) ? ' marcado' : ''}"><input type="checkbox" value="${t.id}" ${c.escolha.has(t.id) ? 'checked' : ''}>
          ${miniatura(t.id)}<span class="tipo-nome">${esc(t.nome)}${t.escuro ? ' <span class="etq">fundo ardósia</span>' : ''}</span><span class="tipo-desc">${esc(t.desc)}</span></label>`, (t) => t.id !== 'abertura-servicos')}
      </div>
      <div class="rodape-acoes"><button type="button" class="u-botao forte" id="btCriar">Criar landing page</button></div>
    </section>`;
  ligarMinis($('#montador'));
  $('#novoSlug').addEventListener('input', (e) => { c.slug = e.target.value.toLowerCase(); });
  $('#selBase').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    c.base = b.dataset.v;
    $('#selBase').querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
    $('#escolhaBlocos').hidden = !!c.base;
  });
  $('#escolhaBlocos').addEventListener('change', (e) => {
    const cx = e.target.closest('input[type=checkbox]'); if (!cx) return;
    if (cx.checked) c.escolha.add(cx.value); else c.escolha.delete(cx.value);
    cx.closest('.tipo-cartao').classList.toggle('marcado', cx.checked);
    $('#nEscolha').textContent = c.escolha.size;
  });
  $('#btCriar').addEventListener('click', criarPagina);
}

function vitrineTipos(cartao, filtro = () => true) {
  return GRUPOS.map((g) => {
    const tipos = TIPOS.filter((t) => t.grupo === g && filtro(t));
    if (!tipos.length) return '';
    return `<div class="grupo-tipos"><h3 class="u-rotulo">${esc(g)}</h3><div class="vitrine">${tipos.map(cartao).join('')}</div></div>`;
  }).join('');
}

async function criarPagina() {
  const c = ed.criando;
  const p = ed.produto;
  const slug = c.slug.trim().toLowerCase();
  if (!SLUG.test(slug) || RESERVADOS.has(slug)) { avisar('Endereço inválido: use letras minúsculas, números e hífen (sem acento).', 'erro'); $('#novoSlug').focus(); return; }
  let pagina;
  if (c.base) {
    try {
      const d = await api(`/api/admin/paginas/${encodeURIComponent(c.base)}`);
      pagina = { ...copiar(d.registro.rascunho), slug, titulo: `Odisse Arquitetos — ${p.publico.titulo || p.nome}`, descricao: '' };
      pagina.blocos = pagina.blocos.map((b) => ({ ...b, uid: undefined }));
    } catch (e) { avisar('Não consegui copiar a página: ' + e.message, 'erro'); return; }
  } else {
    const ordem = TIPOS.map((t) => t.id);
    const escolhidos = [...c.escolha].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    if (!escolhidos.length) { avisar('Escolha pelo menos um módulo.', 'erro'); return; }
    pagina = { slug, titulo: `Odisse Arquitetos — ${p.publico.titulo || p.nome}`, descricao: p.publico.texto || '', formulario: '', chamada: 'Quero Solicitar um Orçamento', whatsapp: true, textoWhatsapp: 'Quero Falar no WhatsApp', blocos: escolhidos.map(novoBloco) };
  }
  ocupado(true, $('#btCriar'));
  try {
    const d = await api(`/api/admin/paginas/${encodeURIComponent(ed.id)}`, { method: 'PUT', body: JSON.stringify({ versao: 0, pagina: limparPagina(pagina) }) });
    // o cartão do produto passa a apontar para a página, se ainda não tinha link
    if (!p.publico.link) {
      const produtos = catalogo.produtos.map((x) => (x.id === p.id ? { ...x, publico: { ...x.publico, link: `/${slug}/` } } : x));
      await gravarCatalogo(produtos);
      ed.produto = catalogo.produtos.find((x) => x.id === p.id) || p;
    }
    abrirRegistro(d.registro, d.resumo);
    avisar('Landing page criada como rascunho. Preencha os módulos e publique quando estiver pronta.', 'ok');
  } catch (e) {
    avisar('Não consegui criar: ' + e.message, 'erro');
  } finally {
    ocupado(false, $('#btCriar'));
  }
}

// ---------- editor: Bloco da página + Pilha de blocos

function enderecoDe(slug, casca) { return SITE + (casca ? `/${slug}/` : `/lp/?p=${slug}`); }

function desenharAcoes() {
  const r = resumoDe(ed.id);
  const pub = ed.registro?.publicado;
  const casca = r?.casca;
  const slug = ed.registro.rascunho.slug;
  const pendente = !pub || JSON.stringify(pub) !== JSON.stringify(ed.registro.rascunho) || sujo();
  const estado = !pub ? '<span class="etq tracejada">rascunho, nunca publicada</span>'
    : pendente ? `<span class="etq atencao">mudanças não publicadas</span>` : '<span class="etq ok">publicada</span>';
  const quandoPub = ed.registro.publicadoEm ? `<span class="u-apoio">Publicada em ${quando(ed.registro.publicadoEm)}</span>` : '';
  const ver = pub ? `<a class="u-botao" href="${esc(enderecoDe(pub.slug, r?.casca && pub.slug === slug))}" target="_blank" rel="noopener">Ver página ${IC.externo}</a>` : '';
  $('#acoesPagina').innerHTML = `${quandoPub}${estado}
    ${ver}<button type="button" class="u-botao" id="btPrevia" title="Abre o rascunho salvo">Ver prévia ${IC.externo}</button>
    <button type="button" class="u-botao forte" id="btPublicar" ${pendente ? '' : 'disabled'}>Publicar</button>`;
  $('#btPublicar').addEventListener('click', publicar);
  $('#btPrevia').addEventListener('click', () => abrirPrevia(slug));
}

// Prévia do rascunho salvo: o painel não mora mais no endereço do site, então a prévia é desenhada aqui
// (rascunho pela API, com a senha) numa aba nova, com os módulos e o endereço do site.
async function abrirPrevia(slug) {
  const aba = window.open('', '_blank');
  if (!aba) { avisar('O navegador bloqueou a aba da prévia.', 'erro'); return; }
  aba.document.write('<p style="padding:48px;font:15px/1.5 Inter,sans-serif">Abrindo a prévia…</p>');
  try {
    const { pagina } = await api(`/api/admin/previa/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    // o grid de serviços (bloco Abertura com serviços) sai do catálogo, como o site faz
    const noGrid = catalogo.produtos.filter((p) => p.situacao === 'no-ar' && p.noSite && p.publico.titulo && p.publico.link).map((p) => p.publico);
    const cartao = (p) => { const u = urlImagem(p.imagem, API); return `<a href="${esc(p.link)}" class="lp-servico${u ? '' : ' sem-imagem'}">${u ? `<div class="lp-servico-fundo" style="background-image:url('${esc(u)}')"></div>` : ''}<div class="lp-servico-veu"></div><div class="lp-servico-txt"><h3>${esc(p.titulo)}</h3>${p.texto ? `<p>${esc(p.texto)}</p>` : ''}<span class="lp-servico-cta">${esc(p.chamada)} <span class="seta">→</span></span></div></a>`; };
    const corpo = desenharPagina(pagina, { api: API })
      .replace('data-grid-servicos></div>', `data-grid-servicos style="--colunas:${Math.min(noGrid.length, 4) || 1}">${noGrid.map(cartao).join('')}</div>`);
    const doc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${SITE}/"><title>Prévia · ${esc(pagina.titulo || slug)}</title><link rel="stylesheet" href="https://marca.odisse.com.br/v1/marca.css"><link rel="stylesheet" href="/assets/lp/blocos.css"></head><body class="lp"><main id="lp"><div class="lp-aviso-previa">Prévia do rascunho — ainda não publicado</div>${corpo}</main></body></html>`;
    aba.location.replace(URL.createObjectURL(new Blob([doc], { type: 'text/html' })));
  } catch (e) {
    aba.document.body.innerHTML = `<p style="padding:48px;font:15px/1.5 Inter,sans-serif">Não consegui abrir a prévia: ${esc(e.message)}</p>`;
  }
}

function resumoBloco(b) {
  const d = b.dados || {};
  return d.titulo || d.rotulo || (d.itens?.[0]?.valor ? d.itens.map((x) => x.valor).filter(Boolean).join(' · ') : '') || '';
}

// campos do módulo em colunas, como a ficha do Universo: os textos do cabeçalho numa coluna,
// imagens e listas nas outras duas; sem imagens nem listas, três colunas (títulos · texto · o resto)
const CAB_MODULO = ['rotulo', 'titulo', 'texto', 'nomes', 'nota', 'chamada', 'botoes'];
function corpoModulo(t, b) {
  const html = (c) => campo(c, b.dados[c.id], `b.${b.uid}.${c.id}`);
  const col = (lista, classe = '') => `<div class="mod-col${classe}">${lista.map(html).join('')}</div>`;
  const cab = t.campos.filter((c) => CAB_MODULO.includes(c.id));
  const cont = t.campos.filter((c) => !CAB_MODULO.includes(c.id));
  if (!cont.length) {
    const c1 = cab.filter((c) => c.id === 'rotulo' || c.id === 'titulo');
    const c2 = cab.filter((c) => c.id === 'texto');
    const c3 = cab.filter((c) => !c1.includes(c) && !c2.includes(c));
    return `<div class="mod-tres">${col(c1)}${col(c2)}${col(c3)}</div>`;
  }
  if (!cab.length) return `<div class="mod-tres">${col(cont, ' tripla')}</div>`;
  return `<div class="mod-tres">${col(cab)}${col(cont, ' dupla')}</div>`;
}

const zonaInserir = (i) => `<div class="inserir" data-inserir="${i}"><button type="button" class="caixa" data-inserir-bt="${i}" aria-label="Acrescentar módulo aqui" title="Acrescentar módulo aqui">${IC.mais}</button></div>`;

function modulo(b) {
  const t = tipoDe(b.tipo);
  const fechado = fechados[`b-${b.uid}`] !== false ? ' fechado' : '';
  const aviso = t.topo && ed.rascunho.blocos[0] !== b ? '<div class="aviso">Módulo de topo: só aparece no site se for o primeiro da página.</div>' : '';
  return `<section class="bloco modulo${fechado}${t.escuro ? ' escuro' : ''}" data-bloco="b-${b.uid}" data-uid="${b.uid}">
    <div class="mod-cab">
      ${alca(t.nome)}
      <button type="button" class="mod-mini" data-alterna tabindex="-1" aria-hidden="true">${miniatura(t.id, b.dados, ed.rascunho)}</button>
      <h3 class="bloco-h"><button type="button" class="bloco-alterna" aria-expanded="${!fechado}">${esc(t.nome)}<small>${esc(resumoBloco(b))}</small></button></h3>
      ${t.escuro ? '<span class="etq">fundo ardósia</span>' : ''}
      <button type="button" class="caixa" data-bloco-acao="tira" data-uid="${b.uid}" aria-label="Tirar módulo" title="Tirar módulo">${IC.fechar}</button>
      <button type="button" class="caixa bloco-seta" data-alterna aria-label="Recolher ou abrir">${IC.baixo}</button>
    </div>
    <div class="bloco-corpo">${aviso}${corpoModulo(t, b)}</div>
  </section>`;
}

function desenharEditor() {
  const pg = ed.rascunho;
  const r = resumoDe(ed.id);
  const camposPagina = CAMPOS_PAGINA.map((c) => {
    if (c.id === 'slug') {
      return `<label class="u-campo"><span>${esc(c.rotulo)}</span><div class="campo-endereco"><span>servicos.odisse.com.br/</span><input type="text" data-c="p.slug" value="${esc(pg.slug)}" maxlength="60" spellcheck="false" ${ed.id === 'inicio' ? 'readonly' : ''}><span>/</span></div>
        ${r && !r.casca && ed.id !== 'inicio' ? `<small>Endereço novo: até a casca ser criada no site, a página fica em <b>/lp/?p=${esc(pg.slug)}</b>.</small>` : ''}</label>`;
    }
    return campo(c, pg[c.id], `p.${c.id}`);
  });
  const [slug, titulo, descricao, formulario, chamada, whatsapp, textoWhatsapp] = camposPagina;
  const paginaCorpo = `<div class="mod-tres">
    <div class="mod-col">${slug}${titulo}</div>
    <div class="mod-col">${descricao}</div>
    <div class="mod-col">${formulario}${chamada}${whatsapp}${textoWhatsapp}</div></div>`;

  $('#montador').innerHTML = `
    ${bloco('pagina-geral', 'Página', paginaCorpo, { classe: 'bloco-pagina' })}
    <section class="secao">
      <div class="secao-cab"><h2 class="u-subtitulo">Módulos da página</h2><span class="u-apoio">${pg.blocos.length} módulos · os textos e as imagens ficam aqui; o desenho é o da <a href="#/modulos">biblioteca</a></span>
        <span class="secao-cmds"><button type="button" class="link-texto" data-todos="abrir">abrir todos</button> · <button type="button" class="link-texto" data-todos="fechar">recolher todos</button></span></div>
      <div class="pilha-modulos" id="pilhaModulos">${zonaInserir(0)}${pg.blocos.map((b, i) => modulo(b) + zonaInserir(i + 1)).join('')}</div>
      <button type="button" class="acrescentar grande" id="btMaisBloco">+ Acrescentar módulo</button>
    </section>
    <section class="secao notas">
      <div><h3 class="u-rotulo">Como funciona</h3><p>Cada módulo é um padrão da biblioteca. Aqui se escolhem os módulos e a ordem (arrastando pela alça) e se preenchem os textos e as imagens; a página não é editada diretamente. <b>Salvar</b> guarda o rascunho; <b>Ver prévia</b> mostra o rascunho como vai sair; <b>Publicar</b> põe no ar.</p></div>
      <div><h3 class="u-rotulo">Fundo ardósia</h3><p>Autoria, Números e Chamada final ficam sobre ardósia. Módulos ardósia vizinhos se juntam numa faixa só, emendada no rodapé.</p></div>
      <div><h3 class="u-rotulo">Botões de contato</h3><p>O formulário e o WhatsApp vêm do Bloco <b>Página</b>. Sem formulário, o WhatsApp vira o botão principal. A conversão do Google Ads conta os cliques no WhatsApp de qualquer módulo.</p></div>
    </section>`;
  ligarMinis($('#montador'));
  desenharAcoes();
  marcarMudanca();
}

// a miniatura do módulo acompanha o que se digita (com uma pausa, para não redesenhar a cada tecla)
const minisPendentes = new Map();
function atualizarMini(uidB) {
  clearTimeout(minisPendentes.get(uidB));
  minisPendentes.set(uidB, setTimeout(() => {
    const b = ed?.rascunho?.blocos.find((x) => x.uid === uidB);
    const fr = document.querySelector(`[data-bloco="b-${uidB}"] .mod-mini iframe`);
    if (b && fr) fr.srcdoc = docMini(b.tipo, b.dados, ed.rascunho);
  }, 500));
}

async function salvarPagina() {
  const pg = limparPagina(ed.rascunho);
  if (!SLUG.test(pg.slug) || (RESERVADOS.has(pg.slug))) { avisar('Endereço inválido: use letras minúsculas, números e hífen (sem acento).', 'erro'); return false; }
  ocupado(true);
  try {
    const d = await api(`/api/admin/paginas/${encodeURIComponent(ed.id)}`, { method: 'PUT', body: JSON.stringify({ versao: ed.registro.versao, pagina: pg }) });
    const aberto = [...document.querySelectorAll('.modulo:not(.fechado)')].map((b) => b.dataset.bloco);
    const y = scrollY;
    abrirRegistro(d.registro, d.resumo);
    aberto.forEach((id) => { const b = document.querySelector(`[data-bloco="${CSS.escape(id)}"]`); if (b?.classList.contains('fechado')) alternarBloco(b); });
    scrollTo(0, y);
    avisar('Rascunho salvo. Publique para pôr no ar.', 'ok');
    return true;
  } catch (e) {
    if (e.status === 409 && e.dados?.registro) {
      avisar('Esta página foi mudada em outro lugar. Recarregue (Descartar) e refaça a mudança.', 'erro');
    } else if (e.status === 401) sair();
    else avisar('Não consegui salvar: ' + e.message, 'erro');
    return false;
  } finally {
    ocupado(false);
  }
}

async function publicar() {
  if (sujo() && !(await salvarPagina())) return;
  const bt = $('#btPublicar');
  ocupado(true, bt);
  try {
    const d = await api(`/api/admin/paginas/${encodeURIComponent(ed.id)}/publicar`, { method: 'POST', body: JSON.stringify({ versao: ed.registro.versao }) });
    abrirRegistro(d.registro, d.resumo);
    avisar(d.aviso || 'Publicada. O site mostra a página nova em até um minuto.', d.aviso ? '' : 'ok');
  } catch (e) {
    avisar('Não consegui publicar: ' + e.message, 'erro');
  } finally {
    ocupado(false, bt);
  }
}

function abrirEscolhaBloco(posicao = null) {
  ed.inserirEm = posicao;
  const temTopo = ed.rascunho.blocos.some((b) => tipoDe(b.tipo).topo);
  $('#dlgBlocosCorpo').innerHTML = vitrineTipos((t) => {
    const bloqueado = t.topo && temTopo;
    return `<button type="button" class="tipo-cartao${bloqueado ? ' bloqueado' : ''}" data-novo-bloco="${t.id}" ${bloqueado ? 'disabled' : ''}>
      ${miniatura(t.id)}<span class="tipo-nome">${esc(t.nome)}${t.escuro ? ' <span class="etq">fundo ardósia</span>' : ''}</span>
      <span class="tipo-desc">${bloqueado ? 'A página já tem um módulo de topo.' : esc(t.desc)}</span></button>`;
  }, (t) => ed.id === 'inicio' || t.id !== 'abertura-servicos');
  ligarMinis($('#dlgBlocosCorpo'));
  $('#dlgBlocos').showModal();
}

// ================================================================ BIBLIOTECA DE MÓDULOS

function desenharBiblioteca() {
  document.title = 'Odisse · Biblioteca de módulos';
  $('#pagina').innerHTML = `
    <div class="cabecalho"><h1 class="u-titulo">Biblioteca de módulos</h1><div class="cab-acoes"><span class="u-apoio">${TIPOS.length} módulos</span></div></div>
    <div class="aviso" id="avisoGeral" hidden></div>
    ${vitrineTipos((t) => `<div class="tipo-cartao estatico">${miniatura(t.id)}<span class="tipo-nome">${esc(t.nome)}${t.escuro ? ' <span class="etq">fundo ardósia</span>' : ''}${t.topo ? ' <span class="etq pessego">topo</span>' : ''}</span>
      <span class="tipo-desc">${esc(t.desc)}</span>
      <span class="tipo-campos">${t.campos.map((c) => esc(c.rotulo)).join(' · ')}</span></div>`)}
    <section class="secao notas">
      <div><h3 class="u-rotulo">A raiz das páginas</h3><p>Toda landing page do servicos é uma lista destes módulos com os seus textos e imagens. O desenho de cada módulo mora num lugar só (<b>assets/lp/blocos.js</b> e <b>blocos.css</b> no repositório servicos-odisse): mudou ali, mudaram todas as páginas na mesma hora.</p></div>
      <div><h3 class="u-rotulo">Marca</h3><p>Núcleo Arquitetos: fundo papel, painel areia, véu ardósia, selo Roda; Inter; tinta ardósia. Ocre só nos números grandes e nos marcadores. Os seis pontos laterais acompanham a tela, como no odisse.com.br.</p></div>
      <div><h3 class="u-rotulo">Módulo novo</h3><p>Um padrão novo (ex.: depoimentos, tabela de preços) entra na biblioteca a pedido, com os campos e o desenho, e fica disponível para todas as páginas.</p></div>
    </section>`;
  ligarMinis($('#pagina'));
}

// ================================================================ MUDANÇAS, SALVAR

function sujo() {
  if (!ed || !ed.rascunho || !ed.original) return false;
  if (ed.tipo === 'produto') return ed.novo || !!ed.arquivo || JSON.stringify(ed.rascunho) !== JSON.stringify(ed.original);
  return JSON.stringify(ed.rascunho) !== JSON.stringify(ed.original);
}

function marcarMudanca() {
  const m = sujo();
  $('#barraSalvar').hidden = !m;
  document.body.classList.toggle('com-barra', m);
  $('#barraTexto').textContent = ed?.tipo === 'produto' && ed.novo ? 'Produto novo, ainda não salvo' : ed?.tipo === 'pagina' ? 'Mudanças no rascunho, não salvas' : 'Mudanças não salvas';
  $('#btSalvar').textContent = ed?.tipo === 'pagina' ? 'Salvar rascunho' : 'Salvar';
  if (ed?.tipo === 'pagina' && ed.registro && $('#btPublicar')) {
    const pub = ed.registro.publicado;
    $('#btPublicar').disabled = !(m || !pub || JSON.stringify(pub) !== JSON.stringify(ed.registro.rascunho));
  }
}

function ocupado(sim, bt = $('#btSalvar')) {
  if (!bt) return;
  bt.disabled = sim;
  if (sim) { bt.dataset.texto = bt.textContent; bt.textContent = 'Aguarde…'; } else if (bt.dataset.texto) bt.textContent = bt.dataset.texto;
}

const salvar = () => (ed?.tipo === 'produto' ? salvarProduto() : ed?.tipo === 'pagina' ? salvarPagina() : null);

// ================================================================ EVENTOS

function moverEm(lista, i, passo) {
  const j = i + passo;
  if (j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
}

function redesenharMantendo() {
  const y = scrollY;
  if (ed.tipo === 'pagina') { desenharEditor(); } else desenharFicha();
  scrollTo(0, y);
}

let alvoImagem = null;

function ligar() {
  $('#btSalvar').addEventListener('click', salvar);
  $('#btDescartar').addEventListener('click', () => {
    if (!ed) return;
    if (ed.tipo === 'produto' && ed.novo) { ed = null; marcarMudanca(); location.hash = '#/'; return; }
    ed.rascunho = copiar(ed.original); ed.arquivo = null;
    redesenharMantendo();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && sujo()) { e.preventDefault(); salvar(); }
  });
  addEventListener('beforeunload', (e) => { if (sujo()) { e.preventDefault(); e.returnValue = ''; } });

  const pag = $('#pagina');

  // digitação: grava no rascunho pelo caminho do campo
  pag.addEventListener('input', (e) => {
    const el = e.target.closest('[data-c]');
    if (!el || !ed) return;
    const c = el.dataset.c;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    porCaminho(c, c === 'p.slug' ? v.toLowerCase().trim() : v);
    const contador = el.closest('.u-campo')?.querySelector('[data-conta]');
    if (contador && el.maxLength > 0) { contador.textContent = `${el.value.length} / ${el.maxLength}`; contador.classList.toggle('passou', el.value.length >= el.maxLength); }
    if (ed.tipo === 'produto') {
      if (c === 'pr.nome') { $('#tituloPagina').textContent = v || 'Produto novo'; $('#trilhaNome').textContent = v || 'Produto novo'; }
      if (c.startsWith('pr.publico.')) $('#previaCartao').innerHTML = cartaoSite(ed.rascunho.publico);
    } else {
      const bl = el.closest('.modulo');
      if (bl) {
        const b = ed.rascunho.blocos.find((x) => x.uid === bl.dataset.uid);
        const sm = bl.querySelector('.bloco-alterna small');
        if (b && sm) sm.textContent = resumoBloco(b);
        atualizarMini(bl.dataset.uid);
      } else if (/^p\.(formulario|chamada|whatsapp|textoWhatsapp)$/.test(c)) {
        ed.rascunho.blocos.forEach((b) => atualizarMini(b.uid));
      }
    }
    marcarMudanca();
  });

  pag.addEventListener('click', async (e) => {
    // recolher / abrir Bloco
    const alt = e.target.closest('.bloco-alterna, [data-alterna]');
    if (alt) { alternarBloco(alt.closest('.bloco')); return; }
    const todos = e.target.closest('[data-todos]');
    if (todos) {
      const fechar = todos.dataset.todos === 'fechar';
      document.querySelectorAll('.modulo').forEach((b) => { if (b.classList.contains('fechado') !== fechar) alternarBloco(b); });
      return;
    }
    if (!ed) return;
    // Seletor da situação (produto)
    const sel = e.target.closest('[data-seletor] button[data-v]');
    if (sel) {
      porCaminho(sel.parentElement.dataset.seletor, sel.dataset.v);
      sel.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', b === sel));
      marcarMudanca(); return;
    }
    const usar = e.target.closest('[data-usar-link]');
    if (usar) { ed.rascunho.publico.link = usar.dataset.usarLink; redesenharMantendo(); return; }
    if (e.target.closest('[data-capa]')) { alvoImagem = { capa: true }; $('#arqImagem').click(); return; }
    if (e.target.closest('[data-tirar-capa]')) { ed.rascunho.publico.imagem = null; ed.arquivo = null; redesenharMantendo(); return; }
    if (e.target.closest('[data-arquivar]')) {
      if (!confirm('Arquivar este produto? Ele sai do grid e da lista principal (fica em Arquivados).')) return;
      ed.rascunho.situacao = 'arquivado'; salvarProduto(); return;
    }
    // imagens dos blocos
    const im = e.target.closest('[data-imagem]');
    if (im) { alvoImagem = { caminho: im.dataset.imagem, formato: im.dataset.formato, bt: im }; $('#arqImagem').click(); return; }
    const tirar = e.target.closest('[data-tirar-imagem]');
    if (tirar) { porCaminho(tirar.dataset.tirarImagem, null); redesenharMantendo(); return; }
    // itens de listas (↑ ↓ × + Acrescentar)
    const it = e.target.closest('[data-item]');
    if (it) {
      const caminho = it.dataset.lista;
      const lista = lerCaminho(caminho);
      if (!Array.isArray(lista)) return;
      const i = Number(it.dataset.i);
      if (it.dataset.item === 'tira') lista.splice(i, 1);
      if (it.dataset.item === 'mais') {
        const [, uidB, campoId] = caminho.split('.');
        const tipo = tipoDe(ed.rascunho.blocos.find((b) => b.uid === uidB)?.tipo);
        const def = tipo?.campos.find((c) => c.id === campoId);
        lista.push(def?.tipo === 'lista' ? Object.fromEntries(def.campos.map((s) => [s.id, s.tipo === 'imagem' ? null : ''])) : '');
      }
      redesenharMantendo();
      if (it.dataset.item === 'mais') {
        const ultimo = [...document.querySelectorAll(`[data-c^="${CSS.escape(caminho)}."]`)].pop();
        ultimo?.focus();
      }
      return;
    }
    // tirar módulo
    const ba = e.target.closest('[data-bloco-acao]');
    if (ba) {
      const lista = ed.rascunho.blocos;
      const i = lista.findIndex((b) => b.uid === ba.dataset.uid);
      if (ba.dataset.blocoAcao === 'tira') {
        if (!confirm(`Tirar o módulo “${tipoDe(lista[i].tipo).nome}” desta página? (Só some de vez ao salvar.)`)) return;
        lista.splice(i, 1);
      }
      redesenharMantendo();
      return;
    }
    if (e.target.closest('#btMaisBloco')) { abrirEscolhaBloco(null); return; }
    const ins = e.target.closest('[data-inserir-bt]');
    if (ins) abrirEscolhaBloco(Number(ins.dataset.inserirBt));
  });

  // arrastar pela alça (módulos da página, itens das listas, linhas de texto); teclado: ↑ ↓ na alça
  pag.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-alca]');
    if (!h || e.button !== 0 || !ed?.rascunho) return;
    const el = h.closest('.modulo, [data-ordenavel] > [data-i]');
    if (!el) return;
    e.preventDefault();
    const cont = el.parentElement;
    const doModulo = el.classList.contains('modulo');
    const irmaos = () => [...cont.children].filter((x) => x !== el && (doModulo ? x.classList.contains('modulo') : x.hasAttribute('data-i')));
    const vertical = doModulo || getComputedStyle(cont).display !== 'grid' || getComputedStyle(cont).gridTemplateColumns.split(' ').length < 2;
    const ordemAntes = [...cont.children].filter((x) => x === el || irmaos().includes(x)).map((x) => x.dataset.uid || x.dataset.i).join();
    el.classList.add('arrastado');
    cont.classList.add('arrastando');
    document.body.classList.add('sem-selecao');
    let rolar = 0;
    const passo = () => { if (rolar) { scrollBy(0, rolar); requestAnimationFrame(passo); } };
    const mover = (ev) => {
      const depois = irmaos().find((x) => {
        const r = x.getBoundingClientRect();
        return vertical ? ev.clientY < r.top + r.height / 2 : ev.clientY < r.top || (ev.clientY <= r.bottom && ev.clientX < r.left + r.width / 2);
      });
      if (depois) { if (el.nextElementSibling !== depois) cont.insertBefore(el, depois); }
      else { const ult = irmaos().pop(); if (ult && ult.nextElementSibling !== el) ult.after(el); }
      const antes = rolar;
      rolar = ev.clientY < 70 ? -14 : ev.clientY > innerHeight - 70 ? 14 : 0;
      if (rolar && !antes) requestAnimationFrame(passo);
    };
    const soltar = () => {
      rolar = 0;
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', soltar);
      removeEventListener('pointercancel', soltar);
      el.classList.remove('arrastado');
      cont.classList.remove('arrastando');
      document.body.classList.remove('sem-selecao');
      const nova = [...cont.children].filter((x) => x === el || irmaos().includes(x));
      if (nova.map((x) => x.dataset.uid || x.dataset.i).join() === ordemAntes) return;
      if (doModulo) {
        const porUid = new Map(ed.rascunho.blocos.map((b) => [b.uid, b]));
        ed.rascunho.blocos = nova.map((x) => porUid.get(x.dataset.uid));
      } else {
        const lista = lerCaminho(cont.dataset.ordenavel);
        const velha = lista.slice();
        lista.splice(0, lista.length, ...nova.map((x) => velha[Number(x.dataset.i)]));
      }
      redesenharMantendo();
    };
    // na janela, não na alça: mover o cartão no DOM solta a captura do ponteiro
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
  });
  pag.addEventListener('keydown', (e) => {
    const h = e.target.closest('[data-alca]');
    if (!h || !ed?.rascunho || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const passo = e.key === 'ArrowUp' ? -1 : 1;
    const mod = h.closest('.modulo');
    const item = h.closest('[data-ordenavel] > [data-i]');
    if (item) {
      const caminho = item.parentElement.dataset.ordenavel;
      const i = Number(item.dataset.i);
      moverEm(lerCaminho(caminho), i, passo);
      redesenharMantendo();
      document.querySelectorAll(`[data-ordenavel="${CSS.escape(caminho)}"] > [data-i="${i + passo}"] [data-alca]`)[0]?.focus();
    } else if (mod) {
      const lista = ed.rascunho.blocos;
      moverEm(lista, lista.findIndex((b) => b.uid === mod.dataset.uid), passo);
      redesenharMantendo();
      document.querySelector(`.modulo[data-uid="${mod.dataset.uid}"] [data-alca]`)?.focus();
    }
  });

  // escolher módulo novo
  const dlg = $('#dlgBlocos');
  dlg.querySelector('[data-fechar]').innerHTML = IC.fechar;
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-fechar]')) { dlg.close(); return; }
    const n = e.target.closest('[data-novo-bloco]');
    if (!n || !ed?.rascunho) return;
    const b = novoBloco(n.dataset.novoBloco);
    const lista = ed.rascunho.blocos;
    if (tipoDe(b.tipo).topo) lista.unshift(b);
    else if (Number.isInteger(ed.inserirEm)) lista.splice(Math.max(ed.inserirEm, lista[0] && tipoDe(lista[0].tipo).topo ? 1 : 0), 0, b);
    else lista.push(b);
    dlg.close();
    desenharEditor();
    const el = document.querySelector(`[data-bloco="b-${b.uid}"]`);
    if (el?.classList.contains('fechado')) alternarBloco(el);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // arquivo de imagem (capa do produto ou campo de bloco)
  $('#arqImagem').addEventListener('change', async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq || !ed || !alvoImagem) return;
    const a = alvoImagem; alvoImagem = null;
    if (a.capa) {
      ed.arquivo = arq;
      ed.rascunho.publico.imagem = { dataUrl: await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(arq); }) };
      redesenharMantendo();
      return;
    }
    if (a.bt) { a.bt.disabled = true; a.bt.textContent = 'Enviando…'; }
    try {
      const max = a.formato === 'paisagem' || a.formato === 'faixa' ? 2400 : 1600;
      porCaminho(a.caminho, await enviarImagem(arq, `lp-${ed.rascunho.slug || 'pagina'}`, max));
      redesenharMantendo();
    } catch (err) {
      avisar('Não consegui enviar a imagem: ' + err.message, 'erro');
      if (a.bt) { a.bt.disabled = false; a.bt.textContent = 'Enviar imagem'; }
    }
  });
}

ligar();
const guardada = lerSenha();
if (guardada) entrar(guardada);
else irParaEntrada();
