// Estratégia (#/estrategia): o plano de publicação que orienta o Calendário.
// Subpáginas: Grade (fase da escalada, semanas A/B, encaixes de cada dia) · Pautas (banco de ângulos por obra) ·
// Ciclo (as próximas semanas com os prazos de produção, a reserva e a escalada).

import * as plano from './plano.js';
import * as pool from './pool.js';
import * as nuvem from './nuvem.js';
import * as local from './store.js';
import { NUCLEOS, ORDEM_NUCLEOS } from './nucleos.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const info = (txt) => ` <span class="info" tabindex="0" data-info="${esc(txt)}">i</span>`;
const SUBS = [['', 'Grade'], ['pautas', 'Pautas'], ['ciclo', 'Ciclo']];
const STATUS_PAUTA = Object.fromEntries(plano.STATUS_PAUTA);
const DIA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const ui = { sub: '', fase: null, ab: 'A', fonte: 'todos', status: 'todos', busca: '', nova: { fonte: 'projeto', formato: 'post' } };
let raiz = null, ligado = false, avisar = () => {}, resumos = [];

export async function renderEstrategia(el, sub, opc = {}) {
  raiz = el;
  ui.sub = sub || '';
  avisar = opc.aviso || avisar;
  if (!ligado) { ligar(); ligado = true; }
  await pool.abrirLocal();
  if (!resumos.length) resumos = await local.listarPubs();
  desenhar();
  const [a, b] = await Promise.all([plano.carregarEstrategia(), plano.carregarPautas(), pool.carregar().catch(() => false)]);
  nuvem.listar().then((l) => { resumos = l; }).catch(() => {});
  if ((a || b || true) && document.body.classList.contains('vista-estrategia')) desenhar();
}

function desenhar() {
  const conteudo = raiz;
  const fase = plano.faseAtual();
  const ciclo = plano.semanaDoCiclo(pool.hoje());
  if (ui.fase == null) ui.fase = fase;
  const pag = ui.sub === 'pautas' ? paginaPautas() : ui.sub === 'ciclo' ? paginaCiclo() : paginaGrade();
  const foco = document.activeElement?.dataset?.foco;
  const rolagem = raiz.scrollTop;
  conteudo.innerHTML = `
    <section class="met-cab">
      <div>
        <h1>Estratégia${info('O plano de publicação (odisse-estrategia-instagram.pdf): a grade semanal da fase da escalada, o banco de pautas e o ciclo de produção. O Calendário mostra a grade como encaixes em cada dia.')}</h1>
        <p>Fase <b>${fase}</b> de 5 · <b>${plano.postsPorSemana(fase)}</b> posts por semana · ciclo na semana <b>${ciclo.n}</b> de 4 (semana ${ciclo.ab})</p>
      </div>
      <div class="met-acoes"><a class="bt-padroes" href="#/calendario">Ir para o Calendário</a></div>
    </section>
    <nav class="met-nav" aria-label="Seções da estratégia">${SUBS.map(([k, r]) => `<a href="#/estrategia${k ? '/' + k : ''}" class="${k === ui.sub ? 'ativo' : ''}">${r}</a>`).join('')}</nav>
    <div class="est-pagina">${pag}</div>`;
  raiz.scrollTop = rolagem;
  if (foco) $(`[data-foco="${foco}"]`, raiz)?.focus();
}

// ---- Grade -------------------------------------------------------------------

const corNucleo = (id) => NUCLEOS[id]?.painel || '#ccc';
const temAB = (fase) => !!(plano.estrategia().grade?.[fase] || plano.GRADE_PADRAO[fase]).B;

function semanaVista() {
  const g = plano.estrategia().grade?.[ui.fase] || plano.GRADE_PADRAO[ui.fase];
  return ui.ab === 'B' && g.B ? g.B : g.A;
}

function conflitosModelo(dias) {
  const seq = dias.flatMap((d, i) => d.map((e, pos) => ({ i, pos, nucleo: e.nucleo })));
  const out = new Set();
  for (let k = 1; k < seq.length; k++) {
    const a = seq[k - 1], b = seq[k];
    if (a.nucleo === b.nucleo || [a.nucleo, b.nucleo].sort().join() === 'estudio,objetos') out.add(`${b.i}:${b.pos}`);
  }
  return out;
}

function paginaGrade() {
  const e = plano.estrategia();
  const atual = plano.faseAtual();
  const dias = semanaVista();
  const conf = conflitosModelo(dias);
  const posts = dias.flat().filter((x) => x.formato === 'post').length;
  const reels = dias.flat().filter((x) => x.formato === 'reel').length;
  const ab = temAB(ui.fase);
  const reelOpts = (sel, nucleo) => Object.entries(plano.REELS).map(([k, [n, nome]]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k} · ${nome}${n !== nucleo ? ` (${NUCLEOS[n].nome})` : ''}</option>`).join('');
  return `<section class="est-ctrl">
      <div class="opcao"><span>Fase atual da escalada${info('Cada fase só começa com a anterior estável: uma semana de reserva pronta e 4 semanas cumpridas sem falhas (veja Ciclo). A troca vale a partir da segunda-feira desta semana.')}</span>
        <div class="seg">${plano.FASES.map((f) => `<button data-fase-atual="${f}" class="${f === atual ? 'ativo' : ''}">Fase ${f}</button>`).join('')}</div></div>
      <label class="campo"><span>Início do ciclo${info('Segunda-feira da semana 1 de um ciclo de 4 semanas. As semanas 1 e 3 são A; 2 e 4, B.')}</span><input type="date" data-ciclo-inicio value="${e.cicloInicio || ''}"></label>
    </section>
    <section class="est-grade-cab">
      <div class="seg">${plano.FASES.map((f) => `<button data-ver-fase="${f}" class="${f === ui.fase ? 'ativo' : ''}">Fase ${f}${f === atual ? ' ·' : ''}</button>`).join('')}</div>
      ${ab ? `<div class="seg">${['A', 'B'].map((x) => `<button data-ver-ab="${x}" class="${ui.ab === x ? 'ativo' : ''}">Semana ${x}</button>`).join('')}</div>` : '<small>Igual nas semanas A e B</small>'}
      <span class="est-soma"><b>${posts + reels}</b> por semana · ${posts} posts · ${reels} reels${conf.size ? ` · <b class="alerta">${conf.size} ${conf.size === 1 ? 'conflito' : 'conflitos'}</b>` : ''}</span>
      <button class="bt-link" data-restaurar>Restaurar a grade do documento</button>
    </section>
    <div class="est-grade">${dias.map((lista, i) => {
      const hs = plano.horarios(lista.length);
      return `<div class="est-dia"><h3>${plano.DIAS[i]}</h3>
        ${lista.map((x, pos) => `<div class="est-enc${conf.has(`${i}:${pos}`) ? ' conflito' : ''}" data-dow="${i}" data-pos="${pos}" style="--cor:${corNucleo(x.nucleo)}"
            title="${conf.has(`${i}:${pos}`) ? 'Núcleo repetido em publicações seguidas, ou Estúdio ao lado de Objetos' : ''}">
          <div class="est-enc-cab"><small>${pos + 1}ª · ${hs[pos]}</small>
            <span><button data-mover="-1" ${pos === 0 ? 'disabled' : ''} title="Antes">↑</button><button data-mover="1" ${pos === lista.length - 1 ? 'disabled' : ''} title="Depois">↓</button><button data-tirar title="Remover">×</button></span></div>
          <select data-campo="nucleo" aria-label="Núcleo">${ORDEM_NUCLEOS.map((n) => `<option value="${n}" ${n === x.nucleo ? 'selected' : ''}>${NUCLEOS[n].nome}</option>`).join('')}</select>
          <div class="seg seg-mini">${[['post', 'Post'], ['reel', 'Reel']].map(([v, r]) => `<button data-formato="${v}" class="${x.formato === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>
          ${x.formato === 'reel'
            ? `<select data-campo="rotulo" aria-label="Modelo do reel">${reelOpts(x.rotulo, x.nucleo)}</select>`
            : `<input data-campo="rotulo" value="${esc(x.rotulo || '')}" placeholder="${esc(plano.POST_DE[x.nucleo])}" aria-label="Formato do post">`}
        </div>`).join('')}
        <button class="pasta-mais" data-mais="${i}">+ Publicação</button></div>`;
    }).join('')}</div>
    <p class="est-nota">Horário pela posição no dia: a primeira (ou única) às 11h–13h; a do meio, quando há três, às 15h–17h; a última às 20h–22h. Nenhum núcleo se repete em publicações seguidas e Estúdio nunca encosta em Objetos.</p>`;
}

/** Altera a semana vista da grade (fases 1–4: uma só; fase 5: A ou B) e grava. */
function mudarGrade(fn) {
  const e = structuredClone(plano.estrategia());
  e.grade = e.grade || structuredClone(plano.GRADE_PADRAO);
  const g = e.grade[ui.fase] || structuredClone(plano.GRADE_PADRAO[ui.fase]);
  e.grade[ui.fase] = g;
  const sem = ui.ab === 'B' && g.B ? g.B : g.A;
  fn(sem);
  salvarEst(e);
}
function salvarEst(e) {
  plano.gravarEstrategia(e).catch(() => avisar('Guardado neste computador; não foi possível salvar na nuvem.'));
  desenhar();
}

// ---- Pautas -------------------------------------------------------------------

function paginaPautas() {
  const busca = ui.busca.trim().toLowerCase();
  const todas = plano.listaPautas();
  const lista = todas.filter((p) => (ui.fonte === 'todos' || p.fonte === ui.fonte) && (ui.status === 'todos' || p.status === ui.status)
    && (!busca || `${p.obra} ${p.angulo} ${p.notas}`.toLowerCase().includes(busca)));
  const f = plano.FONTE_POR_ID[ui.nova.fonte];
  const obras = [...new Set([...todas.map((p) => p.obra), ...resumos.map((r) => r.titulo)].filter(Boolean))].sort();
  const reels = (nucleo, sel = '') => Object.entries(plano.REELS).filter(([, [n]]) => n === nucleo).map(([k, [, nome]]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k} · ${nome}</option>`).join('');
  const grupos = new Map();
  for (const p of lista) {
    const k = `${p.fonte}|${p.obra || ''}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const chips = (k, valores) => `<div class="chips">${[['todos', 'Todas'], ...valores].map(([v, r]) => `<button data-filtro-${k}="${v}" class="${ui[k] === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;
  const quando = (p) => {
    if (!p.dia) return '<small class="sem-dia">sem dia</small>';
    const enc = p.pos != null ? plano.encaixesDoDia(p.dia)[p.pos] : null;
    return `<small>${pool.dataLonga(p.dia)}${enc ? ` · ${enc.horario}` : ''}</small>`;
  };
  return `<section class="pauta-nova">
      <h2>Nova pauta${info('Cada obra rende várias publicações, cada uma por um ângulo próprio, distribuídas ao longo de semanas. A pauta é o ângulo ainda não publicado; no Calendário ela vai para um encaixe da grade.')}</h2>
      <div class="pauta-form">
        <select data-nova="fonte" aria-label="Fonte">${plano.FONTES.map(([id, nome]) => `<option value="${id}" ${id === ui.nova.fonte ? 'selected' : ''}>${nome}</option>`).join('')}</select>
        <input data-nova="obra" list="obrasLista" placeholder="Obra: projeto, peça, ensaio ou assunto" value="${esc(ui.nova.obra || '')}" data-foco="nova-obra">
        <datalist id="obrasLista">${obras.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
        <input data-nova="angulo" placeholder="Ângulo" value="${esc(ui.nova.angulo || '')}" data-foco="nova-angulo">
        <div class="seg">${plano.FORMATOS_PAUTA.map(([v, r]) => `<button data-nova-formato="${v}" class="${ui.nova.formato === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>
        ${ui.nova.formato === 'reel' ? `<select data-nova="modelo" aria-label="Modelo do reel">${reels(f[2], ui.nova.modelo)}</select>` : ''}
        <button class="mini-bt forte" data-adicionar>Adicionar</button>
      </div>
      <div class="pauta-sug">${f[3].map((a) => `<button data-sugestao="${esc(a)}">${esc(a)}</button>`).join('')}</div>
    </section>
    <section class="pool-filtros">
      ${chips('fonte', plano.FONTES.map(([id, nome]) => [id, nome]))}
      ${chips('status', plano.STATUS_PAUTA)}
      <input type="search" data-busca-pauta value="${esc(ui.busca)}" placeholder="Buscar obra ou ângulo" data-foco="busca">
    </section>
    ${[...grupos.entries()].map(([k, ps]) => {
      const [fonte, obra] = k.split('|');
      const fo = plano.FONTE_POR_ID[fonte];
      return `<section class="proj pauta-grupo">
        <div class="proj-cab"><div><i class="proj-cor" style="background:${corNucleo(fo[2])}"></i><b>${esc(obra || 'Sem obra')}</b><small>${fo[1]}</small></div>
          <small>${ps.filter((p) => p.status === 'publicada').length} de ${ps.length} publicadas</small></div>
        <div class="pauta-lista">${ps.map((p) => `<div class="pauta-item st-${p.status}" data-pauta="${esc(p.id)}">
          <input data-pauta-campo="angulo" value="${esc(p.angulo)}" placeholder="Ângulo" aria-label="Ângulo">
          <span class="pauta-fmt">${p.formato === 'reel' ? `Reel${p.modelo ? ' ' + esc(p.modelo) : ''}` : p.formato === 'pin' ? 'Pin' : 'Post'}</span>
          <select data-pauta-campo="status" aria-label="Situação">${plano.STATUS_PAUTA.map(([v, r]) => `<option value="${v}" ${v === p.status ? 'selected' : ''}>${r}</option>`).join('')}</select>
          ${quando(p)}
          <input data-pauta-campo="notas" value="${esc(p.notas || '')}" placeholder="Notas" aria-label="Notas">
          <button class="mini-bt perigo" data-remover-pauta title="Remover a pauta">×</button>
        </div>`).join('')}</div>
      </section>`;
    }).join('') || `<p class="met-vazio">${todas.length ? 'Nenhuma pauta com esses filtros.' : 'O banco de pautas está vazio. Comece pelas obras do próximo ciclo.'}</p>`}`;
}

function mudarPautas(fn, redesenhar = true) {
  const l = structuredClone(plano.listaPautas());
  fn(l);
  plano.gravarPautas(l).then((ok) => { if (!ok) avisar('Pautas guardadas neste computador; não foi possível salvar na nuvem.'); });
  if (redesenhar) desenhar();
}

// ---- Ciclo -------------------------------------------------------------------

function paginaCiclo() {
  const esc_ = plano.escalada();
  const hoje = pool.hoje();
  const seg0 = pool.segundaDe(hoje);
  const prazos = plano.prazosDaSemana(seg0);
  const linhas = [];
  for (let k = 0; k < 8; k++) {
    const seg = pool.somarDias(seg0, k * 7);
    const c = plano.semanaDoCiclo(seg);
    let enc = 0, posts = 0, pautadas = 0, prontas = 0, publicadas = 0;
    for (let i = 0; i < 7; i++) {
      const dia = pool.somarDias(seg, i);
      for (const e of plano.encaixesDoDia(dia)) {
        enc++;
        if (e.formato === 'post') posts++;
        const o = plano.ocupantes(dia, e.pos);
        if (o.item?.status === 'publicado' || o.pauta?.status === 'publicada') publicadas++;
        else if (o.item || o.pauta?.status === 'pronta') prontas++;
        else if (o.pauta) pautadas++;
      }
    }
    linhas.push({ seg, c, fase: plano.faseEm(seg), enc, posts, pautadas, prontas, publicadas, lacunas: enc - pautadas - prontas - publicadas });
  }
  const passo = (ok, txt) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${txt}</li>`;
  return `<section class="est-ciclo-topo">
      <div class="est-cartao">
        <h2>Esta semana${info('Prazos desta semana de trabalho, pelas antecedências do calendário de produção (seção 07).')}</h2>
        <ul class="est-prazos">${prazos.map((p) => `<li><b>${p.rot}</b>${p.k === 'agendar' ? ` · até sexta, ${pool.dataCurta(p.dia)} — semana de ${pool.dataCurta(p.alvo)}`
          : p.k === 'captacao' ? ` · semanas de ${pool.dataCurta(p.alvo)} e ${pool.dataCurta(p.ate)}`
          : p.k === 'pautas' ? ` · ciclo que começa em ${pool.dataCurta(p.alvo)}`
          : p.alvo ? ` · semana de ${pool.dataCurta(p.alvo)}` : ' · antes de fechar as pautas do próximo ciclo'}</li>`).join('')}</ul>
      </div>
      <div class="est-cartao">
        <h2>Escalada${info('A próxima fase só começa com uma semana de reserva pronta (posts no pool, sem dia) e 4 semanas seguidas cumpridas sem falhas: todo encaixe de post com publicação publicada e todo encaixe de reel com pauta publicada.')}</h2>
        <p>Fase <b>${esc_.fase}</b> de 5</p>
        <ul class="est-passos">
          ${passo(esc_.prontos >= esc_.precisa, `Reserva: ${esc_.prontos} de ${esc_.precisa} posts prontos fora da agenda`)}
          ${passo(esc_.cumpridas >= 4, `Semanas cumpridas: ${esc_.cumpridas} de 4`)}
        </ul>
        ${esc_.fase < 5 ? (esc_.pode ? `<button class="mini-bt forte" data-fase-atual="${esc_.fase + 1}">Avançar para a fase ${esc_.fase + 1}</button>` : '<small>Ainda não dá para avançar.</small>') : '<small>Fase final: 15 publicações por semana.</small>'}
      </div>
    </section>
    <section>
      <div class="sec-cab"><h2>Próximas semanas</h2></div>
      <div class="met-tabela"><table class="plat">
        <thead><tr><th>Semana</th><th>Ciclo</th><th>Fase</th><th class="num">Encaixes</th><th class="num">Lacunas</th><th class="num">Pautadas</th><th class="num">Prontas</th><th class="num">Publicadas</th><th>Prazos que vencem nela</th></tr></thead>
        <tbody>${linhas.map((l) => `<tr class="${l.seg === seg0 ? 'atual' : ''}">
          <td><a href="#/calendario">${pool.dataCurta(l.seg)} a ${pool.dataCurta(pool.somarDias(l.seg, 6))}</a></td>
          <td>${l.c.n}/4 · ${l.c.ab}</td><td>${l.fase}</td>
          <td class="num">${l.enc}</td><td class="num">${l.lacunas ? `<b class="alerta">${l.lacunas}</b>` : '0'}</td><td class="num">${l.pautadas || ''}</td><td class="num">${l.prontas || ''}</td><td class="num">${l.publicadas || ''}</td>
          <td class="pastas-c">${[
            l.c.n === 1 ? `pautas do ciclo até ${pool.dataCurta(pool.somarDias(l.seg, -21))}` : '',
            `textos até ${pool.dataCurta(pool.somarDias(l.seg, -14))}`,
            `design até ${pool.dataCurta(pool.somarDias(l.seg, -7))}`,
            `agendar até ${pool.dataCurta(pool.somarDias(l.seg, -3))}`,
          ].filter(Boolean).join(' · ')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="est-nota">Lacuna: encaixe da grade sem pauta nem publicação. Pautada: com pauta ainda não pronta. Pronta: com carrossel no pool ou pauta pronta.</p>
    </section>`;
}

// ---------------------------------------------------------------------------

function ligar() {
  raiz.addEventListener('click', (e) => {
    if (e.target.closest('.info')) return;
    const b = e.target.closest('button');
    if (!b) return;
    // grade
    if (b.dataset.faseAtual) {
      const f = Number(b.dataset.faseAtual);
      const est = structuredClone(plano.estrategia());
      const desde = pool.segundaDe(pool.hoje());
      est.fases = (est.fases || []).filter((x) => x.desde !== desde);
      est.fases.push({ fase: f, desde });
      ui.fase = f;
      salvarEst(est);
      avisar(`Fase ${f} a partir de ${pool.dataCurta(desde)}.`);
      return;
    }
    if (b.dataset.verFase) { ui.fase = Number(b.dataset.verFase); ui.ab = 'A'; desenhar(); return; }
    if (b.dataset.verAb) { ui.ab = b.dataset.verAb; desenhar(); return; }
    if (b.dataset.restaurar !== undefined) {
      if (!b.dataset.confirmar) {
        b.dataset.confirmar = '1';
        b.textContent = `Restaurar a fase ${ui.fase}?`;
        setTimeout(() => { if (b.isConnected) { delete b.dataset.confirmar; b.textContent = 'Restaurar a grade do documento'; } }, 3000);
        return;
      }
      const est = structuredClone(plano.estrategia());
      est.grade = est.grade || structuredClone(plano.GRADE_PADRAO);
      est.grade[ui.fase] = structuredClone(plano.GRADE_PADRAO[ui.fase]);
      salvarEst(est);
      return;
    }
    const enc = b.closest('.est-enc');
    if (b.dataset.mais) {
      const i = Number(b.dataset.mais);
      mudarGrade((sem) => { sem[i].push({ nucleo: 'arquitetos', formato: 'post', rotulo: plano.POST_DE.arquitetos }); });
      return;
    }
    if (enc) {
      const i = Number(enc.dataset.dow), pos = Number(enc.dataset.pos);
      if (b.dataset.tirar !== undefined) mudarGrade((sem) => { sem[i].splice(pos, 1); });
      else if (b.dataset.mover) mudarGrade((sem) => { const j = pos + Number(b.dataset.mover); [sem[i][pos], sem[i][j]] = [sem[i][j], sem[i][pos]]; });
      else if (b.dataset.formato) {
        mudarGrade((sem) => {
          const x = sem[i][pos];
          x.formato = b.dataset.formato;
          x.rotulo = x.formato === 'reel' ? (Object.entries(plano.REELS).find(([, [n]]) => n === x.nucleo)?.[0] || 'E1') : plano.POST_DE[x.nucleo];
        });
      }
      return;
    }
    // pautas
    if (b.dataset.novaFormato) { ui.nova.formato = b.dataset.novaFormato; desenhar(); return; }
    if (b.dataset.sugestao) { ui.nova.angulo = b.dataset.sugestao; desenhar(); $('[data-nova="angulo"]', raiz)?.focus(); return; }
    if (b.dataset.adicionar !== undefined) { adicionarPauta(); return; }
    if (b.dataset.filtroFonte) { ui.fonte = b.dataset.filtroFonte; desenhar(); return; }
    if (b.dataset.filtroStatus) { ui.status = b.dataset.filtroStatus; desenhar(); return; }
    if (b.dataset.removerPauta !== undefined) {
      if (!b.dataset.confirmar) {
        b.dataset.confirmar = '1';
        b.textContent = 'Remover?';
        setTimeout(() => { if (b.isConnected) { delete b.dataset.confirmar; b.textContent = '×'; } }, 2500);
        return;
      }
      const id = b.closest('[data-pauta]').dataset.pauta;
      mudarPautas((l) => { const k = l.findIndex((p) => p.id === id); if (k >= 0) l.splice(k, 1); });
    }
  });
  raiz.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-ciclo-inicio]') && t.value) {
      const est = structuredClone(plano.estrategia());
      est.cicloInicio = pool.segundaDe(t.value);
      salvarEst(est);
      return;
    }
    const enc = t.closest('.est-enc');
    if (enc && t.dataset.campo) {
      const i = Number(enc.dataset.dow), pos = Number(enc.dataset.pos);
      mudarGrade((sem) => {
        const x = sem[i][pos];
        if (t.dataset.campo === 'nucleo' && x.formato === 'post' && (!x.rotulo || x.rotulo === plano.POST_DE[x.nucleo])) x.rotulo = plano.POST_DE[t.value];
        x[t.dataset.campo] = t.value;
      });
      return;
    }
    if (t.dataset.nova === 'fonte') { ui.nova.fonte = t.value; ui.nova.modelo = ''; desenhar(); return; }
    if (t.dataset.nova === 'modelo') { ui.nova.modelo = t.value; return; }
    if (t.dataset.pautaCampo === 'status') {
      const id = t.closest('[data-pauta]').dataset.pauta;
      mudarPautas((l) => { const p = l.find((x) => x.id === id); if (p) p.status = t.value; });
    }
  });
  raiz.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.nova === 'obra' || t.dataset.nova === 'angulo') { ui.nova[t.dataset.nova] = t.value; return; }
    if (t.matches('[data-busca-pauta]')) {
      ui.busca = t.value;
      clearTimeout(ligar.t);
      ligar.t = setTimeout(() => { desenhar(); const c = $('[data-busca-pauta]', raiz); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 250);
      return;
    }
    if (t.dataset.pautaCampo === 'angulo' || t.dataset.pautaCampo === 'notas') {
      const id = t.closest('[data-pauta]').dataset.pauta;
      mudarPautas((l) => { const p = l.find((x) => x.id === id); if (p) p[t.dataset.pautaCampo] = t.value; }, false);
      return;
    }
    if (t.closest('.est-enc') && t.dataset.campo === 'rotulo' && t.tagName === 'INPUT') {
      const enc = t.closest('.est-enc');
      const i = Number(enc.dataset.dow), pos = Number(enc.dataset.pos);
      const est = structuredClone(plano.estrategia());
      est.grade = est.grade || structuredClone(plano.GRADE_PADRAO);
      const g = est.grade[ui.fase];
      (ui.ab === 'B' && g.B ? g.B : g.A)[i][pos].rotulo = t.value;
      clearTimeout(ligar.tg);
      ligar.tg = setTimeout(() => plano.gravarEstrategia(est).catch(() => {}), 500);
    }
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset?.nova) { e.preventDefault(); adicionarPauta(); }
  });
}

function adicionarPauta() {
  const f = plano.FONTE_POR_ID[ui.nova.fonte];
  const angulo = (ui.nova.angulo || '').trim();
  if (!angulo) { avisar('Escreva o ângulo da pauta.'); $('[data-nova="angulo"]', raiz)?.focus(); return; }
  const modelo = ui.nova.formato === 'reel' ? (ui.nova.modelo || Object.entries(plano.REELS).find(([, [n]]) => n === f[2])?.[0] || '') : '';
  const p = plano.novaPauta({ fonte: f[0], nucleo: f[2], obra: (ui.nova.obra || '').trim(), angulo, formato: ui.nova.formato, modelo });
  ui.nova.angulo = '';
  mudarPautas((l) => { l.push(p); });
  $('[data-nova="angulo"]', raiz)?.focus();
}
