// ==========================================================================
// Plano Geral de Trabalho — aba "Linha": o PGT como sistema de nós sobre uma régua de datas
// (desenho em universo-visualizacao-nos.md, ensaios 3 a 7).
//
//   * Nós = entregas e eventos do serviço escolhido, na sequência do PGT (fases do fluxo, etapas, passos).
//   * Datas de referência: começa no primeiro dia útil de 1º de janeiro do ano corrente.
//     Prazos em turnos (1 dia = 2 turnos) contados de segunda a sexta; o fim de semana fica livre.
//     Sem prazo no PGT: 1 dia (marcado "sem prazo"). Tempo do cliente: 3 dias úteis; de terceiros: 7
//     (marcados "estimado"). Evento pontual: ocupa o dia e termina no dia seguinte.
//   * Régua: só as datas com marco, espaço fixo entre elas; faixa de compressão (verde → vermelho
//     conforme os dias úteis saltados até a data seguinte, com "+Nd" em dias corridos).
//   * Camadas: estúdio · cliente · outros. 1ª linha = interação com o cliente (e de visibilidade);
//     2ª linha = interação com terceiros. Reuniões pontuais pousam sobre a linha dos atores; com os três,
//     o cartão atravessa a faixa do cliente e toca as duas linhas.
//   * Cor: borda = fase; preenchimento = situação (no PGT, tudo previsto: branco). Reto = entrega,
//     arredondado = evento; tracejado = opcional ou suspenso por uma decisão.
//   * Decisão: os botões simulam o resultado (não grava): o caminho esperado tira os cartões suspensos;
//     o que os libera concretiza-os. ↺ desfaz.
//   * Recolher etapa ou fase (clique na faixa de cima), fios destacados ao selecionar, minimapa,
//     ver como cliente. Duplo clique leva ao cartão na aba de edição.
//   * o desenho (escala compacta ou extensa, pistas, fios, régua, seleção, laço, + no fio, minimapa)
//     passou para o motor comum linha-nos.js, que também desenha a Linha do Escopo do projeto. Aqui ficam o
//     modelo do PGT, o miolo dos cartões (pertinência, prazo, materiais, cadeado), o popup e a barra de seleção.
// Usa as globais da página: D, ENC, ehEnt, escHtml, nomeDe, TIPOS_EVT, irAoCartao, materiaisDe, fmtPrazo; e LinhaNos.
// ==========================================================================

const LN_CHAVE = 'pgt:linha';
const LN = (() => {
  let g = {};
  try { g = JSON.parse(sessionStorage.getItem(LN_CHAVE) || '{}'); } catch (_) { /* sem armazenamento */ }
  return { srv: g.srv || '', opcionais: !!g.opcionais, cliente: !!g.cliente, recolhidas: new Set(g.recolhidas || []), decisoes: g.decisoes || {},
    modo: g.modo === 'extenso' ? 'extenso' : 'compacto', dia: g.dia || 0, sel: null, rolagem: null, selecao: new Set(), selSrv: new Set() };
})();
function lnGuardar() {
  try {
    sessionStorage.setItem(LN_CHAVE, JSON.stringify({ srv: LN.srv, opcionais: LN.opcionais, cliente: LN.cliente,
      recolhidas: [...LN.recolhidas], decisoes: LN.decisoes, modo: LN.modo, dia: LN.dia }));
  } catch (_) { /* sem armazenamento */ }
}

// cores das fases (borda); as que não estiverem aqui seguem a lista por ordem
const LN_COR_FASE = { pfa_conceitual: '#1D9E75', pfa_legal: '#D85A30', pfa_executiva: '#7F77DD', pfa_obra: '#BA7517', pfa_ilhas: '#888780' };
const LN_CORES = ['#1D9E75', '#D85A30', '#7F77DD', '#BA7517', '#C2577F', '#3B8C9E', '#888780'];
const lnCorFase = (fa) => LN_COR_FASE[fa.id] || LN_CORES[D.fases.indexOf(fa) % LN_CORES.length];

// ---------------------------------------------------------------- calendário (dias úteis = seg a sex)
const LN_DIA = 86400000;
const lnData = (a, m, d) => Date.UTC(a, m, d);
const lnUtil = (t) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6; };
const lnProxUtil = (t) => { while (!lnUtil(t)) t += LN_DIA; return t; };
// consome n dias úteis a partir de t (útil) e devolve o dia útil seguinte (início do próximo passo)
function lnSomarUteis(t, n) { for (let i = 0; i < n; i++) t = lnProxUtil(t + LN_DIA); return t; }
function lnUteisEntre(a, b) { let n = 0; for (let t = a; t < b; t += LN_DIA) if (lnUtil(t)) n++; return n; }
const LN_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const LN_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const lnDM = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const lnDataLonga = (t) => `${LN_SEM[new Date(t).getUTCDay()]} ${lnDM(t)}`;

// ---------------------------------------------------------------- modelo: passos do serviço com datas
const LN_DIAS_CLIENTE = 3;
const LN_DIAS_TERCEIROS = 7;

function lnAtor(x) {
  if (ehEnt(x)) return 'est';
  if (x.tempo === 'estudio') return 'est';
  if (x.tempo === 'cliente') return 'cli';
  if (x.tempo === 'terceiros') return 'out';
  if (x.cliente && x.terceiros) return 'tres';
  if (x.cliente) return 'l1';
  if (x.terceiros) return 'l2';
  return 'est';
}
function lnDuracao(x) {
  if (ehEnt(x) || x.tempo === 'estudio') {
    const t = x.prazo_turnos;
    return { dias: t ? Math.max(1, Math.ceil(t / 2)) : 1, semPrazo: !t };
  }
  if (x.tempo === 'cliente') return { dias: LN_DIAS_CLIENTE, estimado: true };
  if (x.tempo === 'terceiros') return { dias: LN_DIAS_TERCEIROS, estimado: true };
  return { dias: 1, pontual: true };
}

// Serviços que a Linha oferece: a página diz (o Plano do fluxo oferece só os serviços em fluxo).
const lnServicos = () => (typeof servicosDaLinha === 'function' ? servicosDaLinha() : D.servicos);
function lnModelo() {
  const SV = lnServicos();
  const srv = LN.srv && SV.some((s) => s.id === LN.srv) ? LN.srv : SV[0]?.id;
  LN.srv = srv;
  const pertEtapa = (e) => e.servicos[srv]?.pertinencia;
  const cabe = (e) => pertEtapa(e) === 'P' || (LN.opcionais && pertEtapa(e) === 'O');
  // serviço em fluxo: as fases encadeadas (etapas sem dono); serviço em ilha: as etapas dele (0022)
  const ilha = D.servicos.find((s) => s.id === srv)?.dinamica === 'ilha';
  let fases = ilha ? D.fases.filter((fa) => fa.solta) : D.fases.filter((fa) => !fa.solta);
  const etapas = D.etapas.filter((e) => fases.some((fa) => fa.id === e.fase_id) && (ilha ? e.servico_id === srv : !e.servico_id) && cabe(e));
  fases = fases.filter((fa) => etapas.some((e) => e.fase_id === fa.id));
  // quem cada decisão libera
  const liberadoPor = {};
  for (const v of D.eventos) for (const r of v.decisao || []) for (const id of r.libera) liberadoPor[id] = { ev: v, res: r };

  const nos = []; const passos = [];      // passos = [[ids que correm juntos], …] na ordem
  const inicio = lnProxUtil(lnData(new Date().getFullYear(), 0, 1));
  let cursor = inicio;
  const enc = ENC();
  const ultimaComEnc = enc ? [...etapas].reverse().find((e) => (enc.instancias || []).includes(e.id)) : null;
  for (const e of etapas) {
    const fa = faseDe(e.fase_id);
    const etapaOpcional = pertEtapa(e) === 'O';
    const vale = (x) => { const p = x.servicos[srv]; return p === 'P' || p === 'S' || (LN.opcionais && p === 'O'); };
    const lista = D.seq[e.id].filter((x) => {
      if (!x.servicos[srv]) return false;
      const lib = liberadoPor[x.id];
      if (lib && vale(lib.ev)) return true;                   // possível: aparece (suspenso) se a decisão aparece
      return vale(x);
    });
    if (enc && ultimaComEnc && ultimaComEnc.id === e.id && enc.servicos[srv]) lista.push(enc);
    let grupo = null;
    for (const x of lista) {
      const lib = liberadoPor[x.id];
      let susp = '';
      if (lib) {
        const r = LN.decisoes[lib.ev.id];
        if (!r) susp = 'pendente'; else if (r === lib.res.id) susp = 'liberado'; else continue;   // outro resultado: some
      }
      const d = lnDuracao(x);
      const no = { id: x.id, x, ent: ehEnt(x), etapa: e, fase: fa, ator: lnAtor(x), dias: d.dias,
        semPrazo: !!d.semPrazo, estimado: !!d.estimado, pontual: !!d.pontual,
        opcional: etapaOpcional || x.servicos[srv] === 'O', susp, lib };
      if (no.ent && x.junto_anterior && grupo && grupo.etapa === e.id) {          // corre junto com a anterior
        no.ini = grupo.ini; no.fim = lnSomarUteis(grupo.ini, no.dias);
        grupo.ids.push(no.id); grupo.fim = Math.max(grupo.fim, no.fim); cursor = grupo.fim;
      } else {
        no.ini = cursor; no.fim = lnSomarUteis(cursor, no.dias); cursor = no.fim;
        grupo = no.ent ? { etapa: e.id, ini: no.ini, fim: no.fim, ids: [no.id] } : null;
        passos.push(grupo ? grupo.ids : [no.id]);
      }
      nos.push(no);
    }
  }
  return { srv, fases, etapas, nos, passos, inicio, fim: cursor };
}

// ---------------------------------------------------------------- desenho
const lnIconeTipo = (x) => {
  if (ehEnt(x)) return '';
  if (x.decisao) return ICONE.decisao;
  if (x.cliente && x.terceiros) return ICONE.terceiros;
  if (x.cliente) return ICONE.cliente;
  if (x.terceiros) return ICONE.terceiros;
  return '';
};
function lnTitulo(n) {
  if (n.resumo) return `${n.nome}\n${n.n} passos · ${lnDataLonga(n.ini)} → ${lnDataLonga(n.fim)}\nClique na faixa da etapa para expandir.`;
  const x = n.x;
  const tipo = n.ent ? 'Entrega' : x.encerramento ? 'Encerramento' : nomeDe(TIPOS_EVT, x.tipo);
  const dur = n.pontual ? 'pontual' : `${n.dias} dia${n.dias > 1 ? 's' : ''} úte${n.dias > 1 ? 'is' : 'il'}${n.semPrazo ? ' (sem prazo no PGT)' : n.estimado ? ' (estimado)' : ''}`;
  const quem = { est: 'estúdio', cli: 'tempo do cliente', out: 'tempo de terceiros', l1: 'estúdio + cliente', l2: 'estúdio + terceiros', tres: 'estúdio + cliente + terceiros' }[n.ator];
  return [`${x.codigo} · ${tipo}`, x.texto || x.nome, `${lnDataLonga(n.ini)} → ${lnDataLonga(n.fim)} · ${dur}`, quem,
    n.opcional ? 'Opcional neste serviço' : '', n.susp === 'pendente' ? `Suspenso até ${n.lib.ev.codigo}: entra com «${n.lib.res.nome}»` : '',
    n.susp === 'liberado' ? `Liberado por ${n.lib.ev.codigo} («${n.lib.res.nome}»)` : '', 'Duplo clique: abrir na edição'].filter(Boolean).join('\n');
}
// botões do cartão na visão geral: pertinência no serviço da Linha, prazo (− +), materiais, abrir, cadeado
const LN_PERT_PROX = { P: 'O', O: '', '': 'P' };
function lnPrazoCurto(t) {
  if (!t) return 'sem prazo';
  return fmtPrazo(t);
}
const LN_IC = {
  menos: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  mais: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  desfaz: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4.5 5.5H9a2.5 2.5 0 0 1 0 5H6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.5 3.5 4.5 5.5l2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// comandos do cartão, sempre em caixa: pertinência no serviço da Linha, prazo (− +), materiais, abrir, cadeado
function lnAcoes(n) {
  const x = n.x;
  const trv = travado(x.id);
  const dis = trv ? 'disabled' : '';
  const p = x.servicos[LN.srv] || '';
  const temPrazo = n.ent || x.tempo === 'estudio';
  const mats = materiaisDe(x.id).length;
  const sigla = escHtml(D.servicos.find((s) => s.id === LN.srv)?.sigla || '');
  return `<div class="ln-cmd">
    ${x.encerramento ? '<span class="pg-caixa pert-txt pert-S" title="Perpétuo: vale sempre">∞</span>'
      : `<button type="button" class="pg-caixa pert-txt${p === 'P' ? ' is-on' : p === 'O' ? ' pert-O' : ''}" data-ac="pert|${x.id}" ${dis} title="Pertinência em ${sigla}: ${escHtml(nomeDe(PERTINENCIAS, p))} (clique: P → O → —)" aria-label="Pertinência em ${sigla}">${p || '—'}</button>`}
    ${temPrazo ? `<span class="ln-cmd__dur"><button type="button" class="pg-caixa" data-ac="menos|${x.id}" ${dis} title="Encurtar" aria-label="Encurtar">${LN_IC.menos}</button><b title="Prazo no PGT">${lnPrazoCurto(x.prazo_turnos)}</b><button type="button" class="pg-caixa" data-ac="mais|${x.id}" ${dis} title="Alongar" aria-label="Alongar">${LN_IC.mais}</button></span>`
      : `<span class="ln-no__datas">${n.pontual ? 'pontual' : `${n.dias} dias ~`}</span>`}
    <span class="ln-cmd__dir">
      <button type="button" class="pg-caixa" data-ac="mat|${x.id}" title="${mats ? `${mats} material(is): abrir para ler` : 'Sem materiais: abrir para acrescentar'}" aria-label="Materiais">${ICONE.clipe}${mats ? `<span class="n">${mats}</span>` : ''}</button>
      <button type="button" class="pg-caixa" data-ac="abrir|${x.id}" title="Abrir (ou duplo clique)" aria-label="Abrir">${ICONE.lapis}</button>
      <button type="button" class="pg-caixa${trv ? ' is-on' : ''}" data-ac="trava|${x.id}" ${!x.travado && trv ? 'disabled' : ''} title="${trv ? (x.travado ? 'Destravar' : 'Travado pela etapa ou fase') : 'Travar'}" aria-label="Cadeado">${trv ? ICONE.cadeado : ICONE.aberto}</button>
    </span></div>`;
}
// miolo do cartão (o motor põe a caixa, a posição e a cor da fase)
function lnMiolo(n) {
  const x = n.x;
  const dur = n.pontual ? '' : `${n.dias}d${n.semPrazo ? '*' : n.estimado ? '~' : ''}`;
  const tags = [n.susp === 'pendente' ? `<span class="ln-tag--susp">suspenso · ${escHtml(n.lib.ev.codigo)} → ${escHtml(n.lib.res.nome)}</span>` : '',
    n.susp === 'liberado' ? `<span class="ln-tag--lib">liberado · ${escHtml(n.lib.res.nome)}</span>` : '',
    n.opcional && !n.susp ? '<span>opcional</span>' : ''].filter(Boolean);
  let dec = '';
  if (x.decisao) {
    const r = LN.decisoes[x.id];
    dec = `<div class="ln-dec">${x.decisao.map((res, i) => `<button type="button" class="ln-dec__b${r === res.id ? ' is-on' : ''}${i === 0 ? ' is-esperado' : ''}" data-dec="${x.id}|${res.id}" title="${escHtml(res.nome)} · ${i === 0 ? 'caminho esperado' : res.libera.length ? `libera ${res.libera.map(codigoDe).join(', ')}` : 'sem cartões relacionados'}">${escHtml(res.nome)}</button>`).join('')}
      ${r ? `<button type="button" class="ln-dec__b ln-dec__desfaz" data-dec="${x.id}|" title="Desfazer a decisão" aria-label="Desfazer a decisão">${LN_IC.desfaz}</button>` : ''}</div>`;
  }
  return `<div class="ln-no__cab"><span class="ln-no__cod">${lnIconeTipo(x)}${escHtml(x.codigo)}</span><span>${dur}</span></div>
    <div class="ln-no__nome">${escHtml(x.texto || x.nome)}</div>
    ${tags.length ? `<div class="ln-no__pe">${tags.join('')}</div>` : ''}${dec}${lnAcoes(n)}`;
}

// ---------------------------------------------------------------- desenho (pelo motor comum)
function desenharLinha() {
  const el = document.getElementById('linha');
  if (!el || !D || el.closest('[data-painel]')?.hidden) return;
  const M = lnModelo();
  const srvNome = D.servicos.find((s) => s.id === M.srv);
  const ano = new Date().getFullYear();
  const total = lnUteisEntre(M.inicio, M.fim);
  const semPrazo = M.nos.filter((n) => n.semPrazo).length;
  const decisoesPendentes = M.nos.filter((n) => n.x.decisao && !LN.decisoes[n.x.id]).length;
  const chave = (id, on, rot, dica) => `<button type="button" class="u-botao ln-chave" id="${id}" aria-pressed="${on}" title="${dica}">${rot}</button>`;
  el.innerHTML = `<div class="ln-barra">
      <select id="ln-srv" aria-label="Serviço">${lnServicos().map((s) => `<option value="${s.id}" ${s.id === M.srv ? 'selected' : ''}>${escHtml(s.sigla + ' · ' + s.nome)}</option>`).join('')}</select>
      ${LinhaNos.seletorModo(LN)}
      ${chave('ln-opc', LN.opcionais, 'Mostrar opcionais', 'Mostra também o que é opcional neste serviço')}
      ${chave('ln-cli', LN.cliente, 'Ver como cliente', 'Esconde a camada do estúdio')}
      <button type="button" class="u-botao" id="ln-rec">${LN.recolhidas.size ? 'Abrir tudo' : 'Recolher etapas'}</button>
      ${Object.keys(LN.decisoes).length ? '<button type="button" class="u-botao" id="ln-dec0">Desfazer decisões</button>' : ''}
      <span class="ln-resumo small muted">Referência: início em ${lnDataLonga(M.inicio)}/${ano} · ${total} dias úteis até ${lnDataLonga(M.fim)}
        ${semPrazo ? ` · <span title="Passos sem prazo no PGT contam 1 dia">${semPrazo} sem prazo*</span>` : ''}${decisoesPendentes ? ` · ${decisoesPendentes} ${decisoesPendentes > 1 ? 'decisões' : 'decisão'} em aberto` : ''}</span>
    </div><div id="ln-motor"></div>`;
  const redesenhar = () => { lnGuardar(); desenharLinha(); };
  el.querySelector('#ln-srv').onchange = (ev) => { LN.srv = ev.target.value; LN.recolhidas.clear(); LN.sel = null; LN.rolagem = null; redesenhar(); };
  el.querySelector('#ln-opc').onclick = () => { LN.opcionais = !LN.opcionais; redesenhar(); };
  el.querySelector('#ln-cli').onclick = () => { LN.cliente = !LN.cliente; LN.sel = null; redesenhar(); };
  el.querySelector('#ln-rec').onclick = () => {
    if (LN.recolhidas.size) LN.recolhidas.clear(); else M.etapas.forEach((e) => LN.recolhidas.add(e.id));
    redesenhar();
  };
  const d0 = el.querySelector('#ln-dec0');
  if (d0) d0.onclick = () => { LN.decisoes = {}; redesenhar(); };
  LinhaNos.ligarModo(el, LN, redesenhar);
  const porId = Object.fromEntries(M.nos.map((n) => [n.id, n]));
  const nos = M.nos.map((n) => ({
    id: n.id, ini: n.ini, fim: n.fim, ator: n.ator, ent: n.ent, destaque: n.susp === 'pendente',
    fase: { id: n.fase.id, nome: n.fase.nome, cor: lnCorFase(n.fase) }, etapa: { id: n.etapa.id, sigla: n.etapa.sigla, nome: n.etapa.nome },
    cls: [n.x.encerramento ? 'ln-no--enc' : '', n.x.decisao ? 'ln-no--dec' : '', n.opcional || n.susp === 'pendente' ? 'is-tracejado' : '', n.susp === 'pendente' ? 'is-suspenso' : ''].filter(Boolean).join(' '),
    titulo: lnTitulo(n), html: lnMiolo(n),
  }));
  const gatilhos = [];
  for (const n of M.nos) for (const r of n.x.decisao || []) for (const id of r.libera) if (porId[id]) gatilhos.push({ de: n.id, para: id, rotulo: r.nome });
  LinhaNos.desenhar(el.querySelector('#ln-motor'), {
    estado: LN, recolhidas: LN.recolhidas, nos, passos: M.passos, gatilhos, hoje: null, util: lnUtil, cliente: LN.cliente,
    vazio: `<div class="vazio"><p>Nada do PGT vale para ${escHtml(srvNome?.nome || 'este serviço')}${LN.opcionais ? '' : ' (sem os opcionais)'}.</p></div>`,
    aoMudar: redesenhar,
    aoAbrir: (id) => { if (porId[id]) lnAbrirModal(id); },
    aoSelecao: lnDesenharBarraSelecao,
    podeNovo: (id) => { const no = porId[id]; return no && !no.x.encerramento ? id : null; },
    aoNovoNoFio: (id, pt, tela) => lnNovoNoFio(M, porId[id], pt, tela),
    aoLigar: (tela) => {
      tela.querySelectorAll('[data-ac]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); lnAcao(...b.dataset.ac.split('|')); });
      tela.querySelectorAll('[data-dec]').forEach((b) => b.onclick = (ev) => {
        ev.stopPropagation();
        const [id, r] = b.dataset.dec.split('|');
        if (!r || LN.decisoes[id] === r) delete LN.decisoes[id]; else LN.decisoes[id] = r;
        redesenhar();
      });
    },
    legenda: `<span><i class="ln-am ln-am--ent"></i> entrega</span><span><i class="ln-am ln-am--evt"></i> evento</span>
      <span><i class="ln-am ln-am--trac"></i> opcional ou suspenso</span><span>${ICONE.decisao} decisão (os botões simulam o resultado)</span>
      <span><i class="ln-am ln-am--grupo"></i> correm juntas</span><span><i class="ln-am ln-am--gat"></i> gatilho</span>
      <span>borda = fase: ${M.fases.map((fa) => `<b style="color:${lnCorFase(fa)}">${escHtml(fa.nome)}</b>`).join(' · ')}</span>
      <span>vários: Ctrl+clique ou arraste no vazio · Esc limpa</span>
      <span>* sem prazo no PGT (1 dia) · ~ estimado (cliente ${LN_DIAS_CLIENTE}, terceiros ${LN_DIAS_TERCEIROS} dias úteis)</span>
      <span>Extenso: Ctrl + roda muda a largura do dia</span>`,
  });
}

// ---------------------------------------------------------------- criar cartão sobre o fio
// O + aparece no meio do fio; o cartão novo entra logo depois do cartão de onde o fio sai (na etapa dele) e
// empurra os seguintes. Vale para o serviço da Linha (P).
function lnNovoNoFio(M, no, pt, tela) {
  if (!no) return;
  tela.querySelector('.ln-novo')?.remove();
  const apos = no.id;
  const box = document.createElement('div');
  box.className = 'ln-novo';
  box.style.left = `${pt.x}px`; box.style.top = `${pt.y}px`;
  box.innerHTML = `<div class="small muted">Depois de <b>${escHtml(no.x.codigo)}</b>, em ${escHtml(no.etapa.sigla)} · vale (P) em ${escHtml(D.servicos.find((s) => s.id === M.srv)?.sigla || '')}</div>
    <select class="ln-novo__tipo" aria-label="Tipo"><option value="entrega">Entrega</option>${TIPOS_EVT.map((t) => `<option value="${t.id}">Evento · ${escHtml(t.nome)}</option>`).join('')}</select>
    <input class="ln-novo__nome" placeholder="Texto da entrega ou nome do evento" aria-label="Nome">
    <div><button type="button" class="u-botao forte">Criar</button> <button type="button" class="u-botao">Cancelar</button></div>`;
  tela.appendChild(box);
  const nome = box.querySelector('.ln-novo__nome'); const tipo = box.querySelector('.ln-novo__tipo');
  const [criar, cancelar] = box.querySelectorAll('button');
  nome.focus();
  const fechar = () => { box.remove(); };
  cancelar.onclick = fechar;
  const enviar = async () => {
    const t = nome.value.trim();
    if (!t) { nome.focus(); return; }
    criar.disabled = true;
    try {
      const servicos = { [M.srv]: 'P' };
      const etapa = no.etapa.id;
      const tp = tipo.value;
      const r = tp === 'entrega'
        ? await Universo.criar('pgt-entregaveis', { etapa_id: etapa, texto: t, servicos })
        : await Universo.criar('pgt-eventos', { etapa_id: etapa, nome: t, tipo: tp, servicos,
          cliente: ['reuniao', 'apresentacao', 'aprovacao', 'visita'].includes(tp) ? 1 : 0,
          tempo: tp === 'aprovacao' ? 'cliente' : ['ajuste', 'revisao'].includes(tp) ? 'estudio' : 'pontual' });
      const ids = D.seq[etapa].map((x) => x.id);
      ids.splice(ids.indexOf(apos) + 1, 0, r.id);
      await Universo.post('pgt/sequencia', { etapa_id: etapa, ids });
      esquecerDaFila((op) => op.tipo === 'sq' && op.grupo === etapa);
      LN.sel = r.id;
      aviso(''); await recarregar();
    } catch (err) { aviso(mensagemDe(err)); criar.disabled = false; }
  };
  criar.onclick = enviar;
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); if (e.key === 'Escape') fechar(); });
}


// ---------------------------------------------------------------- popup do cartão (duplo clique)
// O cartão inteiro, em edição, à esquerda (o mesmo da aba de edição, só com a coluna do serviço da Linha);
// à direita, os materiais com link abertos para leitura (Drive e Google Docs em modo de visualização).
// Grande o bastante para ler documentos sem redimensionar.
function lnAbrirModal(id) {
  if (!(entDe(id) || evtDe(id))) return;
  LN.modal = id; LN.mat = null;
  EDITANDO.add(id);
  lnDesenharModal();
}
function lnFecharModal() {
  if (!LN.modal) return;
  EDITANDO.delete(LN.modal);
  LN.modal = null;
  document.getElementById('ln-modal')?.remove();
  document.body.classList.remove('ln-modal-aberto');
  desenharPlano();
}
// link de leitura: Drive e Google Docs em /preview; o resto como veio
function lnPrevia(url) {
  try {
    const u = new URL(url);
    let m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (u.hostname === 'drive.google.com' && m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    if (u.hostname === 'drive.google.com' && u.searchParams.get('id')) return `https://drive.google.com/file/d/${u.searchParams.get('id')}/preview`;
    m = u.pathname.match(/^\/(document|spreadsheets|presentation|forms)\/d\/([^/]+)/);
    if (u.hostname === 'docs.google.com' && m) return `https://docs.google.com/${m[1]}/d/${m[2]}/${m[1] === 'forms' ? 'viewform?embedded=true' : 'preview'}`;
    return url;
  } catch (_) { return url; }
}
function lnDesenharModal() {
  if (!LN.modal) return;
  const x = entDe(LN.modal) || evtDe(LN.modal);
  if (!x) { LN.modal = null; document.getElementById('ln-modal')?.remove(); document.body.classList.remove('ln-modal-aberto'); return; }
  let raiz = document.getElementById('ln-modal');
  const rolagem = raiz?.querySelector('.lnm-esq')?.scrollTop || 0;
  if (!raiz) {
    raiz = document.createElement('div'); raiz.id = 'ln-modal';
    document.body.appendChild(raiz);
    raiz.addEventListener('mousedown', (ev) => { if (ev.target === raiz.firstElementChild) lnFecharModal(); });
  }
  document.body.classList.add('ln-modal-aberto');
  const e = etapaDe(x.etapa_id); const fa = e ? faseDe(e.fase_id) : null;
  const srv = D.servicos.find((s) => s.id === LN.srv) || lnServicos()[0];
  // o cartão com uma coluna de serviço só (a da Linha); S é a lista de serviços visíveis do plano
  const S0 = S; S = [srv];
  const cartao = x.encerramento ? cartaoEncerramento(x, e) : ehEnt(x) ? cartaoEnt(x, false) : cartaoEvento(x, false);
  S = S0;
  const mats = materiaisDe(x.id);
  const comLink = mats.filter((m) => m.link);
  if (!LN.mat || !comLink.some((m) => m.id === LN.mat)) LN.mat = comLink[0]?.id || null;
  const sel = comLink.find((m) => m.id === LN.mat);
  raiz.innerHTML = `<div class="lnm-fundo"><div class="lnm" role="dialog" aria-modal="true" aria-label="${escHtml(x.codigo)}" style="--fase:${fa ? lnCorFase(fa) : 'var(--linha-forte)'}">
    <header class="lnm-cab"><div><span class="lnm-cod">${escHtml(x.codigo)}</span> ${escHtml(x.texto || x.nome)}
      <span class="small muted">· ${escHtml(fa?.nome || '')} › ${escHtml(e ? e.sigla + ' · ' + e.nome : '')} · coluna: ${escHtml(srv.sigla)}</span></div>
      <button type="button" class="lnm-fechar" aria-label="Fechar" title="Fechar (Esc)">×</button></header>
    <div class="lnm-corpo">
      <section class="lnm-esq"><div class="plano" style="--cols:52px 64px minmax(0,1fr) 196px 36px 40px">${cartao}</div>
        <p class="small muted lnm-nota">As mudanças vão para a barra de "não salvas", como na aba de edição (Ctrl+S salva).</p></section>
      <section class="lnm-dir">
        <div class="lnm-abas">${comLink.length ? comLink.map((m) => `<button type="button" class="lnm-aba${m.id === LN.mat ? ' is-on' : ''}" data-ver="${m.id}">${escHtml(nomeDe(TIPOS_MAT, m.tipo))} · ${escHtml(m.nome)}</button>`).join('') : ''}
          ${sel ? `<a class="btn-link lnm-fora" href="${escHtml(sel.link)}" target="_blank" rel="noopener">abrir em nova aba ↗</a>` : ''}</div>
        ${sel ? `<iframe class="lnm-leitor" src="${escHtml(lnPrevia(sel.link))}" title="${escHtml(sel.nome)}" referrerpolicy="no-referrer"></iframe>`
          : `<div class="lnm-vazio"><p>${mats.length ? 'Os materiais deste cartão ainda não têm link.' : 'Este cartão ainda não tem materiais.'}</p>
            <p class="small muted">Acrescente um material com link (Drive, Google Docs, Biblioteca) no cartão, à esquerda, para lê-lo aqui. O envio de arquivos vem depois.</p></div>`}
      </section>
    </div></div></div>`;
  const esq = raiz.querySelector('.lnm-esq');
  esq.scrollTop = rolagem;
  ligarPlano(esq);
  raiz.querySelector('.lnm-fechar').onclick = lnFecharModal;
  raiz.querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => { LN.mat = b.dataset.ver; lnDesenharModal(); });
  // o link de um material, dentro do popup, abre no leitor ao lado
  esq.querySelectorAll('.card--mat').forEach((c) => {
    const a = c.querySelector('.mat__nome a'); if (!a) return;
    a.onclick = (ev) => { ev.preventDefault(); LN.mat = c.dataset.card; lnDesenharModal(); };
  });
}
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && LN.modal && !ev.target.closest?.('input, textarea, select')) lnFecharModal(); });


// ---------------------------------------------------------------- seleção de vários cartões
// Ctrl/⌘/Shift + clique alterna um cartão; arrastar no vazio desenha uma caixa (com Ctrl/Shift, soma
// à seleção). A barra de baixo aplica a todos: pertinência nos serviços marcados, prazo, correr juntas,
// cadeado e arquivar. As mudanças vão para a fila de "não salvas" (menos arquivar, que grava na hora).
function lnMarcarSelecao(tela = document.querySelector('#linha .lnn-corpo')) {
  for (const id of [...LN.selecao]) if (!(entDe(id) || evtDe(id))) LN.selecao.delete(id);
  tela?.querySelectorAll('.ln-no').forEach((c) => c.classList.toggle('is-multi', LN.selecao.has(c.dataset.no)));
  lnDesenharBarraSelecao();
}
function lnDesenharBarraSelecao() {
  const el = document.getElementById('ln-selbar');
  if (!el) return;
  const linhaVisivel = !document.getElementById('linha')?.closest('[data-painel]')?.hidden;
  const ids = [...LN.selecao];
  el.hidden = !ids.length || !linhaVisivel;
  if (el.hidden) return;
  if (!LN.selSrv.size || ![...LN.selSrv].every((s) => lnServicos().some((x) => x.id === s))) LN.selSrv = new Set([LN.srv || lnServicos()[0].id]);
  const ents = ids.filter((id) => entDe(id)); const evs = ids.filter((id) => evtDe(id));
  const pertDe = (id, srv) => (entDe(id) || evtDe(id)).servicos[srv] || '';
  const resumoPert = (srv) => {          // como está hoje no serviço: tudo P, tudo O, misto…
    const ps = new Set(ids.filter((id) => !evtDe(id)?.encerramento).map((id) => pertDe(id, srv)));
    return ps.size === 1 ? ({ P: 'P', O: 'O', '': '—', S: '∞' })[[...ps][0]] : 'misto';
  };
  el.innerHTML = `<strong>${ids.length} selecionado${ids.length > 1 ? 's' : ''}</strong>
    <span class="small" style="opacity:.8">${ents.length} entrega${ents.length === 1 ? '' : 's'} · ${evs.length} evento${evs.length === 1 ? '' : 's'}</span>
    <span class="ln-sel__grupo">Serviços ${lnServicos().map((s) => `<button type="button" class="ln-sel__srv${LN.selSrv.has(s.id) ? ' is-on' : ''}" data-sel-srv="${s.id}" title="${escHtml(s.nome)} · hoje: ${resumoPert(s.id)}">${escHtml(s.sigla)}</button>`).join('')}</span>
    <span class="ln-sel__grupo">Pertinência
      <button type="button" class="btn btn--small" data-sel-pert="P" title="Vem marcado nos serviços escolhidos">P</button>
      <button type="button" class="btn btn--small" data-sel-pert="O" title="Opcional nos serviços escolhidos">O</button>
      <button type="button" class="btn btn--small" data-sel-pert="" title="Não se aplica nos serviços escolhidos">—</button></span>
    <span class="ln-sel__grupo"><select id="ln-sel-prazo" aria-label="Prazo"><option value="">prazo…</option>${PRAZOS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}<option value="0">sem prazo</option></select></span>
    <span class="ln-sel__grupo">${ents.length > 1 ? '<button type="button" class="btn-link" data-sel="juntas">correr juntas</button><button type="button" class="btn-link" data-sel="separar">separar</button>' : ''}
      ${ids.length === 2 ? '<button type="button" class="btn-link" data-sel="inverter" title="Os dois trocam de lugar na sequência da etapa (e de código)">inverter a ordem</button>' : ''}
      <button type="button" class="btn-link" data-sel="travar">travar</button><button type="button" class="btn-link" data-sel="destravar">destravar</button>
      <button type="button" class="btn-link" data-sel="arquivar">arquivar</button>
      <button type="button" class="btn-link" data-sel="todos">selecionar todos da linha</button>
      <button type="button" class="btn-link" data-sel="limpar">limpar (Esc)</button></span>`;
  el.querySelectorAll('[data-sel-srv]').forEach((b) => b.onclick = () => {
    const s = b.dataset.selSrv;
    LN.selSrv.has(s) ? LN.selSrv.delete(s) : LN.selSrv.add(s);
    lnDesenharBarraSelecao();
  });
  el.querySelectorAll('[data-sel-pert]').forEach((b) => b.onclick = () => lnSelAplicar('pert', b.dataset.selPert));
  el.querySelector('#ln-sel-prazo').onchange = (ev) => { if (ev.target.value !== '') lnSelAplicar('prazo', Number(ev.target.value)); };
  el.querySelectorAll('[data-sel]').forEach((b) => b.onclick = () => lnSelAplicar(b.dataset.sel));
}
async function lnSelAplicar(acao, valor) {
  const ids = [...LN.selecao];
  const livres = ids.filter((id) => !travado(id));
  const pulados = ids.length - livres.length;
  const fim = (msg) => { ordenar(D); derivar(D); desenhar(); if (msg) aviso(msg, 'ok'); };
  if (acao === 'limpar') { LN.selecao.clear(); lnMarcarSelecao(document.querySelector('.ln-tela')); return; }
  if (acao === 'todos') {
    document.querySelectorAll('.ln-tela .ln-no').forEach((c) => { if (!c.dataset.no.startsWith('sum:')) LN.selecao.add(c.dataset.no); });
    lnMarcarSelecao(document.querySelector('.ln-tela')); return;
  }
  const aviso2 = pulados ? ` ${pulados} travado${pulados > 1 ? 's' : ''} ficou de fora.` : '';
  if (acao === 'pert') {
    if (!LN.selSrv.size) { aviso('Escolha ao menos um serviço na barra.'); return; }
    let n = 0;
    for (const id of livres) {
      const ent = entDe(id); const ev = evtDe(id);
      if (ev?.encerramento) continue;
      for (const srv of LN.selSrv) { mudar(ent ? { tipo: 'pn', ent: id, srv, p: valor } : { tipo: 'pe', ev: id, srv, p: valor }); n++; }
    }
    return fim(`Pertinência ${valor || '—'} em ${livres.length} cartão(ões) × ${LN.selSrv.size} serviço(s). Falta salvar.${aviso2}`);
  }
  if (acao === 'prazo') {
    const alvo = livres.filter((id) => entDe(id) || evtDe(id)?.tempo === 'estudio');
    alvo.forEach((id) => mudar({ tipo: 'ed', id, campos: { prazo_turnos: valor || null } }));
    const fora = livres.length - alvo.length;
    return fim(`Prazo em ${alvo.length} cartão(ões).${fora ? ` ${fora} evento(s) sem tempo do estúdio ficaram de fora.` : ''} Falta salvar.${aviso2}`);
  }
  if (acao === 'juntas' || acao === 'separar') {
    let n = 0;
    for (const id of livres.filter((x) => entDe(x))) {
      const x = entDe(id); const seq = D.seq[x.etapa_id]; const i = seq.findIndex((y) => y.id === id);
      const antes = seq[i - 1];
      const junto = acao === 'juntas' ? (antes && ehEnt(antes) && LN.selecao.has(antes.id) ? 1 : 0) : 0;
      if ((x.junto_anterior || 0) !== junto && (acao === 'separar' || junto)) { mudar({ tipo: 'ed', id, campos: { junto_anterior: junto } }); n++; }
    }
    return fim(n ? `${n} entrega(s) ${acao === 'juntas' ? 'passam a correr junto com a anterior' : 'separadas'}. Falta salvar.${aviso2}`
      : acao === 'juntas' ? 'Só correm juntas entregas seguidas na mesma etapa, todas selecionadas.' : 'Nada a separar.');
  }
  if (acao === 'inverter') {
    // dois cartões da mesma etapa trocam de lugar na sequência; o código acompanha a posição
    const [a, b] = ids.map((id) => entDe(id) || evtDe(id));
    if (ids.length !== 2 || !a || !b) return aviso('Selecione exatamente dois cartões.');
    if (a.encerramento || b.encerramento) return aviso('O Encerramento não muda de lugar.');
    if (a.etapa_id !== b.etapa_id) return aviso('Só se inverte a ordem de cartões da mesma etapa.');
    if (travado(a.id) || travado(b.id)) return aviso('Um dos cartões está travado: destrave para inverter.');
    const seq = D.seq[a.etapa_id].map((y) => y.id);
    const i = seq.indexOf(a.id), j = seq.indexOf(b.id);
    [seq[i], seq[j]] = [seq[j], seq[i]];
    // entre duas entregas, o "correr junto com a anterior" é do lugar, não da entrega
    if (ehEnt(a) && ehEnt(b) && (a.junto_anterior || 0) !== (b.junto_anterior || 0)) {
      mudar({ tipo: 'ed', id: a.id, campos: { junto_anterior: b.junto_anterior || 0 } });
      mudar({ tipo: 'ed', id: b.id, campos: { junto_anterior: a.junto_anterior || 0 } });
    }
    const [ca, cb] = [codigoDe(a.id), codigoDe(b.id)];
    mudar({ tipo: 'sq', grupo: a.etapa_id, ids: seq });
    return fim(`${ca} e ${cb} trocaram de lugar. Falta salvar.`);
  }
  if (acao === 'travar' || acao === 'destravar') {
    ids.forEach((id) => mudar({ tipo: 'ed', id, campos: { travado: acao === 'travar' ? 1 : 0 } }));
    return fim(`${ids.length} cartão(ões) ${acao === 'travar' ? 'travado(s)' : 'destravado(s)'}. Falta salvar.`);
  }
  if (acao === 'arquivar') {
    const alvo = livres.filter((id) => !evtDe(id)?.encerramento);
    if (!alvo.length) return;
    if (!confirm(`Arquivar ${alvo.length} cartão(ões)? Ficam em "Arquivados", no fim da página, e podem ser restaurados.`)) return;
    let ok = 0;
    for (const id of alvo) {
      try { await arquivarRegistro(registroEm(D0, id)); ok++; LN.selecao.delete(id); } catch (e) { aviso(`${codigoDe(id)}: ${mensagemDe(e)}`); }
    }
    esquecerDaFila((op) => alvo.includes(op.ent || op.ev || op.id));
    await recarregar();
    aviso(`${ok} cartão(ões) arquivado(s).${aviso2}`, 'ok');
  }
}
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && LN.selecao.size && !LN.modal && !ev.target.closest?.('input, textarea, select, .ln-novo')) {
    LN.selecao.clear(); lnMarcarSelecao(document.querySelector('.ln-tela'));
  }
});

function lnAcao(acao, id) {
  const x = entDe(id) || evtDe(id);
  if (!x) return;
  if (acao === 'abrir') return lnAbrirModal(id);
  if (acao === 'mat') { lnAbrirModal(id); return; }
  if (acao === 'trava') return mudar({ tipo: 'ed', id, campos: { travado: x.travado ? 0 : 1 } }, { redesenhar: true });
  if (travado(id)) return;
  if (acao === 'pert') {
    const p = LN_PERT_PROX[x.servicos[LN.srv] || ''];
    mudar(ehEnt(x) ? { tipo: 'pn', ent: id, srv: LN.srv, p } : { tipo: 'pe', ev: id, srv: LN.srv, p }, { redesenhar: true });
    if (p !== 'P' && !LN.opcionais) aviso(`${x.codigo} ficou ${p ? 'opcional' : 'fora'} em ${D.servicos.find((s) => s.id === LN.srv).sigla} e saiu da linha${p ? ' (ligue "mostrar opcionais" para vê-lo)' : ''}. Falta salvar.`, 'ok');
    return;
  }
  if (acao === 'menos' || acao === 'mais') {
    const vs = PRAZOS.map(([v]) => v);
    const t = x.prazo_turnos;
    let i = t ? vs.findIndex((v) => v >= t) : -1;
    if (acao === 'mais') i = t ? Math.min(vs.length - 1, (vs[i] === t ? i + 1 : i)) : vs.indexOf(2);
    else i = t ? (vs[i] === t ? i - 1 : i - 1) : -1;
    mudar({ tipo: 'ed', id, campos: { prazo_turnos: i >= 0 ? vs[i] : null } }, { redesenhar: true });
  }
}
