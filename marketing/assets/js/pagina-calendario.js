// Calendário (#/calendario): o pool de mídias atrelado aos dias.
// Subpáginas: Calendário (mês, arrastar do pool para os dias, distribuir, lote da semana) ·
// Pool de mídias (por projeto: situação, pastas, origem, repetição) · Plataformas (a antiga planilha
// odisse-plataformas-de-publicacao.xlsx: projeto, publicados, pastas e último lote, por plataforma).

import * as pool from './pool.js';
import * as pinterest from './pinterest.js';
import * as nuvem from './nuvem.js';
import * as local from './store.js';
import * as plano from './plano.js';
import { NUCLEOS, ORDEM_NUCLEOS } from './nucleos.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const info = (txt) => ` <span class="info" tabindex="0" data-info="${esc(txt)}">i</span>`;
const SUBS = [['', 'Calendário'], ['pool', 'Pool de mídias'], ['plataformas', 'Plataformas']];
const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const STATUS_NOME = Object.fromEntries(pool.STATUS);
const ORIGEM_NOME = Object.fromEntries(pool.ORIGENS);
const REDE_NOME = Object.fromEntries(pool.REDES);
const STATUS_PAUTA = Object.fromEntries(plano.STATUS_PAUTA);

const ui = {
  sub: '',
  mes: pool.hoje().slice(0, 7),
  rede: 'todos',
  nucleo: 'todos',
  status: 'todos',
  origem: 'todos',
  busca: '',
  ritmo: (() => { try { return Number(localStorage.getItem('universo-cal-ritmo')) || 2; } catch { return 2; } })(),
  inicio: '',
  lado: 'pool',
};
let raiz = null, resumos = [], ligado = false, avisar = () => {};

/** Monta a página. `opc.aviso` mostra a mensagem do app. */
export async function renderCalendario(el, sub, opc = {}) {
  raiz = el;
  ui.sub = sub || '';
  avisar = opc.aviso || avisar;
  if (!$('.cal-conteudo', raiz)) {
    raiz.innerHTML = '<div class="cal-conteudo"></div><dialog class="modal pool-detalhe" id="poolDetalhe"></dialog>';
  }
  if (!ligado) { ligar(); ligado = true; }
  await pool.abrirLocal();
  if (!resumos.length) resumos = await local.listarPubs();
  desenhar();
  // por baixo: o pool e o arquivo da nuvem
  const [mudouPool, lista] = await Promise.all([
    pool.carregar().catch((e) => { console.warn(e); return false; }),
    nuvem.listar().catch(() => null),
    plano.carregarEstrategia(),
    plano.carregarPautas(),
  ]);
  if (lista) resumos = lista;
  if (document.body.classList.contains('vista-calendario')) desenhar(); // o plano (grade, pautas) e o pool da nuvem
}

// ---------------------------------------------------------------------------

const passaFiltro = (it) => (ui.rede === 'todos' || it.rede === ui.rede) && (ui.nucleo === 'todos' || it.nucleo === ui.nucleo);

function desenhar() {
  const conteudo = $('.cal-conteudo', raiz);
  const itens = pool.lista();
  const n = (st) => itens.filter((x) => x.status === st).length;
  const esc_ = plano.escalada();
  const pagina = ui.sub === 'pool' ? paginaPool() : ui.sub === 'plataformas' ? paginaPlataformas() : paginaCalendario();
  const rolagem = raiz.scrollTop;
  conteudo.innerHTML = `
    <section class="met-cab">
      <div>
        <h1>Calendário${info('O pool reúne o que saiu do editor pronto para publicar (botão Enviar ao pool, ao lado da exportação). Aqui cada mídia ganha o seu dia.')}</h1>
        <p><b>${n('pronto')}</b> no pool · <b>${n('agendado')}</b> ${n('agendado') === 1 ? 'agendado' : 'agendados'} · <b>${n('publicado')}</b> ${n('publicado') === 1 ? 'publicado' : 'publicados'}
          · <a href="#/estrategia/ciclo" class="cal-esc" title="Escalada: reserva de uma semana de posts prontos e 4 semanas cumpridas">Fase <b>${esc_.fase}</b> · reserva ${esc_.prontos}/${esc_.precisa} · ${esc_.cumpridas} de 4 semanas cumpridas${esc_.pode ? ' · <b>pode avançar</b>' : ''}</a></p>
      </div>
      <div class="met-acoes cal-filtros">
        <div class="chips">${[['todos', 'Todas as redes'], ...pool.REDES].map(([v, r]) => `<button data-rede="${v}" class="${ui.rede === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>
        <select data-filtro-nucleo aria-label="Núcleo"><option value="todos">Todos os núcleos</option>${ORDEM_NUCLEOS.map((id) => `<option value="${id}" ${ui.nucleo === id ? 'selected' : ''}>${NUCLEOS[id].nome}</option>`).join('')}</select>
      </div>
    </section>
    <nav class="met-nav" aria-label="Seções do calendário">${SUBS.map(([k, r]) => `<a href="#/calendario${k ? '/' + k : ''}" class="${k === ui.sub ? 'ativo' : ''}">${r}</a>`).join('')}</nav>
    <div class="cal-pagina">${pagina}</div>`;
  raiz.scrollTop = rolagem;
}

// ---- miniaturas ---------------------------------------------------------------

function selos(it) {
  const s = [];
  if (it.repete?.some((r) => r.exata)) s.push('<i class="selo-rep" title="A mesma imagem, com o mesmo recorte, já está em outro item do pool">repetida</i>');
  else if (it.repete?.length) s.push('<i class="selo-foto" title="A mesma foto, com outro recorte, está em outro item (permitido)">mesma foto</i>');
  if (it.avisos?.length) s.push(`<i class="selo-av" title="${esc(it.avisos.join(' '))}">${it.avisos.length} ${it.avisos.length === 1 ? 'aviso' : 'avisos'}</i>`);
  return s.join('');
}
const thumb = (it) => `<span class="pool-th f-${it.formato}">${it.miniatura ? `<img src="${it.miniatura}" alt="" draggable="false">` : ''}${it.imagens?.length > 1 ? `<em>${it.imagens.length}</em>` : ''}</span>`;
const subtitulo = (it) => [REDE_NOME[it.rede], it.projeto, it.pin?.pastaNome].filter(Boolean).map(esc).join(' · ');

function tile(it) {
  return `<div class="pool-tile" draggable="true" data-item="${esc(it.id)}" title="Clique para abrir; arraste para um dia">
    ${thumb(it)}
    <span class="pool-tx"><b>${esc(it.titulo || 'Sem título')}</b><small>${subtitulo(it)}</small><span class="selos">${selos(it)}</span></span>
  </div>`;
}

// ---- Calendário ---------------------------------------------------------------

// Encaixe da grade (plano de publicação) num dia: o previsto, o que o ocupa e os avisos.
const PRAZO_CURTO = { pautas: 'Pautas → ciclo', captacao: 'Captação →', textos: 'Textos →', design: 'Design →', agendar: 'Agendar →', metricas: 'Métricas do ciclo' };
function prazoCurto(p) {
  const alvo = p.k === 'metricas' ? '' : ` ${pool.dataCurta(p.alvo)}`;
  const tit = p.k === 'agendar' ? `Revisão e agendamento da semana de ${pool.dataCurta(p.alvo)}, até sexta ${pool.dataCurta(p.dia)}`
    : p.k === 'captacao' ? `Captação dos reels das semanas de ${pool.dataCurta(p.alvo)} e ${pool.dataCurta(p.ate)}`
    : p.k === 'pautas' ? `Pautas do ciclo que começa em ${pool.dataCurta(p.alvo)}`
    : p.k === 'metricas' ? 'Revisão das métricas do ciclo, antes de fechar as pautas do próximo'
    : `${p.rot} da semana de ${pool.dataCurta(p.alvo)}`;
  return `<li class="pz-${p.k}" title="${esc(tit)}">${PRAZO_CURTO[p.k]}${alvo}</li>`;
}

function encaixeHtml(dia, e, conf, hoje) {
  const o = plano.ocupantes(dia, e.pos);
  const n = NUCLEOS[e.nucleo] || NUCLEOS.estudio;
  const ocup = o.item || o.pauta;
  const outro = ocup && ocup.nucleo !== e.nucleo;
  const aviso = conf.get(`${dia}:${e.pos}`) || (outro ? `A grade prevê ${n.nome} neste encaixe` : '');
  const estado = o.item ? `st-${o.item.status}` : o.pauta ? `pt-${o.pauta.status}` : 'lacuna';
  let miolo = '';
  if (o.item) miolo += `<div class="cal-item st-${o.item.status}${o.item.status === 'agendado' && dia < hoje ? ' atrasado' : ''}" draggable="true" data-item="${esc(o.item.id)}" title="${esc(o.item.titulo || '')}">${thumb(o.item)}</div>`;
  if (o.pauta) miolo += `<span class="enc-pauta pt-${o.pauta.status}" draggable="true" data-pauta="${esc(o.pauta.id)}" title="${esc(`${o.pauta.obra ? o.pauta.obra + ' · ' : ''}${o.pauta.angulo} · ${STATUS_PAUTA[o.pauta.status]}`)}">${esc(o.pauta.angulo || 'Pauta')}</span>`;
  const rot = e.formato === 'reel' ? `Reel ${e.rotulo}` : 'Post';
  return `<div class="enc ${estado}${aviso ? ' enc-aviso' : ''}" data-dia="${dia}" data-pos="${e.pos}" style="--cor:${n.painel}"
      title="${esc([e.horario, plano.rotuloDe(e), n.nome, aviso].filter(Boolean).join(' · '))}">
    <div class="enc-cab"><i></i><span>${e.horario.slice(0, 3)} · ${rot}</span>${aviso ? '<b>!</b>' : ''}</div>${miolo}</div>`;
}

function paginaCalendario() {
  const [a, m] = ui.mes.split('-').map(Number);
  const primeiro = `${ui.mes}-01`;
  const ultimo = pool.isoDia(new Date(a, m, 0));
  const inicio = pool.segundaDe(primeiro);
  const fim = pool.somarDias(pool.segundaDe(ultimo), 6);
  const hoje = pool.hoje();
  const itens = pool.lista().filter(passaFiltro);
  const comGrade = ui.rede !== 'pinterest';
  const porDia = new Map();
  for (const it of itens) if (it.dia) { if (!porDia.has(it.dia)) porDia.set(it.dia, []); porDia.get(it.dia).push(it); }
  const nomeMes = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  const pautas = plano.listaPautas().filter((p) => ui.nucleo === 'todos' || p.nucleo === ui.nucleo);

  let grade = `<div class="cal-canto">Semana</div>${DIAS_SEM.map((d) => `<div class="cal-dsem">${d}</div>`).join('')}`;
  for (let seg = inicio; seg <= fim; seg = pool.somarDias(seg, 7)) {
    const daSemana = itens.filter((x) => x.dia >= seg && x.dia <= pool.somarDias(seg, 6));
    const c = plano.semanaDoCiclo(seg);
    const conf = comGrade ? plano.conflitosDaSemana(seg, plano.ocupacao) : new Map();
    grade += `<div class="cal-sem">
      <span>${pool.dataCurta(seg)}</span>
      <small class="sem-ab" title="Semana ${c.n} do ciclo de 4 · fase ${plano.faseEm(seg)}">Sem. ${c.n} · ${c.ab} · F${plano.faseEm(seg)}</small>
      <button class="mini-bt" data-lote="${seg}" ${daSemana.length ? '' : 'disabled'} title="Baixar o lote desta semana: imagens por dia e textos.txt">Lote ↓</button>
      ${comGrade ? `<ul class="sem-prazos">${plano.prazosDaSemana(seg).map(prazoCurto).join('')}</ul>` : ''}</div>`;
    for (let i = 0; i < 7; i++) {
      const dia = pool.somarDias(seg, i);
      const encs = comGrade ? plano.encaixesDoDia(dia) : [];
      const posValidos = new Set(encs.map((x) => x.pos));
      const lista = (porDia.get(dia) || []).filter((x) => !(x.rede === 'instagram' && x.pos != null && posValidos.has(x.pos)))
        .sort((x, y) => (x.rede > y.rede ? 1 : -1));
      const pts = comGrade ? pautas.filter((p) => p.dia === dia && (p.pos == null || !posValidos.has(p.pos))) : [];
      const pins = (porDia.get(dia) || []).filter((x) => x.rede === 'pinterest').length;
      const fora = dia.slice(0, 7) !== ui.mes;
      grade += `<div class="cal-dia${fora ? ' cal-fora' : ''}${dia === hoje ? ' hoje' : ''}${dia < hoje ? ' passado' : ''}" data-dia="${dia}">
        <div class="cal-dia-cab"><b>${Number(dia.slice(8))}</b>${pins ? `<small class="${pins > pool.RITMO_MAX ? 'excesso' : ''}" title="${pins > pool.RITMO_MAX ? 'Mais de 3 pins no dia (a meta é de 1 a 3)' : 'Pins no dia'}">${pins} ${pins === 1 ? 'pin' : 'pins'}</small>` : ''}</div>
        ${encs.length ? `<div class="encs">${encs.map((x) => encaixeHtml(dia, x, conf, hoje)).join('')}</div>` : ''}
        <div class="cal-itens">${lista.map((it) => `<div class="cal-item st-${it.status}${it.status === 'agendado' && dia < hoje ? ' atrasado' : ''}" draggable="true" data-item="${esc(it.id)}" title="${esc(`${it.titulo || 'Sem título'} · ${STATUS_NOME[it.status]}`)}">${thumb(it)}</div>`).join('')}
          ${pts.map((p) => `<span class="enc-pauta solta pt-${p.status}" draggable="true" data-pauta="${esc(p.id)}" title="${esc(`${p.obra ? p.obra + ' · ' : ''}${p.angulo}`)}">${esc(p.angulo || 'Pauta')}</span>`).join('')}</div>
      </div>`;
    }
  }

  const prontos = itens.filter((x) => x.status === 'pronto').sort((x, y) => (x.criado || '').localeCompare(y.criado || ''));
  const pinsProntos = prontos.filter((x) => x.rede === 'pinterest').length;
  const semDia = pautas.filter((p) => !p.dia && p.status !== 'publicada');
  const inicioDist = ui.inicio || pool.somarDias(hoje, 1);
  const ladoPool = `<div class="dist">
        <span>Distribuir os ${pinsProntos} pins prontos${info('Um projeto por dia (um projeto se publica aos poucos), alternando as pastas, até o número de pins por dia escolhido. Começa no dia indicado e respeita o que já está agendado.')}</span>
        <div class="dist-linha">
          <div class="seg" role="group" aria-label="Pins por dia">${[1, 2, 3].map((v) => `<button data-ritmo="${v}" class="${ui.ritmo === v ? 'ativo' : ''}">${v}/dia</button>`).join('')}</div>
          <input type="date" data-dist-inicio value="${inicioDist}" aria-label="A partir de">
        </div>
        <button class="mini-bt forte" data-distribuir ${pinsProntos ? '' : 'disabled'}>Distribuir</button>
      </div>
      <div class="pool-lista">${prontos.map(tile).join('') || '<p class="vazio">Nada no pool. No editor, use “Enviar ao pool”, ao lado da exportação.</p>'}</div>`;
  const ladoPautas = `<p class="vazio">Arraste a pauta para um encaixe da grade (ou para o dia, no caso dos pins). <a href="#/estrategia/pautas">Banco de pautas →</a></p>
      <div class="pool-lista">${semDia.map((p) => `<div class="pauta-tile pt-${p.status}" draggable="true" data-pauta="${esc(p.id)}" style="--cor:${(NUCLEOS[p.nucleo] || NUCLEOS.estudio).painel}">
        <b>${esc(p.angulo || 'Pauta')}</b><small>${p.formato === 'reel' ? `Reel ${esc(p.modelo || '')}` : p.formato === 'pin' ? 'Pin' : 'Post'} · ${esc(p.obra || plano.FONTE_POR_ID[p.fonte]?.[1] || '')} · ${STATUS_PAUTA[p.status]}</small></div>`).join('')
        || '<p class="vazio">Nenhuma pauta sem dia.</p>'}</div>`;
  return `<div class="cal-layout">
    <div class="cal-principal">
      <div class="cal-barra">
        <button class="mini-bt" data-mes="-1" aria-label="Mês anterior">‹</button>
        <h2>${nomeMes}</h2>
        <button class="mini-bt" data-mes="1" aria-label="Próximo mês">›</button>
        <button class="bt-link" data-mes="0">Hoje</button>
        <span class="cal-legenda"><i class="lacuna"></i>Lacuna <i class="pautado"></i>Pautado <i class="st-agendado"></i>Agendado <i class="st-publicado"></i>Publicado <i class="atrasado"></i>Atrasado</span>
      </div>
      <div class="cal-grade">${grade}</div>
    </div>
    <aside class="pool-lado" data-soltar="pool">
      <div class="seg lado-abas">
        <button data-lado="pool" class="${ui.lado !== 'pautas' ? 'ativo' : ''}">Pool <small>${prontos.length}</small></button>
        <button data-lado="pautas" class="${ui.lado === 'pautas' ? 'ativo' : ''}">Pautas <small>${semDia.length}</small></button>
        ${info('Pool: mídias prontas, ainda sem dia. Pautas: ângulos do banco, ainda sem dia. Arraste para um encaixe da grade ou para o dia; solte aqui para tirar do calendário.')}
      </div>
      ${ui.lado === 'pautas' ? ladoPautas : ladoPool}
    </aside>
  </div>`;
}

// ---- Pool de mídias (por projeto) -----------------------------------------------

function projetos() {
  // projetos com itens no pool + projetos de pins ainda só no editor
  const mapa = new Map();
  for (const it of pool.lista()) {
    if (!mapa.has(it.pub)) mapa.set(it.pub, { pub: it.pub, nucleo: it.nucleo, projeto: it.projeto, itens: [] });
    mapa.get(it.pub).itens.push(it);
  }
  for (const r of resumos) {
    if ((r.formato || '3x4') !== 'pin' || mapa.has(r.id)) continue;
    mapa.set(r.id, { pub: r.id, nucleo: r.nucleo, projeto: r.titulo || 'Sem título', itens: [] });
  }
  for (const p of mapa.values()) {
    const r = resumos.find((x) => x.id === p.pub);
    p.formato = r?.formato || p.itens[0]?.formato || '3x4';
    p.rede = p.formato === 'pin' ? 'pinterest' : 'instagram';
    p.noEditor = r ? (p.formato === 'pin' ? Math.max(0, (r.ncards || 0) - p.itens.length) : (p.itens.length ? 0 : 1)) : 0;
    p.ultimo = p.itens.filter((x) => x.status === 'publicado').map((x) => x.publicadoEm || x.dia).sort().pop() || '';
    p.proximo = p.itens.filter((x) => x.status === 'agendado').map((x) => x.dia).sort()[0] || '';
  }
  return [...mapa.values()];
}

function paginaPool() {
  const busca = ui.busca.trim().toLowerCase();
  const passa = (it) => passaFiltro(it) && (ui.status === 'todos' || it.status === ui.status) && (ui.origem === 'todos' || it.origem === ui.origem)
    && (!busca || `${it.titulo} ${it.projeto} ${it.pin?.pastaNome || ''}`.toLowerCase().includes(busca));
  const lista = projetos()
    .filter((p) => (ui.rede === 'todos' || p.rede === ui.rede) && (ui.nucleo === 'todos' || p.nucleo === ui.nucleo))
    .map((p) => ({ ...p, visiveis: p.itens.filter(passa) }))
    .filter((p) => p.visiveis.length || (ui.status === 'todos' && ui.origem === 'todos' && !busca))
    .sort((a, b) => (b.itens.map((x) => x.atualizado).sort().pop() || '').localeCompare(a.itens.map((x) => x.atualizado).sort().pop() || ''));
  const chips = (k, valores) => `<div class="chips">${[['todos', 'Todos'], ...valores].map(([v, r]) => `<button data-pool-${k}="${v}" class="${ui[k] === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;
  const cont = (p, st) => p.itens.filter((x) => x.status === st).length;
  return `<section class="pool-filtros">
      ${chips('status', pool.STATUS)}
      ${chips('origem', pool.ORIGENS)}
      <input type="search" data-pool-busca value="${esc(ui.busca)}" placeholder="Buscar título, projeto ou pasta" aria-label="Buscar no pool">
    </section>
    ${lista.map((p) => {
      const n = NUCLEOS[p.nucleo] || NUCLEOS.estudio;
      const pastas = new Map();
      for (const it of p.itens) if (it.pin?.pastaNome) pastas.set(it.pin.pastaNome, (pastas.get(it.pin.pastaNome) || 0) + 1);
      return `<section class="proj">
        <div class="proj-cab">
          <div><i class="proj-cor" style="background:${n.painel}"></i><b>${esc(p.projeto)}</b><small>Odisse ${n.nome} · ${REDE_NOME[p.rede]}</small></div>
          <a class="bt-padroes" href="#/p/${esc(p.pub)}">Abrir no editor</a>
        </div>
        <div class="proj-num">
          ${p.noEditor ? `<span title="${p.formato === 'pin' ? 'Pins da publicação que ainda não foram enviados ao pool' : 'Carrossel ainda não enviado ao pool'}"><b>${p.noEditor}</b> só no editor</span>` : ''}
          <span><b>${cont(p, 'pronto')}</b> no pool</span><span><b>${cont(p, 'agendado')}</b> agendados</span><span><b>${cont(p, 'publicado')}</b> publicados</span>
          ${p.proximo ? `<span>próximo ${pool.dataCurta(p.proximo)}</span>` : ''}${p.ultimo ? `<span>último ${pool.dataCurta(p.ultimo)}</span>` : ''}
        </div>
        ${pastas.size ? `<div class="proj-pastas">${[...pastas].map(([nome, q]) => `<span>${esc(nome)} <b>${q}</b></span>`).join('')}</div>` : ''}
        <div class="proj-itens">${p.visiveis.map((it) => `<button class="proj-item st-${it.status}" data-item="${esc(it.id)}">
          ${thumb(it)}
          <span class="proj-tx"><b>${esc(it.titulo || 'Sem título')}</b>
            <small>${STATUS_NOME[it.status]}${it.dia ? ` · ${pool.dataCurta(it.dia)}` : ''} · ${ORIGEM_NOME[it.origem] || ''}${it.pin?.idioma === 'en' ? ' · EN' : ''}</small>
            <span class="selos">${selos(it)}</span></span>
        </button>`).join('')}</div>
      </section>`;
    }).join('') || '<p class="met-vazio">Nada no pool com esses filtros.</p>'}`;
}

// ---- Plataformas (a planilha de plataformas de publicação) ---------------------------

function linhasPlataformas() {
  return projetos()
    .filter((p) => (ui.rede === 'todos' || p.rede === ui.rede) && (ui.nucleo === 'todos' || p.nucleo === ui.nucleo))
    .map((p) => {
      const pastas = new Map();
      for (const it of p.itens) if (it.pin?.pastaNome) pastas.set(it.pin.pastaNome, (pastas.get(it.pin.pastaNome) || 0) + 1);
      const c = (st) => p.itens.filter((x) => x.status === st).length;
      return {
        projeto: p.projeto, nucleo: NUCLEOS[p.nucleo]?.nome || '', plataforma: REDE_NOME[p.rede], pub: p.pub,
        editor: p.noEditor, pool: c('pronto'), agendados: c('agendado'), publicados: c('publicado'),
        pastas: [...pastas].map(([k, q]) => `${k} (${q})`).join(', '), ultimo: p.ultimo, proximo: p.proximo,
      };
    })
    .sort((a, b) => a.plataforma.localeCompare(b.plataforma) || (b.ultimo || b.proximo).localeCompare(a.ultimo || a.proximo) || a.projeto.localeCompare(b.projeto));
}

function paginaPlataformas() {
  const linhas = linhasPlataformas();
  return `<section>
    <div class="sec-cab linha"><div><h2>Plataformas de publicação${info('Substitui a planilha odisse-plataformas-de-publicacao.xlsx: uma linha por projeto e plataforma, calculada a partir do pool. Último lote = o dia publicado mais recente.')}</h2>
      <p>${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'}</p></div>
      <button class="bt-padroes" data-csv>Baixar .csv</button></div>
    <div class="met-tabela"><table class="plat">
      <thead><tr><th>Projeto</th><th>Núcleo</th><th>Plataforma</th><th class="num">Só no editor</th><th class="num">No pool</th><th class="num">Agendados</th><th class="num">Publicados</th><th>Pastas</th><th>Último lote</th><th>Próximo</th></tr></thead>
      <tbody>${linhas.map((l) => `<tr>
        <td><a href="#/p/${esc(l.pub)}">${esc(l.projeto)}</a></td><td>${esc(l.nucleo)}</td><td>${esc(l.plataforma)}</td>
        <td class="num">${l.editor || ''}</td><td class="num">${l.pool || ''}</td><td class="num">${l.agendados || ''}</td><td class="num"><b>${l.publicados || ''}</b></td>
        <td class="pastas-c">${esc(l.pastas)}</td><td>${pool.dataCurta(l.ultimo)}</td><td>${pool.dataCurta(l.proximo)}</td>
      </tr>`).join('') || '<tr><td colspan="10" class="vazio">Nada ainda.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

function baixarCsv() {
  const cab = ['Projeto', 'Núcleo', 'Plataforma', 'Só no editor', 'No pool', 'Agendados', 'Publicados', 'Pastas', 'Último lote', 'Próximo'];
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = linhasPlataformas().map((l) => [l.projeto, l.nucleo, l.plataforma, l.editor, l.pool, l.agendados, l.publicados, l.pastas, l.ultimo, l.proximo]);
  const csv = '﻿' + [cab, ...linhas].map((r) => r.map(cel).join(';')).join('\r\n');
  baixar(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `odisse-plataformas-de-publicacao-${pool.hoje()}.csv`);
}

// ---------------------------------------------------------------------------
// Detalhe de um item

let urlDetalhe = null;
function abrirDetalhe(id) {
  const it = pool.item(id);
  const dlg = $('#poolDetalhe', raiz);
  if (!it || !dlg) return;
  const n = NUCLEOS[it.nucleo] || NUCLEOS.estudio;
  const seg = (k, valores, atual) => `<div class="seg" role="group">${valores.map(([v, r]) => `<button data-det-${k}="${v}" class="${atual === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;
  const copia = (rot, k, v) => (v ? `<div class="det-copia"><span>${rot}</span><p>${esc(v)}</p><button class="mini-bt" data-copiar="${k}">Copiar</button></div>` : '');
  const reps = (it.repete || []).map((r) => {
    const o = pool.item(r.id);
    if (!o) return '';
    return `<li class="${r.exata ? 'forte' : ''}">${r.exata ? 'Mesma imagem e mesmo recorte' : 'Mesma foto, outro recorte (permitido)'}: <a href="#" data-ir-item="${esc(o.id)}">${esc(o.titulo || o.projeto)}</a> — ${STATUS_NOME[o.status]}${o.dia ? ` ${pool.dataCurta(o.dia)}` : ''}</li>`;
  }).join('');
  dlg.innerHTML = `<div class="det" data-det-id="${esc(it.id)}">
    <div class="det-img f-${it.formato}"><img src="${it.miniatura || ''}" alt="" data-det-img>${it.imagens.length > 1 ? `<small>${it.imagens.length} imagens</small>` : ''}</div>
    <div class="det-info">
      <h2>${esc(it.titulo || 'Sem título')}</h2>
      <p class="det-sub">Odisse ${n.nome} · ${esc(it.projeto)} · ${REDE_NOME[it.rede]}${it.pin?.pastaNome ? ` · ${esc(it.pin.pastaNome)}` : ''}</p>
      ${encaixeTexto(it)}
      ${reps ? `<ul class="det-rep">${reps}</ul>` : ''}
      ${it.avisos?.length ? `<ul class="pin-avisos">${it.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <div class="det-linha">
        <label class="campo"><span>Dia</span><input type="date" data-det-dia value="${it.dia || ''}"></label>
        <div class="opcao"><span>Situação</span>${seg('status', pool.STATUS, it.status)}</div>
      </div>
      <div class="opcao"><span>Origem</span>${seg('origem', pool.ORIGENS, it.origem)}</div>
      ${it.pin ? `<div class="det-textos">
        ${copia('Título', 'titulo', it.pin.titulo)}${copia('Descrição', 'descricao', it.pin.descricao)}
        ${copia('Texto alternativo', 'alt', it.pin.alt)}${copia('Link', 'link', it.pin.link)}
        ${it.pin.tipo === 'video' ? '<p class="det-nota">Capa de pin de vídeo: suba com o master limpo do vídeo.</p>' : ''}
      </div>` : ''}
      <div class="det-acoes">
        <button class="mini-bt forte" data-det-acao="baixar">Baixar ${it.imagens.length > 1 ? 'imagens (.zip)' : 'imagem'}</button>
        <a class="mini-bt" href="#/p/${esc(it.pub)}${it.card ? '/' + esc(it.card) : ''}">Abrir no editor</a>
        <button class="mini-bt perigo" data-det-acao="remover">Remover do pool</button>
        <span></span>
        <button class="mini-bt" data-det-acao="fechar">Fechar</button>
      </div>
    </div></div>`;
  if (!dlg.open) dlg.showModal();
  // imagem inteira, da nuvem
  if (urlDetalhe) URL.revokeObjectURL(urlDetalhe);
  urlDetalhe = null;
  nuvem.baixarBlob(it.imagens[0].ref).then((b) => {
    if ($('[data-det-id]', dlg)?.dataset.detId !== it.id) return;
    urlDetalhe = URL.createObjectURL(b);
    $('[data-det-img]', dlg).src = urlDetalhe;
  }).catch(() => {});
}

function encaixeTexto(x) {
  if (!x.dia || x.pos == null) return '';
  const e = plano.encaixesDoDia(x.dia)[x.pos];
  return e ? `<p class="det-enc">Encaixe da grade: ${pool.dataLonga(x.dia)} · ${e.horario} · ${esc(plano.rotuloDe(e))} · ${NUCLEOS[e.nucleo]?.nome || ''}</p>` : '';
}

/** Detalhe de uma pauta no calendário. */
function abrirPauta(id) {
  const p = plano.pauta(id);
  const dlg = $('#poolDetalhe', raiz);
  if (!p || !dlg) return;
  const fo = plano.FONTE_POR_ID[p.fonte];
  dlg.innerHTML = `<div class="det det-pauta" data-pdet-id="${esc(p.id)}"><div class="det-info">
    <h2>${esc(p.angulo || 'Pauta')}</h2>
    <p class="det-sub">${esc(p.obra || 'Sem obra')} · ${fo?.[1] || ''} · Odisse ${NUCLEOS[p.nucleo]?.nome || ''} · ${p.formato === 'reel' ? `Reel ${esc(p.modelo || '')}` : p.formato === 'pin' ? 'Pin' : 'Post'}</p>
    ${encaixeTexto(p)}
    <div class="det-linha">
      <label class="campo"><span>Dia</span><input type="date" data-pdet-dia value="${p.dia || ''}"></label>
      <div class="opcao"><span>Situação</span><div class="seg">${plano.STATUS_PAUTA.map(([v, r]) => `<button data-pdet-status="${v}" class="${p.status === v ? 'ativo' : ''}">${r}</button>`).join('')}</div></div>
    </div>
    ${p.notas ? `<p class="det-nota">${esc(p.notas)}</p>` : ''}
    <div class="det-acoes">
      ${p.dia ? '<button class="mini-bt" data-pdet-acao="tirar">Tirar do calendário</button>' : ''}
      <a class="mini-bt" href="#/estrategia/pautas">Banco de pautas</a>
      <span></span><button class="mini-bt" data-pdet-acao="fechar">Fechar</button>
    </div></div></div>`;
  if (!dlg.open) dlg.showModal();
}

function salvarPautas(l) {
  plano.gravarPautas(l).then((ok) => { if (!ok) avisar('Pautas guardadas neste computador; não foi possível salvar na nuvem.'); });
}
/** Leva uma pauta para um dia e, se houver, para um encaixe (o que estava nele volta para a lista). */
function moverPauta(id, dia, pos) {
  const l = structuredClone(plano.listaPautas());
  const p = l.find((x) => x.id === id);
  if (!p) return;
  if (dia && pos == null && p.formato !== 'pin') {
    // solta no dia: o primeiro encaixe livre do mesmo formato
    const livre = plano.encaixesDoDia(dia).find((e) => e.formato === p.formato && !plano.ocupantes(dia, e.pos).pauta && !plano.ocupantes(dia, e.pos).item);
    pos = livre ? livre.pos : null;
  }
  if (dia && pos != null) for (const o of l) if (o.id !== id && o.dia === dia && o.pos === pos) { o.dia = ''; o.pos = null; }
  p.dia = dia || '';
  p.pos = dia && pos != null ? pos : null;
  salvarPautas(l);
}
/** A pauta do encaixe acompanha o item: pronta quando ele chega, publicada quando ele é publicado. */
function sincronizarPauta(it) {
  if (it.rede !== 'instagram' || !it.dia || it.pos == null) return;
  const pt = plano.ocupantes(it.dia, it.pos).pauta;
  if (!pt) return;
  const novo = it.status === 'publicado' ? 'publicada' : ['pauta', 'producao'].includes(pt.status) ? 'pronta' : pt.status;
  if (novo === pt.status) return;
  const l = structuredClone(plano.listaPautas());
  l.find((x) => x.id === pt.id).status = novo;
  salvarPautas(l);
}

async function salvarItem(it) {
  sincronizarPauta(it);
  desenhar();
  try { await pool.gravar(it); } catch (e) { console.warn(e); avisar('Não foi possível salvar na nuvem.'); }
}

// ---------------------------------------------------------------------------
// Downloads

function baixar(blob, nome) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function baixarItem(it) {
  if (it.imagens.length === 1) {
    baixar(await nuvem.baixarBlob(it.imagens[0].ref), it.imagens[0].nome);
    return;
  }
  const zip = new window.JSZip();
  for (const m of it.imagens) zip.file(m.nome, await nuvem.baixarBlob(m.ref));
  baixar(await zip.generateAsync({ type: 'blob' }), `${slug(it.projeto) || 'carrossel'}.zip`);
}

/** Lote da semana (segunda a domingo): uma pasta por dia e o textos.txt, para agendar de uma vez. */
async function baixarLote(seg) {
  const fim = pool.somarDias(seg, 6);
  const itens = pool.lista().filter(passaFiltro).filter((x) => x.dia >= seg && x.dia <= fim)
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.rede.localeCompare(b.rede));
  if (!itens.length) return;
  avisar(`Baixando ${itens.length} ${itens.length === 1 ? 'mídia' : 'mídias'} da semana…`);
  const zip = new window.JSZip();
  const pins = [], carrosseis = [];
  for (const it of itens) {
    const pasta = it.rede === 'instagram' ? `${it.dia}/${slug(it.projeto) || 'carrossel'}` : it.dia;
    for (const m of it.imagens) zip.file(`${pasta}/${m.nome}`, await nuvem.baixarBlob(m.ref));
    if (it.pin) {
      pins.push({
        numero: String(pins.length + 1).padStart(2, '0'), dia: it.dia, arquivo: `${pasta}/${it.imagens[0].nome}`,
        pasta: it.pin.pastaNome, titulo: it.pin.titulo, descricao: it.pin.descricao, alt: it.pin.alt, link: it.pin.link,
        idioma: it.pin.idioma, tipo: it.pin.tipo, avisos: it.avisos || [],
      });
    } else carrosseis.push(it);
  }
  let txt = pins.length ? pinterest.textosDoLote({ projeto: `semana de ${pool.dataCurta(seg)} a ${pool.dataCurta(fim)}`, nucleo: 'Pool de mídias', pins }) : '';
  if (carrosseis.length) {
    txt += `${txt ? '\r\n\r\n' : ''}Instagram · semana de ${pool.dataCurta(seg)} a ${pool.dataCurta(fim)}\r\n\r\n`
      + carrosseis.map((it) => `${pool.dataLonga(it.dia)}${it.pos != null && plano.encaixesDoDia(it.dia)[it.pos] ? ` · ${plano.encaixesDoDia(it.dia)[it.pos].horario}` : ''} · ${it.projeto} · ${it.imagens.length} ${it.imagens.length === 1 ? 'imagem' : 'cards'} · ${it.dia}/${slug(it.projeto) || 'carrossel'}/`).join('\r\n');
  }
  zip.file('textos.txt', txt);
  baixar(await zip.generateAsync({ type: 'blob' }), `lote-${seg}.zip`);
  avisar('Lote da semana baixado (.zip, com textos.txt).');
}

// ---------------------------------------------------------------------------
// Eventos

function ligar() {
  let arrastando = null;
  raiz.addEventListener('click', async (e) => {
    if (e.target.closest('.info')) return;
    const t = e.target;
    const b = t.closest('button, a[data-ir-item]');
    // filtros
    if (b?.dataset.rede) { ui.rede = b.dataset.rede; desenhar(); return; }
    if (b?.dataset.poolStatus) { ui.status = b.dataset.poolStatus; desenhar(); return; }
    if (b?.dataset.poolOrigem) { ui.origem = b.dataset.poolOrigem; desenhar(); return; }
    if (b?.dataset.mes !== undefined && b?.dataset.mes !== '') {
      const d = Number(b.dataset.mes);
      if (d === 0) ui.mes = pool.hoje().slice(0, 7);
      else {
        const [a, m] = ui.mes.split('-').map(Number);
        const nd = new Date(a, m - 1 + d, 1);
        ui.mes = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
      }
      desenhar();
      return;
    }
    if (b?.dataset.ritmo) {
      ui.ritmo = Number(b.dataset.ritmo);
      try { localStorage.setItem('universo-cal-ritmo', ui.ritmo); } catch { /* */ }
      desenhar();
      return;
    }
    if (b?.dataset.distribuir !== undefined) { distribuir(b); return; }
    if (b?.dataset.lado) { ui.lado = b.dataset.lado; desenhar(); return; }
    if (b?.dataset.lote) { baixarLote(b.dataset.lote).catch((err) => { console.warn(err); avisar('Não foi possível baixar o lote.'); }); return; }
    if (b?.dataset.csv !== undefined) { baixarCsv(); return; }
    // detalhe
    const dlg = $('#poolDetalhe', raiz);
    const pdet = t.closest('[data-pdet-id]');
    if (pdet) {
      if (t.closest('a[href]')) { dlg.close(); return; }
      if (!b) return;
      const id = pdet.dataset.pdetId;
      if (b.dataset.pdetAcao === 'fechar') { dlg.close(); return; }
      if (b.dataset.pdetAcao === 'tirar') { moverPauta(id, '', null); dlg.close(); desenhar(); return; }
      if (b.dataset.pdetStatus) {
        const l = structuredClone(plano.listaPautas());
        l.find((x) => x.id === id).status = b.dataset.pdetStatus;
        salvarPautas(l);
        desenhar();
        abrirPauta(id);
      }
      return;
    }
    const det = t.closest('[data-det-id]');
    if (det) {
      const it = pool.item(det.dataset.detId);
      if (t.closest('a[href]') && !t.closest('[data-ir-item]')) { dlg.close(); return; } // abrir no editor
      if (!it || !b) return;
      if (b.dataset.irItem) { e.preventDefault(); abrirDetalhe(b.dataset.irItem); return; }
      if (b.dataset.detStatus) {
        it.status = b.dataset.detStatus;
        if (it.status === 'publicado') { if (!it.dia) it.dia = pool.hoje(); it.publicadoEm = it.dia; }
        else { it.publicadoEm = ''; if (it.status === 'pronto') { it.dia = ''; it.pos = null; } if (it.status === 'agendado' && !it.dia) it.dia = pool.hoje(); }
        await salvarItem(it);
        abrirDetalhe(it.id);
        return;
      }
      if (b.dataset.detOrigem) { it.origem = b.dataset.detOrigem; await salvarItem(it); abrirDetalhe(it.id); return; }
      if (b.dataset.copiar) {
        const v = it.pin?.[b.dataset.copiar] || '';
        navigator.clipboard?.writeText(v).then(() => avisar('Copiado.'), () => avisar('Não foi possível copiar.'));
        return;
      }
      if (b.dataset.detAcao === 'fechar') { dlg.close(); return; }
      if (b.dataset.detAcao === 'baixar') { baixarItem(it).catch(() => avisar('Não foi possível baixar.')); return; }
      if (b.dataset.detAcao === 'remover') {
        if (!b.dataset.confirmar) {
          b.dataset.confirmar = '1';
          b.textContent = 'Confirmar remoção?';
          setTimeout(() => { delete b.dataset.confirmar; b.textContent = 'Remover do pool'; }, 2500);
          return;
        }
        dlg.close();
        try { await pool.apagar(it.id); } catch { avisar('Não foi possível remover na nuvem.'); }
        desenhar();
        avisar('Removido do pool. O pin continua no editor.');
        return;
      }
      return;
    }
    if (t.closest('a[href]')) { if (dlg?.open) dlg.close(); return; }
    // abrir um item ou uma pauta
    if (arrastando) return;
    const pt = t.closest('[data-pauta]');
    if (pt) { abrirPauta(pt.dataset.pauta); return; }
    const it = t.closest('[data-item]');
    if (it) abrirDetalhe(it.dataset.item);
  });
  raiz.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches('[data-filtro-nucleo]')) { ui.nucleo = t.value; desenhar(); return; }
    if (t.matches('[data-dist-inicio]')) { ui.inicio = t.value; return; }
    if (t.matches('[data-pdet-dia]')) {
      const id = t.closest('[data-pdet-id]').dataset.pdetId;
      moverPauta(id, t.value, null);
      desenhar();
      abrirPauta(id);
      return;
    }
    if (t.matches('[data-det-dia]')) {
      const it = pool.item(t.closest('[data-det-id]').dataset.detId);
      if (!it) return;
      pool.definirDia(it, t.value);
      if (it.status === 'publicado') it.publicadoEm = it.dia;
      await salvarItem(it);
      abrirDetalhe(it.id);
    }
  });
  raiz.addEventListener('input', (e) => {
    if (e.target.matches('[data-pool-busca]')) {
      ui.busca = e.target.value;
      clearTimeout(ligar.t);
      ligar.t = setTimeout(() => { desenhar(); const c = $('[data-pool-busca]', raiz); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 250);
    }
  });
  raiz.addEventListener('close', () => { if (urlDetalhe) { URL.revokeObjectURL(urlDetalhe); urlDetalhe = null; } }, true);

  // arrastar do pool para os dias, de um dia para outro e de volta ao pool
  raiz.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[data-item][draggable], [data-pauta][draggable]');
    if (!el) return;
    arrastando = el.dataset.item ? `item:${el.dataset.item}` : `pauta:${el.dataset.pauta}`;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', arrastando);
    e.dataTransfer.effectAllowed = 'move';
    raiz.classList.add('arrastando-item');
  });
  // o elemento arrastado some quando o calendário se redesenha: o fim do arraste é ouvido no documento
  const fimArraste = () => {
    raiz.classList.remove('arrastando-item');
    raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
    setTimeout(() => { arrastando = null; }, 0);
  };
  document.addEventListener('dragend', fimArraste);
  raiz.addEventListener('dragover', (e) => {
    const alvo = e.target.closest?.('.enc, [data-dia], [data-soltar]');
    if (!alvo || !arrastando) return;
    e.preventDefault();
    raiz.querySelectorAll('.alvo').forEach((x) => x !== alvo && x.classList.remove('alvo'));
    alvo.classList.add('alvo');
  });
  raiz.addEventListener('drop', async (e) => {
    const alvo = e.target.closest?.('.enc, [data-dia], [data-soltar]');
    const dado = e.dataTransfer.getData('text/plain') || arrastando || '';
    if (!alvo || !dado) return;
    e.preventDefault();
    fimArraste();
    const [tipo, id] = dado.split(/:(.+)/);
    const dia = alvo.dataset.dia || '';
    const pos = alvo.classList.contains('enc') ? Number(alvo.dataset.pos) : null;
    if (tipo === 'pauta') { moverPauta(id, dia, pos); desenhar(); return; }
    const it = pool.item(id);
    if (!it) return;
    if (it.status === 'publicado' && !dia) { avisar('Publicado não volta ao pool. Mude a situação no detalhe, se precisar.'); return; }
    const noEncaixe = it.rede === 'instagram' && pos != null;
    if (noEncaixe) {
      // o carrossel que estava no encaixe volta para o pool
      const antes = plano.ocupantes(dia, pos).item;
      if (antes && antes.id !== it.id && antes.status !== 'publicado') { pool.definirDia(antes, ''); pool.gravar(antes).catch(() => {}); }
    }
    pool.definirDia(it, dia, noEncaixe ? pos : null);
    if (it.status === 'publicado') it.publicadoEm = dia;
    await salvarItem(it);
  });
}

async function distribuir(b) {
  const inicio = ui.inicio || pool.somarDias(pool.hoje(), 1);
  const prontos = pool.lista().filter((x) => x.status === 'pronto' && x.rede === 'pinterest' && (ui.nucleo === 'todos' || x.nucleo === ui.nucleo));
  const plano = pool.planejarDistribuicao(prontos, inicio, ui.ritmo);
  if (!plano.length) return;
  const ultimo = plano.map((p) => p.dia).sort().pop();
  if (!b.dataset.confirmar) {
    b.dataset.confirmar = '1';
    b.textContent = `Agendar ${plano.length} pins de ${pool.dataCurta(inicio)} a ${pool.dataCurta(ultimo)}?`;
    setTimeout(() => { if (b.isConnected) { delete b.dataset.confirmar; b.textContent = 'Distribuir'; } }, 4000);
    return;
  }
  for (const p of plano) pool.definirDia(p.item, p.dia);
  ui.mes = inicio.slice(0, 7);
  desenhar();
  const falhas = (await Promise.all(plano.map((p) => pool.gravar(p.item).then(() => 0, () => 1)))).reduce((a, x) => a + x, 0);
  avisar(falhas ? `${falhas} itens não foram salvos na nuvem.` : `${plano.length} pins agendados de ${pool.dataCurta(inicio)} a ${pool.dataCurta(ultimo)}.`);
}
