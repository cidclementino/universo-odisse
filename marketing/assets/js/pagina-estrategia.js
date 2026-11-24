// Estratégia (#/estrategia): o plano de publicação que orienta o Calendário. Abas: Grade · Plataformas · Pautas · Ciclo.
//
// Grade: uma grade semanal só, com os encaixes de todas as plataformas. "Em vigor" mostra cada plataforma na fase
// atual dela (só leitura); escolhida uma plataforma, edita as fases dela (semanas A/B, encaixes, cotas).
// Plataformas: plataforma › formato › tipo, criados e nomeados à vontade; modo (encaixes com horário ou cota por
// dia), horários, regras e os termos da escalada de cada uma. Nada se apaga: arquiva.
// Pautas: banco de ângulos por obra. Ciclo: prazos da semana, escalada de cada plataforma e as próximas semanas.

import * as plano from './plano.js';
import * as pool from './pool.js';
import * as nuvem from './nuvem.js';
import * as local from './store.js';
import * as pinterest from './pinterest.js';
import { NUCLEOS, ORDEM_NUCLEOS } from './nucleos.js';
import { cabecalho, abas, segmentado, bandeja, lista, secao, quando, acao, etiqueta, gaveta, toque, icone, esc } from '/base/v2/componentes.js';

const $ = (s, r = document) => r.querySelector(s);
const SIG = { estudio: 'ES', arquitetos: 'AR', objetos: 'OB', elaia: 'EL' };
const STATUS_PAUTA = Object.fromEntries(plano.STATUS_PAUTA);
const DSEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MODOS = [{ id: 'encaixes', rotulo: 'Encaixes com horário' }, { id: 'cota', rotulo: 'Cota por dia' }];
const iconePlat = (pid, tam = 12) => icone(['instagram', 'pinterest', 'tiktok'].includes(pid) ? pid : 'plataforma', tam, 1.8);
const nomeNuc = (n) => NUCLEOS[n]?.nome || '';

const ui = { sub: '', plat: 'vigor', fase: {}, ab: 'A', fonte: 'todos', status: 'todos', busca: '', nova: { fonte: 'projeto', plataforma: 'instagram', formato: 'post', tipo: '' }, verArquivadas: false };
let raiz = null, ligado = false, avisar = () => {}, resumos = [], chaveGaveta = '';

export async function renderEstrategia(el, sub, opc = {}) {
  raiz = el;
  ui.sub = ['plataformas', 'pautas', 'ciclo'].includes(sub) ? sub : '';
  avisar = opc.aviso || avisar;
  if (!ligado) { ligar(); ligado = true; }
  await pool.abrirLocal();
  if (!resumos.length) resumos = await local.listarPubs();
  desenhar();
  await Promise.all([plano.carregarEstrategia(), plano.carregarPautas(), pool.carregar().catch(() => false), pinterest.carregarPastas()]);
  nuvem.listar().then((l) => { resumos = l; }).catch(() => {});
  if (document.body.classList.contains('vista-estrategia')) desenhar();
}

function desenhar() {
  if (!raiz) return;
  const rolagem = raiz.scrollTop;
  const foco = document.activeElement?.dataset?.foco;
  const pag = ui.sub === 'plataformas' ? paginaPlataformas() : ui.sub === 'pautas' ? paginaPautas() : ui.sub === 'ciclo' ? paginaCiclo() : paginaGrade();
  raiz.innerHTML = `<div class="mk-pagina">${abas('Estratégia', [['', 'Grade'], ['plataformas', 'Plataformas'], ['pautas', 'Pautas'], ['ciclo', 'Ciclo']]
    .map(([k, r]) => ({ href: `#/estrategia${k ? '/' + k : ''}`, rotulo: r, ativa: ui.sub === k })))}${pag}</div>`;
  raiz.scrollTop = rolagem;
  if (foco) $(`[data-foco="${foco}"]`, raiz)?.focus();
  if (chaveGaveta && document.querySelector('.ui-gaveta')) abrir(chaveGaveta);
}

/** Muda a estratégia (cópia), grava e redesenha. */
function mudarEst(fn, { redesenhar = true } = {}) {
  const e = structuredClone(plano.estrategia());
  fn(e);
  plano.gravarEstrategia(e).catch(() => avisar('Guardado neste computador; não foi possível salvar na nuvem.'));
  if (redesenhar) desenhar();
}
const pEm = (e, pid) => e.plataformas.find((p) => p.id === pid);

// ---------------------------------------------------------------------------
// Grade

const faseVista = (pid) => ui.fase[pid] || plano.faseAtualDe(pid);
function semanaDe(e, pid, fase, ab) {
  e.grades[pid] ||= {};
  e.grades[pid][fase] ||= structuredClone(plano.gradeDe(pid, fase));
  const g = e.grades[pid][fase];
  return ab === 'B' && g.B ? g.B : g.A;
}
function mudarGrade(pid, fn) {
  mudarEst((e) => fn(semanaDe(e, pid, faseVista(pid), ui.ab), e));
}

function paginaGrade() {
  const plats = plano.plataformas();
  if (ui.plat !== 'vigor' && !plano.plataforma(ui.plat)) ui.plat = 'vigor';
  const pid = ui.plat === 'vigor' ? null : ui.plat;
  const p = pid ? plano.plataforma(pid) : null;
  const ciclo = plano.semanaDoCiclo(pool.hoje());
  // colunas: dia → [{ pid, e, editavel }]
  const dias = Array.from({ length: 7 }, () => []);
  const somas = [];
  for (const pl of pid ? [p] : plats) {
    const fase = pid ? faseVista(pl.id) : plano.faseAtualDe(pl.id);
    const g = plano.gradeDe(pl.id, fase);
    const ab = pid ? (g.B ? ui.ab : 'A') : ciclo.ab;
    const sem = ab === 'B' && g.B ? g.B : g.A;
    sem.forEach((lista_, dow) => lista_.forEach((e, pos) => dias[dow].push({ pid: pl.id, e, pos, dow, n: lista_.length })));
    somas.push(`<b>${plano.porSemana(pl.id, fase)}</b> ${esc(pl.nome)}`);
  }
  let controles = segmentado([{ id: 'vigor', rotulo: 'Em vigor' }, ...plats.map((x) => ({ id: x.id, rotulo: x.nome }))], ui.plat, 'g-plat', 'Plataforma vista');
  if (p) {
    const atual = plano.faseAtualDe(pid), fv = faseVista(pid);
    const g = plano.gradeDe(pid, fv);
    const nf = Number(p.escalada?.fases) || 1;
    if (nf > 1) controles += segmentado(Array.from({ length: nf }, (_, i) => ({ id: String(i + 1), rotulo: `Fase ${i + 1}${i + 1 === atual ? ' · atual' : ''}` })), String(fv), 'g-fase', 'Fase vista');
    controles += g.B ? segmentado([{ id: 'A', rotulo: 'Semana A' }, { id: 'B', rotulo: 'Semana B' }], ui.ab, 'g-ab', 'Semana do ciclo') : '<span class="mk-mudo">Igual nas semanas A e B</span>';
    controles += `<button type="button" class="mk-link" data-g-ab-alternar>${g.B ? 'Igualar a semana B à A' : 'Semanas A e B diferentes'}</button>`;
    if (fv !== atual) controles += acao(`Usar a fase ${fv} a partir de ${pool.dataCurta(pool.segundaDe(pool.hoje()))}`, { dados: { 'g-usar-fase': fv } });
  }
  const conf = new Map();
  if (p?.modo === 'encaixes' && (p.regras?.nucleoSeguido || p.regras?.estudioObjetos)) {
    const seq = dias.flatMap((d) => d.filter((x) => x.pid === pid).map((x) => x));
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1].e.nucleo, b = seq[i].e.nucleo;
      if (p.regras.nucleoSeguido && a && a === b) conf.set(seq[i], 'Mesmo núcleo em publicações seguidas');
      else if (p.regras.estudioObjetos && [a, b].sort().join() === 'estudio,objetos') conf.set(seq[i], 'Estúdio encostado em Objetos');
    }
  }
  const editavel = !!p;
  const cartao = (x) => {
    const pl = plano.plataforma(x.pid);
    if (pl?.modo === 'cota') {
      return `<div class="mk-genc is-cota"><div class="mk-genc__topo">${iconePlat(x.pid)}<span>${esc(pl.nome)}</span><em>cota</em></div>
        <div class="mk-genc__cota"><b>${esc(plano.formato(x.pid, x.e.formato)?.nome || 'Cota')} × ${Number(x.e.cota) || 0}</b>
        ${editavel ? `<span><button type="button" class="mk-ico" data-g-cota="${x.dow}" data-d="-1" aria-label="Menos">−</button><button type="button" class="mk-ico" data-g-cota="${x.dow}" data-d="1" aria-label="Mais">+</button></span>` : ''}</div>
        <small>${esc([pl.regras?.umProjetoPorDia && 'um projeto por dia', pl.regras?.pastasAlternadas && 'pastas alternadas'].filter(Boolean).join(' · '))}</small></div>`;
    }
    const f = plano.formato(x.pid, x.e.formato), t = plano.tipo(x.pid, x.e.formato, x.e.tipo);
    const nIg = dias[x.dow].filter((y) => y.pid === x.pid).length;
    const h = plano.horariosDe(pl?.horarios, nIg)[dias[x.dow].filter((y) => y.pid === x.pid).indexOf(x)] || '';
    const c = conf.get(x);
    return `<div class="mk-genc${c ? ' is-conflito' : ''}"${editavel ? ` draggable="true" data-g-enc="${x.dow}|${x.pos}" data-abre="e:${x.dow}|${x.pos}" tabindex="0"` : ''} title="${esc(c || '')}">
      <div class="mk-genc__topo">${editavel ? `<span class="mk-alca">${icone('alca', 12, 2)}</span>` : iconePlat(x.pid)}<span>${esc(editavel ? h : pl?.nome || '')}</span><em>${esc(editavel ? '' : h)}</em></div>
      <b>${esc(f?.nome || x.e.formato)}${t?.codigo ? ` ${esc(t.codigo)}` : ''}</b><small>${esc(t?.nome || 'sem tipo')}</small><small class="mk-genc__nuc">${esc(nomeNuc(x.e.nucleo) || 'qualquer núcleo')}${c ? ' · ' + esc(c.toLowerCase()) : ''}</small></div>`;
  };
  const colunas = dias.map((l, dow) => `<div class="mk-gdia"${editavel ? ` data-g-dia="${dow}"` : ''}><h3>${plano.DIAS[dow]}</h3>${l.map(cartao).join('')}
    ${editavel && p.modo === 'encaixes' ? `<button type="button" class="mk-mais" data-g-mais="${dow}">${icone('mais', 13, 2)} Encaixe</button>` : ''}</div>`).join('');
  return `${cabecalho('Grade semanal', esc(`${plano.fasesEmVigor()} · ciclo na semana ${ciclo.n} (${ciclo.ab})`),
      pid === 'instagram' ? `<button type="button" class="mk-link" data-g-restaurar>Restaurar a fase ${faseVista(pid)} do documento</button>` : '')}
    <div class="mk-filtros">${controles}<span class="mk-filtros__fim"><span class="mk-soma">${somas.join(' · ')} por semana</span></span></div>
    <div class="mk-grade">${colunas}</div>
    <p class="ui-nota">${pid ? 'Arraste o cartão pela alça para mudar a ordem ou o dia; clique para trocar formato, tipo e núcleo. ' : '“Em vigor” mostra cada plataforma na fase atual dela, na semana do ciclo de hoje; escolha uma plataforma para editar as fases dela. '}O horário segue a posição entre os encaixes da mesma plataforma. Formatos, tipos, horários, regras e escalada ficam em Plataformas.</p>`;
}

// ---------------------------------------------------------------------------
// Plataformas

function paginaPlataformas() {
  const todas = plano.todasPlataformas();
  const ativas = todas.filter((p) => !p.arquivada), arq = todas.filter((p) => p.arquivada);
  const nf = ativas.reduce((s, p) => s + p.formatos.filter((f) => !f.arquivado).length, 0);
  const nt = ativas.reduce((s, p) => s + p.formatos.filter((f) => !f.arquivado).reduce((a, f) => a + f.tipos.filter((t) => !t.arquivado).length, 0), 0);
  const secoes = ativas.map((p) => {
    const fase = plano.faseAtualDe(p.id);
    const cfg = p.modo === 'cota'
      ? [`Cota <b>até ${p.cotaMax || 3} por dia</b>`, ...[p.regras?.umProjetoPorDia && 'um projeto por dia', p.regras?.pastasAlternadas && 'pastas alternadas'].filter(Boolean).map((r) => `<b>${r}</b>`)]
      : [`Horários <b>${esc((p.horarios || []).join(' · ') || 'a definir')}</b>`, ...[p.regras?.nucleoSeguido && 'núcleo não se repete em seguida', p.regras?.estudioObjetos && 'Estúdio não encosta em Objetos'].filter(Boolean).map((r) => `<b>${r}</b>`)];
    cfg.push(`Escalada <b>${p.escalada?.fases || 1} ${p.escalada?.fases > 1 ? 'fases' : 'fase'}</b>${p.escalada?.fases > 1 ? ` · sobe com ${p.escalada?.reserva ? `${p.escalada.reserva} ${p.escalada.reserva > 1 ? 'semanas' : 'semana'} de reserva e ` : ''}${p.escalada?.cumpridas || 4} semanas cumpridas` : ''} · atual: <b>fase ${fase}</b>`);
    const formatos = p.formatos.filter((f) => !f.arquivado);
    const linhas = formatos.map((f) => {
      const tipos = f.tipos.filter((t) => !t.arquivado);
      const usos = [0, 1, 2, 3, 4, 5, 6].reduce((s, dow) => s + plano.gradeDe(p.id, fase).A[dow].filter((e) => e.formato === f.id).reduce((a, e) => a + (p.modo === 'cota' ? Number(e.cota) || 0 : 1), 0), 0);
      return { abre: `f:${p.id}|${f.id}`, celulas: [
        { html: `<b>${esc(f.nome)}</b>` },
        { html: `<span class="mk-mudo">${esc(plano.PECA_DESCRICAO[f.peca] || f.peca)}</span>`, celular: false },
        { html: `<span class="mk-tipos">${tipos.map((t) => `<span class="mk-tipo">${esc(t.nome)}${t.codigo || SIG[t.nucleo] ? `<small>${esc(t.codigo || SIG[t.nucleo])}</small>` : ''}</span>`).join('') || '<span class="mk-mudo">sem tipos</span>'}</span>` },
        { html: `<span class="mk-mudo">${usos ? `${usos} por semana` : '—'}</span>`, celular: false },
        { html: `<button type="button" class="mk-link" data-abre="f:${esc(p.id)}|${esc(f.id)}">Editar</button>`, fim: true },
      ] };
    });
    return secao({
      titulo: p.nome,
      n: p.modo === 'cota' ? 'cota por dia' : 'encaixes com horário',
      lado: `${segmentado(MODOS, p.modo, `p-modo:${p.id}`, 'Modo')}<button type="button" class="mk-link" data-abre="c:${esc(p.id)}">Configurar</button>`,
      corpo: bandeja(`<div class="mk-pcfg">${cfg.map((x) => `<span>${x}</span>`).join('')}</div>
        ${lista({ colunas: 'minmax(120px,170px) 140px minmax(0,1fr) 96px 60px', colunasCelular: 'minmax(0,1fr) minmax(0,1.4fr) 60px',
          regua: [{ texto: 'Formato' }, { texto: 'Peça do editor', celular: false }, { texto: 'Tipos' }, { texto: 'Na grade', celular: false }, { texto: '', fim: true }], linhas, vazio: 'Nenhum formato ainda.' })}
        <button type="button" class="mk-mais is-largo" data-p-novo-formato="${esc(p.id)}">${icone('mais', 13, 2)} Formato</button>`)
        + (p.id === 'pinterest' ? `<div class="mk-espaco">${bandeja(blocoPastas())}</div>` : ''),
    });
  }).join('');
  const arquivadas = arq.length ? secao({
    titulo: 'Arquivadas', n: arq.length,
    corpo: bandeja(lista({ colunas: 'minmax(0,1fr) 120px', linhas: arq.map((p) => ({ celulas: [{ html: `<b>${esc(p.nome)}</b>` }, { html: acao('Restaurar', { dados: { 'p-restaurar': p.id } }), fim: true }] })) })),
  }) : '';
  return `${cabecalho('Plataformas', `${ativas.length} ${ativas.length === 1 ? 'plataforma' : 'plataformas'} · ${nf} formatos · ${nt} tipos`, acao('Nova plataforma', { principal: true, dados: { 'p-nova': '1' } }))}
    ${secoes}
    <button type="button" class="mk-nova-plat" data-p-nova="1">${icone('mais', 15, 2)} Nova plataforma</button>
    ${arquivadas}
    <p class="ui-nota">Tipo é o conteúdo dentro de um formato (o “Carrossel de projeto” de um post, o “Antes & Depois” de um reel); pode ter código e núcleo. A peça do editor liga o formato às mídias do pool: o Calendário só deixa soltar num encaixe o que tem a peça dele. Arquivar tira da grade daqui para a frente; o que já foi publicado continua com o nome que tinha.</p>`;
}

/** Pastas do perfil do Pinterest: seguem o que as pessoas buscam, não os nomes dos projetos. A ordem é a do perfil
 *  (arrastar pela alça, dentro do grupo). Valem para todos os computadores (cfg:pin-pastas). */
function blocoPastas() {
  const todas = pinterest.listaPastas();
  return `<div class="mk-pastas__cab">Pastas do perfil <small>${todas.length} pastas · a ordem é a do perfil</small></div>
    ${pinterest.GRUPOS_PASTA.map(([g, nome]) => {
      const itens = todas.filter((x) => x.grupo === g);
      return `<div class="ui-lista__grupo">${esc(nome)} <small>${itens.length}</small></div>
        ${itens.map((x) => `<div class="mk-pasta" data-pasta="${esc(x.id)}" data-pasta-grupo="${esc(g)}">
          <button type="button" class="mk-alca" draggable="true" data-pasta-alca title="Arrastar para mudar a ordem (ou setas para cima e para baixo)" aria-label="Mudar a ordem de ${esc(x.nome || 'pasta')}: setas para cima e para baixo">${icone('alca', 14, 2)}</button>
          <input class="mk-campo-in mk-plano mk-pasta__nome" data-pasta-campo="nome" value="${esc(x.nome)}" placeholder="Nome da pasta" aria-label="Nome da pasta">
          <input class="mk-campo-in mk-plano mk-pasta__desc" data-pasta-campo="desc" value="${esc(x.desc || '')}" placeholder="O que entra" aria-label="O que entra nesta pasta">
          <button type="button" class="mk-ico" data-pasta-remover="${esc(x.id)}" title="Remover a pasta" aria-label="Remover a pasta ${esc(x.nome)}">${icone('fechar', 13, 2)}</button>
        </div>`).join('')}
        <button type="button" class="mk-mais is-largo" data-pasta-nova="${esc(g)}">${icone('mais', 13, 2)} Pasta</button>`;
    }).join('')}`;
}
function mudarPastas(fn, redesenhar = true) {
  const l = structuredClone(pinterest.listaPastas());
  fn(l);
  pinterest.gravarPastas(l).then((ok) => { if (!ok) avisar('Pastas guardadas neste computador; não foi possível salvar na nuvem.'); });
  if (redesenhar) desenhar();
}

// ---------------------------------------------------------------------------
// Pautas (banco de ângulos por obra)

function paginaPautas() {
  const busca = ui.busca.trim().toLowerCase();
  const todas = plano.listaPautas();
  const sel = todas.filter((p) => (ui.fonte === 'todos' || p.fonte === ui.fonte) && (ui.status === 'todos' || p.status === ui.status)
    && (!busca || `${p.obra} ${p.angulo} ${p.notas}`.toLowerCase().includes(busca)));
  const f = plano.FONTE_POR_ID[ui.nova.fonte];
  if (!plano.plataforma(ui.nova.plataforma)) ui.nova.plataforma = plano.plataformas()[0]?.id || 'instagram';
  const fmts = plano.formatosAtivos(ui.nova.plataforma);
  if (!fmts.some((x) => x.id === ui.nova.formato)) ui.nova.formato = fmts[0]?.id || '';
  const tipos = plano.tiposAtivos(ui.nova.plataforma, ui.nova.formato);
  const obras = [...new Set([...todas.map((p) => p.obra), ...resumos.map((r) => r.titulo)].filter(Boolean))].sort();
  const grupos = new Map();
  for (const p of sel) {
    const k = `${p.fonte}|${p.obra || ''}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const quandoP = (p) => {
    if (!p.dia) return quando('sem dia');
    const e = p.pos != null ? plano.encaixesDe(p.dia, plano.plataformaDaPauta(p)).find((x) => x.pos === p.pos) : null;
    return quando(`${pool.dataCurta(p.dia)}${e?.horario ? ' · ' + e.horario.split('–')[0] : ''}`, 'hora');
  };
  const sele = (attr, opcoes, atual, rot) => `<select class="mk-campo-in" ${attr} aria-label="${esc(rot)}">${opcoes.map(([v, r]) => `<option value="${esc(v)}"${v === atual ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>`;
  const form = bandeja(`<div class="mk-pauta-form">
      ${sele('data-nova="fonte"', plano.FONTES.map(([id, nome]) => [id, nome]), ui.nova.fonte, 'Fonte')}
      <input class="mk-campo-in mk-pauta-obra" data-nova="obra" list="obrasLista" placeholder="Obra: projeto, peça, ensaio ou assunto" value="${esc(ui.nova.obra || '')}" data-foco="nova-obra">
      <datalist id="obrasLista">${obras.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
      <input class="mk-campo-in mk-pauta-angulo" data-nova="angulo" placeholder="Ângulo" value="${esc(ui.nova.angulo || '')}" data-foco="nova-angulo">
      ${sele('data-nova="plataforma"', plano.plataformas().map((p) => [p.id, p.nome]), ui.nova.plataforma, 'Plataforma')}
      ${sele('data-nova="formato"', fmts.map((x) => [x.id, x.nome]), ui.nova.formato, 'Formato')}
      ${tipos.length ? sele('data-nova="tipo"', [['', 'Sem tipo'], ...tipos.map((t) => [t.id, `${t.codigo ? t.codigo + ' · ' : ''}${t.nome}${t.nucleo && t.nucleo !== f[2] ? ` (${nomeNuc(t.nucleo)})` : ''}`])], ui.nova.tipo, 'Tipo') : ''}
      ${acao('Adicionar', { principal: true, dados: { adicionar: '1' } })}
    </div>
    <div class="mk-pauta-sug">${f[3].map((a) => `<button type="button" data-sugestao="${esc(a)}">${esc(a)}</button>`).join('')}</div>`);
  const filtros = `<div class="mk-filtros">
    <input type="search" class="mk-busca" data-busca-pauta value="${esc(ui.busca)}" placeholder="Buscar obra ou ângulo" data-foco="busca" aria-label="Buscar pauta">
    ${segmentado([{ id: 'todos', rotulo: 'Todas as fontes' }, ...plano.FONTES.map(([id, nome]) => ({ id, rotulo: nome }))], ui.fonte, 'pt-fonte', 'Fonte')}
    ${segmentado([{ id: 'todos', rotulo: 'Todas' }, ...plano.STATUS_PAUTA.map(([v, r]) => ({ id: v, rotulo: r, n: todas.filter((p) => p.status === v).length }))], ui.status, 'pt-status', 'Situação')}
  </div>`;
  const secoes = [...grupos.entries()].map(([k, ps]) => {
    const [fonte, obra] = k.split('|');
    const fo = plano.FONTE_POR_ID[fonte];
    return secao({
      titulo: obra || 'Sem obra', n: `${fo[1]} · ${ps.filter((p) => p.status === 'publicada').length} de ${ps.length} publicadas`,
      corpo: bandeja(lista({ colunas: 'minmax(0,1.4fr) minmax(0,1fr) 130px 96px minmax(0,1fr) 28px', colunasCelular: 'minmax(0,1fr) 110px 28px',
        regua: [{ texto: 'Ângulo' }, { texto: 'Plataforma e formato', celular: false }, { texto: 'Situação' }, { texto: 'Dia', celular: false }, { texto: 'Notas', celular: false }, { texto: '', fim: true }],
        linhas: ps.map((p) => ({ celulas: [
          { html: `<input class="mk-campo-in mk-plano" data-pauta="${esc(p.id)}" data-pauta-campo="angulo" value="${esc(p.angulo)}" placeholder="Ângulo" aria-label="Ângulo">` },
          { html: `<span class="mk-mudo">${esc(`${plano.nomePlataforma(plano.plataformaDaPauta(p))} · ${plano.rotuloDaPauta(p)}`)}</span>`, celular: false },
          { html: `<select class="mk-campo-in" data-pauta="${esc(p.id)}" data-pauta-campo="status" aria-label="Situação">${plano.STATUS_PAUTA.map(([v, r]) => `<option value="${v}"${v === p.status ? ' selected' : ''}>${r}</option>`).join('')}</select>` },
          { html: quandoP(p), celular: false },
          { html: `<input class="mk-campo-in mk-plano" data-pauta="${esc(p.id)}" data-pauta-campo="notas" value="${esc(p.notas || '')}" placeholder="Notas" aria-label="Notas">`, celular: false },
          { html: `<button type="button" class="mk-ico" data-remover-pauta="${esc(p.id)}" aria-label="Arquivar a pauta" title="Remover a pauta">${icone('fechar', 13, 2)}</button>`, fim: true },
        ] })) })),
    });
  }).join('');
  return `${cabecalho('Banco de pautas', `${todas.length} ${todas.length === 1 ? 'pauta' : 'pautas'} · ${todas.filter((p) => !p.dia && p.status !== 'publicada').length} sem dia`)}
    <div class="mk-espaco">${form}</div>${filtros}
    ${secoes || `<p class="mk-vazio mk-espaco">${todas.length ? 'Nenhuma pauta com esses filtros.' : 'O banco de pautas está vazio. Comece pelas obras do próximo ciclo.'}</p>`}`;
}

function adicionarPauta() {
  const f = plano.FONTE_POR_ID[ui.nova.fonte];
  const angulo = (ui.nova.angulo || '').trim();
  if (!angulo) { toque('Escreva o ângulo da pauta.'); $('[data-nova="angulo"]', raiz)?.focus(); return; }
  const t = plano.tipo(ui.nova.plataforma, ui.nova.formato, ui.nova.tipo);
  const p = plano.novaPauta({ fonte: f[0], nucleo: t?.nucleo || f[2], obra: (ui.nova.obra || '').trim(), angulo, plataforma: ui.nova.plataforma, formato: ui.nova.formato, tipo: t?.id || '', modelo: t?.codigo || '' });
  ui.nova.angulo = '';
  mudarPautas((l) => { l.push(p); });
  $('[data-nova="angulo"]', raiz)?.focus();
}
function mudarPautas(fn, redesenhar = true) {
  const l = structuredClone(plano.listaPautas());
  fn(l);
  plano.gravarPautas(l).then((ok) => { if (!ok) avisar('Pautas guardadas neste computador; não foi possível salvar na nuvem.'); });
  if (redesenhar) desenhar();
}

// ---------------------------------------------------------------------------
// Ciclo

function paginaCiclo() {
  const hoje = pool.hoje();
  const seg0 = pool.segundaDe(hoje);
  const c = plano.semanaDoCiclo(hoje);
  const est = plano.estrategia();
  const prazos = plano.prazosDaSemana(seg0);
  const descr = (p) => (p.k === 'agendar' ? `até sexta, ${pool.dataCurta(p.dia)} · semana de ${pool.dataCurta(p.alvo)}`
    : p.k === 'captacao' ? `semanas de ${pool.dataCurta(p.alvo)} e ${pool.dataCurta(p.ate)}`
    : p.k === 'pautas' ? `ciclo que começa em ${pool.dataCurta(p.alvo)}`
    : p.alvo ? `semana de ${pool.dataCurta(p.alvo)}` : 'antes de fechar as pautas do próximo ciclo');
  const esc_ = plano.plataformas().map((p) => ({ p, x: plano.escalada(p.id) }));
  const semanas = [];
  for (let k = 0; k < 8; k++) {
    const seg = pool.somarDias(seg0, k * 7);
    const cc = plano.semanaDoCiclo(seg);
    let enc = 0, pautadas = 0, prontas = 0, publicadas = 0;
    for (let i = 0; i < 7; i++) {
      const dia = pool.somarDias(seg, i);
      for (const e of plano.encaixesDoDia(dia)) {
        if (e.pos == null) {
          const n = pool.lista().filter((x) => x.rede === e.plataforma && x.dia === dia);
          enc += e.cota;
          publicadas += Math.min(e.cota, n.filter((x) => x.status === 'publicado').length);
          prontas += Math.min(Math.max(0, e.cota - n.filter((x) => x.status === 'publicado').length), n.filter((x) => x.status !== 'publicado').length);
          continue;
        }
        enc++;
        const o = plano.ocupantes(dia, e.plataforma, e.pos);
        if (o.item?.status === 'publicado' || o.pauta?.status === 'publicada') publicadas++;
        else if (o.item || o.pauta?.status === 'pronta') prontas++;
        else if (o.pauta) pautadas++;
      }
    }
    semanas.push({ seg, cc, enc, pautadas, prontas, publicadas, lacunas: enc - pautadas - prontas - publicadas });
  }
  return `${cabecalho('Ciclo de produção', `semana ${c.n} de 4 (${c.ab}) · ${esc(plano.fasesEmVigor())}`,
      `<label class="mk-campo mk-campo--linha"><span>Início do ciclo</span><input type="date" data-ciclo-inicio value="${esc(est.cicloInicio || '')}"></label>`)}
    ${secao({ titulo: 'Esta semana', n: prazos.length, corpo: bandeja(lista({ colunas: 'minmax(0,1fr) minmax(0,1.4fr)', colunasCelular: 'minmax(0,1fr)',
      linhas: prazos.map((p) => ({ celulas: [{ html: `<b>${esc(p.rot)}</b>` }, { html: `<span class="mk-mudo">${esc(descr(p))}</span>`, celular: false }] })) })) })}
    ${secao({ titulo: 'Escalada', n: esc_.length, corpo: bandeja(lista({ colunas: '150px 100px minmax(0,1fr) minmax(0,1fr) 220px', colunasCelular: 'minmax(0,1fr) 80px 150px',
      regua: [{ texto: 'Plataforma' }, { texto: 'Fase' }, { texto: 'Reserva', celular: false }, { texto: 'Semanas cumpridas', celular: false }, { texto: '', fim: true }],
      linhas: esc_.map(({ p, x }) => ({ celulas: [
        { html: `<span class="mk-plat">${iconePlat(p.id, 13)}<b>${esc(p.nome)}</b></span>` },
        { html: `${x.fase} de ${x.fases}` },
        { html: x.precisa ? quando(`${x.prontos} de ${x.precisa} prontos fora da agenda`, x.prontos >= x.precisa ? 'ok' : '') : '<span class="mk-mudo">não pede reserva</span>', celular: false },
        { html: x.vazia ? '<span class="mk-mudo">sem encaixes na grade</span>' : quando(`${Math.min(x.cumpridas, x.meta)} de ${x.meta}`, x.cumpridas >= x.meta ? 'ok' : ''), celular: false },
        { html: x.fase >= x.fases ? '<span class="mk-mudo">fase final</span>' : x.pode ? acao(`Avançar para a fase ${x.fase + 1}`, { principal: true, dados: { avancar: p.id } }) : '<span class="mk-mudo">ainda não dá para avançar</span>', fim: true },
      ] })) })) })}
    ${secao({ titulo: 'Próximas semanas', n: 8, corpo: bandeja(lista({ colunas: '130px 80px 72px 72px 72px 72px 80px minmax(0,1fr)', colunasCelular: 'minmax(0,1fr) 64px 64px',
      regua: ['Semana', 'Ciclo', 'Encaixes', 'Lacunas', 'Pautadas', 'Prontas', 'Publicadas', 'Prazos que vencem nela'].map((t, i) => ({ texto: t, celular: [0, 2, 3].includes(i), fim: i >= 2 && i <= 6 })),
      linhas: semanas.map((l) => ({ href: '#/calendario', sel: l.seg === seg0, celulas: [
        { html: `<b>${pool.dataCurta(l.seg)} a ${pool.dataCurta(pool.somarDias(l.seg, 6))}</b>` },
        { html: `${l.cc.n}/4 · ${l.cc.ab}`, celular: false },
        { html: String(l.enc), fim: true },
        { html: l.lacunas ? quando(String(l.lacunas), 'atraso') : '0', fim: true },
        { html: l.pautadas || '', fim: true, celular: false }, { html: l.prontas || '', fim: true, celular: false }, { html: l.publicadas || '', fim: true, celular: false },
        { html: `<span class="mk-mudo">${esc([l.cc.n === 1 ? `pautas do ciclo até ${pool.dataCurta(pool.somarDias(l.seg, -21))}` : '', `textos até ${pool.dataCurta(pool.somarDias(l.seg, -14))}`,
          `design até ${pool.dataCurta(pool.somarDias(l.seg, -7))}`, `agendar até ${pool.dataCurta(pool.somarDias(l.seg, -3))}`].filter(Boolean).join(' · '))}</span>`, celular: false },
      ] })) })) })}
    <p class="ui-nota">Lacuna: encaixe (ou vaga de cota) sem pauta nem publicação. Pautada: com pauta ainda não pronta. Pronta: com mídia no pool ou pauta pronta. A escalada de cada plataforma segue os termos dela (Plataformas › Configurar).</p>`;
}

// ---------------------------------------------------------------------------
// Gaveta: encaixe da grade, formato, configuração da plataforma

function abrir(chave) {
  const k = chave.slice(0, 1), r = chave.slice(2);
  let g = null;
  if (k === 'e') g = gavetaEncaixe(...r.split('|').map(Number));
  else if (k === 'f') g = gavetaFormato(...r.split('|'));
  else if (k === 'c') g = gavetaPlataforma(r);
  if (!g) { chaveGaveta = ''; return; }
  chaveGaveta = chave;
  gaveta.aoFechar = () => { chaveGaveta = ''; };
  g.dataset.chave = chave;
  g.addEventListener('click', cliqueGaveta);
  g.addEventListener('change', mudancaGaveta);
  g.addEventListener('input', digitacaoGaveta);
}
const inp = (attr, v, extra = '') => `<input class="mk-campo-in" ${attr} value="${esc(v ?? '')}" ${extra}>`;
const chk = (attr, on, rot) => `<label class="mk-chk"><input type="checkbox" ${attr}${on ? ' checked' : ''}> ${esc(rot)}</label>`;

function gavetaEncaixe(dow, pos) {
  const pid = ui.plat;
  const p = plano.plataforma(pid);
  if (!p) return null;
  const sem = (() => { const g = plano.gradeDe(pid, faseVista(pid)); return ui.ab === 'B' && g.B ? g.B : g.A; })();
  const e = sem[dow]?.[pos];
  if (!e) return null;
  const fmts = plano.formatosAtivos(pid);
  const tipos = plano.tiposAtivos(pid, e.formato);
  return gaveta.abrir({
    etiqueta: etiqueta(`${p.nome} · fase ${faseVista(pid)}${plano.gradeDe(pid, faseVista(pid)).B ? ` · semana ${ui.ab}` : ''}`, 'marketing'),
    titulo: plano.rotuloDe({ plataforma: pid, formato: e.formato, tipo: e.tipo }),
    texto: `${plano.DIAS[dow]} · ${pos + 1}º encaixe do dia`,
    campos: [
      ['Formato', segmentado(fmts.map((f) => ({ id: f.id, rotulo: f.nome })), e.formato, 'ge-formato')],
      ['Tipo', `<select class="mk-campo-in" data-ge="tipo"><option value="">Sem tipo</option>${tipos.map((t) => `<option value="${esc(t.id)}"${t.id === e.tipo ? ' selected' : ''}>${esc(`${t.codigo ? t.codigo + ' · ' : ''}${t.nome}${t.nucleo ? ` (${nomeNuc(t.nucleo)})` : ''}`)}</option>`).join('')}</select>`],
      ['Núcleo', segmentado([{ id: '', rotulo: 'Qualquer' }, ...ORDEM_NUCLEOS.map((n) => ({ id: n, rotulo: NUCLEOS[n].nome }))], e.nucleo || '', 'ge-nucleo')],
      ['Dia', `<select class="mk-campo-in" data-ge="dia">${plano.DIAS.map((d, i) => `<option value="${i}"${i === dow ? ' selected' : ''}>${d}</option>`).join('')}</select>`],
    ],
    acoes: acao('Tirar o encaixe da grade', { dados: { 'ge-tirar': '1' } }),
  });
}

function gavetaFormato(pid, fid) {
  const p = plano.plataforma(pid), f = plano.formato(pid, fid);
  if (!p || !f) return null;
  const linhaTipo = (t) => `<div class="mk-gtipo${t.arquivado ? ' is-arquivado' : ''}" data-tipo="${esc(t.id)}">
    ${inp('data-gt="nome" aria-label="Nome do tipo"', t.nome)}
    <span class="mk-gtipo__l">${inp('data-gt="codigo" aria-label="Código" placeholder="Código"', t.codigo, 'style="width:72px"')}
      <select class="mk-campo-in" data-gt="nucleo" aria-label="Núcleo"><option value="">Qualquer núcleo</option>${ORDEM_NUCLEOS.map((n) => `<option value="${n}"${n === t.nucleo ? ' selected' : ''}>${NUCLEOS[n].nome}</option>`).join('')}</select>
      <button type="button" class="mk-link" data-gt-arquivar>${t.arquivado ? 'Restaurar' : 'Arquivar'}</button></span></div>`;
  return gaveta.abrir({
    etiqueta: etiqueta(p.nome, 'marketing'),
    titulo: f.nome,
    campos: [
      ['Nome', inp('data-gf="nome" aria-label="Nome do formato"', f.nome)],
      ['Peça do editor', segmentado(plano.PECAS.map(([v, r]) => ({ id: v, rotulo: r })), f.peca, 'gf-peca')],
      ['Tipos', `<div class="mk-gtipos">${f.tipos.filter((t) => !t.arquivado).map(linhaTipo).join('')}</div>
        <button type="button" class="mk-mais is-largo" data-gt-novo>${icone('mais', 13, 2)} Tipo</button>
        ${f.tipos.some((t) => t.arquivado) ? `<details class="mk-arq"><summary>Arquivados (${f.tipos.filter((t) => t.arquivado).length})</summary>${f.tipos.filter((t) => t.arquivado).map(linhaTipo).join('')}</details>` : ''}`],
    ],
    acoes: acao(f.arquivado ? 'Restaurar o formato' : 'Arquivar o formato', { dados: { 'gf-arquivar': '1' } }),
  });
}

function gavetaPlataforma(pid) {
  const p = plano.plataforma(pid);
  if (!p) return null;
  const atual = plano.faseAtualDe(pid);
  const nf = Number(p.escalada?.fases) || 1;
  const campos = [
    ['Nome', inp('data-gp="nome" aria-label="Nome da plataforma"', p.nome)],
    ['Modo', segmentado(MODOS, p.modo, 'gp-modo')],
  ];
  if (p.modo === 'encaixes') campos.push(['Horários', `${inp('data-gp="horarios" aria-label="Horários" placeholder="11h–13h, 15h–17h, 20h–22h"', (p.horarios || []).join(', '))}<small class="mk-mudo">Pela posição no dia: o primeiro, os do meio e o último.</small>`]);
  else campos.push(['Cota máxima', inp('data-gp="cotaMax" type="number" min="1" max="20" aria-label="Cota máxima por dia"', p.cotaMax || 3, 'style="width:80px"')]);
  campos.push(['Regras', p.modo === 'encaixes'
    ? `${chk('data-gr="nucleoSeguido"', p.regras?.nucleoSeguido, 'Núcleo não se repete em publicações seguidas')}${chk('data-gr="estudioObjetos"', p.regras?.estudioObjetos, 'Estúdio não encosta em Objetos')}`
    : `${chk('data-gr="umProjetoPorDia"', p.regras?.umProjetoPorDia, 'Um projeto por dia')}${chk('data-gr="pastasAlternadas"', p.regras?.pastasAlternadas, 'Pastas alternadas')}`]);
  campos.push(['Fases da escalada', inp('data-ge2="fases" type="number" min="1" max="12" aria-label="Número de fases"', nf, 'style="width:80px"')]);
  campos.push(['Reserva', `${inp('data-ge2="reserva" type="number" min="0" max="8" aria-label="Semanas de reserva"', p.escalada?.reserva ?? 0, 'style="width:80px"')} <small class="mk-mudo">semanas de publicações prontas fora da agenda</small>`]);
  campos.push(['Semanas cumpridas', `${inp('data-ge2="cumpridas" type="number" min="1" max="12" aria-label="Semanas cumpridas"', p.escalada?.cumpridas ?? 4, 'style="width:80px"')} <small class="mk-mudo">seguidas, sem falha, para subir de fase</small>`]);
  campos.push(['Fase atual', `<select class="mk-campo-in" data-gp-fase>${Array.from({ length: nf }, (_, i) => `<option value="${i + 1}"${i + 1 === atual ? ' selected' : ''}>Fase ${i + 1}</option>`).join('')}</select><small class="mk-mudo">Trocar vale a partir da segunda-feira desta semana.</small>`]);
  return gaveta.abrir({
    etiqueta: etiqueta('Plataforma', 'marketing'),
    titulo: p.nome,
    campos,
    acoes: acao(p.arquivada ? 'Restaurar a plataforma' : 'Arquivar a plataforma', { dados: { 'gp-arquivar': '1' } }),
  });
}

function cliqueGaveta(ev) {
  const g = ev.currentTarget, t = ev.target, ch = g.dataset.chave;
  const seg = t.closest('[data-segmentado]');
  if (ch.startsWith('e:')) {
    const [dow, pos] = ch.slice(2).split('|').map(Number);
    const pid = ui.plat;
    if (seg?.dataset.segmentado === 'ge-formato') { mudarGrade(pid, (sem) => { const e = sem[dow][pos]; e.formato = seg.dataset.valor; e.tipo = ''; }); return; }
    if (seg?.dataset.segmentado === 'ge-nucleo') { mudarGrade(pid, (sem) => { sem[dow][pos].nucleo = seg.dataset.valor; }); return; }
    if (t.closest('[data-ge-tirar]')) { gaveta.fechar(true); chaveGaveta = ''; mudarGrade(pid, (sem) => { sem[dow].splice(pos, 1); }); toque('Encaixe tirado da grade.'); }
    return;
  }
  if (ch.startsWith('f:')) {
    const [pid, fid] = ch.slice(2).split('|');
    if (seg?.dataset.segmentado === 'gf-peca') { mudarEst((e) => { pEm(e, pid).formatos.find((f) => f.id === fid).peca = seg.dataset.valor; }); return; }
    if (t.closest('[data-gt-novo]')) {
      mudarEst((e) => { const f = pEm(e, pid).formatos.find((x) => x.id === fid); f.tipos.push({ id: `t${Date.now().toString(36)}`, nome: 'Novo tipo', codigo: '', nucleo: '' }); });
      setTimeout(() => { const l = document.querySelectorAll('.ui-gaveta .mk-gtipos [data-gt="nome"]'); const u = l[l.length - 1]; u?.focus(); u?.select(); }, 30);
      return;
    }
    const arq = t.closest('[data-gt-arquivar]');
    if (arq) { const tid = arq.closest('[data-tipo]').dataset.tipo; mudarEst((e) => { const tp = pEm(e, pid).formatos.find((x) => x.id === fid).tipos.find((x) => x.id === tid); tp.arquivado = !tp.arquivado; }); return; }
    if (t.closest('[data-gf-arquivar]')) {
      gaveta.fechar(true); chaveGaveta = '';
      mudarEst((e) => { const f = pEm(e, pid).formatos.find((x) => x.id === fid); f.arquivado = !f.arquivado; });
      toque('Formato arquivado: sai da grade daqui para a frente.');
    }
    return;
  }
  if (ch.startsWith('c:')) {
    const pid = ch.slice(2);
    if (seg?.dataset.segmentado === 'gp-modo') { trocarModo(pid, seg.dataset.valor); return; }
    if (t.closest('[data-gp-arquivar]')) {
      if (plano.plataformas().length <= 1 && !plano.plataforma(pid)?.arquivada) { toque('Precisa haver ao menos uma plataforma ativa.'); return; }
      gaveta.fechar(true); chaveGaveta = '';
      mudarEst((e) => { const p = pEm(e, pid); p.arquivada = !p.arquivada; });
      toque('Plataforma arquivada: sai da grade e do calendário daqui para a frente.');
    }
  }
}

function mudancaGaveta(ev) {
  const g = ev.currentTarget, t = ev.target, ch = g.dataset.chave;
  if (ch.startsWith('e:')) {
    const [dow, pos] = ch.slice(2).split('|').map(Number);
    if (t.dataset.ge === 'tipo') {
      const pid = ui.plat;
      mudarGrade(pid, (sem) => {
        const e = sem[dow][pos];
        e.tipo = t.value;
        const tp = plano.tipo(pid, e.formato, t.value);
        if (tp?.nucleo) e.nucleo = tp.nucleo;
      });
    } else if (t.dataset.ge === 'dia') {
      const novo = Number(t.value);
      let nova = 0;
      mudarGrade(ui.plat, (sem) => { const [e] = sem[dow].splice(pos, 1); sem[novo].push(e); nova = sem[novo].length - 1; });
      chaveGaveta = `e:${novo}|${nova}`;
      desenhar();
    }
    return;
  }
  if (ch.startsWith('f:')) {
    const [pid, fid] = ch.slice(2).split('|');
    const tid = t.closest('[data-tipo]')?.dataset.tipo;
    if (tid && t.dataset.gt === 'nucleo') mudarEst((e) => { pEm(e, pid).formatos.find((x) => x.id === fid).tipos.find((x) => x.id === tid).nucleo = t.value; });
    return;
  }
  if (ch.startsWith('c:')) {
    const pid = ch.slice(2);
    if (t.dataset.gr) { mudarEst((e) => { const p = pEm(e, pid); p.regras = { ...(p.regras || {}), [t.dataset.gr]: t.checked }; }); return; }
    if (t.dataset.ge2) {
      const v = Math.max(t.dataset.ge2 === 'reserva' ? 0 : 1, Math.min(12, Number(t.value) || 0));
      mudarEst((e) => { const p = pEm(e, pid); p.escalada = { ...(p.escalada || {}), [t.dataset.ge2]: v }; });
      return;
    }
    if (t.dataset.gp === 'cotaMax') { const v = Math.max(1, Math.min(20, Number(t.value) || 3)); mudarEst((e) => { pEm(e, pid).cotaMax = v; }); return; }
    if (t.matches('[data-gp-fase]')) { usarFase(pid, Number(t.value)); }
  }
}

/** Textos digitados na Gaveta: gravam sem redesenhar a cada letra (a página redesenha ao fechar ou ao mudar outra coisa). */
function digitacaoGaveta(ev) {
  const g = ev.currentTarget, t = ev.target, ch = g.dataset.chave;
  const gravar = (fn) => { clearTimeout(digitacaoGaveta.t); digitacaoGaveta.t = setTimeout(() => { mudarEst(fn, { redesenhar: false }); redesenharPorBaixo(); }, 450); };
  if (ch.startsWith('f:')) {
    const [pid, fid] = ch.slice(2).split('|');
    if (t.dataset.gf === 'nome') { const v = t.value.trim() || 'Formato'; gravar((e) => { pEm(e, pid).formatos.find((x) => x.id === fid).nome = v; }); return; }
    const tid = t.closest('[data-tipo]')?.dataset.tipo;
    if (tid && (t.dataset.gt === 'nome' || t.dataset.gt === 'codigo')) {
      const v = t.value.trim(), campo = t.dataset.gt;
      gravar((e) => { pEm(e, pid).formatos.find((x) => x.id === fid).tipos.find((x) => x.id === tid)[campo] = campo === 'nome' ? v || 'Tipo' : v.toUpperCase(); });
    }
    return;
  }
  if (ch.startsWith('c:')) {
    const pid = ch.slice(2);
    if (t.dataset.gp === 'nome') { const v = t.value.trim() || 'Plataforma'; gravar((e) => { pEm(e, pid).nome = v; }); return; }
    if (t.dataset.gp === 'horarios') { const v = t.value.split(/[,;]/).map((x) => x.trim()).filter(Boolean); gravar((e) => { pEm(e, pid).horarios = v; }); }
  }
}
/** Redesenha a página sem reabrir a Gaveta (para não tirar o foco do campo que está sendo digitado). */
function redesenharPorBaixo() {
  const ch = chaveGaveta;
  chaveGaveta = '';
  desenhar();
  chaveGaveta = ch;
}

function trocarModo(pid, modo) {
  const p = plano.plataforma(pid);
  if (!p || p.modo === modo) return;
  mudarEst((e) => { const x = pEm(e, pid); x.modo = modo; e.grades[pid] = {}; if (modo === 'encaixes' && !(x.horarios || []).length) x.horarios = ['11h–13h']; });
  toque(`A grade do ${p.nome} recomeçou no modo ${modo === 'cota' ? 'cota por dia' : 'encaixes com horário'}.`);
}
function usarFase(pid, f) {
  const desde = pool.segundaDe(pool.hoje());
  mudarEst((e) => { const p = pEm(e, pid); p.fases = (p.fases || []).filter((x) => x.desde !== desde); p.fases.push({ fase: f, desde }); });
  ui.fase[pid] = f;
  toque(`${plano.nomePlataforma(pid)}: fase ${f} a partir de ${pool.dataCurta(desde)}.`);
}
function novaPlataforma() {
  const ids = new Set(plano.todasPlataformas().map((p) => p.id));
  let id = 'plataforma', n = 1;
  while (ids.has(id)) id = `plataforma-${++n}`;
  mudarEst((e) => {
    e.plataformas.push({ id, nome: 'Nova plataforma', modo: 'encaixes', horarios: ['11h–13h'], cotaMax: 3, regras: {}, escalada: { fases: 1, reserva: 0, cumpridas: 4 },
      fases: [{ fase: 1, desde: '2000-01-03' }], formatos: [{ id: 'post', nome: 'Post', peca: '3x4', tipos: [] }] });
    e.grades[id] = {};
  });
  abrir(`c:${id}`);
  setTimeout(() => { const c = document.querySelector('.ui-gaveta [data-gp="nome"]'); c?.focus(); c?.select(); }, 30);
}

// ---------------------------------------------------------------------------
// Eventos da página

function ligar() {
  raiz.addEventListener('click', (e) => {
    const t = e.target;
    const seg = t.closest('[data-segmentado]');
    if (seg) {
      const g = seg.dataset.segmentado, v = seg.dataset.valor;
      if (g === 'g-plat') { ui.plat = v; ui.ab = 'A'; }
      else if (g === 'g-fase') { ui.fase[ui.plat] = Number(v); ui.ab = 'A'; }
      else if (g === 'g-ab') ui.ab = v;
      else if (g === 'pt-fonte') ui.fonte = v;
      else if (g === 'pt-status') ui.status = v;
      else if (g.startsWith('p-modo:')) { trocarModo(g.slice(7), v); return; }
      desenhar();
      return;
    }
    const b = t.closest('button');
    if (!b) {
      const el = t.closest('[data-abre]');
      if (el && !t.closest('a, input, select')) abrir(el.dataset.abre);
      return;
    }
    const d = b.dataset;
    if (d.abre) { abrir(d.abre); return; }
    // grade
    if (d.gMais !== undefined) {
      const pid = ui.plat, dow = Number(d.gMais);
      const f = plano.formatosAtivos(pid)[0];
      let pos = 0;
      mudarGrade(pid, (sem) => { sem[dow].push({ formato: f?.id || '', tipo: '', nucleo: '' }); pos = sem[dow].length - 1; });
      abrir(`e:${dow}|${pos}`);
      return;
    }
    if (d.gCota !== undefined) {
      const pid = ui.plat, dow = Number(d.gCota), p = plano.plataforma(pid);
      mudarGrade(pid, (sem) => {
        const f = plano.formatosAtivos(pid)[0]?.id || 'pin';
        if (!sem[dow].length) sem[dow].push({ formato: f, cota: 0 });
        sem[dow][0].cota = Math.max(0, Math.min(p?.cotaMax || 3, (Number(sem[dow][0].cota) || 0) + Number(d.d)));
      });
      return;
    }
    if (d.gAbAlternar !== undefined) {
      const pid = ui.plat;
      mudarEst((e) => { semanaDe(e, pid, faseVista(pid), 'A'); const g = e.grades[pid][faseVista(pid)]; g.B = g.B ? null : structuredClone(g.A); });
      ui.ab = 'A';
      return;
    }
    if (d.gUsarFase) { usarFase(ui.plat, Number(d.gUsarFase)); return; }
    if (d.gRestaurar !== undefined) {
      if (!d.confirmar) { d.confirmar = '1'; b.textContent = `Confirmar: restaurar a fase ${faseVista('instagram')}?`; setTimeout(() => { if (b.isConnected) { delete b.dataset.confirmar; desenhar(); } }, 3000); return; }
      const fase = faseVista('instagram');
      mudarEst((e) => { e.grades.instagram[fase] = normalizarFaseDoc(fase); });
      return;
    }
    // pastas do Pinterest
    if (d.pastaNova) {
      const nova = { id: `pf${Date.now().toString(36)}`, grupo: d.pastaNova, nome: '', desc: '' };
      mudarPastas((l) => { const ult = l.map((x) => x.grupo).lastIndexOf(nova.grupo); l.splice(ult < 0 ? l.length : ult + 1, 0, nova); });
      $(`[data-pasta="${nova.id}"] [data-pasta-campo="nome"]`, raiz)?.focus();
      return;
    }
    if (d.pastaRemover) {
      if (!d.confirmar) { d.confirmar = '1'; b.innerHTML = '<small>Remover?</small>'; b.classList.add('is-confirmar'); setTimeout(() => { if (b.isConnected) desenhar(); }, 2500); return; }
      const id = d.pastaRemover;
      mudarPastas((l) => { const k = l.findIndex((x) => x.id === id); if (k >= 0) l.splice(k, 1); });
      return;
    }
    // plataformas
    if (d.pNova !== undefined) { novaPlataforma(); return; }
    if (d.pNovoFormato) {
      const pid = d.pNovoFormato;
      const id = `f${Date.now().toString(36)}`;
      mudarEst((e) => { pEm(e, pid).formatos.push({ id, nome: 'Novo formato', peca: '3x4', tipos: [] }); });
      abrir(`f:${pid}|${id}`);
      setTimeout(() => { const c = document.querySelector('.ui-gaveta [data-gf="nome"]'); c?.focus(); c?.select(); }, 30);
      return;
    }
    if (d.pRestaurar) { mudarEst((e) => { pEm(e, d.pRestaurar).arquivada = false; }); return; }
    // ciclo
    if (d.avancar) { const x = plano.escalada(d.avancar); usarFase(d.avancar, x.fase + 1); return; }
    // pautas
    if (d.sugestao) { ui.nova.angulo = d.sugestao; desenhar(); $('[data-nova="angulo"]', raiz)?.focus(); return; }
    if (d.adicionar !== undefined) { adicionarPauta(); return; }
    if (d.removerPauta) {
      if (!d.confirmar) { d.confirmar = '1'; b.innerHTML = '<small>Remover?</small>'; b.classList.add('is-confirmar'); setTimeout(() => { if (b.isConnected) desenhar(); }, 2500); return; }
      const id = d.removerPauta;
      mudarPautas((l) => { const k = l.findIndex((p) => p.id === id); if (k >= 0) l.splice(k, 1); });
    }
  });
  raiz.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-abre][tabindex]')) { e.preventDefault(); abrir(e.target.dataset.abre); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.matches?.('[data-pasta-alca]')) {
      e.preventDefault();
      const id = e.target.closest('[data-pasta]').dataset.pasta, dir = e.key === 'ArrowUp' ? -1 : 1;
      mudarPastas((l) => {
        const i = l.findIndex((x) => x.id === id);
        let j = i + dir;
        while (j >= 0 && j < l.length && l[j].grupo !== l[i].grupo) j += dir; // troca com a vizinha do mesmo grupo
        if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
      });
      $(`[data-pasta="${id}"] [data-pasta-alca]`, raiz)?.focus();
      return;
    }
    if (e.key === 'Enter' && e.target.dataset?.nova) { e.preventDefault(); adicionarPauta(); }
  });
  raiz.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-ciclo-inicio]') && t.value) { mudarEst((x) => { x.cicloInicio = pool.segundaDe(t.value); }); return; }
    if (t.dataset.nova === 'fonte') { ui.nova.fonte = t.value; desenhar(); return; }
    if (t.dataset.nova === 'plataforma') { ui.nova.plataforma = t.value; ui.nova.formato = ''; ui.nova.tipo = ''; desenhar(); return; }
    if (t.dataset.nova === 'formato') { ui.nova.formato = t.value; ui.nova.tipo = ''; desenhar(); return; }
    if (t.dataset.nova === 'tipo') { ui.nova.tipo = t.value; return; }
    if (t.dataset.pautaCampo === 'status') { const id = t.dataset.pauta; mudarPautas((l) => { const p = l.find((x) => x.id === id); if (p) p.status = t.value; }); }
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
    if (t.dataset.pastaCampo) {
      const id = t.closest('[data-pasta]').dataset.pasta, campo = t.dataset.pastaCampo;
      mudarPastas((l) => { const x = l.find((y) => y.id === id); if (x) x[campo] = t.value; }, false);
      return;
    }
    if (t.dataset.pautaCampo === 'angulo' || t.dataset.pautaCampo === 'notas') {
      const id = t.dataset.pauta, campo = t.dataset.pautaCampo;
      mudarPautas((l) => { const p = l.find((x) => x.id === id); if (p) p[campo] = t.value; }, false);
    }
  });

  // pastas do Pinterest: arrastar pela alça para mudar a ordem, dentro do mesmo grupo
  let pasta = null;
  raiz.addEventListener('dragstart', (e) => {
    const alca = e.target.closest?.('.mk-pasta .mk-alca');
    if (!alca) return;
    const linha = alca.closest('[data-pasta]');
    pasta = { id: linha.dataset.pasta, grupo: linha.dataset.pastaGrupo };
    e.dataTransfer.setData('text/plain', pasta.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(linha, 16, 16);
    linha.classList.add('is-pego');
  });
  raiz.addEventListener('dragover', (e) => {
    if (!pasta) return;
    const l = e.target.closest?.('[data-pasta]');
    raiz.querySelectorAll('.mk-pasta.is-sobre').forEach((x) => x !== l && x.classList.remove('is-sobre'));
    if (!l || l.dataset.pastaGrupo !== pasta.grupo || l.dataset.pasta === pasta.id) return;
    e.preventDefault();
    l.classList.add('is-sobre');
  });
  raiz.addEventListener('drop', (e) => {
    if (!pasta) return;
    const l = e.target.closest?.('[data-pasta]');
    const de = pasta.id;
    pasta = null;
    if (!l || l.dataset.pasta === de) return;
    e.preventDefault();
    mudarPastas((lista) => {
      const i = lista.findIndex((x) => x.id === de);
      const alvo = lista.findIndex((y) => y.id === l.dataset.pasta);
      const [x] = lista.splice(i, 1);
      const j = lista.findIndex((y) => y.id === l.dataset.pasta);
      lista.splice(i < alvo ? j + 1 : j, 0, x); // descendo, entra depois da pasta de destino; subindo, antes
    });
  });
  document.addEventListener('dragend', () => { pasta = null; raiz?.querySelectorAll('.mk-pasta.is-pego, .mk-pasta.is-sobre').forEach((x) => x.classList.remove('is-pego', 'is-sobre')); });

  // grade: arrastar o cartão para outra posição ou outro dia
  let pego = null;
  raiz.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[data-g-enc]');
    if (!el) return;
    pego = el.dataset.gEnc.split('|').map(Number);
    e.dataTransfer.setData('text/plain', el.dataset.gEnc);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-pego');
  });
  document.addEventListener('dragend', () => { pego = null; raiz.querySelectorAll('.is-pego, .is-sobre').forEach((x) => x.classList.remove('is-pego', 'is-sobre')); });
  raiz.addEventListener('dragover', (e) => {
    if (!pego) return;
    const d = e.target.closest?.('[data-g-dia]');
    raiz.querySelectorAll('.is-sobre').forEach((x) => x !== d && x.classList.remove('is-sobre'));
    if (!d) return;
    e.preventDefault();
    d.classList.add('is-sobre');
  });
  raiz.addEventListener('drop', (e) => {
    const d = e.target.closest?.('[data-g-dia]');
    if (!pego || !d) return;
    e.preventDefault();
    const [dow, pos] = pego;
    const novo = Number(d.dataset.gDia);
    const antes = e.target.closest('[data-g-enc]');
    let alvo = antes ? Number(antes.dataset.gEnc.split('|')[1]) : null;
    pego = null;
    mudarGrade(ui.plat, (sem) => {
      const [x] = sem[dow].splice(pos, 1);
      if (alvo != null && novo === dow && alvo > pos) alvo--;
      if (alvo == null) sem[novo].push(x); else sem[novo].splice(alvo, 0, x);
    });
  });
}

/** A fase do documento (seção 02), já no formato da versão 2. */
function normalizarFaseDoc(fase) {
  const doc = plano.GRADE_PADRAO[fase];
  const tipos = plano.formato('instagram', 'post')?.tipos || [];
  const conv = (sem) => sem && sem.map((dia) => dia.map((e) => (e.formato === 'reel'
    ? { formato: 'reel', tipo: String(e.rotulo).toLowerCase(), nucleo: e.nucleo }
    : { formato: 'post', tipo: tipos.find((t) => t.nome === e.rotulo)?.id || '', nucleo: e.nucleo })));
  return { A: conv(doc.A), B: conv(doc.B) };
}
