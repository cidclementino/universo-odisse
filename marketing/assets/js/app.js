// Universo — publicações do Odisse: posts 3:4 (Instagram) e pins 2:3 (Pinterest).
// Duas vistas: início (subpágina do formato: criar + arquivo) e editor de uma publicação.
// O editor é o mesmo para todos os formatos; muda o canvas, o repertório de modelos e os campos do canal.

import { NUCLEOS, ORDEM_NUCLEOS, padroesDoNucleo, COR, tintaSobre } from './nucleos.js';
import {
  modelosDo, modeloDe, codigoDe, slotsDe, migrarCard, opcoesDe, opcoesDoModelo, SEQUENCIAS, SEQUENCIA_PIN, GRUPOS, grupoDe, renderCard, exemploDe, ajustarLayout, ajustar, crescer, refluir, textosDe, estruturaDe, OP_VEU, LARG,
} from './templates.js';
import * as pinterest from './pinterest.js';
import * as pool from './pool.js';
import { renderCalendario } from './pagina-calendario.js';
import { renderEstrategia } from './pagina-estrategia.js';
import { mark } from './marks.js';
import { lerArquivo, tratar } from './imaging.js';
import * as local from './store.js';
import * as nuvem from './nuvem.js';
import { instalarPadroes, MACROS, TEXTO_POR_CLASSE, FORMATO_POR_ID } from './padroes.js';
import { carregarMarca } from './marca.js';
import { renderPadroes } from './pagina-padroes.js';
import { renderMetricas } from './pagina-metricas.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VERSAO = 4; // 4: modelos universais (O-01…O-11) com opções por card
/** Ícone (i): o texto de ajuda aparece ao pousar o mouse. */
const info = (txt) => (txt ? ` <span class="info" tabindex="0" data-info="${esc(txt)}">i</span>` : '');

// ---------------------------------------------------------------------------
// Preferências de interface (por navegador)

const prefs = (() => {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('universo-prefs') || '{}'); } catch { /* sem storage */ }
  return {
    get: (k, d) => (k in p ? p[k] : d),
    set: (k, v) => { p[k] = v; try { localStorage.setItem('universo-prefs', JSON.stringify(p)); } catch { /* */ } },
  };
})();

// ---------------------------------------------------------------------------
// Guias de composição (só no editor; não entram na exportação)

/** Guias na altura do canvas do formato (1440 no post, 1620 no pin). O recorte quadrado só existe no post. */
const guiasSvg = (alt) => `<svg class="guias" viewBox="0 0 1080 ${alt}" preserveAspectRatio="none" aria-hidden="true">
  <g class="g-diagonais"><path d="M0 0L1080 ${alt}M1080 0L0 ${alt}"/></g>
  <g class="g-tercos"><path d="M360 0V${alt}M720 0V${alt}M0 ${alt / 3}H1080M0 ${(2 * alt) / 3}H1080"/></g>
  ${alt === 1440 ? '<g class="g-quadrado"><path class="veu-q" d="M0 0H1080V180H0ZM0 1260H1080V1440H0Z"/><rect x="0" y="180" width="1080" height="1080"/></g>' : ''}
</svg>`;
const GUIAS = [
  ['diagonais', 'Diagonais', 'Diagonais do card, de canto a canto'],
  ['tercos', 'Terços', 'Regra dos terços: o card dividido em três, na horizontal e na vertical'],
  ['quadrado', '1080×1080', 'Recorte quadrado do grid do perfil (y 180 a 1260)', '3x4'],
];

function renderGuias() {
  const ativas = prefs.get('guias', []);
  $('#guias').innerHTML = GUIAS.filter((g) => !g[3] || g[3] === formatoDe(pub)).map(([id, rot, dica]) =>
    `<button class="${ativas.includes(id) ? 'ativo' : ''}" data-guia="${id}" title="${dica}" aria-pressed="${ativas.includes(id)}">${rot}</button>`).join('');
  GUIAS.forEach(([id]) => $('#palco').classList.toggle(`com-${id}`, ativas.includes(id)));
}

// ---------------------------------------------------------------------------
// Estado

let pub = null;          // publicação aberta no editor
let resumos = [];        // arquivo (local + nuvem)
let modo = prefs.get('modo', '3');
const imagens = new Map(); // ref → dataURL original

const nucleo = () => NUCLEOS[pub.nucleo];
const cardAtivo = () => pub?.cards[pub.ativo];

// Formatos: '3x4' (posts do Instagram, padrão das publicações antigas) e 'pin' (Pinterest).
const formatoDe = (p) => p?.formato || '3x4';
const ehPin = (p = pub) => formatoDe(p) === 'pin';
const altDe = (p = pub) => FORMATO_POR_ID[formatoDe(p)].canvas[1];
const classeCard = (p = pub) => (ehPin(p) ? 'card pin' : 'card');
/** Subpáginas de Publicações: [rota, formato, nome]. */
const SUBPAGINAS = [['posts', '3x4', 'Posts 3:4'], ['pins', 'pin', 'Pins 2:3']];
const rotaDoFormato = (f) => SUBPAGINAS.find((x) => x[1] === f)?.[0] || 'posts';
let formatoInicio = prefs.get('formatoInicio', '3x4');
/** As informações padrão lembradas por núcleo são separadas por formato. */
const chaveGlobais = (nucleoId, formato) => (formato === 'pin' ? 'globais-pin:' : 'globais:') + nucleoId;

function novoCard(modelo, nucleoId, formato = '3x4') {
  const c = { id: uid('c'), modelo, campos: exemploDe(nucleoId, modelo), imgs: {} };
  if (formato === 'pin') c.pin = pinterest.pinVazio(nucleoId);
  return c;
}

async function novaPublicacao(nucleoId, formato = '3x4') {
  const ultimos = (await local.lerMeta(chaveGlobais(nucleoId, formato))) || {};
  const agora = new Date().toISOString();
  const globais = { ...padroesDoNucleo(nucleoId), ...ultimos, dataPublicacao: '' };
  if (formato === 'pin') {
    // o link é de cada projeto; os créditos, lembrados do último projeto do núcleo
    globais.link = '';
    globais.projeto = ''; // cada publicação de pins é um projeto, peça ou texto novo
    globais.creditos = ultimos.creditos ?? pinterest.CREDITOS[nucleoId].pt;
    globais.creditosEn = ultimos.creditosEn ?? pinterest.CREDITOS[nucleoId].en;
  }
  return {
    id: uid('p'),
    versao: VERSAO,
    formato,
    nucleo: nucleoId,
    titulo: '',
    globais,
    cards: (formato === 'pin' ? SEQUENCIA_PIN : SEQUENCIAS[nucleoId]).map((m) => novoCard(m, nucleoId, formato)),
    ativo: 0,
    criado: agora,
    atualizado: agora,
    capa: '',
  };
}

const tituloDe = (p) => p.titulo || p.globais?.projeto || 'Sem título';

// ---------------------------------------------------------------------------
// Salvamento
// - rascunho: cada alteração vai para o navegador (IndexedDB), automaticamente;
// - nuvem: ao criar, no botão Salvar (Ctrl+S), ao exportar, ao sair do editor
//   e a cada 20 minutos se houver alteração.

const AUTOSALVAR_MIN = 20;
let timerLocal;
const pendente = () => !!pub && (pub.atualizado || '') > (pub.salvoEm || '');

function salvar() {
  if (!pub) return;
  pub.atualizado = new Date().toISOString();
  status('pendente');
  clearTimeout(timerLocal);
  timerLocal = setTimeout(async () => {
    await local.gravarPub(pub);
    await local.gravarMeta(chaveGlobais(pub.nucleo, formatoDe(pub)), pub.globais);
  }, 350);
}

let salvando = null;
async function salvarNaNuvem({ silencioso = false } = {}) {
  if (!pub) return;
  if (salvando) return salvando;
  const alvo = pub;
  status('salvando');
  salvando = (async () => {
    try {
      alvo.capa = await gerarCapa(alvo).catch(() => alvo.capa);
      for (const ref of local.refsDe(alvo)) await garantirImagemNaNuvem(ref);
      const marca = alvo.atualizado;
      await nuvem.gravar({ ...alvo, salvoEm: marca });
      alvo.salvoEm = marca;
      await local.gravarPub(alvo);
      status(pub === alvo && pendente() ? 'pendente' : 'salvo', alvo.salvoEm);
      if (!silencioso) aviso('Publicação salva.');
    } catch (e) {
      console.warn(e);
      if (e.message === 'senha incorreta') return sair();
      status('erro', e.message);
      if (!silencioso) aviso('Não foi possível salvar na nuvem. O rascunho continua neste computador.');
    } finally {
      salvando = null;
    }
  })();
  return salvando;
}

setInterval(() => { if (pendente()) salvarNaNuvem({ silencioso: true }); }, AUTOSALVAR_MIN * 60 * 1000);

const enviadas = new Set();
async function garantirImagemNaNuvem(ref) {
  if (enviadas.has(ref)) return;
  const src = imagens.get(ref) || (await local.lerImg(ref));
  if (!src) return;
  if (!(await nuvem.existeImg(ref))) await nuvem.enviarImg(ref, src);
  enviadas.add(ref);
}

function status(tipo, detalhe = '') {
  const el = $('#sinc');
  el.dataset.estado = tipo;
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  $('#sincTxt').textContent = {
    pendente: 'Alterações não salvas',
    salvando: 'Salvando…',
    salvo: detalhe ? `Salvo às ${hora(detalhe)}` : 'Salvo',
    erro: 'Erro ao salvar',
    pronto: '',
  }[tipo] ?? tipo;
  el.title = tipo === 'erro' ? `Não foi possível salvar na nuvem (${detalhe}). O rascunho continua neste computador.` : '';
  $('#btSalvar').disabled = tipo === 'salvando';
}

function aviso(msg) {
  const el = $('#aviso');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------------------------------------------------------------------------
// Imagens: originais em memória/IndexedDB/nuvem; tratadas só em memória

async function carregarImagens(p) {
  const faltando = [];
  for (const ref of local.refsDe(p)) {
    if (imagens.has(ref)) continue;
    const src = await local.lerImg(ref);
    if (src) imagens.set(ref, src);
    else faltando.push(ref);
  }
  if (faltando.length) {
    await Promise.all(faltando.map(async (ref) => {
      try {
        const src = await nuvem.baixarImg(ref);
        imagens.set(ref, src);
        await local.gravarImg(ref, src);
        enviadas.add(ref);
      } catch (e) { console.warn('imagem não encontrada', ref, e); }
    }));
  }
}

const tratadas = new Map();
let timerReTrilho;
function fonteImagem(card, slot) {
  const im = card.imgs[slot];
  const src = im?.ref ? imagens.get(im.ref) : im?.src;
  if (!src) return null;
  const trat = NUCLEOS[pub?.nucleo || 'estudio'].tratamento;
  if (semTratamento(im) || trat.tipo === 'nenhum') return src;
  const k = `${pub.nucleo}:${im.ref || card.id + slot}`;
  if (typeof tratadas.get(k) === 'string') return tratadas.get(k);
  if (!tratadas.has(k)) {
    tratadas.set(k, null);
    tratar(src, trat).then((out) => {
      tratadas.set(k, out);
      clearTimeout(timerReTrilho);
      timerReTrilho = setTimeout(() => { if (pub) { renderTrilho(); renderImagens(); } }, 30);
    });
  }
  return src;
}
/** A imagem sai sem o tratamento do núcleo? Vale a escolha da própria imagem; senão, a da publicação. */
function semTratamento(im) {
  return im.original ?? !!pub?.globais?.semTratamento;
}
async function aguardarTratamentos(cards) {
  const trat = nucleo().tratamento;
  if (trat.tipo === 'nenhum') return;
  const tarefas = [];
  for (const c of cards) for (const s of Object.keys(c.imgs)) {
    const im = c.imgs[s];
    const src = im?.ref ? imagens.get(im.ref) : null;
    if (!src || semTratamento(im)) continue;
    const k = `${pub.nucleo}:${im.ref}`;
    if (typeof tratadas.get(k) !== 'string') tarefas.push(tratar(src, trat).then((o) => tratadas.set(k, o)));
  }
  await Promise.all(tarefas);
}

// ---------------------------------------------------------------------------
// Texto editado: só negrito e quebra de linha

function limparHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  let out = '';
  const andar = (no) => {
    for (const c of no.childNodes) {
      if (c.nodeType === 3) out += c.textContent.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
      else if (c.nodeType === 1) {
        const tag = c.tagName;
        if (tag === 'BR') out += '<br>';
        else if (tag === 'B' || tag === 'STRONG') { out += '<b>'; andar(c); out += '</b>'; }
        else if (tag === 'DIV' || tag === 'P') { if (out && !out.endsWith('<br>')) out += '<br>'; andar(c); }
        else andar(c);
      }
    }
  };
  andar(tpl.content);
  out = out.replace(/(<br>)+$/, '');
  return out === '<br>' ? '' : out;
}

// ===========================================================================
// INÍCIO — criar e arquivo

let filtro = 'todos';

// Arquivo de publicações: o que está neste navegador aparece na hora; a lista da nuvem é consultada
// por baixo, no máximo uma vez por minuto (ou na hora, quando `forcar`), e a tela se ajusta se algo mudou.
const INTERVALO_LISTA = 60 * 1000;
let remotos = null, remotosEm = 0;

async function montarResumos() {
  const locais = await local.listarPubs();
  const mapa = new Map(locais.map((r) => [r.id, { ...r, rascunho: (r.atualizado || '') > (r.salvoEm || '') }]));
  for (const r of remotos || []) {
    const l = mapa.get(r.id);
    if (!l || (r.atualizado || '') >= (l.atualizado || '')) mapa.set(r.id, { ...r, rascunho: false });
  }
  resumos = [...mapa.values()].sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''));
}

/** Busca a lista na nuvem. Devolve true quando ela mudou desde a última consulta. */
async function buscarLista(forcar = false) {
  if (!forcar && remotos && Date.now() - remotosEm < INTERVALO_LISTA) return false;
  try {
    const novos = await nuvem.listar();
    const mudou = JSON.stringify(novos) !== JSON.stringify(remotos);
    remotos = novos;
    remotosEm = Date.now();
    status('pronto');
    return mudou;
  } catch (e) {
    if (e.message === 'senha incorreta') { sair(); return false; }
    status('erro', e.message);
    return false;
  }
}

/** Arquivo completo, esperando a nuvem (usado depois de duplicar, excluir ou abrir por link). */
async function carregarArquivo() {
  await buscarLista(true);
  await montarResumos();
}

const DICA_CRIAR = {
  '3x4': 'Escolha o núcleo. O carrossel já começa com o repertório de modelos dele.',
  pin: 'Escolha o núcleo. Cada publicação é um projeto, uma peça ou um texto: de 8 a 15 pins, publicados aos poucos e em pastas diferentes. Começa com um pin; os outros entram pelo +.',
};

function renderInicio() {
  const fmt = formatoInicio, pins = fmt === 'pin';
  $('#pubNav').innerHTML = SUBPAGINAS.map(([r, f, nome]) => `<a href="#/publicacoes/${r}" class="${f === fmt ? 'ativo' : ''}">${nome}</a>`).join('')
    + '<span class="em-breve" title="Em breve">Stories 9:16</span>';
  $('#criarTit').textContent = pins ? 'Novo projeto de pins' : 'Nova publicação';
  $('#criarInfo').dataset.info = DICA_CRIAR[fmt];
  const doFormato = resumos.filter((r) => (r.formato || '3x4') === fmt);
  const unid = (q) => (pins ? (q === 1 ? 'projeto' : 'projetos') : q === 1 ? 'publicação' : 'publicações');
  $('#tiles').innerHTML = ORDEM_NUCLEOS.map((id) => {
    const n = NUCLEOS[id];
    const cor = tintaSobre(n.painel);
    const qtd = doFormato.filter((r) => r.nucleo === id).length;
    return `<button class="tile" data-criar="${id}" style="--painel:${n.painel};--tinta:${cor}">
      <span class="tile-selo">${mark(n.selo, 54)}</span>
      <span class="tile-txt"><b>Odisse ${n.nome}</b><small>${n.conteudo}</small></span>
      <span class="tile-mais">+ Criar</span>
      <span class="tile-qtd">${qtd} ${unid(qtd)}</span>
    </button>`;
  }).join('');

  $('#filtros').innerHTML = [['todos', 'Todos'], ...ORDEM_NUCLEOS.map((id) => [id, NUCLEOS[id].nome])]
    .map(([v, r]) => `<button data-filtro="${v}" class="${filtro === v ? 'ativo' : ''}">${r}</button>`).join('');

  const busca = $('#busca').value.trim().toLowerCase();
  const lista = doFormato.filter((r) => (filtro === 'todos' || r.nucleo === filtro) && (!busca || (r.titulo || '').toLowerCase().includes(busca)));
  $('#arquivoInfo').textContent = doFormato.length
    ? `${doFormato.length} ${unid(doFormato.length)}`
    : pins ? 'Nenhum projeto de pins ainda.' : 'Nenhuma publicação ainda.';
  $('#listaPubs').classList.toggle('pins', pins);

  const data = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  $('#listaPubs').innerHTML = lista.length ? lista.map((r) => {
    const n = NUCLEOS[r.nucleo] || NUCLEOS.estudio;
    const capa = r.capa
      ? `<img src="${r.capa}" alt="">`
      : `<span class="sem-capa" style="background:${n.painel};color:${tintaSobre(n.painel)}">${mark(n.selo, 40)}</span>`;
    return `<article class="pub" data-id="${r.id}">
      <a class="pub-capa" href="#/p/${r.id}">${capa}</a>
      <div class="pub-info">
        <a href="#/p/${r.id}" class="pub-nome">${esc(r.titulo || 'Sem título')}</a>
        <span class="pub-meta"><i style="background:${n.painel}"></i>${n.nome} · ${r.ncards} ${pins ? (r.ncards === 1 ? 'pin' : 'pins') : 'cards'}</span>
        <span class="pub-data">${data(r.atualizado)}${r.rascunho ? ' · <b class="rascunho" title="Há alterações deste computador que ainda não foram salvas na nuvem">não salvo</b>' : ''}</span>
      </div>
      <div class="pub-acoes">
        <button data-dup="${r.id}" title="Duplicar">Duplicar</button>
        <button data-del="${r.id}" class="perigo" title="Excluir">Excluir</button>
      </div>
    </article>`;
  }).join('') : `<p class="vazio-arquivo">${doFormato.length ? 'Nada encontrado com esse filtro.' : pins ? 'Os projetos de pins que você criar aparecem aqui.' : 'As publicações que você criar aparecem aqui.'}</p>`;
  $('#pastasSec').hidden = !pins;
  if (pins) renderPastas();
}

// ---- Pastas do Pinterest (subpágina Pins) --------------------------------------

function renderPastas() {
  const lista = pinterest.listaPastas();
  $('#pastasSec').innerHTML = `<div class="sec-cab linha"><div>
      <h2>Pastas do Pinterest${info('As pastas seguem o que as pessoas buscam, não os nomes dos projetos: cada projeto se espalha por várias. A ordem aqui é a do perfil. Valem para todos os computadores.')}</h2>
      <p>${lista.length} pastas · Arquitetos, Objetos, Elaia, Estúdio e as comuns a todos</p></div></div>
    <div class="pastas-grupos">${pinterest.GRUPOS_PASTA.map(([g, nome]) => {
      const itens = lista.filter((x) => x.grupo === g);
      return `<div class="pastas-grupo" data-grupo="${g}">
        <h3>${nome} <small>${itens.length}</small></h3>
        ${itens.map((x, i) => `<div class="pasta-item" data-pasta="${esc(x.id)}">
          <input class="pasta-nome" data-pasta-campo="nome" value="${esc(x.nome)}" placeholder="Nome da pasta" aria-label="Nome da pasta">
          <div class="pasta-acoes">
            <button data-pasta-mover="-1" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
            <button data-pasta-mover="1" ${i === itens.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
            <button data-pasta-remover class="perigo" title="Remover a pasta">×</button>
          </div>
          <input class="pasta-desc" data-pasta-campo="desc" value="${esc(x.desc || '')}" placeholder="O que entra" aria-label="O que entra nesta pasta">
        </div>`).join('') || '<p class="vazio">Nenhuma pasta.</p>'}
        <button class="pasta-mais" data-pasta-nova="${g}">+ Pasta</button>
      </div>`;
    }).join('')}</div>`;
}

function mudarPastas(fn, redesenhar = true) {
  const lista = structuredClone(pinterest.listaPastas());
  fn(lista);
  pinterest.gravarPastas(lista).then((ok) => { if (!ok) aviso('Pastas guardadas neste computador; não foi possível salvar na nuvem.'); });
  if (redesenhar) renderPastas();
}

async function abrirPublicacao(id) {
  let p = await local.lerPub(id);
  const r = resumos.find((x) => x.id === id);
  if (!p || (r && !r.rascunho && (r.atualizado || '') > (p.atualizado || ''))) {
    try {
      p = await nuvem.ler(id);
      await local.gravarPub(p);
    } catch (e) {
      if (!p) { aviso('Não foi possível abrir essa publicação.'); location.hash = '#/'; return; }
    }
  }
  if (!p) { aviso('Publicação não encontrada.'); location.hash = '#/'; return; }
  await carregarImagens(p);
  pub = p;
  pub.ativo = Math.min(pub.ativo || 0, pub.cards.length - 1);
  // cards de versões anteriores → modelos universais com as opções equivalentes
  const migrou = pub.cards.map((c) => migrarCard(pub.nucleo, c)).some(Boolean);
  if (migrou || (pub.versao || 0) < VERSAO) { pub.versao = VERSAO; salvar(); }
  mostrar('editor');
  status(pendente() ? 'pendente' : 'salvo', pub.salvoEm);
  renderEditor();
}

async function duplicarPublicacao(id) {
  let p = await local.lerPub(id);
  if (!p && nuvem.ativa()) p = await nuvem.ler(id);
  if (!p) return;
  const agora = new Date().toISOString();
  const copia = { ...structuredClone(p), id: uid('p'), titulo: `${tituloDe(p)} (cópia)`, criado: agora, atualizado: agora };
  const novos = new Map(copia.cards.map((c) => [c.id, uid('c')]));
  copia.cards.forEach((c) => {
    c.id = novos.get(c.id);
    if (c.pin?.par) c.pin.par = novos.get(c.pin.par); // versões PT/EN continuam ligadas na cópia
  });
  copia.salvoEm = copia.atualizado;
  await local.gravarPub(copia);
  await nuvem.gravar(copia).catch(() => { copia.salvoEm = ''; return local.gravarPub(copia); });
  await carregarArquivo();
  renderInicio();
  aviso('Publicação duplicada.');
}

async function excluirPublicacao(id, botao) {
  if (!botao.dataset.confirmar) {
    botao.dataset.confirmar = '1';
    botao.textContent = 'Confirmar?';
    setTimeout(() => { delete botao.dataset.confirmar; botao.textContent = 'Excluir'; }, 2500);
    return;
  }
  await local.apagarPub(id);
  await nuvem.apagar(id).catch((e) => aviso('Excluída aqui, mas não na nuvem: ' + e.message));
  await carregarArquivo();
  renderInicio();
}

// ===========================================================================
// EDITOR

function renderEditor() {
  const n = nucleo();
  document.documentElement.style.setProperty('--cor-nucleo', n.painel === COR.pessego || n.painel === COR.areia ? COR.ocre : n.painel);
  $('#pubChip').innerHTML = mark(n.selo, 15);
  $('#pubChip').style.cssText = `background:${n.painel};color:${tintaSobre(n.painel)}`;
  $('#pubNucleo').textContent = `Odisse ${n.nome}`;
  $('#pubTitulo').value = pub.titulo || '';
  $('#pubTitulo').placeholder = pub.globais.projeto || 'Título da publicação';
  document.title = `${tituloDe(pub)} · Universo`;
  const pin = ehPin();
  document.body.classList.toggle('editor-pin', pin);
  $('#btVoltar').href = `#/publicacoes/${rotaDoFormato(formatoDe(pub))}`;
  $('#cardRot').textContent = pin ? 'Dados do pin' : 'Dados do card';
  $('#btExportarCard').textContent = pin ? 'Exportar pin' : 'Exportar card';
  $('#btExportarTudo').textContent = pin ? 'Exportar lote (.zip)' : 'Exportar carrossel';
  $('#btExportarCard').title = pin ? 'JPG em 1000 × 1500' : 'JPG em 1080 × 1440';
  $('#btExportarTudo').title = pin ? 'Todos os pins em JPG, com o textos.txt (título, descrição, pasta e link de cada pin)' : 'Todos os cards em JPG, num .zip';
  $('#btPool').title = pin
    ? 'Envia todos os pins ao pool de mídias (imagem e textos), para agendar no Calendário. Reenviar atualiza o que ainda não foi publicado.'
    : 'Envia o carrossel ao pool de mídias, para agendar no Calendário. Reenviar atualiza, se ainda não foi publicado.';
  // pool por baixo: avisa no painel de imagens quando a foto já está no pool
  const alvo = pub;
  pool.carregar().then(() => { if (pub === alvo && ehPin()) renderImagens(); }).catch(() => {});
  renderGuias();
  renderGlobais();
  renderTrilho();
  renderModelos();
  renderImagens();
}

// ---- Informações padrão ---------------------------------------------------

const CAMPOS_GLOBAIS = [
  { grupo: 'Dados da publicação', dica: 'Valem para todos os cards desta publicação.', campos: [
    { k: '__titulo', rot: 'Nome da publicação' },
    { k: 'projeto', rot: 'Rótulo do cabeçalho', rotElaia: 'Autoria', dica: 'Texto do canto superior direito dos cards.', dicaElaia: 'Canto superior direito dos cards, depois do texto fixo "Escrito por".' },
    { k: 'dataPublicacao', rot: 'Data de publicação', tipo: 'date' },
  ] },
];

/** Dados da publicação de pins: projeto, link padrão e créditos (fecham a descrição de cada pin). */
const CAMPOS_PIN = [
  { k: '__titulo', rot: 'Nome da publicação' },
  { k: 'projeto', rot: 'Projeto, peça ou texto', dica: 'Entra na campanha dos links (utm_campaign) e no nome dos arquivos, quando a publicação não tem nome.' },
  { k: 'dataPublicacao', rot: 'Data dos arquivos', tipo: 'date', dica: 'Data no nome dos arquivos exportados (AAMMDD). A programação de cada pin entra depois, no pool de mídias.' },
  { k: 'link', rot: 'Link de destino padrão', tipo: 'url', ph: 'https://projetos.odisse.com.br/…', dica: 'Página do projeto, da peça ou do texto (nunca a página inicial). Vale para os pins sem link próprio.' },
  { k: 'creditos', rot: 'Créditos', dica: 'Fecham a descrição de cada pin: núcleo e parceiros, quando houver (fornecedor, fotógrafo).' },
  { k: 'creditosEn', rot: 'Créditos em inglês', dica: 'Fecham a descrição dos pins em inglês.', soComEn: true },
];

function renderGlobais() {
  const n = nucleo();
  const g = pub.globais;
  const pin = ehPin();
  const campos = pin ? CAMPOS_PIN.filter((c) => !c.soComEn || pub.cards.some((x) => x.pin?.idioma === 'en')) : CAMPOS_GLOBAIS[0].campos;
  let h = '';
  for (const c of campos) {
    const valor = c.k === '__titulo' ? pub.titulo : g[c.k];
    const elaia = !pin && n.autoria && c.rotElaia;
    const ph = c.ph || (c.k === '__titulo' ? 'Ex.: Apto RP 201 · lançamento' : '');
    const input = `<input type="${c.tipo || 'text'}" data-k="${c.k}" value="${esc(valor)}"${ph ? ` placeholder="${esc(ph)}"` : ''}>`;
    h += `<label class="campo" data-campo-global="${c.k}"><span>${elaia ? c.rotElaia : c.rot}${info(elaia ? c.dicaElaia : c.dica)}</span>${input}</label>`;
  }
  // Tratamento de imagem do núcleo (duotone): liga/desliga para todas as imagens da publicação
  if (n.tratamento.tipo !== 'nenhum') {
    const sem = !!g.semTratamento;
    h += `<div class="campo opcao"><span>Tratamento das imagens${info(`${n.tratamentoNome}, automático no ${n.nome}. Vale para todas as imagens da publicação; cada imagem ainda pode ser trocada em Imagens.`)}</span>
      <div class="seg" role="group" aria-label="Tratamento das imagens">
        <button data-trat="nucleo" class="${sem ? '' : 'ativo'}" aria-pressed="${!sem}">${n.tratamentoNome.split(',')[0]}</button>
        <button data-trat="original" class="${sem ? 'ativo' : ''}" aria-pressed="${sem}">Original</button>
      </div></div>`;
  }
  // Origem (ordem de entrada no Pinterest): vai para o pool com cada pin
  if (pin) {
    const o = g.origem || 'acervo';
    h += `<div class="campo opcao"><span>Origem${info('Ordem de entrada: acervo (o que já está nos sites), fluxo contínuo (material novo) e imprensa. Cada pin leva a etiqueta ao pool de mídias; lá ela pode ser trocada.')}</span>
      <div class="seg" role="group" aria-label="Origem">${pool.ORIGENS.map(([v, r]) => `<button data-origem="${v}" class="${o === v ? 'ativo' : ''}" aria-pressed="${o === v}">${r}</button>`).join('')}</div></div>`;
  }
  $('#globaisPub').innerHTML = h;
}

let timerGlobais;
function aoMudarGlobal(k, v) {
  if (k === '__titulo') {
    pub.titulo = v;
    $('#pubTitulo').value = v;
    document.title = `${tituloDe(pub)} · Universo`;
    salvar();
    return;
  }
  pub.globais[k] = v;
  salvar();
  if (ehPin() && ['link', 'creditos', 'creditosEn', 'projeto', 'dataPublicacao'].includes(k)) atualizarPinterest();
  clearTimeout(timerGlobais);
  timerGlobais = setTimeout(() => {
    renderTrilho();
    renderModelos();
    $('#pubTitulo').placeholder = pub.globais.projeto || 'Título da publicação';
  }, 120);
}

// ---- Modelos, em grupos recolhíveis ----------------------------------------

function renderModelos() {
  const n = nucleo();
  const g = pub.globais;
  const atual = cardAtivo()?.modelo;
  const fechados = prefs.get('gruposFechados', []);
  const lista = modelosDo(n.id, formatoDe(pub));
  $('#modelos').classList.toggle('pins', ehPin());
  $('#modelos').innerHTML = GRUPOS.map(([gid, gnome]) => {
    const itens = lista.filter((m) => grupoDe(m) === gid);
    if (!itens.length) return '';
    return `<details class="grupo-modelos" data-grupo="${gid}" ${fechados.includes(gid) ? '' : 'open'}>
      <summary><span>${gnome}</span><small>${itens.length}</small></summary>
      <div class="modelos">${itens.map((m) => `
        <button class="modelo ${m.id === atual ? 'ativo' : ''}" data-modelo="${m.id}">
          <div class="mini"><div class="${classeCard()}">${renderCard({
            card: { id: 'm-' + m.id, modelo: m.id, campos: exemploDe(n.id, m.id), imgs: {} },
            indice: 0, total: 8, nucleo: n, globais: g, modo: 'miniatura', fonteImagem,
          })}</div></div>
          <span class="cod">${codigoDe(n.id, m.id)}</span>
          <b>${m.nome}${info(m.desc)}</b>
        </button>`).join('')}</div>
    </details>`;
  }).join('');
  requestAnimationFrame(escalarMiniaturas);
}
function escalarMiniaturas() {
  $$('#modelos details[open] .mini').forEach((mini) => {
    const c = mini.firstElementChild;
    if (c.dataset.k) return;
    const k = mini.clientWidth / LARG;
    if (!k) return;
    c.style.transform = `scale(${k})`;
    c.dataset.k = k;
    ajustarLayout(c);
  });
}

function aplicarModelo(id) {
  const c = cardAtivo();
  if (!c || c.modelo === id) return;
  const ex = exemploDe(pub.nucleo, id);
  const exAntigo = exemploDe(pub.nucleo, c.modelo);
  const campos = {};
  for (const k of Object.keys(ex)) {
    const escrito = c.campos[k] && c.campos[k] !== exAntigo[k];
    campos[k] = escrito ? c.campos[k] : ex[k];
  }
  c.modelo = id;
  c.campos = campos;
  // o carimbo e o véu passam de um modelo para outro
  c.opcoes = Object.fromEntries(['carimbo', 'veu'].filter((k) => c.opcoes?.[k]).map((k) => [k, c.opcoes[k]]));
  salvar();
  renderTrilho();
  $$('.modelo', $('#modelos')).forEach((b) => b.classList.toggle('ativo', b.dataset.modelo === id));
  renderImagens();
}

// ---- Imagens do card -------------------------------------------------------

function renderImagens() {
  const c = cardAtivo();
  const el = $('#imagens');
  if (!c) { el.innerHTML = ''; return; }
  renderOpcoes();
  const slots = slotsDe(pub.nucleo, c);
  const n = nucleo();
  const dica = slots.length
    ? 'Valem só para este card. Clique numa área vazia do card para adicionar, arraste um arquivo sobre ela ou arraste a imagem para reenquadrar.'
    : 'Este modelo é só texto. Clique nos textos do card para editar.';
  $('#cardTag').textContent = String(pub.ativo + 1).padStart(2, '0');
  let h = `<h3>Imagens${info(dica)}</h3>`;
  if (!slots.length) h += `<p class="vazio">Sem imagens neste modelo.</p>`;
  for (const [s, nome] of slots) {
    const im = c.imgs[s];
    const th = im ? fonteImagem(c, s) : null;
    if (!th) {
      h += `<div class="img-item"><div class="img-topo"><div class="th"></div><div><b>${nome}</b><span>Vazio</span></div></div>
        <div class="img-acoes"><button data-acao="trocar" data-slot="${s}">Adicionar imagem</button></div></div>`;
      continue;
    }
    const trat = n.tratamento.tipo !== 'nenhum'
      ? `<button data-acao="tratada" data-slot="${s}" class="${!semTratamento(im) ? 'ativo' : ''}">${n.tratamentoNome.split(',')[0]}</button>
         <button data-acao="original" data-slot="${s}" class="${semTratamento(im) ? 'ativo' : ''}">Original</button>`
      : '';
    const amplia = ehPin() ? ampliacao(c, s, im) : 0;
    let avisoRes = amplia > 1.02
      ? `<small class="img-aviso">Será ampliada ${Math.round((amplia - 1) * 100)}% na exportação (1000 × 1500). Prefira uma imagem maior.</small>` : '';
    if (ehPin()) avisoRes += avisoDeUso(c, im);
    h += `<div class="img-item" data-slot="${s}">
      <div class="img-topo"><div class="th" style="background-image:url('${th}')"></div><div><b>${nome}</b><span>${im.w} × ${im.h}px</span>${avisoRes}</div></div>
      <div class="img-acoes">
        <button data-acao="trocar" data-slot="${s}">Trocar</button>
        <button data-acao="remover" data-slot="${s}">Remover</button>
        ${trat}
      </div>
      ${FAIXAS.map(([f, rot, min, max, passo, pad, unid]) => {
        const v = im[f] ?? pad;
        const mostrado = f === 'z' ? Math.round(v * 100) : Math.round(v * 10) / 10;
        return `<label class="faixa">${rot} <input type="range" min="${min}" max="${max}" step="${passo}" value="${v}" data-faixa="${f}" data-slot="${s}">
          <span class="num"><input type="number" min="${f === 'z' ? min * 100 : min}" max="${f === 'z' ? max * 100 : max}" step="${f === 'z' ? 1 : 0.5}" value="${mostrado}" data-num="${f}" data-slot="${s}" aria-label="${rot}">${unid}</span></label>`;
      }).join('')}
    </div>`;
  }
  el.innerHTML = h;
  renderPinterest(c);
}

/** A foto já está em outro item do pool? (a mesma imagem não volta; um novo recorte, sim) */
let hashPendente = false;
function avisoDeUso(c, im) {
  const src = im?.ref ? imagens.get(im.ref) : null;
  if (!src || !pool.lista().length) return '';
  const h = pool.hashPronto(src);
  if (!h) {
    if (!hashPendente) { hashPendente = true; pool.hashDe(src).then(() => { hashPendente = false; if (pub) renderImagens(); }); }
    return '';
  }
  const usos = pool.usosDaFoto(h, [c.id, c.pin?.par].filter(Boolean));
  if (!usos.length) return '';
  const pub_ = usos.find((u) => u.status === 'publicado');
  const quando = pub_ ? `publicada em ${pool.dataCurta(pub_.publicadoEm || pub_.dia)}` : `no pool (${usos.length})`;
  return `<small class="img-aviso info-uso">Esta foto já está ${quando}. Um novo recorte ou ângulo pode; a mesma imagem não volta.</small>`;
}

/** Quanto a imagem é ampliada na exportação (1 = pixel a pixel), pela área que ocupa no card ativo. */
function ampliacao(c, s, im) {
  const el = $(`#trilho .peca[data-id="${c.id}"] .slot[data-slot="${s}"]`);
  if (!el || !im.w || !im.h) return 0;
  const k = FORMATO_POR_ID[formatoDe(pub)].larg / LARG;
  return Math.max(el.offsetWidth / im.w, el.offsetHeight / im.h) * (im.z ?? 1) * k;
}

// ---- Pinterest: campos do pin ativo ------------------------------------------

const codigoPin = (i) => `${dataArquivo()}-${String(i + 1).padStart(3, '0')}-${nucleo().sigla}`;
const linkDoPin = (i) => pinterest.linkFinal(pub.cards[i].pin || {}, pub.globais, {
  sigla: nucleo().sigla, projeto: pub.globais.projeto || pub.titulo, codigo: codigoPin(i),
});
const IDIOMAS = [['pt', 'Português'], ['en', 'Inglês']];
const TIPOS = [['imagem', 'Imagem'], ['video', 'Capa de vídeo']];

function renderPinterest(c = cardAtivo()) {
  const el = $('#pinterest');
  if (!ehPin() || !c) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const p = c.pin || (c.pin = pinterest.pinVazio(pub.nucleo));
  const g = pub.globais;
  const en = p.idioma === 'en';
  const par = p.par ? pub.cards.findIndex((x) => x.id === p.par) : -1;
  // pastas: as do núcleo da publicação primeiro, depois as outras
  const grupos = [...pinterest.GRUPOS_PASTA].sort((a, b) => (b[0] === pub.nucleo) - (a[0] === pub.nucleo));
  const lista = pinterest.listaPastas();
  const opPastas = grupos.map(([gid, gnome]) => {
    const itens = lista.filter((x) => x.grupo === gid);
    return itens.length ? `<optgroup label="${esc(gnome)}">${itens.map((x) => `<option value="${esc(x.id)}" ${x.id === p.pasta ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  const seg = (k, valores) => `<div class="seg" role="group">${valores.map(([v, rot]) =>
    `<button data-pin-v="${k}" data-v="${v}" class="${p[k] === v ? 'ativo' : ''}" aria-pressed="${p[k] === v}">${rot}</button>`).join('')}</div>`;
  const campo = (k, rot, input, dica = '') => `<div class="campo pin-campo" data-pin-campo="${k}">
      <span>${rot}${info(dica)}<small class="conta" data-conta="${k}"></small></span>${input}
      <ul class="pin-avisos" data-avisos="${k}"></ul></div>`;
  el.innerHTML = `<h3>Pinterest${info('Título, descrição, pasta e link deste pin. Saem no textos.txt do lote. O texto serve à busca: descreva o que a imagem mostra, sem chamadas para ação nem hashtags.')}</h3>
    <div class="opcao"><span>Idioma</span>${seg('idioma', IDIOMAS)}</div>
    ${campo('titulo', en ? 'Título (inglês)' : 'Título', `<input type="text" data-pin="titulo" value="${esc(p.titulo)}" placeholder="Termo de busca primeiro, depois o lugar">`,
      `O termo de busca primeiro, depois o lugar. Até 100 caracteres, sem ponto final. Ex.: ${pinterest.EXEMPLO.titulo}`)}
    ${campo('descricao', en ? 'Descrição (inglês)' : 'Descrição', `<textarea data-pin="descricao" rows="5" placeholder="O que a imagem mostra e de qual projeto, peça ou texto. Depois, a decisão de projeto: materiais, tipologia e cidade.">${esc(p.descricao)}</textarea><small class="pin-cred" data-cred></small>`,
      `Primeira frase: o que a imagem mostra e de qual projeto, peça ou texto. Depois, uma ou duas frases sobre a decisão de projeto: materiais, tipologia e cidade. Os créditos da publicação entram no fim; o total vai até 500 caracteres. Ex.: ${pinterest.EXEMPLO.descricao}`)}
    ${campo('alt', 'Texto alternativo', `<textarea data-pin="alt" rows="2" placeholder="O que a imagem mostra, para quem não a vê.">${esc(p.alt)}</textarea>`,
      'Descrição da imagem para leitores de tela; também ajuda a busca.')}
    ${campo('pasta', 'Pasta', `<select data-pin="pasta"><option value="">Escolha a pasta</option>${opPastas}</select>`,
      'Pastas por tema, editáveis na subpágina Pins 2:3. Um projeto se espalha por várias.')}
    ${campo('link', 'Link de destino', `<input type="url" data-pin="link" value="${esc(p.link)}" placeholder="${esc(g.link || 'Página do projeto, da peça ou do texto')}">`,
      'Vazio, vale o link padrão da publicação. As UTMs entram sozinhas.')}
    <div class="pin-final"><span>Link com UTMs <button class="mini-bt" data-pin-acao="copiar">Copiar</button></span><code data-link-final></code></div>
    <div class="opcao"><span>Tipo${info('Capa de vídeo: o reel entra como pin de vídeo, a partir do master limpo, com esta imagem de capa.')}</span>${seg('tipo', TIPOS)}</div>
    <div class="pin-par">${par >= 0
      ? `<button class="mini-bt" data-pin-acao="par">Ir para a versão em ${en ? 'português' : 'inglês'} (pin ${par + 1})</button>`
      : en ? '' : `<button class="mini-bt" data-pin-acao="en" title="Projetos com potencial internacional ganham também pins em inglês">+ Versão em inglês</button>`}</div>`;
  atualizarPinterest();
}

/** Contadores, avisos, créditos e link final, sem redesenhar o painel (o foco fica onde está). */
function atualizarPinterest() {
  const c = cardAtivo();
  const el = $('#pinterest');
  if (!ehPin() || !c?.pin || el.hidden) return;
  const p = c.pin, g = pub.globais;
  const conta = (k, n, max) => {
    const s = $(`[data-conta="${k}"]`, el);
    if (!s) return;
    s.textContent = `${n}/${max}`;
    s.classList.toggle('passou', n > max);
  };
  conta('titulo', String(p.titulo || '').trim().length, pinterest.LIMITE.titulo);
  conta('descricao', pinterest.descricaoFinal(p, g).length, pinterest.LIMITE.descricao);
  conta('alt', String(p.alt || '').trim().length, pinterest.LIMITE.alt);
  const cred = p.idioma === 'en' ? g.creditosEn : g.creditos;
  const credEl = $('[data-cred]', el);
  if (credEl) credEl.textContent = cred ? `+ ${cred}` : 'Sem créditos na publicação.';
  for (const k of ['titulo', 'descricao', 'alt', 'pasta', 'link']) {
    const ul = $(`[data-avisos="${k}"]`, el);
    if (ul) ul.innerHTML = pinterest.avisosDe(k, p, g).map((a) => `<li>${esc(a)}</li>`).join('');
  }
  const fim = $('[data-link-final]', el);
  if (fim) fim.textContent = linkDoPin(pub.ativo) || '—';
}

/** Versão em inglês do pin ativo: mesma imagem e composição, título e descrição a escrever. */
function criarVersaoEn() {
  const c = cardAtivo();
  const novo = structuredClone(c);
  novo.id = uid('c');
  novo.pin = { ...pinterest.pinVazio(pub.nucleo), pasta: c.pin.pasta, link: c.pin.link, tipo: c.pin.tipo, idioma: 'en', par: c.id };
  c.pin.par = novo.id;
  pub.cards.splice(pub.ativo + 1, 0, novo);
  pub.ativo += 1;
  salvar();
  renderGlobais();
  renderTrilho();
  renderImagens();
  aviso('Versão em inglês criada. Escreva o título e a descrição em inglês.');
}

// [campo, rótulo, mín, máx, passo da barra, padrão, unidade] — o zoom aparece em %
const FAIXAS = [
  ['z', 'Zoom', 1, 3, 0.01, 1, '%'],
  ['x', 'Horiz.', 0, 100, 0.5, 50, ''],
  ['y', 'Vert.', 0, 100, 0.5, 50, ''],
];

// ---- Personalização do card (opções do modelo) ------------------------------

function renderOpcoes() {
  const c = cardAtivo();
  const el = $('#opcoes');
  const m = c && modeloDe(pub.nucleo, c.modelo);
  if (!m) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }
  const ops = opcoesDe(m, c, nucleo());
  // Véu: só nos cards que desenham algum gradiente sobre a imagem; vale só para este card
  const lista = opcoesDoModelo(m, nucleo(), c);
  if (estruturaDe({ card: c, nucleo: nucleo(), globais: pub.globais }).veu) {
    lista.push(OP_VEU);
    ops.veu = c.opcoes?.veu ?? OP_VEU.padrao;
  }
  el.hidden = false;
  el.innerHTML = `<h3>Personalização${info('Opções de composição deste card. O preenchimento pinta o fundo do card e o carimbo cheio; as cores vêm da Marca, por núcleo. O véu é a opacidade do gradiente do núcleo sobre a imagem, só neste card.')}</h3>
    ${lista.map((d) => `<div class="opcao"><span>${d.rot}</span>
      <div class="seg" role="group" aria-label="${d.rot}">${d.valores.map(([v, rot, hex]) =>
        `<button class="${ops[d.k] === v ? 'ativo' : ''}" data-op="${d.k}" data-v="${v}" aria-pressed="${ops[d.k] === v}">${hex ? `<i class="amostra" style="background:${hex}"></i>` : ''}${rot}</button>`).join('')}</div></div>`).join('')}`;
  renderTextos(c);
}

/** Nome de cada texto no painel: o macro (Título / Corpo) e, quando ajuda, de qual texto se trata. */
const QUAL_TEXTO = { linha: 'linha de contexto', citacao: 'citação', sub: 'subtítulo', p1t: 'etapa 01', p2t: 'etapa 02', p3t: 'etapa 03', contatoTitulo: 'chamada', contatoTexto: 'apoio' };
const faixaDe = (cls) => {
  const t = TEXTO_POR_CLASSE[cls];
  return Array.isArray(t.tamanho) ? `${t.tamanho[0]}–${t.tamanho[1]} px` : `${t.tamanho} px`;
};

/** Textos do card: check · nome · estilo 01–03, e a caixa com o conteúdo, ligada ao canvas.
 *  No fechamento (O-10) esta seção é o próprio Fechamento: chamada e apoio valem para a publicação toda. */
const CHAVES_GLOBAIS = new Set(['contatoTitulo', 'contatoTexto']);
/** Ficha do card: rótulo e valor de cada linha, editáveis aqui. As linhas que não cabem no card
 *  (a imagem, o título e o corpo ocupam o espaço) saem dele e ficam marcadas com o aviso. */
const textoPuro = (html) => String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
function renderFicha(c, fichas) {
  const el = $('#ficha');
  el.hidden = !fichas.length;
  if (!fichas.length) { el.innerHTML = ''; return; }
  const ex = exemploDe(pub.nucleo, c.modelo) || {};
  const linhas = fichas.map(({ prefixo, linhas: n }) => Array.from({ length: n }, (_, j) => {
    const k = `${prefixo}${j + 1}`;
    const ph = (s) => esc(textoPuro(ex[s]) || '');
    return `<div class="ficha-item" data-linha="${k}">
      <span class="ficha-num">${String(j + 1).padStart(2, '0')}</span>
      <input data-ficha="${k}r" value="${esc(textoPuro(c.campos?.[k + 'r']))}" placeholder="${ph(k + 'r') || 'Rótulo'}" aria-label="Rótulo da linha ${j + 1}">
      <input data-ficha="${k}v" value="${esc(textoPuro(c.campos?.[k + 'v']))}" placeholder="${ph(k + 'v') || 'Valor'}" aria-label="Valor da linha ${j + 1}">
      <small class="ficha-aviso" hidden>Suprimida por falta de espaço no card.</small>
    </div>`;
  }).join('')).join('');
  el.innerHTML = `<h3>Ficha${info('Linhas da ficha (rótulo e valor). Só as preenchidas aparecem no card; as que não cabem, porque imagem, título e corpo ocupam o espaço, saem do card e ficam marcadas aqui.')}</h3>${linhas}`;
  requestAnimationFrame(atualizarAvisosFicha);
}

/** Marca no painel as linhas preenchidas que o card suprimiu por falta de espaço. */
function atualizarAvisosFicha() {
  $$('#ficha .ficha-item').forEach((item) => {
    const k = item.dataset.linha;
    const noCard = $(`#trilho .peca.ativa .card [data-linha="${k}"]`);
    const sup = !!noCard?.dataset.suprimida;
    item.classList.toggle('suprimida', sup);
    item.querySelector('.ficha-aviso').hidden = !sup;
  });
}

function renderTextos(c) {
  const el = $('#textos');
  const ordem = { titulo: 0, corpo: 1 };
  const est = estruturaDe({ card: c, nucleo: nucleo(), globais: pub.globais });
  renderFicha(c, est.fichas);
  const lista = est.textos.sort((x, y) => ordem[x.macro] - ordem[y.macro]);
  el.hidden = !lista.length;
  if (!lista.length) { el.innerHTML = ''; return; }
  const fech = grupoDe(modeloDe(pub.nucleo, c.modelo)) === 'fechamento';
  const ex = exemploDe(pub.nucleo, c.modelo) || {};
  const itens = lista.map(({ chave, macro, padrao, ativo }) => {
    const conf = c.textos?.[chave] || {};
    const atual = conf.estilo && MACROS[macro].classes.includes(conf.estilo) ? conf.estilo : padrao;
    const nome = MACROS[macro].nome + (QUAL_TEXTO[chave] ? ` · ${QUAL_TEXTO[chave]}` : '');
    const global = CHAVES_GLOBAIS.has(chave);
    const valor = global ? esc(pub.globais[chave] || '') : (c.campos?.[chave] || '');
    const ph = esc(String(ex[chave] || nome).replace(/<[^>]+>/g, ''));
    return `<div class="texto-item${ativo ? '' : ' off'}">
      <div class="texto-cab">
        <label class="check"><input type="checkbox" data-txt-ativo="${chave}" ${ativo ? 'checked' : ''}> ${nome}</label>
        <div class="seg" role="group" aria-label="Estilo de ${nome}">${MACROS[macro].classes.map((cls, i) => {
          const est = TEXTO_POR_CLASSE[cls];
          return `<button class="${cls === atual ? 'ativo' : ''}" data-txt-estilo="${chave}" data-v="${cls}" title="${est.nome} · ${faixaDe(cls)}${cls === padrao ? ' · padrão do modelo' : ''}" aria-pressed="${cls === atual}" ${ativo ? '' : 'disabled'}>${String(i + 1).padStart(2, '0')}</button>`;
        }).join('')}</div>
      </div>
      <div class="texto-caixa" contenteditable="true" spellcheck="true" data-txt-campo="${chave}"${global ? ' data-txt-global' : ''} data-ph="${ph}">${valor}</div>
    </div>`;
  }).join('');
  const titulo = fech ? 'Fechamento' : 'Textos';
  const dica = fech
    ? 'Chamada e texto de apoio do fechamento valem para toda a publicação. Site, telefone e e-mail vêm da Marca, de acordo com o núcleo.'
    : 'Estilo de cada texto entre os três do seu macro (Título 01–03, Corpo 01–03). Desligado, o texto sai e a imagem ou o vazio ocupam o lugar.';
  el.innerHTML = `<h3>${titulo}${info(dica)}</h3>${itens}`;
}

function atualizarImgNoCard(cardId, slot) {
  const c = pub.cards.find((x) => x.id === cardId);
  const im = c?.imgs[slot];
  const img = $(`.peca[data-id="${cardId}"] .slot[data-slot="${slot}"] img`);
  if (!im || !img) return;
  img.style.objectPosition = `${im.x}% ${im.y}%`;
  img.style.transformOrigin = `${im.x}% ${im.y}%`;
  img.style.transform = `scale(${im.z})`;
}

// ---- Palco -----------------------------------------------------------------

const LATERAL = 0.6;

function indicesVisiveis() {
  const n = pub.cards.length;
  if (modo === '3') return [pub.ativo - 1, pub.ativo, pub.ativo + 1].map((i) => (i >= 0 && i < n ? i : null));
  return pub.cards.map((_, i) => i);
}

function escala(qtd) {
  const wrap = $('#trilhoWrap');
  const W = wrap.clientWidth - 112;
  const H = wrap.clientHeight - 44 - 22;
  const gap = modo === 'todos' ? 18 : 28;
  const kH = H / altDe();
  const unidades = modo === '3' ? 1 + 2 * LATERAL : qtd;
  const kW = (W - 70 - gap * qtd) / (unidades * LARG);
  let k = Math.min(kH, kW);
  if (modo === 'todos') k = Math.max(k, Math.min(kH, 0.17));
  return { k: Math.max(0.08, k), gap };
}

function renderTrilho() {
  if (!pub) return;
  const n = nucleo();
  const trilho = $('#trilho');
  const vis = indicesVisiveis();
  const { k, gap } = escala(vis.length);
  trilho.style.setProperty('--gap', gap + 'px');
  $('#trilhoWrap').classList.toggle('todos', modo === 'todos');

  let h = '';
  for (const i of vis) {
    if (i === null) { h += `<div class="peca" style="width:${LARG * k * LATERAL}px"></div>`; continue; }
    const c = pub.cards[i];
    const lateral = modo === '3' && i !== pub.ativo;
    const kk = lateral ? k * LATERAL : k;
    const en = c.pin?.idioma === 'en' ? ' · EN' : '';
    h += `<div class="peca ${i === pub.ativo ? 'ativa' : ''} ${lateral ? 'lateral' : ''}" data-id="${c.id}" data-i="${i}">
      <span class="num">${String(i + 1).padStart(2, '0')} · ${codigoDe(pub.nucleo, c.modelo)}${en}</span>
      <div class="moldura" style="--k:${kk};--alt:${altDe()}px"><div class="${classeCard()} editar">${renderCard({
        card: c, indice: i, total: pub.cards.length, nucleo: n, globais: pub.globais, modo: 'editar', fonteImagem,
      })}</div>${guiasSvg(altDe())}</div>
    </div>`;
  }
  h += `<button class="mais" id="btMais" title="Adicionar ${ehPin() ? 'pin' : 'card'} ${modo === 'todos' ? 'no fim' : 'depois deste'}">+</button>`;
  trilho.innerHTML = h;
  $$('.card', trilho).forEach(ajustarLayout);
  atualizarAvisosFicha();

  const largura = vis.length * (LARG * k + gap) + 70;
  trilho.classList.toggle('rolavel', largura > trilho.clientWidth);
  if (modo === 'todos') $('.peca.ativa', trilho)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  renderBarra();
}

function renderBarra() {
  const c = cardAtivo();
  $('#posicao').textContent = `${ehPin() ? 'Pin' : 'Card'} ${pub.ativo + 1} de ${pub.cards.length}`;
  $('#modeloAtual').textContent = c ? `· ${modeloDe(pub.nucleo, c.modelo).nome}` : '';
  $('#btMoverEsq').disabled = pub.ativo <= 0;
  $('#btMoverDir').disabled = pub.ativo >= pub.cards.length - 1;
  $('#btExcluir').disabled = pub.cards.length <= 1;
  $('#navEsq').disabled = pub.ativo <= 0;
  $('#navDir').disabled = pub.ativo >= pub.cards.length - 1;
  $$('#modos button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === modo));
  $('#pontos').innerHTML = pub.cards.map((_, i) => `<button data-ir="${i}" class="${i === pub.ativo ? 'ativo' : ''}">${i + 1}</button>`).join('');
}

function irPara(i) {
  const novo = Math.max(0, Math.min(pub.cards.length - 1, i));
  if (novo === pub.ativo) return;
  pub.ativo = novo;
  salvar();
  renderTrilho();
  $$('.modelo', $('#modelos')).forEach((b) => b.classList.toggle('ativo', b.dataset.modelo === cardAtivo().modelo));
  renderImagens();
}

function adicionarCard() {
  const pin = ehPin();
  const lista = modelosDo(pub.nucleo, formatoDe(pub)).filter((m) => grupoDe(m) === (pin ? 'pin' : 'corpo'));
  const i = lista.findIndex((m) => m.id === cardAtivo()?.modelo);
  const sugestao = lista[(i + 1) % lista.length].id;
  const c = novoCard(sugestao, pub.nucleo, formatoDe(pub));
  // o pin novo segue a composição do pin ativo (o mesmo projeto costuma manter o registro)
  if (pin && cardAtivo()?.opcoes) c.opcoes = { ...cardAtivo().opcoes };
  const pos = modo === 'todos' ? pub.cards.length : pub.ativo + 1;
  pub.cards.splice(pos, 0, c);
  pub.ativo = pos;
  salvar();
  renderTrilho();
  renderModelos();
  renderImagens();
  aviso(pin ? 'Pin adicionado.' : 'Card adicionado. Escolha o modelo à direita.');
}

function mover(delta) {
  const j = pub.ativo + delta;
  if (j < 0 || j >= pub.cards.length) return;
  [pub.cards[pub.ativo], pub.cards[j]] = [pub.cards[j], pub.cards[pub.ativo]];
  pub.ativo = j;
  salvar();
  renderTrilho();
  renderImagens();
}

// ---- Upload ---------------------------------------------------------------

let destinoUpload = null;
async function receberArquivo(file, cardId, slot) {
  if (!file || !file.type.startsWith('image/')) { aviso('Arquivo não é uma imagem.'); return; }
  const c = pub.cards.find((x) => x.id === cardId);
  if (!c) return;
  aviso('Carregando imagem…');
  const { src, w, h } = await lerArquivo(file);
  const ref = uid('i');
  imagens.set(ref, src);
  await local.gravarImg(ref, src);
  c.imgs[slot] = { ref, w, h, x: 50, y: 50, z: 1, original: false };
  salvar();
  renderTrilho();
  renderImagens();
  garantirImagemNaNuvem(ref).catch(() => {});
}
function abrirSeletor(cardId, slot) {
  destinoUpload = { cardId, slot };
  $('#arquivo').value = '';
  $('#arquivo').click();
}

// ---- Exportação -------------------------------------------------------------

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function dataArquivo() {
  const v = pub.globais.dataPublicacao;
  const d = v ? new Date(v + 'T12:00:00') : new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
const nomeBase = () => slug(pub.titulo || pub.globais.projeto) || (ehPin() ? 'projeto' : 'post');
/** Post: AAMMDD-NNN-nn-assunto.jpg · Pin: AAMMDD-NNN-nn-assunto-pin.jpg (versão em inglês: …-en-pin.jpg). */
const nomeArquivo = (i) => (ehPin()
  ? `${codigoPin(i)}-${nomeBase()}${pub.cards[i].pin?.idioma === 'en' ? '-en' : ''}-pin.jpg`
  : `${dataArquivo()}-${String(i + 1).padStart(3, '0')}-${nucleo().sigla}-${nomeBase()}.jpg`);

async function montarCard(p, i) {
  const host = $('#exportador');
  host.innerHTML = `<div class="${classeCard(p)}">${renderCard({
    card: p.cards[i], indice: i, total: p.cards.length, nucleo: NUCLEOS[p.nucleo], globais: p.globais, modo: 'exportar', fonteImagem,
  })}</div>`;
  const no = host.firstElementChild;
  await document.fonts.ready;
  ajustarLayout(no);
  await Promise.all($$('img', no).map((im) => im.decode().catch(() => {})));
  return no;
}

/** JPG otimizado, sRGB, qualidade 0,86 (bom equilíbrio para redes que recomprimem).
 *  Post: 1080 × 1440. Pin: 1000 × 1500, desenhado em 1080 × 1620 e reduzido (a margem de 52 vira 48). */
const QUALIDADE_JPG = 0.86;
async function gerarArquivo(i) {
  const no = await montarCard(pub, i);
  const f = FORMATO_POR_ID[formatoDe(pub)];
  const [w, h] = f.canvas;
  const opc = { width: w, height: h, canvasWidth: f.larg, canvasHeight: f.alt, pixelRatio: 1, cacheBust: false, backgroundColor: COR.papel };
  await window.htmlToImage.toCanvas(no, opc); // 1ª passada carrega as fontes
  const canvas = await window.htmlToImage.toCanvas(no, opc);
  $('#exportador').innerHTML = '';
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE_JPG));
}

async function gerarCapa(p) {
  if (!p.cards.length) return '';
  const no = await montarCard(p, 0);
  const url = await window.htmlToImage.toJpeg(no, { width: LARG, height: altDe(p), pixelRatio: 0.25, quality: 0.82, backgroundColor: COR.papel });
  $('#exportador').innerHTML = '';
  return url;
}

function baixar(url, nome) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportarCard() {
  const pin = ehPin();
  aviso('Gerando JPG…');
  await aguardarTratamentos([cardAtivo()]);
  const u = URL.createObjectURL(await gerarArquivo(pub.ativo));
  baixar(u, nomeArquivo(pub.ativo));
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso(pin ? 'JPG exportado em 1000 × 1500.' : 'JPG exportado em 1080 × 1440.');
  salvarNaNuvem({ silencioso: true });
}

/** Lote de pins: o que vai para o textos.txt (seção 07 da estratégia do Pinterest). */
function lotePins() {
  const g = pub.globais;
  const texto = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return pub.cards.map((c, i) => {
    const p = c.pin || pinterest.pinVazio(pub.nucleo);
    return {
      numero: String(i + 1).padStart(2, '0'),
      arquivo: nomeArquivo(i),
      pasta: pinterest.pastaDe(p.pasta)?.nome || '',
      titulo: texto(p.titulo),
      descricao: pinterest.descricaoFinal(p, g),
      alt: texto(p.alt),
      link: linkDoPin(i),
      idioma: p.idioma || 'pt',
      tipo: p.tipo || 'imagem',
      avisos: ['titulo', 'descricao', 'pasta', 'link'].flatMap((k) => pinterest.avisosDe(k, p, g)),
    };
  });
}

async function exportarTudo() {
  const pin = ehPin();
  aviso(`Gerando ${pub.cards.length} ${pin ? 'pins' : 'cards'}…`);
  await aguardarTratamentos(pub.cards);
  const zip = new window.JSZip();
  for (let i = 0; i < pub.cards.length; i++) zip.file(nomeArquivo(i), await gerarArquivo(i));
  let pendentes = 0;
  if (pin) {
    const lote = lotePins();
    pendentes = lote.filter((x) => x.avisos.length).length;
    zip.file('textos.txt', pinterest.textosDoLote({ projeto: pub.globais.projeto || tituloDe(pub), nucleo: `Odisse ${nucleo().nome}`, pins: lote }));
  }
  const u = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  baixar(u, `${dataArquivo()}-${nucleo().sigla}-${nomeBase()}${pin ? '-pins' : ''}.zip`);
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso(pin
    ? `Lote exportado (.zip, com textos.txt).${pendentes ? ` ${pendentes} ${pendentes === 1 ? 'pin tem' : 'pins têm'} avisos — veja o textos.txt.` : ''}`
    : 'Carrossel exportado (.zip).');
  salvarNaNuvem({ silencioso: true });
}

// ---- Pool de mídias ----------------------------------------------------------------

async function miniatura(blob, larg = 160) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = larg;
  c.height = Math.round((bmp.height * larg) / bmp.width);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

/** Fotos de origem dos cards (hash da imagem original + recorte), para o controle de repetição. */
async function fontesDe(indices) {
  const out = [];
  for (const i of indices) {
    for (const im of Object.values(pub.cards[i].imgs || {})) {
      const src = im?.ref ? imagens.get(im.ref) : null;
      if (src) out.push({ hash: await pool.hashDe(src), x: im.x ?? 50, y: im.y ?? 50, z: im.z ?? 1 });
    }
  }
  return out;
}

/**
 * Envia ao pool: cada pin vira um item (pl-<card>); o carrossel inteiro, um item (pl-<publicação>).
 * Reenviar substitui imagens e textos e mantém dia, situação e origem; o que já foi publicado não muda.
 */
async function enviarAoPool() {
  const pin = ehPin();
  const alvo = pub;
  try { await pool.carregar(true); } catch (e) { console.warn(e); aviso('Não foi possível ler o pool na nuvem.'); return; }
  await aguardarTratamentos(alvo.cards);
  const unidades = pin ? alvo.cards.map((_, i) => [i]) : [alvo.cards.map((_, i) => i)];
  const lote = pin ? lotePins() : null;
  const agora = new Date().toISOString();
  let novos = 0, atualizados = 0, publicados = 0, repetidos = 0;
  try {
    for (let u = 0; u < unidades.length; u++) {
      const idx = unidades[u];
      const card = alvo.cards[idx[0]];
      const id = pin ? `pl-${card.id}` : `pl-${alvo.id}`;
      const ant = pool.item(id);
      if (ant?.status === 'publicado') { publicados++; continue; }
      aviso(pin ? `Enviando ao pool: pin ${u + 1} de ${unidades.length}…` : 'Enviando o carrossel ao pool…');
      const imgs = [];
      let mini = '';
      for (const i of idx) {
        const blob = await gerarArquivo(i);
        const ref = uid('m');
        await nuvem.enviarBlob(ref, blob);
        imgs.push({ ref, nome: nomeArquivo(i) });
        if (!mini) mini = await miniatura(blob);
      }
      const fontes = await fontesDe(idx);
      const par = pin && card.pin?.par ? `pl-${card.pin.par}` : '';
      const l = pin ? lote[idx[0]] : null;
      const it = {
        id, rede: pin ? 'pinterest' : 'instagram', formato: formatoDe(alvo), pub: alvo.id, card: pin ? card.id : null,
        nucleo: alvo.nucleo, projeto: alvo.globais.projeto || tituloDe(alvo), titulo: pin ? l.titulo : tituloDe(alvo),
        imagens: imgs, miniatura: mini,
        pin: pin ? { titulo: l.titulo, descricao: l.descricao, alt: l.alt, pasta: card.pin?.pasta || '', pastaNome: l.pasta, link: l.link, idioma: l.idioma, tipo: l.tipo } : null,
        avisos: pin ? l.avisos : [],
        fontes, par,
        origem: ant?.origem || alvo.globais.origem || (pin ? 'acervo' : 'fluxo'),
        status: ant?.status || 'pronto', dia: ant?.dia || '', publicadoEm: ant?.publicadoEm || '',
        criado: ant?.criado || agora,
      };
      it.repete = pool.repeticoes(fontes, [id, par]);
      if (it.repete.some((r) => r.exata)) repetidos++;
      await pool.gravar(it);
      if (ant) atualizados++; else novos++;
    }
  } catch (e) {
    console.warn(e);
    if (e.message === 'senha incorreta') return sair();
    aviso('Não foi possível enviar ao pool. Tente de novo.');
    return;
  }
  const partes = [];
  if (novos) partes.push(`${novos} ${novos === 1 ? 'nova' : 'novas'}`);
  if (atualizados) partes.push(`${atualizados} ${atualizados === 1 ? 'atualizada' : 'atualizadas'}`);
  let msg = partes.length ? `Pool de mídias: ${partes.join(', ')}.` : 'Nada enviado.';
  if (publicados) msg += ` ${publicados} já ${publicados === 1 ? 'publicada ficou' : 'publicadas ficaram'} como estava${publicados === 1 ? '' : 'm'}.`;
  if (repetidos) msg += ` Atenção: ${repetidos} com imagem e recorte iguais a outro item.`;
  aviso(msg);
  if (pub === alvo) renderImagens();
  salvarNaNuvem({ silencioso: true });
}

// ===========================================================================
// Navegação

// No editor (três colunas), o menu lateral do Universo recolhe sozinho para dar espaço ao palco; ao sair, volta
// como estava. Não grava a preferência do menu (só o botão de recolher grava).
let menuRecolhidoPeloEditor = false;
function ajustarMenu(vista) {
  const app = document.querySelector('.ui-app');
  if (!app) return;
  if (vista === 'editor' && !app.classList.contains('is-recolhido')) { app.classList.add('is-recolhido'); menuRecolhidoPeloEditor = true; }
  else if (vista !== 'editor' && menuRecolhidoPeloEditor) { app.classList.remove('is-recolhido'); menuRecolhidoPeloEditor = false; }
}
window.addEventListener('universo:casca', () => ajustarMenu(document.body.classList.contains('vista-editor') ? 'editor' : ''));

function mostrar(vista) {
  ajustarMenu(vista);
  for (const v of ['inicio', 'editor', 'padroes', 'metricas', 'calendario', 'estrategia']) document.body.classList.toggle('vista-' + v, vista === v);
}

async function sairDoEditor() {
  if (!pub) return;
  clearTimeout(timerLocal);
  await local.gravarPub(pub);
  if (pendente()) await salvarNaNuvem({ silencioso: true });
  pub = null;
}

let pastasLidas = false;
async function rotear() {
  if (!nuvem.ativa()) { irParaEntrada(); return; }
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/([^/]+))?$/); // #/p/<publicação>[/<card>]
  // o retorno do login do Meta às vezes chega com o fragmento "#_=_"; volta para as métricas
  if (location.hash === '#_=_') { history.replaceState(null, '', location.pathname + '#/metricas'); }
  const metr = location.hash.startsWith('#/metricas');
  const cal = location.hash.startsWith('#/calendario');
  const estr = location.hash.startsWith('#/estrategia');
  marcarSecao(metr ? 'metricas' : cal ? 'calendario' : estr ? 'estrategia' : 'publicacoes');
  if (!pastasLidas) {
    pastasLidas = true;
    pinterest.carregarPastas().then((mudou) => {
      if (!mudou) return;
      if (document.body.classList.contains('vista-inicio') && formatoInicio === 'pin') renderPastas();
      if (pub && ehPin()) renderPinterest();
    });
  }
  if (metr) {
    if (pub) await sairDoEditor();
    document.title = 'Métricas · Universo';
    mostrar('metricas');
    await renderMetricas($('#metricas'));
    return;
  }
  if (estr) {
    if (pub) await sairDoEditor();
    document.title = 'Estratégia · Universo';
    mostrar('estrategia');
    await renderEstrategia($('#estrategia'), location.hash.split('/')[2] || '', { aviso });
    return;
  }
  if (cal) {
    if (pub) await sairDoEditor();
    document.title = 'Calendário · Universo';
    mostrar('calendario');
    await renderCalendario($('#calendario'), location.hash.split('/')[2] || '', { aviso });
    return;
  }
  if (location.hash === '#/padroes') {
    if (pub) await sairDoEditor();
    document.title = 'Padrões · Universo';
    mostrar('padroes');
    renderPadroes($('#padroes'));
    return;
  }
  if (m) {
    const irCard = () => {
      const i = m[2] ? pub?.cards.findIndex((c) => c.id === decodeURIComponent(m[2])) : -1;
      if (i >= 0) irPara(i);
    };
    if (pub?.id === m[1]) { irCard(); return; }
    if (pub) await sairDoEditor();
    if (!resumos.length) await carregarArquivo();
    await abrirPublicacao(decodeURIComponent(m[1]));
    irCard();
  } else {
    // Publicações: a subpágina do formato (#/publicacoes/posts, #/publicacoes/pins); sem ela, a última aberta
    const sub = location.hash.match(/^#\/publicacoes\/([\w-]+)/)?.[1];
    const f = SUBPAGINAS.find((x) => x[0] === sub);
    if (!f) { history.replaceState(null, '', `#/publicacoes/${rotaDoFormato(formatoInicio)}`); }
    else if (f[1] !== formatoInicio) { formatoInicio = f[1]; prefs.set('formatoInicio', formatoInicio); filtro = 'todos'; }
    if (pub) await sairDoEditor();
    document.title = `${SUBPAGINAS.find((x) => x[1] === formatoInicio)[2]} · Publicações · Universo`;
    mostrar('inicio');
    await montarResumos(); // na hora, com o que já está neste navegador
    renderInicio();
    buscarLista().then(async (mudou) => {
      if (!mudou || pub || !document.body.classList.contains('vista-inicio')) return;
      await montarResumos();
      renderInicio();
    });
  }
}

// ---- Entrada ----------------------------------------------------------------

// Entrada: a do Universo. Sem senha (ou senha recusada pela API), guarda o endereço e volta ao Início para
// entrar; depois de entrar, o Início traz de volta para cá (sessionStorage 'universo:volta').
function irParaEntrada() {
  try { sessionStorage.setItem('universo:volta', location.href); } catch { /* segue */ }
  location.href = '/#/';
}

// Abas do Marketing (no desenho das Abas da v2) e o item aceso no menu lateral do Universo (casca).
const MENU_DA_SECAO = { publicacoes: 'publicacoes', calendario: 'calendario', estrategia: 'estrategia', metricas: 'kpis' };
function marcarSecao(secao) {
  $$('#abasMarketing a').forEach((a) => { if (a.dataset.secao === secao) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const marcar = () => window.universoCasca?.marcar(MENU_DA_SECAO[secao]);
  if (window.universoCasca) marcar(); else window.addEventListener('universo:casca', marcar, { once: true });
}

async function sair() {
  if (pub) {
    clearTimeout(timerLocal);
    await local.gravarPub(pub);
    pub = null;
  }
  nuvem.salvarConfig(null);
  resumos = [];
  irParaEntrada();
}

// ===========================================================================
// Eventos

function ligarEventos() {
  window.addEventListener('hashchange', rotear);

  // Início
  $('#tiles').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-criar]');
    if (!b) return;
    const p = await novaPublicacao(b.dataset.criar, formatoInicio);
    await local.gravarPub(p);
    try {
      await nuvem.gravar({ ...p, salvoEm: p.atualizado });
      p.salvoEm = p.atualizado;
      await local.gravarPub(p);
    } catch { /* fica como rascunho até o próximo salvamento */ }
    location.hash = `#/p/${p.id}`;
  });
  $('#filtros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    filtro = b.dataset.filtro;
    renderInicio();
  });
  $('#busca').addEventListener('input', renderInicio);

  // Pastas do Pinterest
  const pastasSec = $('#pastasSec');
  pastasSec.addEventListener('input', (e) => {
    const k = e.target.dataset.pastaCampo;
    if (!k) return;
    const id = e.target.closest('[data-pasta]').dataset.pasta;
    mudarPastas((l) => { const x = l.find((y) => y.id === id); if (x) x[k] = e.target.value; }, false);
  });
  pastasSec.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = b.closest('[data-pasta]')?.dataset.pasta;
    if (b.dataset.pastaNova) {
      const nova = { id: uid('pf'), grupo: b.dataset.pastaNova, nome: '', desc: '' };
      mudarPastas((l) => {
        const ult = l.map((x) => x.grupo).lastIndexOf(nova.grupo);
        l.splice(ult < 0 ? l.length : ult + 1, 0, nova);
      });
      $(`[data-pasta="${nova.id}"] .pasta-nome`, pastasSec)?.focus();
    } else if (b.dataset.pastaMover) {
      mudarPastas((l) => {
        const i = l.findIndex((x) => x.id === id);
        const grupo = l[i].grupo, d = Number(b.dataset.pastaMover);
        let j = i + d;
        while (j >= 0 && j < l.length && l[j].grupo !== grupo) j += d; // troca com a vizinha do mesmo grupo
        if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
      });
    } else if (b.dataset.pastaRemover !== undefined) {
      if (!b.dataset.confirmar) {
        b.dataset.confirmar = '1';
        b.textContent = 'Remover?';
        setTimeout(() => { delete b.dataset.confirmar; b.textContent = '×'; }, 2500);
        return;
      }
      mudarPastas((l) => { const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1); });
    }
  });
  $('#listaPubs').addEventListener('click', (e) => {
    const d = e.target.closest('[data-dup]');
    if (d) duplicarPublicacao(d.dataset.dup);
    const x = e.target.closest('[data-del]');
    if (x) excluirPublicacao(x.dataset.del, x);
  });

  // Entrada e saída

  // Salvar
  $('#btSalvar').onclick = () => salvarNaNuvem();
  window.addEventListener('keydown', (e) => {
    if (pub && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvarNaNuvem(); }
  });

  // Editor: título
  $('#pubTitulo').addEventListener('input', (e) => {
    pub.titulo = e.target.value;
    const campo = $('#globais [data-k="__titulo"]');
    if (campo) campo.value = pub.titulo;
    salvar();
  });

  // Informações padrão
  const glob = $('#globais');
  glob.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k) aoMudarGlobal(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });

  glob.addEventListener('click', (e) => {
    const o = e.target.closest('[data-origem]');
    if (o) { pub.globais.origem = o.dataset.origem; salvar(); renderGlobais(); return; }
    const b = e.target.closest('[data-trat]');
    if (!b) return;
    pub.globais.semTratamento = b.dataset.trat === 'original';
    // a escolha da publicação passa a valer para todas as imagens (as escolhas imagem a imagem são zeradas)
    for (const c of pub.cards) for (const im of Object.values(c.imgs || {})) if (im) delete im.original;
    salvar();
    renderGlobais();
    renderTrilho();
    renderImagens();
  });

  // Modelos
  $('#modelos').addEventListener('click', (e) => {
    if (e.target.closest('.info')) return;
    const b = e.target.closest('[data-modelo]');
    if (b) aplicarModelo(b.dataset.modelo);
  });
  $('#modelos').addEventListener('toggle', (e) => {
    const d = e.target.closest('details[data-grupo]');
    if (!d) return;
    const fechados = new Set(prefs.get('gruposFechados', []));
    if (d.open) fechados.delete(d.dataset.grupo); else fechados.add(d.dataset.grupo);
    prefs.set('gruposFechados', [...fechados]);
    if (d.open) requestAnimationFrame(escalarMiniaturas);
  }, true);

  // Imagens
  const imgs = $('#imagens');
  imgs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const c = cardAtivo();
    const s = b.dataset.slot;
    if (b.dataset.acao === 'trocar') { abrirSeletor(c.id, s); return; }
    if (b.dataset.acao === 'remover') delete c.imgs[s];
    if (b.dataset.acao === 'original') c.imgs[s].original = true;
    if (b.dataset.acao === 'tratada') c.imgs[s].original = false;
    salvar();
    renderTrilho();
    renderImagens();
  });
  imgs.addEventListener('input', (e) => {
    const f = e.target.dataset.faixa || e.target.dataset.num;
    if (!f) return;
    const c = cardAtivo();
    const s = e.target.dataset.slot;
    const im = c.imgs[s];
    const [, , min, max, , pad] = FAIXAS.find((x) => x[0] === f);
    const label = e.target.closest('.faixa');
    if (e.target.dataset.faixa) {
      im[f] = Number(e.target.value);
      label.querySelector('[data-num]').value = f === 'z' ? Math.round(im.z * 100) : Math.round(im[f] * 10) / 10;
    } else {
      // valor digitado: zoom em %, posições de 0 a 100
      const bruto = parseFloat(String(e.target.value).replace(',', '.'));
      if (Number.isNaN(bruto)) return;
      const v = f === 'z' ? bruto / 100 : bruto;
      im[f] = Math.max(min, Math.min(max, v ?? pad));
      label.querySelector('[data-faixa]').value = im[f];
    }
    atualizarImgNoCard(c.id, s);
    salvar();
  });
  // Opções do card
  $('#opcoes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-op]');
    if (!b) return;
    const c = cardAtivo();
    c.opcoes = { ...(c.opcoes || {}), [b.dataset.op]: b.dataset.v };
    salvar();
    renderTrilho();
    renderImagens();
  });
  // Pinterest: campos do pin ativo
  const pinEl = $('#pinterest');
  const mudarPin = (e) => {
    const k = e.target.dataset?.pin;
    if (!k) return;
    cardAtivo().pin[k] = e.target.value;
    salvar();
    atualizarPinterest();
  };
  pinEl.addEventListener('input', mudarPin);
  pinEl.addEventListener('change', mudarPin);
  pinEl.addEventListener('click', (e) => {
    if (e.target.closest('label .info')) return;
    const b = e.target.closest('button');
    if (!b) return;
    const c = cardAtivo();
    if (b.dataset.pinV) {
      c.pin[b.dataset.pinV] = b.dataset.v;
      salvar();
      renderPinterest();
      if (b.dataset.pinV === 'idioma') { renderGlobais(); renderTrilho(); }
    } else if (b.dataset.pinAcao === 'en') criarVersaoEn();
    else if (b.dataset.pinAcao === 'par') irPara(pub.cards.findIndex((x) => x.id === c.pin.par));
    else if (b.dataset.pinAcao === 'copiar') {
      const link = linkDoPin(pub.ativo);
      if (link) navigator.clipboard?.writeText(link).then(() => aviso('Link copiado.'), () => aviso('Não foi possível copiar.'));
    }
  });

  // Textos do card: estilo (01–03 do macro) e ligado/desligado
  const mudarTexto = (chave, mudanca) => {
    const c = cardAtivo();
    c.textos = { ...(c.textos || {}), [chave]: { ...(c.textos?.[chave] || {}), ...mudanca } };
    salvar();
    renderTrilho();
    renderOpcoes();
  };
  const textos = $('#textos');
  textos.addEventListener('click', (e) => {
    const b = e.target.closest('[data-txt-estilo]');
    if (b && !b.disabled) mudarTexto(b.dataset.txtEstilo, { estilo: b.dataset.v });
  });
  textos.addEventListener('change', (e) => {
    const k = e.target.dataset?.txtAtivo;
    if (k) mudarTexto(k, { ativo: e.target.checked });
  });
  // Caixa de texto do painel ↔ texto no card
  textos.addEventListener('input', (e) => {
    const cx = e.target.closest('[data-txt-campo]');
    if (!cx) return;
    const k = cx.dataset.txtCampo;
    if (cx.dataset.txtGlobal !== undefined) { aoMudarGlobal(k, cx.innerText.replace(/\n+$/, '')); return; }
    const html = limparHtml(cx.innerHTML);
    cardAtivo().campos[k] = html;
    const el = $(`#trilho .peca.ativa [data-campo="${k}"]`);
    if (el) {
      el.innerHTML = html;
      if (el.dataset.fit) ajustar(el);
      if (el.dataset.cresce) crescer(el);
      refluir(el.closest('.card'));
      atualizarAvisosFicha();
    }
    salvar();
  });
  textos.addEventListener('keydown', (e) => {
    const cx = e.target.closest('[data-txt-campo]');
    if (!cx) return;
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
    if (e.key === 'Escape') cx.blur();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && cx.dataset.txtGlobal === undefined) { e.preventDefault(); document.execCommand('bold'); }
  });
  textos.addEventListener('paste', (e) => {
    if (!e.target.closest('[data-txt-campo]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });
  // Ficha: rótulo e valor de cada linha
  let timerFicha;
  $('#ficha').addEventListener('input', (e) => {
    const k = e.target.dataset?.ficha;
    if (!k) return;
    const c = cardAtivo();
    c.campos = c.campos || {};
    c.campos[k] = esc(e.target.value);
    const el = $(`#trilho .peca.ativa .card [data-campo="${k}"]`);
    if (el && el.closest('.ficha-linha')?.style.display !== 'none') {
      el.textContent = e.target.value;
      refluir(el.closest('.card'));
      atualizarAvisosFicha();
    } else {
      // linha que ainda não está no card (vazia até agora): redesenha
      clearTimeout(timerFicha);
      timerFicha = setTimeout(renderTrilho, 250);
    }
    salvar();
  });
  // Macrosseções recolhíveis (lembradas)
  $$('#globais details.macro').forEach((d) => {
    if (prefs.get('macrosFechadas', []).includes(d.dataset.macro)) d.open = false;
    d.addEventListener('toggle', () => {
      const f = new Set(prefs.get('macrosFechadas', []));
      if (d.open) f.delete(d.dataset.macro); else f.add(d.dataset.macro);
      prefs.set('macrosFechadas', [...f]);
    });
  });

  // Barra
  renderGuias();
  $('#guias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-guia]');
    if (!b) return;
    const ativas = new Set(prefs.get('guias', []));
    ativas.has(b.dataset.guia) ? ativas.delete(b.dataset.guia) : ativas.add(b.dataset.guia);
    prefs.set('guias', [...ativas]);
    renderGuias();
  });
  $('#modos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b) return;
    modo = b.dataset.modo;
    prefs.set('modo', modo);
    renderTrilho();
  });
  $('#btMoverEsq').onclick = () => mover(-1);
  $('#btMoverDir').onclick = () => mover(1);
  $('#btDuplicar').onclick = () => {
    const c = structuredClone(cardAtivo());
    c.id = uid('c');
    if (c.pin) delete c.pin.par; // a cópia é outro pin (novo recorte), sem par em outro idioma
    pub.cards.splice(pub.ativo + 1, 0, c);
    pub.ativo += 1;
    salvar();
    renderTrilho();
    renderImagens();
  };
  $('#btExcluir').onclick = (e) => {
    const b = e.currentTarget;
    if (pub.cards.length <= 1) return;
    if (!b.dataset.confirmar) {
      b.dataset.confirmar = '1';
      b.textContent = 'Confirmar?';
      setTimeout(() => { delete b.dataset.confirmar; b.textContent = 'Excluir'; }, 2500);
      return;
    }
    delete b.dataset.confirmar;
    b.textContent = 'Excluir';
    const par = cardAtivo().pin?.par && pub.cards.find((x) => x.id === cardAtivo().pin.par);
    if (par) delete par.pin.par;
    pub.cards.splice(pub.ativo, 1);
    pub.ativo = Math.min(pub.ativo, pub.cards.length - 1);
    salvar();
    renderTrilho();
    renderModelos();
    renderImagens();
  };
  $('#btExportarCard').onclick = () => exportarCard().catch(erroExport);
  $('#btPool').onclick = (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    enviarAoPool().catch(erroExport).finally(() => { b.disabled = false; });
  };
  $('#btExportarTudo').onclick = () => exportarTudo().catch(erroExport);
  $('#navEsq').onclick = () => irPara(pub.ativo - 1);
  $('#navDir').onclick = () => irPara(pub.ativo + 1);
  // Roda do mouse (ou trackpad) passa de card em card; um passo por gesto.
  let rodaAcum = 0, rodaTrava = 0;
  $('#trilhoWrap').addEventListener('wheel', (e) => {
    if (!pub || e.ctrlKey) return; // Ctrl+roda continua sendo zoom do navegador
    e.preventDefault();
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const agora = performance.now();
    if (agora < rodaTrava) return;
    rodaAcum += e.deltaMode === 1 ? d * 40 : d;
    if (Math.abs(rodaAcum) < 50) return;
    irPara(pub.ativo + Math.sign(rodaAcum));
    rodaAcum = 0;
    rodaTrava = agora + 260;
  }, { passive: false });
  $('#pontos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) irPara(Number(b.dataset.ir));
  });

  // Trilho
  const trilho = $('#trilho');
  trilho.addEventListener('click', (e) => {
    if (e.target.closest('#btMais')) { adicionarCard(); return; }
    const peca = e.target.closest('.peca[data-i]');
    if (!peca) return;
    const i = Number(peca.dataset.i);
    if (i !== pub.ativo) { irPara(i); return; }
    const g = e.target.closest('[data-global]');
    if (g) { focarGlobal(g.dataset.global); return; }
    const vazio = e.target.closest('.slot[data-vazio]');
    if (vazio) abrirSeletor(peca.dataset.id, vazio.dataset.slot);
  });
  trilho.addEventListener('dblclick', (e) => {
    const slot = e.target.closest('.slot:not([data-vazio])');
    const peca = e.target.closest('.peca.ativa');
    if (slot && peca) abrirSeletor(peca.dataset.id, slot.dataset.slot);
  });
  trilho.addEventListener('input', (e) => {
    const el = e.target.closest('[data-campo]');
    if (!el) return;
    cardAtivo().campos[el.dataset.campo] = limparHtml(el.innerHTML);
    if (el.dataset.fit) ajustar(el);
    if (el.dataset.cresce) crescer(el);
    refluir(el.closest('.card')); // imagens em bloco acompanham o texto que cresce ou encolhe
    const caixa = $(`#textos [data-txt-campo="${el.dataset.campo}"]`);
    if (caixa && document.activeElement !== caixa) caixa.innerHTML = el.innerHTML;
    const campoFicha = $(`#ficha [data-ficha="${el.dataset.campo}"]`);
    if (campoFicha) campoFicha.value = textoPuro(el.innerHTML);
    atualizarAvisosFicha();
    salvar();
  });
  trilho.addEventListener('focusout', (e) => {
    const el = e.target.closest('[data-campo]');
    if (el && !el.textContent.trim()) el.innerHTML = '';
  });
  trilho.addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-campo]');
    if (!el) return;
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
    if (e.key === 'Escape') el.blur();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); }
  });
  trilho.addEventListener('paste', (e) => {
    if (!e.target.closest('[data-campo]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });

  // Arrastar para reenquadrar
  trilho.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.peca.ativa .slot:not([data-vazio])');
    if (!slot || e.button !== 0) return;
    const peca = slot.closest('.peca');
    const c = pub.cards.find((x) => x.id === peca.dataset.id);
    const im = c.imgs[slot.dataset.slot];
    const k = parseFloat(slot.closest('.moldura').style.getPropertyValue('--k'));
    const bw = slot.offsetWidth, bh = slot.offsetHeight;
    const cobre = Math.max(bw / im.w, bh / im.h);
    const sobraX = Math.max(1, im.w * cobre * im.z - bw);
    const sobraY = Math.max(1, im.h * cobre * im.z - bh);
    const x0 = e.clientX, y0 = e.clientY, ox = im.x, oy = im.y;
    slot.setPointerCapture(e.pointerId);
    e.preventDefault();
    const mov = (ev) => {
      im.x = Math.max(0, Math.min(100, ox - ((ev.clientX - x0) / k / sobraX) * 100));
      im.y = Math.max(0, Math.min(100, oy - ((ev.clientY - y0) / k / sobraY) * 100));
      atualizarImgNoCard(c.id, slot.dataset.slot);
    };
    const fim = () => {
      slot.removeEventListener('pointermove', mov);
      slot.removeEventListener('pointerup', fim);
      salvar();
      renderImagens();
    };
    slot.addEventListener('pointermove', mov);
    slot.addEventListener('pointerup', fim);
  });

  // Soltar arquivos
  trilho.addEventListener('dragover', (e) => {
    const slot = e.target.closest('.peca.ativa .slot');
    if (!slot) return;
    e.preventDefault();
    $$('.slot.alvo').forEach((s) => s !== slot && s.classList.remove('alvo'));
    slot.classList.add('alvo');
  });
  trilho.addEventListener('dragleave', (e) => e.target.closest?.('.slot')?.classList.remove('alvo'));
  trilho.addEventListener('drop', (e) => {
    const slot = e.target.closest('.peca.ativa .slot');
    document.body.classList.remove('arrastando');
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove('alvo');
    receberArquivo(e.dataTransfer.files[0], slot.closest('.peca').dataset.id, slot.dataset.slot);
  });
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) document.body.classList.add('arrastando'); });
  window.addEventListener('drop', (e) => { document.body.classList.remove('arrastando'); if (!e.target.closest('.slot')) e.preventDefault(); });
  window.addEventListener('dragover', (e) => e.preventDefault());

  $('#arquivo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f && destinoUpload) receberArquivo(f, destinoUpload.cardId, destinoUpload.slot);
  });

  window.addEventListener('keydown', (e) => {
    if (!pub || e.target.closest('input, textarea, [contenteditable], dialog')) return;
    if (e.key === 'ArrowLeft') irPara(pub.ativo - 1);
    if (e.key === 'ArrowRight') irPara(pub.ativo + 1);
  });
  window.addEventListener('beforeunload', (e) => {
    if (!pub) return;
    local.gravarPub(pub);
    if (pendente()) { e.preventDefault(); e.returnValue = ''; }
  });
  new ResizeObserver(() => { if (pub) renderTrilho(); }).observe($('#trilhoWrap'));
}

function focarGlobal(k) {
  const alvo = $(`#globais [data-campo-global="${k}"]`) || $(`#textos [data-txt-campo="${k}"]`)?.closest('.texto-item');
  if (!alvo) return;
  alvo.closest('details.macro')?.setAttribute('open', '');
  alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  alvo.classList.remove('pisca');
  void alvo.offsetWidth;
  alvo.classList.add('pisca');
  (alvo.querySelector('input, textarea, [contenteditable]'))?.focus();
}

function erroExport(err) {
  console.error(err);
  aviso('Não foi possível exportar. Abra o editor por um servidor (veja o README).');
}

/** Ao conectar a nuvem pela primeira vez, envia o que já existe neste navegador. */
async function enviarTudoParaNuvem() {
  const locais = await local.listarPubs();
  let remotos = [];
  try { remotos = await nuvem.listar(); } catch { return; }
  const r = new Map(remotos.map((x) => [x.id, x]));
  for (const res of locais) {
    if ((r.get(res.id)?.atualizado || '') >= (res.atualizado || '')) continue;
    const p = await local.lerPub(res.id);
    for (const ref of local.refsDe(p)) await garantirImagemNaNuvem(ref);
    p.salvoEm = p.atualizado;
    await nuvem.gravar(p);
    await local.gravarPub(p);
  }
}

// ---------------------------------------------------------------------------
// Migração das versões anteriores (carrossel único por núcleo, imagens embutidas)

async function migrar() {
  const antigo = await local.ler('estado');
  if (!antigo?.decks || (await local.lerMeta('migrado'))) return;
  for (const id of ORDEM_NUCLEOS) {
    const d = antigo.decks[id];
    if (!d) continue;
    await local.gravarMeta('globais:' + id, d.globais);
    const temImagem = d.cards?.some((c) => Object.values(c.imgs || {}).some((im) => im?.src));
    if (!temImagem || antigo.versao !== 2) continue;
    const p = await novaPublicacao(id);
    p.titulo = `${d.globais?.projeto || NUCLEOS[id].nome} (rascunho anterior)`;
    p.globais = { ...p.globais, ...d.globais };
    p.cards = await Promise.all(d.cards.map(async (c) => {
      const imgs = {};
      for (const [s, im] of Object.entries(c.imgs || {})) {
        if (!im?.src) continue;
        const ref = uid('i');
        await local.gravarImg(ref, im.src);
        const { src, ...resto } = im;
        imgs[s] = { ...resto, ref };
      }
      return { ...c, imgs };
    }));
    await local.gravarPub(p);
  }
  await local.gravarMeta('migrado', true);
}

// ---------------------------------------------------------------------------

/** Dica flutuante dos ícones (i): uma só, posicionada junto ao ícone, fora de qualquer recorte. */
function ligarDicas() {
  const el = $('#dicaFlut');
  const mostrarDica = (alvo) => {
    el.textContent = alvo.dataset.info;
    el.classList.add('on');
    const r = alvo.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    let y = r.bottom + 8;
    if (y + hh > innerHeight - 8) y = r.top - hh - 8;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  };
  const esconder = () => el.classList.remove('on');
  document.addEventListener('mouseover', (e) => { const a = e.target.closest?.('.info'); if (a) mostrarDica(a); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.('.info')) esconder(); });
  document.addEventListener('focusin', (e) => { const a = e.target.closest?.('.info'); if (a) mostrarDica(a); });
  document.addEventListener('focusout', (e) => { if (e.target.closest?.('.info')) esconder(); });
  document.addEventListener('scroll', esconder, true);
  // dentro de um <label>, o (i) não marca a caixa nem foca o campo
  document.addEventListener('click', (e) => { if (e.target.closest?.('label .info')) e.preventDefault(); });
}

async function iniciar() {
  instalarPadroes();
  ligarDicas();
  status('pronto');
  carregarMarca(); // por baixo: o site abre com a cópia guardada da Marca
  await migrar();
  await document.fonts.load('700 112px Inter').catch(() => {});
  await document.fonts.ready;
  ligarEventos();
  await rotear();
}

iniciar();

// Arquivos do site com número de versão (?v=) ficam guardados pelo service worker até a próxima versão.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* segue sem */ });
}
