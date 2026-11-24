// Universo — publicações do Odisse: posts 3:4 (Instagram) e pins 2:3 (Pinterest).
// Duas vistas: início (subpágina do formato: criar + arquivo, nas peças da base/v2) e editor de uma publicação.
// O editor é o mesmo para todos os formatos; muda o canvas, o repertório de modelos e os campos do canal.
// Gerar arquivos (exportar, enviar ao pool) funciona com qualquer publicação, aberta ou não: as funções recebem
// a publicação (`p`, padrão a aberta) e passam uma de cada vez pelo #exportador.

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
import { carregarLocal as carregarPadroesCards, atualizarDaNuvem as padroesCardsDaNuvem, padraoInicial } from './padroes-cards.js';
import { renderMetricas } from './pagina-metricas.js';
import { abas, cabecalho, segmentado, secao, bandeja, lista, etiqueta, quando, acao, link, icone, medidor, gaveta } from '/base/v2/componentes.js';

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
  // os padrões editados na página Padrões entram no card quando ele nasce (as publicações antigas não mudam)
  const ini = padraoInicial(nucleoId, modelo);
  if (Object.keys(ini.opcoes).length) c.opcoes = ini.opcoes;
  if (Object.keys(ini.textos).length) c.textos = ini.textos;
  if (formato === 'pin') c.pin = pinterest.pinVazio(nucleoId);
  return c;
}

async function novaPublicacao(nucleoId, formato = '3x4') {
  const ultimos = (await local.lerMeta(chaveGlobais(nucleoId, formato))) || {};
  const agora = new Date().toISOString();
  const globais = { ...padroesDoNucleo(nucleoId), ...ultimos };
  delete globais.dataPublicacao; // o campo saiu: a data dos arquivos é a de criação
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
// Publicação já no pool e alterada depois do envio: depois de salvar na nuvem, o pool é atualizado sozinho
// (reenvio automático; o que já foi publicado não muda). `enviadoEm` guarda a hora do último envio.

const AUTOSALVAR_MIN = 20;
let timerLocal;
const pendente = () => !!pub && (pub.atualizado || '') > (pub.salvoEm || '');

function salvar() {
  if (!pub) return;
  pub.atualizado = new Date().toISOString();
  status('pendente');
  clearTimeout(timerLocal);
  timerLocal = setTimeout(async () => {
    renderSituacao();
    await local.gravarPub(pub);
    await local.gravarMeta(chaveGlobais(pub.nucleo, formatoDe(pub)), pub.globais);
  }, 350);
}

/** Grava a publicação na nuvem (capa, imagens e o JSON) e a cópia deste navegador. Serve à aberta e a qualquer outra. */
async function gravarNaNuvem(p) {
  p.capa = await gerarCapa(p).catch(() => p.capa);
  for (const ref of local.refsDe(p)) await garantirImagemNaNuvem(ref);
  const marca = p.atualizado;
  await nuvem.gravar({ ...p, salvoEm: marca });
  p.salvoEm = marca;
  await local.gravarPub(p);
}

let salvando = null;
async function salvarNaNuvem({ silencioso = false } = {}) {
  if (!pub) return;
  if (salvando) return salvando;
  const alvo = pub;
  status('salvando');
  salvando = (async () => {
    try {
      await gravarNaNuvem(alvo);
      status(pub === alvo && pendente() ? 'pendente' : 'salvo', alvo.salvoEm);
      if (!silencioso) aviso('Publicação salva.');
      if (precisaReenvio(alvo)) reenviarAutomatico(alvo);
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

// ---- Situação no pool -----------------------------------------------------------
// Cada publicação vira um item do pool (carrossel: pl-<publicação>) ou um por pin (pl-<card>), com `pub` apontando
// para ela. A situação mostrada no arquivo e no editor sai daí.

const itensDoPool = (id) => pool.lista().filter((it) => it.pub === id);
/** Publicações enviadas antes de existir `enviadoEm`: vale o momento em que foram abertas no editor. */
const abertura = new WeakMap();

/** Alterada depois do envio: salva depois do último envio, com algo ainda não publicado no pool. */
function alteradaDepoisDoEnvio(r) {
  const ref = r.enviadoEm || abertura.get(r) || '';
  return !!ref && (r.atualizado || '') > ref && itensDoPool(r.id).some((it) => it.status !== 'publicado');
}
const precisaReenvio = (p) => alteradaDepoisDoEnvio(p);

/** Resumo da publicação no pool: { estado, itens, noPool, total, agendados, publicados, primeiro, alterada }. */
function situacaoNoPool(r) {
  const itens = itensDoPool(r.id);
  const pin = (r.formato || '3x4') === 'pin';
  const total = pin ? (r.ncards ?? r.cards?.length ?? 0) : 1;
  const noPool = pin ? new Set(itens.map((it) => it.card)).size : (itens.length ? 1 : 0);
  const agendados = itens.filter((it) => it.status === 'agendado');
  const publicados = itens.filter((it) => it.status === 'publicado');
  const ordem = (a, b) => (a.dia || '9').localeCompare(b.dia || '9');
  let estado = 'fora';
  if (itens.length) estado = publicados.length === itens.length ? 'publicado' : agendados.length ? 'agendado' : 'pronto';
  return {
    estado, itens, noPool, total, faltam: Math.max(0, total - noPool),
    agendados: agendados.length, publicados: publicados.length,
    proximo: agendados.sort(ordem)[0] || null,
    ultimoPublicado: publicados.sort((a, b) => (b.publicadoEm || b.dia || '').localeCompare(a.publicadoEm || a.dia || ''))[0] || null,
    primeiro: [...itens].sort(ordem)[0] || null,
    alterada: !!itens.length && alteradaDepoisDoEnvio(r),
  };
}

/** Texto e tom da situação (Quando da v2). */
function textoSituacao(r, s = situacaoNoPool(r)) {
  const pin = (r.formato || '3x4') === 'pin';
  if (tarefas.has(r.id)) return [tarefas.get(r.id), 'atencao'];
  if (s.estado === 'fora') return ['Fora do pool', ''];
  if (s.alterada) return [pin ? 'Alterado depois do envio' : 'Alterada depois do envio', 'atencao'];
  if (pin) {
    if (s.estado === 'publicado') return [`${s.publicados} ${s.publicados === 1 ? 'publicado' : 'publicados'}`, 'ok'];
    if (!s.agendados && !s.publicados) return ['No pool, para agendar', ''];
    return [`${s.agendados} ${s.agendados === 1 ? 'agendado' : 'agendados'} · ${s.publicados} ${s.publicados === 1 ? 'publicado' : 'publicados'}`, s.agendados ? 'hora' : ''];
  }
  if (s.estado === 'publicado') return [`Publicada em ${pool.dataCurta(s.ultimoPublicado?.publicadoEm || s.ultimoPublicado?.dia)}`, 'ok'];
  if (s.estado === 'agendado') return [`Agendada · ${pool.dataLonga(s.proximo.dia).replace(/\/\d{4}$/, '')}`, 'hora'];
  return ['No pool, para agendar', ''];
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
function fonteImagem(card, slot, p = pub) {
  const im = card.imgs[slot];
  const src = im?.ref ? imagens.get(im.ref) : im?.src;
  if (!src) return null;
  const trat = NUCLEOS[p?.nucleo || 'estudio'].tratamento;
  if (semTratamento(im, p) || trat.tipo === 'nenhum') return src;
  const k = `${p.nucleo}:${im.ref || card.id + slot}`;
  if (typeof tratadas.get(k) === 'string') return tratadas.get(k);
  if (!tratadas.has(k)) {
    tratadas.set(k, null);
    tratar(src, trat).then((out) => {
      tratadas.set(k, out);
      clearTimeout(timerReTrilho);
      timerReTrilho = setTimeout(() => { if (pub && p === pub) { renderTrilho(); renderImagens(); } }, 30);
    });
  }
  return src;
}
/** A imagem sai sem o tratamento do núcleo? Vale a escolha da própria imagem; senão, a da publicação. */
function semTratamento(im, p = pub) {
  return im.original ?? !!p?.globais?.semTratamento;
}
async function aguardarTratamentos(cards, p = pub) {
  const trat = NUCLEOS[p.nucleo].tratamento;
  if (trat.tipo === 'nenhum') return;
  const tarefas = [];
  for (const c of cards) for (const s of Object.keys(c.imgs)) {
    const im = c.imgs[s];
    const src = im?.ref ? imagens.get(im.ref) : null;
    if (!src || semTratamento(im, p)) continue;
    const k = `${p.nucleo}:${im.ref}`;
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
// INÍCIO — criar e arquivo (peças da base/v2)
//
// Abas (Posts 3:4 · Pins 2:3) → Cabeçalho → os cartões de núcleo para criar → Seção Arquivo: busca, núcleo,
// Ativas/Arquivadas, ordem e vista (Grade · Lista). Cada publicação mostra a situação no pool, as datas
// automáticas (criada, último salvamento, envio) e a ação do momento: Enviar ao pool, ou Abrir no calendário.
// Alterada depois do envio: o pool é atualizado sozinho, em segundo plano (uma publicação de cada vez).

const ui = {
  filtro: 'todos',
  busca: '',
  arquivadas: false,
  vista: prefs.get('pubVista', 'grade'),
  ordem: prefs.get('pubOrdem', 'salva'),
};

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
  resumos = [...mapa.values()];
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

/** Arquivo completo, esperando a nuvem (usado depois de duplicar, arquivar ou abrir por link). */
async function carregarArquivo() {
  await buscarLista(true);
  await montarResumos();
}

const naInicio = () => document.body.classList.contains('vista-inicio');
const hojeIso = () => pool.hoje();
/** 24/11/2026 16:01 · hoje, 16:01 */
function dataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (pool.isoDia(d) === hojeIso()) return `hoje, ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${hora}`;
}
const dataHoraCurta = (iso) => dataHora(iso).replace(/\/\d{4} /, ' ');

function selecionadas() {
  const fmt = formatoInicio;
  const busca = ui.busca.trim().toLowerCase();
  const chave = ui.ordem === 'criada' ? 'criado' : 'atualizado';
  return resumos
    .filter((r) => (r.formato || '3x4') === fmt && !!r.arquivado === ui.arquivadas)
    .filter((r) => (ui.filtro === 'todos' || r.nucleo === ui.filtro) && (!busca || (r.titulo || '').toLowerCase().includes(busca)))
    .sort((a, b) => (b[chave] || '').localeCompare(a[chave] || ''));
}

function renderInicio() {
  const el = $('#inicio');
  const fmt = formatoInicio, pins = fmt === 'pin';
  const doFormato = resumos.filter((r) => (r.formato || '3x4') === fmt);
  const ativas = doFormato.filter((r) => !r.arquivado);
  const narq = doFormato.length - ativas.length;
  if (!narq) ui.arquivadas = false;
  const unid = (q) => (pins ? (q === 1 ? 'projeto' : 'projetos') : q === 1 ? 'publicação' : 'publicações');
  const tiles = ORDEM_NUCLEOS.map((id) => {
    const n = NUCLEOS[id];
    const qtd = ativas.filter((r) => r.nucleo === id).length;
    return `<button type="button" class="tile" data-criar="${id}" style="--painel:${n.painel};--tinta:${tintaSobre(n.painel)}">
      <span class="tile-selo">${mark(n.selo, 50)}</span>
      <span class="tile-txt"><b>Odisse ${n.nome}</b><small>${n.conteudo}</small></span>
      <span class="tile-mais">+ Criar</span>
      <span class="tile-qtd">${qtd} ${unid(qtd)}</span>
    </button>`;
  }).join('');
  const filtros = `<div class="mk-filtros mk-pb-filtros">
      <input type="search" class="mk-busca" data-pb-busca placeholder="Buscar publicação" aria-label="Buscar publicação" value="${esc(ui.busca)}">
      ${segmentado([{ id: 'todos', rotulo: 'Todos' }, ...ORDEM_NUCLEOS.map((id) => ({ id, rotulo: NUCLEOS[id].nome }))], ui.filtro, 'pb-nuc', 'Núcleo')}
      ${narq ? segmentado([{ id: 'ativas', rotulo: 'Ativas' }, { id: 'arquivadas', rotulo: 'Arquivadas', n: narq }], ui.arquivadas ? 'arquivadas' : 'ativas', 'pb-arq', 'Arquivadas') : ''}
      <span class="mk-filtros__fim">
        ${segmentado([{ id: 'salva', rotulo: 'Últimas salvas' }, { id: 'criada', rotulo: 'Últimas criadas' }], ui.ordem, 'pb-ordem', 'Ordem')}
        ${segmentado([{ id: 'grade', rotulo: 'Grade' }, { id: 'lista', rotulo: 'Lista' }], ui.vista, 'pb-vista', 'Vista')}
      </span>
    </div>`;
  el.innerHTML = `<div class="mk-pagina">
    ${abas('Publicações', SUBPAGINAS.map(([r, f, nome]) => ({ href: `#/publicacoes/${r}`, rotulo: nome, ativa: f === fmt })))}
    ${cabecalho(pins ? 'Novo projeto de pins' : 'Nova publicação', '', link('Padrões dos cards', '#/padroes'))}
    <div class="nucleo-tiles">${tiles}</div>
    <div class="mk-pb-arquivo">${secao({ titulo: ui.arquivadas ? 'Arquivadas' : 'Arquivo', n: ui.arquivadas ? narq : ativas.length, corpo: `${filtros}<div class="mk-espaco" id="pbCorpo"></div>` })}</div>
  </div>`;
  renderArquivo();
}

/** Só o corpo do arquivo (a busca redesenha só ele, sem perder o foco). */
function renderArquivo() {
  const corpo = $('#pbCorpo');
  if (!corpo) return;
  const pins = formatoInicio === 'pin';
  const sel = selecionadas();
  const doFormato = resumos.some((r) => (r.formato || '3x4') === formatoInicio && !r.arquivado);
  if (!sel.length) {
    corpo.innerHTML = bandeja(`<p class="mk-vazio">${ui.busca || ui.filtro !== 'todos' ? 'Nada encontrado com esse filtro.'
      : ui.arquivadas ? 'Nenhuma publicação arquivada.'
        : doFormato ? '' : pins ? 'Os projetos de pins que você criar aparecem aqui.' : 'As publicações que você criar aparecem aqui.'}</p>`);
    return;
  }
  if (ui.vista === 'lista') {
    corpo.innerHTML = bandeja(lista({
      colunas: '30px minmax(0,1.6fr) 100px minmax(0,1.4fr) 128px 128px 168px',
      colunasCelular: '30px minmax(0,1fr) 132px',
      regua: [{ texto: '' }, { texto: 'Publicação' }, { texto: 'Núcleo', celular: false }, { texto: 'No pool', celular: false },
        { texto: 'Criada', celular: false }, { texto: 'Último salvamento', celular: false }, { texto: '', fim: true }],
      linhas: sel.map((r) => {
        const n = NUCLEOS[r.nucleo] || NUCLEOS.estudio;
        const [txt, tom] = textoSituacao(r);
        return { abre: r.id, celulas: [
          { html: `<span class="mk-th ${pins ? 'is-p' : 'is-l'}" style="aspect-ratio:${pins ? '2 / 3' : '3 / 4'}">${r.capa ? `<img src="${r.capa}" alt="">` : ''}</span>` },
          { html: `<span class="mk-tit"><b>${esc(r.titulo || 'Sem título')}</b><small>${r.ncards} ${pins ? (r.ncards === 1 ? 'pin' : 'pins') : 'cards'}</small></span>` },
          { html: etiqueta(n.nome), celular: false },
          { html: `<button type="button" class="mk-link" data-pb-pool="${esc(r.id)}">${quando(txt, tom)}</button>`, celular: false },
          { html: quando(dataHoraCurta(r.criado)), celular: false },
          { html: `${quando(dataHoraCurta(r.atualizado))}${r.rascunho ? ' <small class="mk-mudo" title="Alterações só neste computador, ainda não salvas na nuvem">não salvo</small>' : ''}`, celular: false },
          { html: `<span class="mk-pb-acoes">${botaoDoPool(r)}${botaoMais(r)}</span>`, fim: true },
        ] };
      }),
    }));
    return;
  }
  corpo.innerHTML = bandeja(`<div class="mk-pb-grade${pins ? ' is-pins' : ''}">${sel.map(cartao).join('')}</div>`, { cartao: false });
}

function cartao(r) {
  const n = NUCLEOS[r.nucleo] || NUCLEOS.estudio;
  const pins = (r.formato || '3x4') === 'pin';
  const s = situacaoNoPool(r);
  const [txt, tom] = textoSituacao(r, s);
  const capa = r.capa
    ? `<img src="${r.capa}" alt="">`
    : `<span class="mk-pb-sem-capa" style="background:${n.painel};color:${tintaSobre(n.painel)}">${mark(n.selo, 40)}</span>`;
  const enviada = s.itens.length && r.enviadoEm ? `<dt>Enviada</dt><dd${s.alterada ? ' class="is-atencao"' : ''}>${dataHora(r.enviadoEm)}</dd>` : '';
  return `<article class="mk-pb" data-pb="${esc(r.id)}">
    <a class="mk-pb__capa${pins ? ' is-pin' : ''}" href="#/p/${esc(r.id)}">${capa}<em>${r.ncards}</em></a>
    <div class="mk-pb__tx">
      <a class="mk-pb__nome" href="#/p/${esc(r.id)}" title="${esc(r.titulo || 'Sem título')}">${esc(r.titulo || 'Sem título')}</a>
      <span class="mk-pb__meta"><i style="background:${n.painel}"></i>${n.nome} · ${r.ncards} ${pins ? (r.ncards === 1 ? 'pin' : 'pins') : 'cards'}</span>
      <button type="button" class="mk-pb__pool" data-pb-pool="${esc(r.id)}" title="Ver no pool">${quando(txt, tom, { pequeno: true })}${pins && s.itens.length ? `<span class="mk-pb__med">${medidor(s.noPool, s.total)}</span>` : ''}</button>
      <dl class="mk-pb__datas"><dt>Criada</dt><dd>${dataHora(r.criado)}</dd><dt>Salva</dt><dd>${dataHora(r.atualizado)}${r.rascunho ? ' <b title="Alterações só neste computador, ainda não salvas na nuvem">não salvo</b>' : ''}</dd>${enviada}</dl>
    </div>
    <div class="mk-pb-acoes">${botaoDoPool(r, s)}${botaoMais(r)}</div>
  </article>`;
}

/** A ação do momento: Enviar ao pool (o que falta), Restaurar (arquivada) ou Abrir no calendário. */
function botaoDoPool(r, s = situacaoNoPool(r)) {
  if (r.arquivado) return acao('Restaurar', { dados: { 'pb-restaurar': r.id } });
  if (tarefas.has(r.id)) return acao('Enviando…', { desligada: true });
  const pins = (r.formato || '3x4') === 'pin';
  if (s.faltam) return acao(pins && s.noPool ? `Enviar ${s.faltam} ao pool` : 'Enviar ao pool', { dados: { 'pb-enviar': r.id } });
  const alvo = s.proximo || s.primeiro;
  return acao(s.estado === 'publicado' ? 'Ver no calendário' : 'Abrir no calendário', { href: `#/calendario/item/${encodeURIComponent(alvo.id)}` });
}
const svgIco = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONE_DUPLICAR = svgIco('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>');
const ICONE_EXCLUIR = svgIco('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>');
const ICONE_TROCAR = svgIco('<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>');
const TRES_PONTOS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
const botaoMais = (r) => `<button type="button" class="mk-ico mk-pb-mais" data-pb-menu="${esc(r.id)}" aria-label="Mais ações" aria-haspopup="menu">${TRES_PONTOS}</button>`;

/** Menu ⋯ do cartão: Abrir no editor, Duplicar, Baixar (.zip), Arquivar. */
function abrirMenu(botao) {
  fecharMenu();
  const id = botao.dataset.pbMenu;
  const r = resumos.find((x) => x.id === id);
  if (!r) return;
  const pins = (r.formato || '3x4') === 'pin';
  const m = document.createElement('div');
  m.className = 'mk-pb-menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = `<a role="menuitem" href="#/p/${esc(id)}">Abrir no editor</a>
    <button type="button" role="menuitem" data-pb-duplicar="${esc(id)}">Duplicar</button>
    <button type="button" role="menuitem" data-pb-baixar="${esc(id)}">${pins ? 'Baixar lote (.zip)' : 'Baixar carrossel (.zip)'}</button>
    ${r.arquivado ? `<button type="button" role="menuitem" data-pb-restaurar="${esc(id)}">Restaurar</button>`
      : `<button type="button" role="menuitem" data-pb-arquivar="${esc(id)}">Arquivar</button>`}`;
  botao.after(m);
  botao.setAttribute('aria-expanded', 'true');
  m.querySelector('a, button')?.focus();
}
function fecharMenu() {
  $$('#inicio .mk-pb-menu').forEach((m) => { m.previousElementSibling?.removeAttribute('aria-expanded'); m.remove(); });
}

/** Gaveta da situação no pool: o que está lá, em que dia, e as datas da publicação. */
function gavetaPool(id) {
  const r = (pub?.id === id ? pub : null) || resumos.find((x) => x.id === id);
  if (!r) return;
  const pins = (r.formato || '3x4') === 'pin';
  const s = situacaoNoPool(r);
  const [txt, tom] = textoSituacao(r, s);
  const STATUS_NOME = Object.fromEntries(pool.STATUS);
  const ORIGEM_NOME = Object.fromEntries(pool.ORIGENS);
  const sitItem = (it) => quando(`${STATUS_NOME[it.status] || ''}${it.status === 'publicado' ? ` em ${pool.dataCurta(it.publicadoEm || it.dia)}` : it.dia ? ` · ${pool.dataCurta(it.dia)}` : ''}`,
    it.status === 'publicado' ? 'ok' : it.status === 'agendado' ? 'hora' : '', { pequeno: true });
  const campos = [];
  if (!s.itens.length) campos.push(['No pool', 'Ainda não foi enviada.']);
  else if (pins) {
    campos.push(['No pool', `${s.noPool} de ${s.total} pins`]);
    campos.push(['Pins', `<ul class="mk-gv-lista">${s.itens.slice().sort((a, b) => (a.dia || '9').localeCompare(b.dia || '9'))
      .map((it) => `<li><a class="mk-link" href="#/calendario/item/${encodeURIComponent(it.id)}">${esc(it.titulo || it.pin?.titulo || 'Pin')}</a> · ${sitItem(it)}</li>`).join('')}</ul>`]);
  } else {
    const it = s.itens[0];
    campos.push(['Situação', sitItem(it)]);
    if (it.dia) campos.push(['Dia', esc(pool.dataLonga(it.dia))]);
    campos.push(['Origem', esc(ORIGEM_NOME[it.origem] || '—')]);
  }
  campos.push(['Criada', esc(dataHora(r.criado))], ['Último salvamento', esc(dataHora(r.atualizado))]);
  if (s.itens.length) campos.push(['Enviada ao pool', esc(r.enviadoEm ? dataHora(r.enviadoEm) : '—')]);
  const alvo = s.proximo || s.primeiro;
  gaveta.abrir({
    etiqueta: `${etiqueta(NUCLEOS[r.nucleo]?.nome || '')} ${quando(txt, tom, { pequeno: true })}`,
    titulo: r.titulo || 'Sem título',
    texto: s.alterada ? 'Salva depois do último envio: o pool está sendo atualizado com a versão nova (o que já foi publicado não muda).' : '',
    campos,
    acoes: `${s.faltam && !r.arquivado && !tarefas.has(id) ? acao(pins && s.noPool ? `Enviar ${s.faltam} ao pool` : 'Enviar ao pool', { principal: true, dados: { 'pb-enviar': id } }) : ''}
      ${alvo ? acao('Abrir no calendário', { href: `#/calendario/item/${encodeURIComponent(alvo.id)}` }) : ''}
      ${acao('Abrir no editor', { href: `#/p/${encodeURIComponent(id)}` })}`,
  }).addEventListener('click', (e) => {
    const b = e.target.closest('[data-pb-enviar]');
    if (b) { gaveta.fechar(); if (pub?.id === id) $('#btPool').click(); else enviarDoArquivo(id); }
    if (e.target.closest('a[href]')) gaveta.fechar(true);
  });
}

// ---- Tarefas em segundo plano (enviar, reenviar, baixar), uma de cada vez -----------------------

const tarefas = new Map(); // id → texto mostrado na situação
let fila = Promise.resolve();
const tentadas = new Set();  // reenvios automáticos já tentados nesta sessão (não repete se falhar)

function emSegundoPlano(id, texto, fn) {
  tarefas.set(id, texto);
  if (naInicio()) renderArquivo();
  const vez = fila.then(fn).catch((e) => { console.warn(e); aviso('Não foi possível terminar: ' + (e.message || 'erro')); });
  fila = vez.finally(async () => {
    tarefas.delete(id);
    if (!naInicio()) return;
    await montarResumos();
    renderArquivo();
  });
  return fila;
}
const progresso = (id) => (texto) => { tarefas.set(id, texto); if (naInicio()) renderArquivo(); };

const migradas = new WeakSet(); // cards de versões anteriores convertidos aos modelos universais ao abrir
/** A publicação inteira (a cópia mais nova entre este navegador e a nuvem), com as imagens carregadas. */
async function lerCompleta(id) {
  let p = await local.lerPub(id);
  const r = resumos.find((x) => x.id === id);
  if (!p || (r && !r.rascunho && (r.atualizado || '') > (p.atualizado || ''))) {
    try { p = await nuvem.ler(id); await local.gravarPub(p); } catch (e) { if (!p) throw e; }
  }
  if (!p) throw new Error('publicação não encontrada');
  if (p.cards.map((c) => migrarCard(p.nucleo, c)).some(Boolean)) migradas.add(p);
  await carregarImagens(p);
  return p;
}

function enviarDoArquivo(id, { auto = false } = {}) {
  if (pub?.id === id) return;
  return emSegundoPlano(id, auto ? 'Atualizando o pool…' : 'Enviando ao pool…', async () => {
    const p = await lerCompleta(id);
    await enviarAoPool(p, { auto, silencioso: auto, progresso: progresso(id) });
  });
}

/** Publicações alteradas depois do envio (salvas noutra hora ou noutro computador): reenvio automático. */
function reenviarPendentes() {
  for (const r of resumos) {
    if (r.arquivado || tarefas.has(r.id) || tentadas.has(r.id) || pub?.id === r.id) continue;
    if (!alteradaDepoisDoEnvio(r)) continue;
    tentadas.add(r.id);
    enviarDoArquivo(r.id, { auto: true });
  }
}

function baixarDoArquivo(id) {
  emSegundoPlano(id, 'Gerando os arquivos…', async () => {
    const p = await lerCompleta(id);
    await exportarTudo(p, { progresso: progresso(id) });
  });
}

async function arquivarPublicacao(id, arquivar = true) {
  try {
    const p = await lerCompleta(id);
    p.arquivado = arquivar;
    await local.gravarPub(p);
    await nuvem.gravar({ ...p, salvoEm: p.salvoEm || p.atualizado });
  } catch (e) {
    console.warn(e);
    aviso('Não foi possível ' + (arquivar ? 'arquivar' : 'restaurar') + ' na nuvem.');
  }
  await carregarArquivo();
  renderInicio();
  aviso(arquivar ? 'Publicação arquivada. Está em Arquivadas.' : 'Publicação restaurada.');
}

async function abrirPublicacao(id) {
  // o envio em segundo plano termina antes (ele usa o mesmo gerador de arquivos)
  if (tarefas.size) { aviso('Terminando o envio ao pool…'); await fila; }
  let p;
  try { p = await lerCompleta(id); } catch { aviso('Não foi possível abrir essa publicação.'); location.hash = '#/'; return; }
  pub = p;
  abertura.set(pub, pub.atualizado || '');
  pub.ativo = Math.min(pub.ativo || 0, pub.cards.length - 1);
  if (migradas.has(pub) || (pub.versao || 0) < VERSAO) { pub.versao = VERSAO; salvar(); }
  mostrar('editor');
  status(pendente() ? 'pendente' : 'salvo', pub.salvoEm);
  renderEditor();
}

async function duplicarPublicacao(id) {
  let p = await local.lerPub(id);
  if (!p && nuvem.ativa()) p = await nuvem.ler(id);
  if (!p) return;
  const agora = new Date().toISOString();
  const copia = { ...structuredClone(p), id: uid('p'), titulo: `${tituloDe(p)} (cópia)`, criado: agora, atualizado: agora, enviadoEm: '', arquivado: false };
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
  $('#voltarRot').textContent = SUBPAGINAS.find((x) => x[1] === formatoDe(pub))[2];
  $('#cardRot').textContent = pin ? 'Dados do pin' : 'Dados do card';
  $('#btExportarCard').textContent = pin ? 'Exportar pin' : 'Exportar card';
  $('#btExportarTudo').textContent = 'Exportar tudo';
  $('#btExportarCard').title = pin ? 'O pin em destaque, em JPG 1000 × 1500' : 'O card em destaque, em JPG 1080 × 1440';
  $('#btExportarTudo').title = pin ? 'Todos os pins em JPG, num .zip com o textos.txt' : 'Todos os cards em JPG, num .zip';
  $('#btPool').title = pin
    ? 'Envia os pins ao pool de mídias (imagem e textos), para agendar no Calendário. Depois, as alterações vão sozinhas para o pool.'
    : 'Envia o carrossel ao pool de mídias, para agendar no Calendário. Depois, as alterações vão sozinhas para o pool.';
  // pool por baixo: a situação no pool e o aviso, no painel de imagens, de foto que já está no pool
  const alvo = pub;
  renderSituacao();
  pool.carregar().then(() => { if (pub === alvo) { renderSituacao(); if (ehPin()) renderImagens(); } }).catch(() => {});
  renderGuias();
  renderGlobais();
  renderTrilho();
  renderModelos();
  renderImagens();
}

/** Situação no pool, na barra do editor, e o Enviar ao pool quando falta algo lá. */
function renderSituacao(tarefa = '') {
  if (!pub) return;
  const s = situacaoNoPool(pub);
  const b = $('#btPool');
  b.hidden = !s.faltam || tarefas.has(pub.id);
  b.textContent = ehPin() && s.noPool ? `Enviar ${s.faltam} ao pool` : 'Enviar ao pool';
  const auto = $('#datasPub');
  if (auto) auto.innerHTML = datasDaPublicacao(tarefa);
}

/** Datas automáticas (só leitura) e o código dos arquivos. */
function datasDaPublicacao(tarefa = tarefas.get(pub.id) || '') {
  const [txt, tom] = tarefa ? [tarefa, 'atencao'] : textoSituacao(pub);
  const sit = `<div><span>No pool</span><span><button type="button" class="mk-link" id="btSituacao" title="Ver no pool">${quando(txt, tom, { pequeno: true })}</button></span></div>`;
  const env = itensDoPool(pub.id).length ? `<div><span>Enviada</span><span>${esc(pub.enviadoEm ? dataHora(pub.enviadoEm) : '—')}</span></div>` : '';
  return `${sit}<div><span>Criada</span><span>${esc(dataHora(pub.criado))}</span></div>
    <div><span>Salva</span><span>${esc(pub.salvoEm ? dataHora(pub.salvoEm) : 'ainda não salva na nuvem')}</span></div>${env}`;
}

// ---- Informações padrão ---------------------------------------------------

const CAMPOS_GLOBAIS = [
  { grupo: 'Dados da publicação', dica: 'Valem para todos os cards desta publicação.', campos: [
    { k: '__titulo', rot: 'Nome da publicação' },
    { k: 'projeto', rot: 'Rótulo do cabeçalho', rotElaia: 'Autoria', dica: 'Texto do canto superior direito dos cards.', dicaElaia: 'Canto superior direito dos cards, depois do texto fixo "Escrito por".' },
  ] },
];

/** Dados da publicação de pins: projeto, link padrão e créditos (fecham a descrição de cada pin). */
const CAMPOS_PIN = [
  { k: '__titulo', rot: 'Nome da publicação' },
  { k: 'projeto', rot: 'Projeto, peça ou texto', dica: 'Entra na campanha dos links (utm_campaign) e no nome dos arquivos, quando a publicação não tem nome.' },
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
  // datas automáticas (criação, último salvamento, envio ao pool) e o código dos arquivos
  h += `<div class="pub-datas" id="datasPub">${datasDaPublicacao()}</div>
    <p class="pub-codigo">Código dos arquivos${pin ? ' e do utm_content' : ''}: <code>${esc(dataArquivo())}-001-${esc(nucleo().sigla)}</code>${info(pub.globais.dataPublicacao ? 'Data escolhida quando a publicação foi criada (campo antigo); fica assim para os nomes e links já enviados não mudarem.' : 'A data é a de criação da publicação; o número é a posição do card.')}</p>`;
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
  if (ehPin() && ['link', 'creditos', 'creditosEn', 'projeto'].includes(k)) atualizarPinterest();
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
  // os padrões do modelo novo (página Padrões) entram por baixo
  const ini = padraoInicial(pub.nucleo, id);
  c.opcoes = { ...ini.opcoes, ...Object.fromEntries(['carimbo', 'veu'].filter((k) => c.opcoes?.[k]).map((k) => [k, c.opcoes[k]])) };
  c.textos = { ...ini.textos, ...(c.textos || {}) };
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
      h += `<div class="img-item is-vazio"><div class="img-topo"><div class="th"></div><div class="img-nome"><b>${nome}</b><span>Vazio</span></div>
        <div class="img-icones"><button type="button" class="ui-acao" data-acao="trocar" data-slot="${s}">Adicionar</button></div></div></div>`;
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
      <div class="img-topo">
        <div class="th" style="background-image:url('${th}')"></div>
        <div class="img-nome"><b>${nome}</b><span>${im.w} × ${im.h} px</span></div>
        <div class="img-icones">
          <button type="button" class="card-icones__bt" data-acao="trocar" data-slot="${s}" title="Trocar imagem" aria-label="Trocar imagem">${ICONE_TROCAR}</button>
          <button type="button" class="card-icones__bt" data-acao="remover" data-slot="${s}" title="Remover imagem" aria-label="Remover imagem">${ICONE_EXCLUIR}</button>
        </div>
      </div>
      ${avisoRes}
      ${trat ? `<div class="seg img-trat" role="group" aria-label="Tratamento">${trat}</div>` : ''}
      <div class="faixas">${FAIXAS.map(([f, rot, min, max, passo, pad, unid]) => {
        const v = im[f] ?? pad;
        const mostrado = f === 'z' ? Math.round(v * 100) : Math.round(v * 10) / 10;
        return `<label class="faixa"><span>${rot}</span><input type="range" min="${min}" max="${max}" step="${passo}" value="${v}" data-faixa="${f}" data-slot="${s}">
          <span class="num"><input type="number" min="${f === 'z' ? min * 100 : min}" max="${f === 'z' ? max * 100 : max}" step="${f === 'z' ? 1 : 0.5}" value="${mostrado}" data-num="${f}" data-slot="${s}" aria-label="${rot}">${unid ? `<i>${unid}</i>` : ''}</span></label>`;
      }).join('')}</div>
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
  const H = wrap.clientHeight - 44 - 22; // em cima, o código do card e os ícones
  const gap = modo === 'todos' ? 16 : 20;
  const kH = H / altDe();
  const unidades = modo === '3' ? 1 + 2 * LATERAL : qtd;
  const kW = (W - 2 * 36 - gap * (qtd + 1)) / (unidades * LARG); // 2 × a caixa ao lado do card em destaque
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

  const pin = ehPin();
  const nome = pin ? 'pin' : 'card';
  // ao lado do card em destaque: + (novo antes ou depois) e a seta de mover para aquele lado, numa caixa compacta
  const lado = (d) => `<div class="lado-card" role="group" aria-label="${d < 0 ? 'Antes' : 'Depois'} deste ${nome}">
      <button type="button" class="lado-card__bt" data-mais="${d < 0 ? 'antes' : 'depois'}" title="Novo ${nome} ${d < 0 ? 'antes' : 'depois'} deste" aria-label="Novo ${nome} ${d < 0 ? 'antes' : 'depois'} deste">${icone('mais', 15, 2)}</button>
      <button type="button" class="lado-card__bt" data-mover="${d}" title="Mover para a ${d < 0 ? 'esquerda' : 'direita'}" aria-label="Mover o ${nome} para a ${d < 0 ? 'esquerda' : 'direita'}"${(d < 0 ? pub.ativo <= 0 : pub.ativo >= pub.cards.length - 1) ? ' disabled' : ''}>${icone(d < 0 ? 'anterior' : 'seta', 15, 2)}</button>
    </div>`;
  const icones = `<span class="card-icones">
      <button type="button" class="card-icones__bt" data-card="duplicar" title="Duplicar ${nome}" aria-label="Duplicar ${nome}">${ICONE_DUPLICAR}</button>
      <button type="button" class="card-icones__bt" data-card="excluir" title="Excluir ${nome}" aria-label="Excluir ${nome}"${pub.cards.length <= 1 ? ' disabled' : ''}>${ICONE_EXCLUIR}</button>
    </span>`;
  let h = '';
  for (const i of vis) {
    if (i === null) { h += `<div class="peca" style="width:${LARG * k * LATERAL}px"></div>`; continue; }
    const c = pub.cards[i];
    const lateral = modo === '3' && i !== pub.ativo;
    const kk = lateral ? k * LATERAL : k;
    const en = c.pin?.idioma === 'en' ? ' · EN' : '';
    if (i === pub.ativo) h += lado(-1);
    h += `<div class="peca ${i === pub.ativo ? 'ativa' : ''} ${lateral ? 'lateral' : ''}" data-id="${c.id}" data-i="${i}">
      <span class="num">${String(i + 1).padStart(2, '0')} · ${codigoDe(pub.nucleo, c.modelo)}${en}</span>${i === pub.ativo ? icones : ''}
      <div class="moldura" style="--k:${kk};--alt:${altDe()}px"><div class="${classeCard()} editar">${renderCard({
        card: c, indice: i, total: pub.cards.length, nucleo: n, globais: pub.globais, modo: 'editar', fonteImagem,
      })}</div>${guiasSvg(altDe())}</div>
    </div>`;
    if (i === pub.ativo) h += lado(1);
  }
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
  $('#navEsq').disabled = pub.ativo <= 0;
  $('#navDir').disabled = pub.ativo >= pub.cards.length - 1;
  $$('#modos button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === modo));
  $('#pontos').innerHTML = pub.cards.map((_, i) => `<button type="button" data-ir="${i}" class="${i === pub.ativo ? 'ativo' : ''}" aria-label="${ehPin() ? 'Pin' : 'Card'} ${i + 1}"${i === pub.ativo ? ' aria-current="true"' : ''}>${i + 1}</button>`).join('');
  renderSituacao(tarefas.get(pub.id) || '');
}

function irPara(i) {
  const novo = Math.max(0, Math.min(pub.cards.length - 1, i));
  if (novo === pub.ativo) return;
  pub.ativo = novo;
  local.gravarPub(pub); // só a posição, neste navegador: trocar de card não é alteração da publicação
  renderTrilho();
  $$('.modelo', $('#modelos')).forEach((b) => b.classList.toggle('ativo', b.dataset.modelo === cardAtivo().modelo));
  renderImagens();
}

function adicionarCard(depois = true) {
  const pin = ehPin();
  const lista = modelosDo(pub.nucleo, formatoDe(pub)).filter((m) => grupoDe(m) === (pin ? 'pin' : 'corpo'));
  const i = lista.findIndex((m) => m.id === cardAtivo()?.modelo);
  const sugestao = lista[(i + 1) % lista.length].id;
  const c = novoCard(sugestao, pub.nucleo, formatoDe(pub));
  // o pin novo segue a composição do pin ativo (o mesmo projeto costuma manter o registro)
  if (pin && cardAtivo()?.opcoes) c.opcoes = { ...cardAtivo().opcoes };
  const pos = depois ? pub.ativo + 1 : pub.ativo;
  pub.cards.splice(pos, 0, c);
  pub.ativo = pos;
  salvar();
  renderTrilho();
  renderModelos();
  renderImagens();
  aviso(pin ? 'Pin adicionado.' : 'Card adicionado. Escolha o modelo à direita.');
}

function duplicarCard() {
  const c = structuredClone(cardAtivo());
  c.id = uid('c');
  if (c.pin) delete c.pin.par; // a cópia é outro pin (novo recorte), sem par em outro idioma
  pub.cards.splice(pub.ativo + 1, 0, c);
  pub.ativo += 1;
  salvar();
  renderTrilho();
  renderImagens();
}

/** Excluir pede confirmação: o primeiro clique troca o ícone por "Excluir?". */
function excluirCard(b) {
  if (pub.cards.length <= 1) return;
  if (!b.dataset.confirmar) {
    b.dataset.confirmar = '1';
    b.classList.add('is-confirmar');
    b.innerHTML = 'Excluir?';
    setTimeout(() => { if (b.isConnected) renderTrilho(); }, 2500);
    return;
  }
  const par = cardAtivo().pin?.par && pub.cards.find((x) => x.id === cardAtivo().pin.par);
  if (par) delete par.pin.par;
  pub.cards.splice(pub.ativo, 1);
  pub.ativo = Math.min(pub.ativo, pub.cards.length - 1);
  salvar();
  renderTrilho();
  renderModelos();
  renderImagens();
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
// Todas recebem a publicação (padrão: a aberta). O #exportador é um só: um arquivo de cada vez (naVez).

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
/** AAMMDD dos arquivos e do código dos pins: a data de criação. Publicações antigas guardam a data escolhida à mão
 *  (o campo saiu do editor), para os nomes e os links já enviados não mudarem. */
function dataArquivo(p = pub) {
  const v = p.globais?.dataPublicacao;
  const d = v ? new Date(v + 'T12:00:00') : p.criado ? new Date(p.criado) : new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
const nomeBase = (p = pub) => slug(p.titulo || p.globais.projeto) || (ehPin(p) ? 'projeto' : 'post');
/** Post: AAMMDD-NNN-nn-assunto.jpg · Pin: AAMMDD-NNN-nn-assunto-pin.jpg (versão em inglês: …-en-pin.jpg). */
const nomeArquivo = (i, p = pub) => (ehPin(p)
  ? `${codigoPin(i, p)}-${nomeBase(p)}${p.cards[i].pin?.idioma === 'en' ? '-en' : ''}-pin.jpg`
  : `${dataArquivo(p)}-${String(i + 1).padStart(3, '0')}-${NUCLEOS[p.nucleo].sigla}-${nomeBase(p)}.jpg`);

let vez = Promise.resolve();
/** Um uso do #exportador de cada vez (editor e segundo plano dividem o mesmo). */
function naVez(fn) {
  const r = vez.then(fn);
  vez = r.catch(() => {});
  return r;
}

async function montarCard(p, i) {
  const host = $('#exportador');
  host.innerHTML = `<div class="${classeCard(p)}">${renderCard({
    card: p.cards[i], indice: i, total: p.cards.length, nucleo: NUCLEOS[p.nucleo], globais: p.globais, modo: 'exportar',
    fonteImagem: (c, s) => fonteImagem(c, s, p),
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
function gerarArquivo(i, p = pub) {
  return naVez(async () => {
    const no = await montarCard(p, i);
    const f = FORMATO_POR_ID[formatoDe(p)];
    const [w, h] = f.canvas;
    const opc = { width: w, height: h, canvasWidth: f.larg, canvasHeight: f.alt, pixelRatio: 1, cacheBust: false, backgroundColor: COR.papel };
    await window.htmlToImage.toCanvas(no, opc); // 1ª passada carrega as fontes
    const canvas = await window.htmlToImage.toCanvas(no, opc);
    $('#exportador').innerHTML = '';
    return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE_JPG));
  });
}

function gerarCapa(p) {
  if (!p.cards.length) return Promise.resolve('');
  return naVez(async () => {
    const no = await montarCard(p, 0);
    const url = await window.htmlToImage.toJpeg(no, { width: LARG, height: altDe(p), pixelRatio: 0.25, quality: 0.82, backgroundColor: COR.papel });
    $('#exportador').innerHTML = '';
    return url;
  });
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

const codigoPin = (i, p = pub) => `${dataArquivo(p)}-${String(i + 1).padStart(3, '0')}-${NUCLEOS[p.nucleo].sigla}`;
const linkDoPin = (i, p = pub) => pinterest.linkFinal(p.cards[i].pin || {}, p.globais, {
  sigla: NUCLEOS[p.nucleo].sigla, projeto: p.globais.projeto || p.titulo, codigo: codigoPin(i, p),
});

/** Lote de pins: o que vai para o textos.txt (seção 07 da estratégia do Pinterest). */
function lotePins(p = pub) {
  const g = p.globais;
  const texto = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return p.cards.map((c, i) => {
    const pin = c.pin || pinterest.pinVazio(p.nucleo);
    return {
      numero: String(i + 1).padStart(2, '0'),
      arquivo: nomeArquivo(i, p),
      pasta: pinterest.pastaDe(pin.pasta)?.nome || '',
      titulo: texto(pin.titulo),
      descricao: pinterest.descricaoFinal(pin, g),
      alt: texto(pin.alt),
      link: linkDoPin(i, p),
      idioma: pin.idioma || 'pt',
      tipo: pin.tipo || 'imagem',
      avisos: ['titulo', 'descricao', 'pasta', 'link'].flatMap((k) => pinterest.avisosDe(k, pin, g)),
    };
  });
}

/** Carrossel (.zip) ou lote de pins (.zip com textos.txt). `progresso(texto)`: no arquivo, o texto vai ao cartão. */
async function exportarTudo(p = pub, { progresso = aviso } = {}) {
  const pin = ehPin(p);
  progresso(`Gerando ${p.cards.length} ${pin ? 'pins' : 'cards'}…`);
  await aguardarTratamentos(p.cards, p);
  const zip = new window.JSZip();
  for (let i = 0; i < p.cards.length; i++) zip.file(nomeArquivo(i, p), await gerarArquivo(i, p));
  let pendentes = 0;
  if (pin) {
    const lote = lotePins(p);
    pendentes = lote.filter((x) => x.avisos.length).length;
    zip.file('textos.txt', pinterest.textosDoLote({ projeto: p.globais.projeto || tituloDe(p), nucleo: `Odisse ${NUCLEOS[p.nucleo].nome}`, pins: lote }));
  }
  const u = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  baixar(u, `${dataArquivo(p)}-${NUCLEOS[p.nucleo].sigla}-${nomeBase(p)}${pin ? '-pins' : ''}.zip`);
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso(pin
    ? `Lote exportado (.zip, com textos.txt).${pendentes ? ` ${pendentes} ${pendentes === 1 ? 'pin tem' : 'pins têm'} avisos — veja o textos.txt.` : ''}`
    : 'Carrossel exportado (.zip).');
  if (p === pub) salvarNaNuvem({ silencioso: true });
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
async function fontesDe(indices, p = pub) {
  const out = [];
  for (const i of indices) {
    for (const im of Object.values(p.cards[i].imgs || {})) {
      const src = im?.ref ? imagens.get(im.ref) : null;
      if (src) out.push({ hash: await pool.hashDe(src), x: im.x ?? 50, y: im.y ?? 50, z: im.z ?? 1 });
    }
  }
  return out;
}

/**
 * Envia ao pool: cada pin vira um item (pl-<card>); o carrossel inteiro, um item (pl-<publicação>).
 * Reenviar substitui imagens e textos e mantém dia, situação e origem; o que já foi publicado não muda.
 * `auto` (reenvio automático, depois de alterar o que já estava no pool): só atualiza o que já está lá; pins
 * novos entram pelo Enviar ao pool. Grava `enviadoEm` (a hora do envio) e salva a publicação.
 */
async function enviarAoPool(p = pub, { auto = false, silencioso = false, progresso = aviso } = {}) {
  const pin = ehPin(p);
  try { await pool.carregar(true); } catch (e) { console.warn(e); if (!silencioso) aviso('Não foi possível ler o pool na nuvem.'); return; }
  await aguardarTratamentos(p.cards, p);
  // a hora do envio; nunca antes da última alteração (relógios de computadores diferentes)
  const enviadoEm = [new Date().toISOString(), p.atualizado || ''].sort().pop();
  let unidades = pin ? p.cards.map((_, i) => [i]) : [p.cards.map((_, i) => i)];
  if (auto) unidades = unidades.filter((idx) => pool.item(pin ? `pl-${p.cards[idx[0]].id}` : `pl-${p.id}`));
  const lote = pin ? lotePins(p) : null;
  const agora = new Date().toISOString();
  let novos = 0, atualizados = 0, publicados = 0, repetidos = 0;
  try {
    for (let u = 0; u < unidades.length; u++) {
      const idx = unidades[u];
      const card = p.cards[idx[0]];
      const id = pin ? `pl-${card.id}` : `pl-${p.id}`;
      const ant = pool.item(id);
      if (ant?.status === 'publicado') { publicados++; continue; }
      progresso(pin ? `${auto ? 'Atualizando' : 'Enviando'} o pin ${u + 1} de ${unidades.length}…` : `${auto ? 'Atualizando o pool' : 'Enviando ao pool'}…`);
      const imgs = [];
      let mini = '';
      for (const i of idx) {
        const blob = await gerarArquivo(i, p);
        const ref = uid('m');
        await nuvem.enviarBlob(ref, blob);
        imgs.push({ ref, nome: nomeArquivo(i, p) });
        if (!mini) mini = await miniatura(blob);
      }
      const fontes = await fontesDe(idx, p);
      const par = pin && card.pin?.par ? `pl-${card.pin.par}` : '';
      const l = pin ? lote[idx[0]] : null;
      const it = {
        ...(ant || {}),
        id, rede: pin ? 'pinterest' : 'instagram', formato: formatoDe(p), pub: p.id, card: pin ? card.id : null,
        nucleo: p.nucleo, projeto: p.globais.projeto || tituloDe(p), titulo: pin ? l.titulo : tituloDe(p),
        imagens: imgs, miniatura: mini,
        pin: pin ? { titulo: l.titulo, descricao: l.descricao, alt: l.alt, pasta: card.pin?.pasta || '', pastaNome: l.pasta, link: l.link, idioma: l.idioma, tipo: l.tipo } : null,
        avisos: pin ? l.avisos : [],
        fontes, par,
        origem: ant?.origem || p.globais.origem || (pin ? 'acervo' : 'fluxo'),
        status: ant?.status || 'pronto', dia: ant?.dia || '', pos: ant?.pos ?? null, publicadoEm: ant?.publicadoEm || '',
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
    if (!silencioso) aviso('Não foi possível enviar ao pool. Tente de novo.');
    throw e;
  }
  p.enviadoEm = enviadoEm;
  const partes = [];
  if (novos) partes.push(`${novos} ${novos === 1 ? 'nova' : 'novas'}`);
  if (atualizados) partes.push(`${atualizados} ${atualizados === 1 ? 'atualizada' : 'atualizadas'}`);
  let msg = partes.length ? `Pool de mídias: ${partes.join(', ')}.` : 'Nada enviado.';
  if (publicados) msg += ` ${publicados} já ${publicados === 1 ? 'publicada ficou' : 'publicadas ficaram'} como estava${publicados === 1 ? '' : 'm'}.`;
  if (repetidos) msg += ` Atenção: ${repetidos} com imagem e recorte iguais a outro item.`;
  if (!silencioso || repetidos) aviso(auto && !repetidos ? 'Pool atualizado com a versão nova.' : msg);
  // guarda a hora do envio (sem mexer em `atualizado`: não é alteração da publicação)
  if (p === pub) {
    await local.gravarPub(p);
    renderImagens();
    renderSituacao();
    if (salvando) await salvando;
    await salvarNaNuvem({ silencioso: true });
  } else await gravarNaNuvem(p);
}

/** Reenvio automático da publicação aberta, em segundo plano (o editor continua livre). */
function reenviarAutomatico(p) {
  if (tarefas.has(p.id)) return;
  emSegundoPlano(p.id, 'Atualizando o pool…', async () => {
    if (pub === p) renderSituacao('Atualizando o pool…');
    await enviarAoPool(p, { auto: true, silencioso: true, progresso: (t) => { progresso(p.id)(t); if (pub === p) renderSituacao(t); } });
    if (pub === p) renderSituacao();
  });
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
    pinterest.carregarPastas().then((mudou) => { if (mudou && pub && ehPin()) renderPinterest(); });
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
    // a antiga subpágina Plataformas (tabela por projeto) virou a vista Tabela do Pool de mídias
    if (location.hash.startsWith('#/calendario/plataformas')) { history.replaceState(null, '', '#/calendario/pool/tabela'); }
    await renderCalendario($('#calendario'), location.hash.split('/').slice(2).join('/'), { aviso });
    return;
  }
  if (location.hash.startsWith('#/padroes')) {
    if (pub) await sairDoEditor();
    document.title = 'Padrões · Universo';
    mostrar('padroes');
    await renderPadroes($('#padroes'), location.hash.split('/')[2] || '', { aviso });
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
    else if (f[1] !== formatoInicio) { formatoInicio = f[1]; prefs.set('formatoInicio', formatoInicio); ui.filtro = 'todos'; ui.busca = ''; ui.arquivadas = false; }
    if (pub) await sairDoEditor();
    document.title = `${SUBPAGINAS.find((x) => x[1] === formatoInicio)[2]} · Publicações · Universo`;
    mostrar('inicio');
    await pool.abrirLocal();
    await montarResumos(); // na hora, com o que já está neste navegador
    renderInicio();
    // por baixo: a lista e o pool da nuvem; depois, o reenvio automático do que mudou depois do envio
    const [mudouLista, mudouPool] = await Promise.all([buscarLista(), pool.carregar().catch(() => false)]);
    if (pub || !naInicio()) return;
    if (mudouLista) await montarResumos();
    if (mudouLista || mudouPool) renderInicio();
    reenviarPendentes();
  }
}

// ---- Entrada ----------------------------------------------------------------

// Entrada: a do Universo. Sem senha (ou senha recusada pela API), guarda o endereço e volta ao Início para
// entrar; depois de entrar, o Início traz de volta para cá (sessionStorage 'universo:volta').
function irParaEntrada() {
  try { sessionStorage.setItem('universo:volta', location.href); } catch { /* segue */ }
  location.href = '/#/';
}

// O item aceso no menu lateral do Universo (casca): Publicações, Estratégia, Calendário editorial e Métricas são
// itens do menu; cada página mostra só as próprias Abas.
const MENU_DA_SECAO = { publicacoes: 'publicacoes', calendario: 'calendario', estrategia: 'estrategia', metricas: 'metricas' };
function marcarSecao(secao) {
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

  // Início: criar e arquivo (um ouvinte só, a página é redesenhada inteira)
  const inicio = $('#inicio');
  inicio.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t.closest('.mk-pb-menu') && !t.closest('[data-pb-menu]')) fecharMenu();
    const criar = t.closest('[data-criar]');
    if (criar) {
      const p = await novaPublicacao(criar.dataset.criar, formatoInicio);
      await local.gravarPub(p);
      try {
        await nuvem.gravar({ ...p, salvoEm: p.atualizado });
        p.salvoEm = p.atualizado;
        await local.gravarPub(p);
      } catch { /* fica como rascunho até o próximo salvamento */ }
      location.hash = `#/p/${p.id}`;
      return;
    }
    const seg = t.closest('[data-segmentado]');
    if (seg) {
      const g = seg.dataset.segmentado, v = seg.dataset.valor;
      if (g === 'pb-nuc') ui.filtro = v;
      if (g === 'pb-arq') ui.arquivadas = v === 'arquivadas';
      if (g === 'pb-ordem') { ui.ordem = v; prefs.set('pubOrdem', v); }
      if (g === 'pb-vista') { ui.vista = v; prefs.set('pubVista', v); }
      renderInicio();
      return;
    }
    const b = t.closest('button');
    const d = b?.dataset || {};
    if (d.pbMenu) { if (b.getAttribute('aria-expanded')) fecharMenu(); else abrirMenu(b); return; }
    if (d.pbPool) { gavetaPool(d.pbPool); return; }
    if (d.pbEnviar) { enviarDoArquivo(d.pbEnviar); return; }
    if (d.pbDuplicar) { fecharMenu(); duplicarPublicacao(d.pbDuplicar); return; }
    if (d.pbBaixar) { fecharMenu(); baixarDoArquivo(d.pbBaixar); return; }
    if (d.pbArquivar) { fecharMenu(); arquivarPublicacao(d.pbArquivar, true); return; }
    if (d.pbRestaurar) { fecharMenu(); arquivarPublicacao(d.pbRestaurar, false); return; }
    if (t.closest('.mk-pb-menu a')) { fecharMenu(); return; }
    // linha da Lista: abre o editor
    const linha = t.closest('[data-abre]');
    if (linha && !t.closest('a, button')) location.hash = `#/p/${linha.dataset.abre}`;
  });
  inicio.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharMenu();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-abre][tabindex]')) { e.preventDefault(); location.hash = `#/p/${e.target.dataset.abre}`; }
  });
  inicio.addEventListener('input', (e) => {
    if (!e.target.matches('[data-pb-busca]')) return;
    ui.busca = e.target.value;
    renderArquivo();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest?.('#inicio')) fecharMenu(); });

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
  $('#btExportarCard').onclick = () => exportarCard().catch(erroExport);
  $('#btExportarTudo').onclick = () => exportarTudo().catch(erroExport);
  $('#btPool').onclick = (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    renderSituacao('Enviando ao pool…');
    enviarAoPool().catch(erroExport).finally(() => { b.disabled = false; renderSituacao(); });
  };
  $('#globaisPub').addEventListener('click', (e) => { if (e.target.closest('#btSituacao') && pub) gavetaPool(pub.id); });
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
    const mais = e.target.closest('[data-mais]');
    if (mais) { adicionarCard(mais.dataset.mais === 'depois'); return; }
    const acaoCard = e.target.closest('[data-card]');
    if (acaoCard) { if (acaoCard.dataset.card === 'duplicar') duplicarCard(); else excluirCard(acaoCard); return; }
    const mv = e.target.closest('[data-mover]');
    if (mv) { mover(Number(mv.dataset.mover)); return; }
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
  await carregarPadroesCards(); // os padrões editados (página Padrões) antes de desenhar qualquer card
  padroesCardsDaNuvem().then((mudou) => { if (mudou && pub) renderTrilho(); });
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
