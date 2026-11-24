// ==========================================================================
// Escopo do Projeto — calendário, Linha, Cartões e Alterações.
//
//   * O escopo é a lista de etapas, entregas e eventos contratados (cópia do PGT), cada cartão com a sua duração.
//   * Calendário: início + durações em sequência, em dias úteis (seg–sex; sem feriados por ora); os que correm
//     juntos no mesmo intervalo; a suspensão do projeto congela os dias. "Em andamento" é o que cai em hoje:
//     nenhum estado se marca no cartão.
//   * Ajustes do dia a dia: DURAÇÃO (− / +, à vista no cartão: os seguintes andam junto) e MOVER sem mudar a
//     duração (dentro do cartão: abre um hiato antes dele, ou corre em paralelo para trás).
//   * Suprimir e acrescentar cartões; decisões liberam a rodada prevista (extra previsto).
//   * Tudo o que muda vai para Alterações de escopo (a API junta cliques seguidos em 10 s).
// Usa as globais de base.js (Universo, escHtml, abrirPainel, fecharPainel, avisoEm, mensagemDe).
// ==========================================================================

const ESC_IC = {
  lapis: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6 13.4 5.2 6 12.6 3 13 3.4 10Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  menos: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  mais: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  esq: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 3.5 5 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dir: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M5.5 3.5 9 7l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fechar: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  decisao: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  cliente: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  terceiros: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.2" cy="5.6" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="10.8" cy="5.6" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.6 13c.4-2 1.8-3.2 3.6-3.2S8.4 11 8.8 13M7.2 13c.4-2 1.8-3.2 3.6-3.2s3.2 1.2 3.6 3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  doc: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5Z M9.5 2v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  troca: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 4.5h8.5M8.5 2l2.5 2.5L8.5 7M11.5 9.5H3M5.5 7 3 9.5 5.5 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fora: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8 2.5h3.5V6M11.5 2.5 6.5 7.5M10 8.5v3H2.5V4h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const ESC_DIA = 86400000;
const escDia = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const escISO = (t) => new Date(t).toISOString().slice(0, 10);
const escHoje = () => escDia(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10));
const ESC_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const escDM = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const escDMA = (t) => `${escDM(t)}/${new Date(t).getUTCFullYear()}`;
const escDiaFmt = (s) => (s ? s.split('-').reverse().join('/') : '');
const plural = (n, um, varios) => `${n} ${Math.abs(n) === 1 ? um : varios}`;

// cores das fases (as mesmas da Linha do PGT); borda do cartão = fase
const ESC_COR_FASE = { pfa_conceitual: '#1D9E75', pfa_legal: '#D85A30', pfa_executiva: '#7F77DD', pfa_obra: '#BA7517', pfa_ilhas: '#888780' };
const ESC_CORES = ['#1D9E75', '#D85A30', '#7F77DD', '#BA7517', '#C2577F', '#3B8C9E', '#888780'];

// ---------------------------------------------------------------- montar o escopo a partir do PGT publicado
// cfg = { servicoId, area, categoriaId, etapas: [pet] | null, entregas: { pet: [pen] } | null, clausulas: [pev], semanas: { pet: n } | null }
function escMontar(P, B, cfg) {
  const srv = cfg.servicoId;
  const servico = ((B && B.servicos) || P.servicos || []).find((s) => s.id === srv);
  const faixas = (B && B.faixas_prazo) || [];
  const fx = !(cfg.area > 0) || !faixas.length ? 1 : (faixas.find((f) => f.ate == null || cfg.area <= f.ate) || faixas[faixas.length - 1]).mult || 1;
  const ehEntP = (x) => String(x.id).startsWith('pen_');
  const pertEtapa = (e) => (e.servicos && e.servicos[srv] ? e.servicos[srv].pertinencia || e.servicos[srv] : null);
  const etapasSrv = P.etapas.filter((e) => pertEtapa(e) && (servico?.dinamica === 'ilha' ? e.servico_id === srv : !e.servico_id));
  const escolhidas = cfg.etapas ? etapasSrv.filter((e) => cfg.etapas.includes(e.id)) : etapasSrv.filter((e) => pertEtapa(e) === 'P');
  const liberadoPor = {};
  for (const v of P.eventos) for (const r of (v.decisao || []).slice(1)) for (const id of r.libera || []) liberadoPor[id] = v.id;
  const cls = new Set(cfg.clausulas || []);
  const fases = Object.fromEntries((P.fases || []).map((f) => [f.id, f]));
  const cartoes = [];
  const enc = P.eventos.find((x) => x.encerramento);
  const ultimaComEnc = enc ? [...escolhidas].reverse().find((e) => (enc.instancias || []).includes(e.id)) || escolhidas[escolhidas.length - 1] : null;
  const diasDe = (x) => {
    if (ehEntP(x)) { const t = x.prazo_turnos; return t ? { dias: Math.max(1, Math.ceil((t * (x.prazo_fixo ? 1 : fx)) / 2)) } : { dias: 1, sem: true }; }
    if (x.tempo === 'cliente') return { dias: 3 };
    if (x.tempo === 'terceiros') return { dias: 7 };
    if (x.tempo === 'pontual') return { dias: 1 };
    const t = x.prazo_turnos; return t ? { dias: Math.max(1, Math.ceil(t / 2)) } : { dias: 1, sem: true };
  };
  for (const e of escolhidas) {
    const fa = fases[e.fase_id] || {};
    cartoes.push({ ref: e.id, tipo: 'etapa', origem_id: e.id, sigla: e.sigla, texto: e.nome, fase_id: e.fase_id, fase_nome: fa.nome || '' });
    const passos = [...P.entregaveis.filter((x) => x.etapa_id === e.id), ...P.eventos.filter((x) => x.etapa_id === e.id && !x.encerramento)]
      .sort((a, b) => (a.ordem - b.ordem) || ((ehEntP(a) ? 0 : 1) - (ehEntP(b) ? 0 : 1)) || String(a.id).localeCompare(String(b.id)));
    const etapaCartoes = [];
    for (const x of passos) {
      const p = x.servicos ? x.servicos[srv] : null;
      if (!p) continue;
      const lib = liberadoPor[x.id];
      let entra;
      if (ehEntP(x)) {
        const cat = !cfg.categoriaId || !(x.categorias || []).length || x.categorias.includes(cfg.categoriaId);
        entra = cfg.entregas && cfg.entregas[e.id] ? cfg.entregas[e.id].includes(x.id) : p === 'P' && cat;
      } else {
        entra = p === 'P' || p === 'S' || (p === 'O' && cls.has(x.id)) || !!lib;
      }
      if (!entra) continue;
      const d = diasDe(x);
      etapaCartoes.push({ ref: x.id, tipo: ehEntP(x) ? 'entrega' : 'evento', etapa_ref: e.id, origem_id: x.id, codigo: x.codigo, texto: x.texto || x.nome,
        fase_id: e.fase_id, fase_nome: fa.nome || '', evento_tipo: x.tipo || null, tempo: ehEntP(x) ? null : (x.tempo || 'estudio'),
        cliente: !!x.cliente, terceiros: !!x.terceiros, junto_anterior: ehEntP(x) && !!x.junto_anterior && etapaCartoes[etapaCartoes.length - 1]?.tipo === 'entrega', dias: d.dias, sem_prazo: !!d.sem,
        decisao: x.decisao || null, liberado_por_ref: lib || null });
    }
    // prazo personalizado da etapa (proposta ou "Gerar escopo"): as entregas e os eventos do estúdio se ajustam na proporção
    const alvo = cfg.semanas && cfg.semanas[e.id] ? Math.round(cfg.semanas[e.id] * 5) : 0;
    if (alvo > 0) {
      const seq = etapaCartoes.filter((c) => !c.liberado_por_ref);
      const ajustaveis = seq.filter((c) => c.tipo === 'entrega' || c.tempo === 'estudio');
      const total = escDuracaoDaSequencia(seq);
      if (total > 0 && total !== alvo && ajustaveis.length) {
        const f = alvo / total;
        for (const c of ajustaveis) c.dias = Math.max(1, Math.round(c.dias * f));
      }
    }
    cartoes.push(...etapaCartoes);
    if (enc && ultimaComEnc && ultimaComEnc.id === e.id) {
      cartoes.push({ ref: enc.id, tipo: 'evento', etapa_ref: e.id, origem_id: enc.id, codigo: 'ENC', texto: enc.nome || 'Encerramento', fase_id: e.fase_id,
        fase_nome: fa.nome || '', evento_tipo: 'encerramento', tempo: 'pontual', encerramento: true, dias: 1 });
    }
  }
  return cartoes;
}
// dias de uma sequência de cartões (os que correm juntos contam pela mais longa)
function escDuracaoDaSequencia(lista, soma = false) {
  if (soma) return lista.reduce((t, c) => t + c.dias, 0);
  let t = 0, grupo = 0;
  for (const c of lista) {
    if (c.junto_anterior && grupo) { const g = Math.max(grupo, c.dias); t += g - grupo; grupo = g; }
    else { t += c.dias; grupo = c.dias; }
  }
  return t;
}

// ---------------------------------------------------------------- calendário
// devolve { itens: [{ c, ini, fim, estado }], hiatos: [{ antes, ini, fim, dias }], etapas: [{ c, ini, fim }], inicio, fim, hoje }
function escCalendario(E) {
  const hoje = escHoje();
  const sus = (E.projeto.suspensoes || []).map((s) => ({ de: escDia(s.de), ate: s.ate ? escDia(s.ate) : hoje + ESC_DIA }));
  const util = (t) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6 && !sus.some((s) => t >= s.de && t < s.ate); };
  const prox = (t) => { let n = 0; while (!util(t) && n++ < 4000) t += ESC_DIA; return t; };
  const somar = (t, n) => { for (let i = 0; i < n; i++) t = prox(t + ESC_DIA); return t; };
  const voltar = (t, n) => { for (let i = 0; i < n; i++) { t -= ESC_DIA; let k = 0; while (!util(t) && k++ < 4000) t -= ESC_DIA; } return t; };
  const inicio = prox(escDia(E.projeto.escopo_inicio || E.projeto.inicio || escISO(hoje)));
  const porId = Object.fromEntries(E.cartoes.map((c) => [c.id, c]));
  const ativo = (c) => {
    if (c.suprimido_em) return false;
    if (c.etapa_id && porId[c.etapa_id]?.suprimido_em) return false;
    if (!c.liberado_por) return true;
    const d = porId[c.liberado_por];
    const r = d && (d.decisao || []).find((x) => x.id === d.decisao_resultado);
    return !!(r && r.libera.includes(c.id));
  };
  const itens = []; const hiatos = []; const etapas = [];
  let cursor = inicio;
  for (const et of E.cartoes.filter((c) => c.tipo === 'etapa')) {
    let grupo = null;
    const filhos = E.cartoes.filter((c) => c.etapa_id === et.id);
    const doEtapa = [];
    for (const c of filhos) {
      if (!ativo(c)) continue;
      const base = c.junto_anterior && grupo ? grupo.ini : cursor;     // 0028: eventos também correm juntos
      const ini = c.folga > 0 ? somar(base, c.folga) : c.folga < 0 ? voltar(base, -c.folga) : base;
      if (c.folga > 0) hiatos.push({ antes: c, ini: base, fim: ini, dias: c.folga });
      const fim = somar(ini, c.dias);
      const it = { c, ini, fim, estado: fim <= hoje ? 'feito' : ini <= hoje ? 'hoje' : 'adiante' };
      itens.push(it); doEtapa.push(it);
      if (c.junto_anterior && grupo) { grupo.fim = Math.max(grupo.fim, fim); cursor = grupo.fim; }
      else { cursor = fim; grupo = { ini, fim }; }
    }
    if (doEtapa.length && !et.suprimido_em) etapas.push({ c: et, ini: Math.min(...doEtapa.map((x) => x.ini)), fim: Math.max(...doEtapa.map((x) => x.fim)) });
  }
  const fim = itens.length ? Math.max(...itens.map((x) => x.fim)) : inicio;
  // último dia de trabalho de um item (o fim é o começo do dia útil seguinte)
  const ultimoDia = (t) => voltar(t, 1);
  return { itens, hiatos, etapas, inicio, fim, hoje, ultimoDia, ativo, util, somar, sus };
}
// o que foi contratado: os cartões da proposta com os dias contratados, sem hiatos, sem acréscimos e sem decisões
// (as suspensões ficam: suspensão não é atraso). Serve para o fim contratado e para saber quem foi empurrado.
function escBase(E) {
  const B = { projeto: E.projeto, alteracoes: [], cartoes: E.cartoes.filter((c) => !c.adicionado)
    .map((c) => ({ ...c, dias: c.dias_contratados || c.dias, folga: 0, suprimido_em: null, decisao_resultado: null })) };
  return escCalendario(B);
}
// simula uma mudança e diz quanto ela mexe: quantos cartões mudam de data e o fim novo
function escSimular(E, mudar) {
  const C = { ...E, projeto: { ...E.projeto }, cartoes: E.cartoes.map((c) => ({ ...c })) };
  mudar(C);
  const A = escCalendario(E), N = escCalendario(C);
  const antes = new Map(A.itens.map((x) => [x.c.id, x.ini]));
  let n = 0; for (const x of N.itens) if (antes.get(x.c.id) !== x.ini) n++;
  return { n, fimAntes: A.ultimoDia(A.fim), fimDepois: N.ultimoDia(N.fim) };
}
const escUteis = (a, b, util) => { let n = 0; for (let t = a; t < b; t += ESC_DIA) if (util(t)) n++; return n; };

// ---------------------------------------------------------------- resumo do dia (Ficha)
function escResumo(E) {
  const M = escCalendario(E);
  const hoje = M.itens.filter((x) => x.estado === 'hoje');
  const adiante = M.itens.filter((x) => x.estado === 'adiante').slice(0, 5);
  const aditivos = E.alteracoes.filter((a) => a.natureza === 'aditivo');
  return { M, hoje, adiante, aditivos, fim: M.ultimoDia(M.fim) };
}
const escLinhaCurta = (x, M) => `<li><span class="esc-cod">${escHtml(x.c.codigo || (x.c.adicionado ? 'novo' : ''))}</span>
  <span class="esc-txt">${escHtml(x.c.texto)}${x.estado === 'hoje' && M.ultimoDia(x.fim) === M.hoje ? ' <span class="esc-etq">termina hoje</span>' : ''}</span><span class="esc-dt">${escDM(x.ini)} – ${escDM(M.ultimoDia(x.fim))}</span></li>`;

// ---------------------------------------------------------------- estado da página e ações
const ESC = { E: null, prj: null, fila: Promise.resolve(), pendentes: 0, aoMudar: null, modo: (() => { try { return localStorage.getItem('esc:modo') || 'linha'; } catch (_) { return 'linha'; } })() };
const escCartao = (id) => ESC.E.cartoes.find((c) => c.id === id);

// manda a ação para o Universo em fila (a ordem dos cliques se mantém) e redesenha com o que voltou
function escAcao(corpo, otimista) {
  if (otimista) { otimista(ESC.E); ESC.aoMudar && ESC.aoMudar(); escPainelAtualizar(); }
  ESC.pendentes++;
  ESC.fila = ESC.fila.then(async () => {
    try {
      const r = await Universo.post(`escopo/${ESC.prj}/acao`, corpo);
      ESC.pendentes--;
      if (!ESC.pendentes) { ESC.E = r; ESC.aoMudar && ESC.aoMudar(); escPainelAtualizar(); }
    } catch (err) {
      ESC.pendentes--;
      escAviso(mensagemDe(err));
      try { ESC.E = await Universo.get(`escopo/${ESC.prj}`); } catch (_) { /* fica o que está */ }
      ESC.aoMudar && ESC.aoMudar(); escPainelAtualizar();
    }
  });
  return ESC.fila;
}
const escAviso = (t, tipo) => { const el = document.getElementById('aviso'); if (el) avisoEm(el)(t, tipo); };
const escDuracao = (id, delta) => escAcao({ acao: 'duracao', cartao_id: id, dias: delta }, (E) => {
  const c = E.cartoes.find((x) => x.id === id); if (c) c.dias = Math.max(1, c.dias + delta);
});
const escMover = (id, delta) => escAcao({ acao: 'mover', cartao_id: id, dias: delta }, (E) => {
  const c = E.cartoes.find((x) => x.id === id); if (c) c.folga = Math.max(-400, Math.min(400, c.folga + delta));
});

// ---------------------------------------------------------------- Linha do projeto (motor comum: linha-nos.js)
//   A mesma Linha do PGT (camadas, 1ª e 2ª linha, caixas do que corre junto, fios, gatilhos, recolher, minimapa,
//   compacto e extenso), com o que é do projeto por cima: hoje, situação (passou, hoje, adiante), atraso (o que passou
//   do contratado, hachura vermelha), empurrado (começa depois do contratado, hachura ocre), hiato, suspensão, decisão
//   real e, se pedido, os cartões do PGT que não foram contratados (tracejados; um clique acrescenta, potencial aditivo).
const ESC_LN_CHAVE = 'esc:linha';
ESC.linha = (() => {
  let g = {};
  try { g = JSON.parse(localStorage.getItem(ESC_LN_CHAVE) || '{}'); } catch (_) { /* sem armazenamento */ }
  return { modo: g.modo === 'extenso' ? 'extenso' : 'compacto', dia: g.dia || 0, cliente: !!g.cliente, naoContratados: !!g.naoContratados,
    recolhidas: new Set(), sel: null, selecao: new Set(), rolagem: null };
})();
function escLinhaGuardar() {
  const L = ESC.linha;
  try { localStorage.setItem(ESC_LN_CHAVE, JSON.stringify({ modo: L.modo, dia: L.dia, cliente: L.cliente, naoContratados: L.naoContratados })); } catch (_) { /* sem armazenamento */ }
}
function escCamada(c) {
  if (c.tipo === 'entrega' || c.tempo === 'estudio') return 'est';
  if (c.tempo === 'cliente') return 'cli';
  if (c.tempo === 'terceiros') return 'out';
  if (c.cliente && c.terceiros) return 'tres';
  if (c.cliente) return 'l1';
  if (c.terceiros) return 'l2';
  return 'est';
}
const ESC_ATOR_GRUPO = { est: 'est', l1: 'cli', l2: 'out', tres: 'cli', cli: 'cli', out: 'out' };
const escCorFase = (E, id) => ESC_COR_FASE[id] || ESC_CORES[[...new Set(E.cartoes.map((c) => c.fase_id))].indexOf(id) % ESC_CORES.length];
const escIconeTipo = (c) => (c.tipo === 'entrega' ? '' : c.decisao && c.decisao.length ? ESC_IC.decisao : c.cliente && c.terceiros ? ESC_IC.terceiros : c.cliente ? ESC_IC.cliente : c.terceiros ? ESC_IC.terceiros : '');

// cartões do PGT publicado que não entraram no escopo (só das etapas contratadas); o serviço é o que mais casa
function escNaoContratados(E, M) {
  const P = ESC.pgt && ESC.pgt.P;
  if (!P) return [];
  const origens = new Set(E.cartoes.map((c) => c.origem_id).filter(Boolean));
  const etapas = E.cartoes.filter((c) => c.tipo === 'etapa' && c.origem_id && !c.suprimido_em);
  const itensDe = (pet) => [...P.entregaveis.filter((x) => x.etapa_id === pet), ...P.eventos.filter((x) => x.etapa_id === pet && !x.encerramento)]
    .sort((a, b) => (a.ordem - b.ordem) || String(a.id).localeCompare(String(b.id)));
  // serviço: o que tem mais cartões do escopo marcados como P
  const conta = {};
  for (const e of etapas) for (const x of itensDe(e.origem_id)) if (origens.has(x.id)) for (const [srv, p] of Object.entries(x.servicos || {})) if (p === 'P' || p === 'S') conta[srv] = (conta[srv] || 0) + 1;
  const srv = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!srv) return [];
  const liberados = new Set(); for (const v of P.eventos) for (const r of v.decisao || []) for (const id of r.libera || []) liberados.add(id);
  const quando = new Map(M.itens.map((x) => [x.c.id, x]));
  const porOrigem = new Map(E.cartoes.filter((c) => c.origem_id).map((c) => [c.origem_id, c]));
  const fora = [];
  for (const e of etapas) {
    const qe = M.etapas.find((x) => x.c.id === e.id);
    if (!qe) continue;
    let depois = e.id; let cursor = qe.ini;
    for (const x of itensDe(e.origem_id)) {
      const noEscopo = porOrigem.get(x.id);
      if (noEscopo) { const q = quando.get(noEscopo.id); if (q) { depois = noEscopo.id; cursor = q.fim; } continue; }
      const p = x.servicos && x.servicos[srv];
      if (!(p === 'O' || p === 'P') || liberados.has(x.id)) continue;
      const ent = String(x.id).startsWith('pen_');
      const dias = ent || x.tempo === 'estudio' ? Math.max(1, Math.ceil((x.prazo_turnos || 2) / 2)) : x.tempo === 'cliente' ? 3 : x.tempo === 'terceiros' ? 7 : 1;
      fora.push({ x, ent, dias, depois, ini: cursor, fim: M.somar(cursor, dias), etapa: e, opcional: p === 'O' });
    }
  }
  return fora;
}

function escLinhaDados(E) {
  const M = escCalendario(E);
  const B = escBase(E);
  const L = ESC.linha;
  const baseIni = new Map(B.itens.map((x) => [x.c.id, x.ini]));
  const porId = Object.fromEntries(E.cartoes.map((c) => [c.id, c]));
  const etapaDe = (c) => porId[c.etapa_id] || {};
  const fase = (c) => ({ id: c.fase_id || 'sem', nome: c.fase_nome || 'Fase', cor: escCorFase(E, c.fase_id) });
  const etapa = (c) => { const e = etapaDe(c); return { id: e.id || 'sem', sigla: e.sigla || '', nome: e.texto || '' }; };
  const nos = []; const passos = [];
  let grupo = null;
  for (const it of M.itens) {
    const c = it.c;
    const contratado = c.dias_contratados || c.dias;
    const atraso = !c.adicionado && c.dias > contratado ? c.dias - contratado : 0;
    const b = baseIni.get(c.id);
    const empurrado = b != null && it.ini > b ? escUteis(b, it.ini, M.util) : 0;
    const res = c.decisao && c.decisao.length ? c.decisao.find((r) => r.id === c.decisao_resultado) : null;
    const etqs = [it.estado === 'hoje' ? '<span class="ln-etq hoje">hoje</span>' : '',
      atraso ? `<span class="ln-etq atraso">+${atraso}d atraso</span>` : '',
      empurrado ? `<span class="ln-etq empurrado" title="Começa ${empurrado} dia(s) útil(eis) depois do contratado">+${empurrado}d</span>` : '',
      c.folga < 0 ? `<span class="ln-etq tracejada">${-c.folga}d em paralelo</span>` : '',
      c.adicionado ? '<span class="ln-etq tracejada">acrescentado</span>' : '',
      c.decisao && c.decisao.length ? `<span class="ln-etq">${res ? escHtml(res.nome) : 'decisão em aberto'}</span>` : ''].filter(Boolean);
    const marca = c.sem_prazo ? '*' : c.tempo === 'cliente' || c.tempo === 'terceiros' ? '~' : '';
    const html = `${atraso ? `<div class="ln-atraso" style="width:${Math.round((atraso / c.dias) * 100)}%"></div>` : ''}
      <div class="ln-no__cab"><span class="ln-no__cod">${escIconeTipo(c)}${escHtml(c.codigo || (c.adicionado ? 'novo' : ''))}</span><span title="${marca === '*' ? 'o PGT não tinha prazo' : marca ? 'estimado' : ''}">${marca}</span></div>
      <div class="ln-no__nome">${escHtml(c.texto)}</div>
      ${etqs.length ? `<div class="ln-no__pe">${etqs.join('')}</div>` : ''}
      <div class="ln-cmd"><span class="ln-no__datas">${escDM(it.ini)}${M.ultimoDia(it.fim) !== it.ini ? ' – ' + escDM(M.ultimoDia(it.fim)) : ''}</span>
        <span class="ln-cmd__dir"><span class="ln-cmd__dur"><button type="button" class="pg-caixa" data-esc-dur="${c.id}|-1" aria-label="Reduzir um dia" title="Reduzir um dia">${ESC_IC.menos}</button><b>${c.dias}d${marca}</b><button type="button" class="pg-caixa" data-esc-dur="${c.id}|1" aria-label="Estender um dia" title="Estender um dia">${ESC_IC.mais}</button></span>
        <button type="button" class="pg-caixa" data-esc-abrir="${c.id}" aria-label="Abrir" title="Abrir o cartão (ou duplo clique)">${ESC_IC.lapis}</button></span></div>`;
    nos.push({ id: c.id, ini: it.ini, fim: it.fim, ator: escCamada(c), ent: c.tipo === 'entrega', fase: fase(c), etapa: etapa(c), html, destaque: !!(atraso || empurrado),
      cls: [`is-${it.estado === 'hoje' ? 'hoje' : it.estado}`, atraso ? 'is-atrasado' : '', empurrado ? 'is-empurrado' : '', c.adicionado ? 'is-acrescentado' : '', c.encerramento ? 'ln-no--enc' : '', c.decisao && c.decisao.length ? 'ln-no--dec' : ''].filter(Boolean).join(' '),
      titulo: `${c.codigo || ''} ${c.texto}\n${escDMA(it.ini)} a ${escDMA(M.ultimoDia(it.fim))} · ${c.dias} dia(s) útil(eis)${c.dias_contratados ? ` · contratado: ${c.dias_contratados}` : ''}` });
    // passos: entregas que correm juntas formam um passo só
    if (c.junto_anterior && grupo && grupo.etapa === c.etapa_id && c.folga === 0) grupo.ids.push(c.id);
    else { grupo = { etapa: c.etapa_id, ids: [c.id] }; passos.push(grupo.ids); }
  }
  // decisões: os cartões que um resultado ainda pode liberar aparecem tracejados depois da decisão
  const gatilhos = [];
  const quando = new Map(M.itens.map((x) => [x.c.id, x]));
  for (const it of M.itens) {
    const c = it.c;
    if (!c.decisao || !c.decisao.length) continue;
    let cursor = it.fim;
    for (const r of c.decisao) for (const id of r.libera || []) {
      const alvo = porId[id]; if (!alvo || alvo.suprimido_em) continue;
      gatilhos.push({ de: c.id, para: id, rotulo: r.nome });
      if (quando.has(id) || c.decisao_resultado) continue;      // já liberado, ou decidido por outro caminho
      const fim = M.somar(cursor, alvo.dias);
      nos.push({ id, ini: cursor, fim, ator: escCamada(alvo), ent: alvo.tipo === 'entrega', fase: fase(alvo), etapa: etapa(alvo), fantasma: true,
        cls: 'is-tracejado', titulo: `Entra se ${c.codigo || 'a decisão'} for «${r.nome}» (extra previsto)`,
        html: `<div class="ln-no__cab"><span class="ln-no__cod">${escHtml(alvo.codigo || '')}</span><span>${alvo.dias}d</span></div>
          <div class="ln-no__nome">${escHtml(alvo.texto)}</div><div class="ln-no__pe"><span class="ln-tag--susp">entra com «${escHtml(r.nome)}»</span></div>` });
      cursor = fim;
    }
  }
  // não contratados (pedido na barra)
  if (L.naoContratados) {
    for (const f of escNaoContratados(E, M)) {
      const pseudo = { tipo: f.ent ? 'entrega' : 'evento', tempo: f.ent ? null : f.x.tempo, cliente: !!f.x.cliente, terceiros: !!f.x.terceiros };
      nos.push({ id: 'nc:' + f.x.id, ini: f.ini, fim: f.fim, ator: escCamada(pseudo), ent: f.ent, fase: fase(f.etapa), etapa: etapa({ etapa_id: f.etapa.id }), fantasma: true,
        cls: 'is-tracejado', titulo: `${f.x.codigo} · não contratado (${f.opcional ? 'opcional' : 'pertinente'} no PGT). Acrescentar entra como potencial aditivo.`,
        html: `<div class="ln-no__cab"><span class="ln-no__cod">${escHtml(f.x.codigo || '')}</span><span>${f.dias}d</span></div>
          <div class="ln-no__nome">${escHtml(f.x.texto || f.x.nome)}</div>
          <div class="ln-cmd"><span class="ln-etq tracejada">não contratado</span><span class="ln-cmd__dir"><button type="button" class="pg-caixa" data-esc-nc="${escHtml(f.x.id)}" aria-label="Acrescentar ao escopo" title="Acrescentar ao escopo (potencial aditivo)">${ESC_IC.mais}</button></span></div>` });
    }
  }
  const hiatos = M.hiatos.map((h) => ({ id: h.antes.id, ini: h.ini, fim: h.fim,
    html: `<b>Hiato</b><span>${escDM(h.ini)} – ${escDM(M.ultimoDia(h.fim))}</span><strong>${plural(h.dias, 'dia útil', 'dias úteis')}</strong>
      <span>antes de ${escHtml(h.antes.codigo || h.antes.texto)}</span>
      <span class="ln-hiato__cmd"><button type="button" class="pg-caixa" data-esc-abrir="${h.antes.id}" aria-label="Editar o hiato" title="Editar (abre ${escHtml(h.antes.codigo || 'o cartão')})">${ESC_IC.lapis}</button>
        <button type="button" class="pg-caixa" data-esc-fechar="${h.antes.id}" aria-label="Fechar o hiato" title="Fechar o hiato: puxa tudo o que vem depois">${ESC_IC.fechar}</button></span>` }));
  const pausas = M.sus.map((s) => ({ ini: s.de, fim: s.ate, html: `<b>Suspenso</b><span>${escDM(s.de)} – ${escDM(s.ate - ESC_DIA)}</span>` }));
  const fimBase = B.itens.length ? B.ultimoDia(B.fim) : null;
  const fimPrev = M.ultimoDia(M.fim);
  return { M, B, nos, passos, gatilhos, hiatos, pausas, fimBase, fimPrev, difFim: fimBase != null && fimPrev > fimBase ? escUteis(fimBase, fimPrev, M.util) : fimBase != null && fimPrev < fimBase ? -escUteis(fimPrev, fimBase, M.util) : 0 };
}

function escDesenharLinha(el, E) {
  const L = ESC.linha;
  if (L.naoContratados && !ESC.pgt && !ESC.pgtCarregando) {
    ESC.pgtCarregando = true;
    escCarregarPgt().then((d) => { ESC.pgt = d; }).catch((err) => escAviso(`Não consegui ler o PGT publicado (${mensagemDe(err)}).`))
      .finally(() => { ESC.pgtCarregando = false; ESC.aoMudar && ESC.aoMudar(); });
  }
  const X = escLinhaDados(E);
  if (!X.nos.length) { el.innerHTML = '<div class="pg-vazio">Nenhum cartão no escopo.</div>'; return; }
  // no computador, a linha cabe na tela (faixas Estúdio 1,5 · Cliente 1 · Terceiros 1); no celular, a página rola
  const ajustar = window.innerWidth >= 1100;
  document.body.classList.toggle('esc-cabe', ajustar);
  const redesenhar = () => { escLinhaGuardar(); ESC.aoMudar && ESC.aoMudar(); };
  LinhaNos.desenhar(el, {
    estado: L, recolhidas: L.recolhidas, nos: X.nos, passos: X.passos, gatilhos: X.gatilhos, hiatos: X.hiatos, pausas: X.pausas,
    hoje: X.M.hoje, util: X.M.util, cliente: L.cliente, folgaBase: 12, ajustar,
    aoMudar: redesenhar,
    aoAbrir: (id) => {
      if (id.startsWith('nc:')) return escAcrescentarDoPgt(id.slice(3));
      const c = escCartao(id); if (!c) return;
      if (!X.M.itens.some((x) => x.c.id === id) && c.liberado_por) return escAbrirCartao(c.liberado_por);   // tracejado: abre a decisão
      escAbrirCartao(id);
    },
    aoSelecao: escDesenharSelecao,
    podeNovo: (id) => { const c = escCartao(id); return c && !c.encerramento && X.M.itens.some((x) => x.c.id === id) ? id : null; },
    aoNovoNoFio: (id) => escAbrirAcrescentar(id),
    aoLigar: (tela) => {
      tela.querySelectorAll('[data-esc-dur]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); const [id, d] = b.dataset.escDur.split('|'); escDuracao(id, Number(d)); });
      tela.querySelectorAll('[data-esc-abrir]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); escAbrirCartao(b.dataset.escAbrir); });
      tela.querySelectorAll('[data-esc-fechar]').forEach((b) => b.onclick = (ev) => {
        ev.stopPropagation(); const c = escCartao(b.dataset.escFechar);
        if (c && c.folga > 0) escAcao({ acao: 'mover', cartao_id: c.id, dias: -c.folga }, (E2) => { const x = E2.cartoes.find((y) => y.id === c.id); if (x) x.folga = 0; });
      });
      tela.querySelectorAll('[data-esc-nc]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); escAcrescentarDoPgt(b.dataset.escNc); });
    },
    legenda: `<span><i class="ln-am ln-am--ent"></i> entrega</span><span><i class="ln-am ln-am--evt"></i> evento</span>
      <span><i class="ln-am ln-am--grupo"></i> correm juntas</span><span><i class="ln-am ln-am--gat"></i> gatilho da decisão</span>
      <span><i class="ln-am ln-am--trac"></i> acrescentado · por decidir · não contratado</span>
      <span><i class="ln-am esc-am--atraso"></i> atraso</span><span><i class="ln-am esc-am--empurrado"></i> empurrado</span>
      <span>* sem prazo no PGT · ~ estimado</span>
      <span>Ctrl+clique ou laço: vários · Esc limpa · roda sobre uma faixa cheia: rola a faixa · Extenso: Ctrl + roda, largura do dia</span>`,
  });
}

// um cartão do PGT que não foi contratado entra no escopo (potencial aditivo), com o código e a origem dele
async function escAcrescentarDoPgt(origemId) {
  const P = ESC.pgt && ESC.pgt.P; if (!P) return;
  const E = ESC.E; const M = escCalendario(E);
  const f = escNaoContratados(E, M).find((x) => x.x.id === origemId);
  if (!f) return;
  const motivo = prompt(`Acrescentar ${f.x.codigo} · ${f.x.texto || f.x.nome} ao escopo?\nFica registrado como potencial aditivo.\n\nMotivo (opcional; dá para preencher depois):`, '');
  if (motivo === null) return;
  await escAcao({ acao: 'acrescentar', depois_de: f.depois, tipo: f.ent ? 'entrega' : 'evento', texto: f.x.texto || f.x.nome, dias: f.dias,
    tempo: f.ent ? null : f.x.tempo || 'estudio', motivo, origem_id: f.x.id, codigo: f.x.codigo, cliente: !!f.x.cliente, terceiros: !!f.x.terceiros,
    evento_tipo: f.ent ? null : f.x.tipo || null, sem_prazo: f.ent && !f.x.prazo_turnos });
}

// ---------------------------------------------------------------- andamento (0028): ao mesmo tempo ou em sequência
// O mesmo plano do Universo (worker/dados/escopo.js › planejarAndamento): com buracos na seleção, os selecionados passam
// à frente dos do meio (reorganiza a pilha) e os códigos da etapa acompanham a nova ordem.
const ESC_RX_ENT = /^(.+)-(\d+)$/, ESC_RX_EVT = /^(.+)-M(\d+)$/;
function escPlanejarAndamento(filhos, ids, modo) {
  const lista = [...filhos].sort((a, b) => a.ordem - b.ordem);
  const sel = lista.filter((c) => ids.includes(c.id));
  const mud = new Map();
  const por = (c, k, v) => { if (c[k] !== v) { const m = mud.get(c.id) || {}; m[k] = v; mud.set(c.id, m); } };
  if (modo === 'sequencia') {
    for (const c of sel) { por(c, 'junto_anterior', 0); if (c.folga < 0) por(c, 'folga', 0); }
    return mud;
  }
  const [prim, ...resto] = sel;
  const nova = lista.filter((c) => !resto.includes(c));
  nova.splice(nova.indexOf(prim) + 1, 0, ...resto);
  const ordens = lista.map((c) => c.ordem);
  nova.forEach((c, i) => por(c, 'ordem', ordens[i]));
  for (const c of resto) { por(c, 'junto_anterior', 1); por(c, 'folga', 0); }
  escRenumerar(lista, nova, por);
  return mud;
}
function escRenumerar(lista, nova, por) {
  for (const rx of [ESC_RX_EVT, ESC_RX_ENT]) {
    const doGrupo = (c) => c.codigo && rx.test(c.codigo) && (rx === ESC_RX_EVT || !ESC_RX_EVT.test(c.codigo));
    const nums = lista.filter(doGrupo).map((c) => c.codigo).sort((a, b) => Number(a.match(rx)[2]) - Number(b.match(rx)[2]));
    nova.filter(doGrupo).forEach((c, i) => por(c, 'codigo', nums[i]));
  }
}
// inverter a ordem de dois cartões (o mesmo de planejarTroca no Universo): trocam de lugar; o lugar (junto com o
// anterior, hiato, paralelo) fica onde estava; os códigos acompanham
function escAplicarTroca(E, a, b) {
  const A = E.cartoes.find((c) => c.id === a), B = E.cartoes.find((c) => c.id === b);
  if (!A || !B) return;
  const lista = E.cartoes.filter((c) => c.etapa_id === A.etapa_id).sort((x, y) => x.ordem - y.ordem);
  const nova = lista.map((c) => (c === A ? B : c === B ? A : c));
  const mud = new Map();
  const por = (c, k, v) => { if (c[k] !== v) { const m = mud.get(c.id) || {}; m[k] = v; mud.set(c.id, m); } };
  for (const k of ['ordem', 'junto_anterior', 'folga']) { const va = A[k], vb = B[k]; por(A, k, vb); por(B, k, va); }
  escRenumerar(lista, nova, por);
  for (const [id, campos] of mud) Object.assign(E.cartoes.find((c) => c.id === id), campos);
  E.cartoes.sort((x, y) => x.ordem - y.ordem);
}
function escAplicarAndamento(E, ids, modo) {
  const sel = E.cartoes.filter((c) => ids.includes(c.id));
  if (!sel.length) return;
  const filhos = E.cartoes.filter((c) => c.etapa_id === sel[0].etapa_id);
  for (const [id, campos] of escPlanejarAndamento(filhos, ids, modo)) Object.assign(E.cartoes.find((c) => c.id === id), campos);
  E.cartoes.sort((a, b) => a.ordem - b.ordem);
}
// o que a seleção permite e como ela está: { ids, motivo (por que não dá), modo atual, efeito de cada opção }
function escAndamentoDaSelecao(ids) {
  const E = ESC.E;
  const cand = ids.map(escCartao).filter((c) => c && c.tipo !== 'etapa' && !c.encerramento && !c.suprimido_em).sort((a, b) => a.ordem - b.ordem);
  if (!cand.length) return { motivo: 'Escolha entregas ou eventos (sem a etapa e o Encerramento).' };
  if (new Set(cand.map((c) => c.etapa_id)).size > 1) return { motivo: 'Escolha cartões de uma etapa só.' };
  const filhos = E.cartoes.filter((c) => c.etapa_id === cand[0].etapa_id && !c.suprimido_em);
  const pos = cand.map((c) => filhos.indexOf(c));
  const seguidos = pos.every((p, i) => !i || p === pos[i - 1] + 1);
  const juntos = cand.length > 1 && seguidos && cand.slice(1).every((c) => c.junto_anterior && !c.folga);
  const sequencia = cand.every((c) => !c.junto_anterior && c.folga >= 0);
  const efeito = (modo) => {
    if (modo === 'juntos' && cand.length < 2) return null;
    const r = escSimular(E, (C) => escAplicarAndamento(C, cand.map((c) => c.id), modo));
    const M = escCalendario(E);
    const dias = r.fimDepois > r.fimAntes ? escUteis(r.fimAntes, r.fimDepois, M.util) : -escUteis(r.fimDepois, r.fimAntes, M.util);
    return { ...r, dias };
  };
  return { ids: cand.map((c) => c.id), modo: juntos ? 'juntos' : sequencia ? 'sequencia' : null, efeito };
}
function escAndamento(ids, modo, dias) {
  escAcao({ acao: 'andamento', cartoes: ids, modo, dias }, (E) => escAplicarAndamento(E, ids, modo));
}

// barra de seleção (vários cartões): duração de cada um, andamento (ao mesmo tempo ou em sequência), adiar ou adiantar
// o bloco (move o primeiro; os outros seguem), suprimir
function escDesenharSelecao() {
  let bar = document.getElementById('esc-selbar');
  const L = ESC.linha;
  const ids = [...L.selecao].filter((id) => escCartao(id));
  if (!bar) { bar = document.createElement('div'); bar.id = 'esc-selbar'; bar.className = 'esc-selbar'; document.body.appendChild(bar); }
  bar.hidden = !ids.length || !document.querySelector('#esc-vista .lnn');
  if (bar.hidden) return;
  const A = escAndamentoDaSelecao(ids);
  const opcao = (modo, rot) => {
    if (A.motivo) return `<button type="button" role="radio" aria-checked="false" disabled title="${escHtml(A.motivo)}">${rot}</button>`;
    const ef = A.modo === modo ? null : A.efeito(modo);
    const pode = A.modo === modo || ef;
    const tit = !pode ? 'Escolha ao menos dois cartões' : A.modo === modo ? 'É como estão agora'
      : `${ef.fimAntes === ef.fimDepois ? `O fim previsto continua em ${escDMA(ef.fimAntes)}` : `O fim previsto passa de ${escDMA(ef.fimAntes)} para ${escDMA(ef.fimDepois)}`}${modo === 'juntos' ? '. Os de fora da seleção que estão no meio vão para depois.' : ''}`;
    return `<button type="button" role="radio" aria-checked="${A.modo === modo}" data-and="${modo}" ${pode ? '' : 'disabled'} title="${escHtml(tit)}">${rot}</button>`;
  };
  const efJ = !A.motivo && A.modo !== 'juntos' ? A.efeito('juntos') : null;
  const troca = !A.motivo && A.ids.length === 2 ? (() => {
    const r = escSimular(ESC.E, (C) => escAplicarTroca(C, A.ids[0], A.ids[1])); const M0 = escCalendario(ESC.E);
    return { ...r, dias: r.fimDepois > r.fimAntes ? escUteis(r.fimAntes, r.fimDepois, M0.util) : -escUteis(r.fimDepois, r.fimAntes, M0.util) };
  })() : null;
  const titTroca = A.motivo ? A.motivo : !troca ? 'Selecione exatamente dois cartões da mesma etapa'
    : `Os dois trocam de lugar e de código${troca.fimAntes === troca.fimDepois ? `; o fim previsto continua em ${escDMA(troca.fimAntes)}` : `; o fim previsto passa de ${escDMA(troca.fimAntes)} para ${escDMA(troca.fimDepois)}`}`;
  const dica = A.motivo ? A.motivo : efJ && efJ.dias ? `juntos: fim em ${escDM(efJ.fimDepois)} (${efJ.dias > 0 ? '+' : '−'}${Math.abs(efJ.dias)} d)` : '';
  bar.innerHTML = `<strong>${plural(ids.length, 'cartão selecionado', 'cartões selecionados')}</strong>
    <span class="esc-selbar__g">Duração de cada um <button type="button" class="u-botao" data-sb="dur|-1">− 1 dia</button><button type="button" class="u-botao" data-sb="dur|1">+ 1 dia</button></span>
    <span class="esc-selbar__g">Andamento <span class="pg-seletor" role="radiogroup" aria-label="Andamento">${opcao('juntos', 'Ao mesmo tempo')}${opcao('sequencia', 'Em sequência')}</span>${dica ? `<small class="esc-selbar__dica">${escHtml(dica)}</small>` : ''}
      <button type="button" class="u-botao" data-troca ${troca ? '' : 'disabled'} title="${escHtml(titTroca)}">${ESC_IC.troca}<span>Inverter a ordem</span></button></span>
    <span class="esc-selbar__g">O bloco <button type="button" class="u-botao" data-sb="mov|-1">Adiantar 1 dia</button><button type="button" class="u-botao" data-sb="mov|1">Adiar 1 dia</button></span>
    <span class="esc-selbar__g"><button type="button" class="u-botao" data-sb="sup|0">Suprimir</button><button type="button" class="u-botao" data-sb="limpar|0">Limpar (Esc)</button></span>`;
  const bt = bar.querySelector('[data-troca]');
  if (bt) bt.onclick = () => {
    if (!troca) return;
    const [a, b] = A.ids;
    escAcao({ acao: 'trocar', cartoes: [a, b], dias: troca.dias }, (E) => escAplicarTroca(E, a, b));
    escDesenharSelecao(); reabrirDepois(escDesenharSelecao);
  };
  bar.querySelectorAll('[data-and]').forEach((b) => b.onclick = () => {
    const modo = b.dataset.and;
    if (A.motivo || A.modo === modo) return;
    const ef = A.efeito(modo);
    escAndamento(A.ids, modo, ef ? ef.dias : null);
    escDesenharSelecao(); reabrirDepois(escDesenharSelecao);
  });
  bar.querySelectorAll('[data-sb]').forEach((b) => b.onclick = async () => {
    const [a, d] = b.dataset.sb.split('|');
    if (a === 'limpar') { L.selecao.clear(); ESC.aoMudar && ESC.aoMudar(); escDesenharSelecao(); return; }
    if (a === 'dur') { for (const id of ids) escDuracao(id, Number(d)); return; }
    if (a === 'mov') {
      const M = escCalendario(ESC.E);
      const primeiro = M.itens.find((x) => ids.includes(x.c.id));
      if (primeiro) escMover(primeiro.c.id, Number(d));
      return;
    }
    if (a === 'sup') {
      const alvo = ids.filter((id) => !escCartao(id).encerramento && !escCartao(id).suprimido_em);
      const motivo = prompt(`Suprimir ${plural(alvo.length, 'cartão', 'cartões')} do escopo? Fica registrado como potencial aditivo.\n\nMotivo (opcional):`, '');
      if (motivo === null) return;
      for (const id of alvo) escAcao({ acao: 'suprimir', cartao_id: id, motivo });
      L.selecao.clear(); escDesenharSelecao();
    }
  });
}
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && ESC.linha.selecao.size && !document.querySelector('.escm-fundo') && !ev.target.closest?.('input, textarea, select')) {
    ESC.linha.selecao.clear(); ESC.aoMudar && ESC.aoMudar(); escDesenharSelecao();
  }
});

function escLigarNos(el) {
  el.querySelectorAll('[data-no]').forEach((n) => {
    n.querySelectorAll('[data-dur]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); escDuracao(n.dataset.no, Number(b.dataset.dur)); });
    n.onclick = () => escAbrirCartao(n.dataset.no);
    n.onkeydown = (ev) => { if (ev.key === 'Enter') escAbrirCartao(n.dataset.no); };
  });
}

// ---------------------------------------------------------------- Cartões (a mesma coisa em lista, por etapa)
function escDesenharCartoes(el, E) {
  const M = escCalendario(E);
  const quando = Object.fromEntries(M.itens.map((x) => [x.c.id, x]));
  const etapas = E.cartoes.filter((c) => c.tipo === 'etapa');
  el.innerHTML = etapas.map((et) => {
    const e = M.etapas.find((x) => x.c.id === et.id);
    const filhos = E.cartoes.filter((c) => c.etapa_id === et.id && (M.ativo(c) || c.suprimido_em));
    return `<section class="esc-grupo${et.suprimido_em ? ' suprimido' : ''}">
      <div class="esc-grupo__cab"><span class="esc-cod">${escHtml(et.sigla || '')}</span><b>${escHtml(et.texto)}</b>
        <span class="esc-dt">${e ? `${escDM(e.ini)} – ${escDM(M.ultimoDia(e.fim))}` : et.suprimido_em ? 'suprimida' : ''}</span>
        <span class="pg-empurra"></span><button type="button" class="pg-caixa" data-abrir="${et.id}" title="Abrir a etapa" aria-label="Abrir">${ESC_IC.lapis}</button></div>
      <div class="esc-lista">${filhos.map((c) => {
        const q = quando[c.id];
        return `<div class="esc-linha ${q ? q.estado : 'suprimido'}${c.adicionado ? ' adicionado' : ''}" data-no="${c.id}" tabindex="0">
          <span class="esc-cod">${escHtml(c.codigo || (c.adicionado ? 'novo' : ''))}</span>
          <span class="esc-txt">${escHtml(c.texto)}${q && q.estado === 'hoje' ? ' <span class="esc-etq hoje">hoje</span>' : ''}${c.adicionado ? ' <span class="esc-etq">acrescentado</span>' : ''}${c.suprimido_em ? ' <span class="esc-etq tracejada">suprimido</span>' : ''}${q && c.folga > 0 ? ` <span class="esc-etq tracejada">hiato de ${plural(c.folga, 'dia', 'dias')} antes</span>` : ''}${q && c.folga < 0 ? ` <span class="esc-etq tracejada">${plural(-c.folga, 'dia', 'dias')} em paralelo</span>` : ''}</span>
          <span class="esc-dt">${q ? `${escDM(q.ini)} – ${escDM(M.ultimoDia(q.fim))}` : ''}</span>
          <span class="esc-dur">${q ? `<button type="button" class="pg-caixa" data-dur="-1" aria-label="Reduzir um dia">${ESC_IC.menos}</button><b>${c.dias}d</b><button type="button" class="pg-caixa" data-dur="1" aria-label="Estender um dia">${ESC_IC.mais}</button>` : ''}</span>
        </div>`;
      }).join('')}</div></section>`;
  }).join('') || '<div class="pg-vazio">Nenhum cartão no escopo.</div>';
  escLigarNos(el);
  el.querySelectorAll('[data-abrir]').forEach((b) => b.onclick = () => escAbrirCartao(b.dataset.abrir));
}

// ---------------------------------------------------------------- o cartão aberto (painel sobre a Linha)
//   Blocos: Datas (começa em, termina em, duração, hiato ou paralelo; a data nova mostra antes quanto empurra),
//   Decisão, Materiais (do PGT; o que tem link abre ao lado, para ler sem sair), Observações e as Alterações deste
//   cartão (com o motivo). No pé: suprimir/restaurar e acrescentar depois deste. Etapa: só o que cabe a ela.
const ESC_P = { id: null, mat: null, previa: null, matModo: null, busca: '' };
// ---------------------------------------------------------------- materiais do cartão (0028)
//   Os do PGT publicado ligados ao cartão (ou à etapa dele) vêm sozinhos; o cartão guarda { mais, menos }: os que se
//   acrescentaram do banco de materiais do PGT e os do PGT que se tiraram. O cartão aponta para o banco (link vivo).
const ESC_TIPOS_MAT = [['modelo', 'Modelo'], ['formulario', 'Formulário'], ['checklist', 'Checklist'], ['referencia', 'Referência']];
const escNormal = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escTipoMat = (t) => (ESC_TIPOS_MAT.find((x) => x[0] === t) || [t, t || 'material'])[1];
function escCarregarBanco(forcar) {
  if ((ESC.banco && !forcar) || ESC.bancoCarregando) return ESC.bancoCarregando || Promise.resolve();
  ESC.bancoCarregando = Universo.get('escopo/materiais').then((b) => { ESC.banco = b; })
    .catch(() => { /* fica sem o banco: só os do PGT publicado */ })
    .finally(() => { ESC.bancoCarregando = null; escPainelAtualizar(); });
  return ESC.bancoCarregando;
}
// a lista do cartão: [{ id, nome, tipo, link, modelo_id, origem: 'pgt' | 'etapa' | 'projeto' }]
function escMateriaisDoCartao(c, P) {
  const et = c.tipo === 'etapa' ? c : escCartao(c.etapa_id) || {};
  const cm = c.materiais || { mais: [], menos: [] };
  const banco = ESC.banco || { materiais: [], modelos: [] };
  const viva = (m) => banco.materiais.find((x) => x.id === m.id) || m;
  const nomeModelo = (id) => banco.modelos.find((x) => x.id === id)?.nome || (P && (P.modelos || []).find((x) => x.id === id)?.nome);
  const base = P ? (P.materiais || []).filter((m) => m.alvo_id && (m.alvo_id === c.origem_id || (c.tipo !== 'etapa' && m.alvo_id === et.origem_id))) : [];
  const lista = base.filter((m) => !cm.menos.includes(m.id)).map((m) => { const v = viva(m);
    return { ...v, nome: (v.modelo_id && nomeModelo(v.modelo_id)) || v.nome, origem: m.alvo_id === et.origem_id && c.tipo !== 'etapa' ? 'etapa' : 'pgt' }; });
  for (const id of cm.mais) {
    if (lista.some((x) => x.id === id)) continue;
    if (/^pmo_/.test(id)) { const o = banco.modelos.find((x) => x.id === id); if (o) lista.push({ id, nome: o.nome, tipo: o.tipo, modelo_id: id, origem: 'projeto' }); continue; }
    const m = banco.materiais.find((x) => x.id === id);
    if (m) lista.push({ ...m, nome: (m.modelo_id && nomeModelo(m.modelo_id)) || m.nome, origem: 'projeto' });
  }
  return lista;
}
// onde um material do banco está ligado no PGT (código da entrega/evento ou sigla da etapa), para a busca
function escOndeNoPgt(alvo, P) {
  if (!P || !alvo) return '';
  const x = (P.entregaveis || []).find((e) => e.id === alvo) || (P.eventos || []).find((e) => e.id === alvo);
  if (x) return x.codigo || '';
  const e = (P.etapas || []).find((y) => y.id === alvo);
  return e ? e.sigla : '';
}
function escCandidatosDoBanco(c, P, jaTem) {
  const banco = ESC.banco || { materiais: [], modelos: [] };
  const et = c.tipo === 'etapa' ? c : escCartao(c.etapa_id) || {};
  const daEtapa = new Set([et.origem_id, ...(P ? [...(P.entregaveis || []), ...(P.eventos || [])].filter((x) => x.etapa_id === et.origem_id).map((x) => x.id) : [])]);
  const tem = new Set(jaTem.flatMap((m) => [m.id, m.modelo_id].filter(Boolean)));
  const lista = [];
  for (const o of banco.modelos) if (!tem.has(o.id)) lista.push({ id: o.id, nome: o.nome, tipo: o.tipo, onde: 'padrão do PGT', peso: 1 });
  for (const m of banco.materiais) {
    if (m.modelo_id || tem.has(m.id)) continue;      // ligação de um padrão: entra pelo padrão
    lista.push({ id: m.id, nome: m.nome, tipo: m.tipo, onde: escOndeNoPgt(m.alvo_id, P), peso: daEtapa.has(m.alvo_id) ? 0 : 2 });
  }
  return lista.sort((a, b) => a.peso - b.peso || a.nome.localeCompare(b.nome, 'pt'));
}
function escLeitura(url) {
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
function escAbrirCartao(id) {
  if (!escCartao(id)) return;
  ESC_P.id = id; ESC_P.mat = null; ESC_P.previa = null; ESC_P.matModo = null; ESC_P.busca = '';
  escCarregarBanco();
  if (!ESC.pgt && !ESC.pgtCarregando) {
    ESC.pgtCarregando = true;
    escCarregarPgt().then((d) => { ESC.pgt = d; }).catch(() => { /* materiais ficam sem a lista */ }).finally(() => { ESC.pgtCarregando = false; escPainelAtualizar(); });
  }
  escPainelAtualizar();
}
function escFecharCartao() {
  ESC_P.id = null;
  document.getElementById('escm')?.remove();
  document.body.classList.remove('escm-aberto');
}
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ESC_P.id && !ev.target.closest?.('input, textarea, select')) escFecharCartao(); });

function escPainelAtualizar() {
  if (!ESC_P.id || !ESC.E) return;
  const c = escCartao(ESC_P.id);
  if (!c) { escFecharCartao(); return; }
  const E = ESC.E;
  const M = escCalendario(E);
  const q = M.itens.find((x) => x.c.id === c.id);
  const etapa = c.tipo === 'etapa';
  const et = etapa ? c : escCartao(c.etapa_id) || {};
  const cor = escCorFase(E, c.fase_id);
  let raiz = document.getElementById('escm');
  const rolagem = raiz?.querySelector('.escm-esq')?.scrollTop || 0;
  if (!raiz) {
    raiz = document.createElement('div'); raiz.id = 'escm';
    document.body.appendChild(raiz);
    raiz.addEventListener('mousedown', (ev) => { if (ev.target.classList.contains('escm-fundo')) escFecharCartao(); });
  }
  document.body.classList.add('escm-aberto');
  // materiais do PGT ligados ao cartão (ou à etapa dele)
  const P = ESC.pgt && ESC.pgt.P;
  const sel = (P || ESC.banco ? escMateriaisDoCartao(c, P) : []).find((m) => m.link && m.id === ESC_P.mat);
  // situação
  const B = escBase(E);
  const b = B.itens.find((x) => x.c.id === c.id);
  const empurrado = q && b && q.ini > b.ini ? escUteis(b.ini, q.ini, M.util) : 0;
  const contratado = c.dias_contratados || null;
  const atraso = !c.adicionado && contratado && c.dias > contratado ? c.dias - contratado : 0;
  const ant = q ? M.itens[M.itens.indexOf(q) - 1] : null;
  const etqs = [q ? `<span class="pg-etq ${q.estado === 'hoje' ? 'hoje' : ''}">${q.estado === 'feito' ? 'passou' : q.estado === 'hoje' ? 'em andamento' : 'adiante'}</span>` : c.suprimido_em ? '<span class="pg-etq tracejada">suprimido</span>' : '<span class="pg-etq tracejada">fora do calendário</span>',
    atraso ? `<span class="pg-etq esc-atraso">+${atraso}d além do contratado</span>` : '',
    empurrado ? `<span class="pg-etq atencao">começa ${plural(empurrado, 'dia útil', 'dias úteis')} depois do contratado</span>` : '',
    c.adicionado ? '<span class="pg-etq tracejada">acrescentado · potencial aditivo</span>' : ''].filter(Boolean).join('');
  const bloco = (titulo, corpo) => `<section class="pg-bloco escm-bloco"><div class="pg-bloco-cab"><h3 class="pg-bloco-h">${titulo}</h3></div><div class="pg-bloco-corpo">${corpo}</div></section>`;
  const prev = ESC_P.previa;
  const datas = etapa || !q ? '' : bloco('Datas', `<div class="escm-grade">
      <label class="u-campo"><span>Começa em</span><input type="date" id="m-inicio" value="${prev ? prev.dia : escISO(q.ini)}">
        <small>${c.folga > 0 ? `hiato de ${plural(c.folga, 'dia útil', 'dias úteis')} antes` : c.folga < 0 ? `${plural(-c.folga, 'dia', 'dias')} em paralelo com o anterior` : ant ? `logo depois de ${escHtml(ant.c.codigo || ant.c.texto)}` : 'no começo do escopo'}</small></label>
      <label class="u-campo"><span>Termina em</span><input type="text" value="${escDMA(M.ultimoDia(q.fim))}" readonly tabindex="-1"><small>calculado: começo + duração</small></label>
      <div class="u-campo"><span>Duração</span><span class="esc-ctl"><button type="button" class="pg-caixa" data-m-dur="-1" aria-label="Reduzir um dia">${ESC_IC.menos}</button>
        <span class="pg-unidade"><input type="number" min="1" max="400" id="m-dias" value="${c.dias}" aria-label="Dias úteis"><i>dias úteis</i></span>
        <button type="button" class="pg-caixa" data-m-dur="1" aria-label="Estender um dia">${ESC_IC.mais}</button></span>
        <small>${contratado ? `contratado: ${plural(contratado, 'dia útil', 'dias úteis')}` : 'acrescentado (sem prazo contratado)'}; os seguintes andam junto</small></div>
      <div class="u-campo"><span>Mover sem mudar a duração</span><span class="esc-ctl"><button type="button" class="pg-caixa" data-m-mov="-1" aria-label="Um dia antes" title="Um dia antes">${ESC_IC.esq}</button>
        <b class="escm-folga">${c.folga > 0 ? `hiato de ${c.folga}` : c.folga < 0 ? `${-c.folga} em paralelo` : 'sem folga'}</b>
        <button type="button" class="pg-caixa" data-m-mov="1" aria-label="Um dia depois" title="Um dia depois">${ESC_IC.dir}</button></span>
        <small>depois abre um hiato antes do cartão; antes do fim do anterior, corre em paralelo</small></div>
    </div>
    ${prev ? `<div class="escm-previa">Começar em ${escDMA(escDia(prev.dia))} ${prev.dias > 0 ? 'adia' : 'adianta'} este cartão ${plural(Math.abs(prev.dias), 'dia útil', 'dias úteis')}${prev.n > 1 ? ` e mexe em mais ${plural(prev.n - 1, 'cartão', 'cartões')}` : ''}; o fim previsto ${prev.fimDepois === prev.fimAntes ? `continua em ${escDMA(prev.fimAntes)}` : `passa de ${escDMA(prev.fimAntes)} para <b>${escDMA(prev.fimDepois)}</b>`}. Fica registrado como ajuste de prazo.
      <span class="escm-previa__cmd"><button type="button" class="u-botao forte" id="m-aplicar">Aplicar</button><button type="button" class="u-botao" id="m-desfazer">Desfazer</button></span></div>` : ''}`);
  const dec = c.decisao && c.decisao.length ? bloco('Decisão', `<span class="pg-seletor" role="radiogroup" aria-label="Resultado">
      ${c.decisao.map((r, i) => `<button type="button" role="radio" data-res="${escHtml(r.id)}" aria-checked="${c.decisao_resultado === r.id}" title="${i === 0 ? 'caminho esperado' : (r.libera || []).length ? `libera ${r.libera.map((x) => escCartao(x)?.codigo || '').join(', ')}` : ''}">${escHtml(r.nome)}</button>`).join('')}</span>
      <p class="pg-apoio escm-dica">O resultado que libera uma rodada a põe no escopo como extra previsto. Clicar de novo no resultado escolhido desfaz.</p>`) : '';
  const ORIGEM = { pgt: 'do PGT', etapa: 'do PGT · da etapa', projeto: 'acrescentado neste projeto' };
  const linhaMat = (m) => `<div class="escm-mat${m.id === ESC_P.mat ? ' is-on' : ''}">
        <span class="escm-mat__ic">${ESC_IC.doc}</span><span class="escm-mat__txt"><b>${escHtml(m.nome)}</b><small>${escHtml(escTipoMat(m.tipo))}${m.modelo_id ? ' · padrão' : ''} · ${ORIGEM[m.origem]}</small></span>
        ${m.link ? `<button type="button" class="u-botao" data-ler="${m.id}">${m.id === ESC_P.mat ? 'Fechar' : 'Ler aqui'}</button><a class="pg-caixa" href="${escHtml(m.link)}" target="_blank" rel="noopener" aria-label="Abrir em nova aba" title="Abrir em nova aba">${ESC_IC.fora}</a>`
          : m.modelo_id ? `<a class="u-botao" href="pgt.html#materiais/${m.modelo_id}" target="_blank" rel="noopener">Ver o padrão</a>` : '<span class="pg-apoio">sem link</span>'}
        <button type="button" class="pg-caixa" data-tirar="${m.id}" aria-label="Tirar do cartão" title="Tirar do cartão (continua no banco do PGT)">${ESC_IC.fechar}</button></div>`;
  const alvoNovo = c.origem_id ? (c.codigo || c.sigla || 'este cartão') : et.sigla ? `etapa ${et.sigla}` : '';
  const podeNovo = !!(/^(pen|pev|pet)_/.test(c.origem_id || '') || /^pet_/.test(et.origem_id || ''));
  const escolher = ESC_P.matModo === 'banco' ? `<div class="escm-matbox">
      <label class="u-campo"><span>Buscar no banco de materiais do PGT</span><input type="search" id="m-busca" value="${escHtml(ESC_P.busca)}" placeholder="nome ou código (PP-03, CE…)" autocomplete="off"></label>
      <div class="escm-cands" id="m-cands"></div>
      <div class="escm-matbox__pe"><button type="button" class="u-botao" data-mm="">Fechar a busca</button></div></div>`
    : ESC_P.matModo === 'novo' ? `<div class="escm-matbox">
      <div class="u-campo"><span>Tipo</span><span class="pg-seletor" role="radiogroup" aria-label="Tipo" id="m-tipo">${ESC_TIPOS_MAT.map(([v, r], i) => `<button type="button" role="radio" data-tipo="${v}" aria-checked="${i === 0}">${r}</button>`).join('')}</span></div>
      <div class="escm-grade"><label class="u-campo"><span>Nome</span><input type="text" id="m-nnome" maxlength="160" placeholder="ex.: Prancha de similares"></label>
        <label class="u-campo"><span>Link</span><input type="url" id="m-nlink" placeholder="https://…"><small>Drive, Docs, Biblioteca…</small></label></div>
      <p class="pg-apoio escm-dica">Entra na hora no banco de materiais do PGT, ligado a ${escHtml(alvoNovo)}, e fica disponível para outros projetos. Nos escopos novos, vem sozinho depois de publicar o PGT. Para um formulário feito no Universo, crie um padrão em <a href="pgt.html#materiais" target="_blank" rel="noopener">PGT › Materiais</a> e acrescente pelo banco.</p>
      <p class="escm-erro" id="m-nerro" role="alert"></p>
      <div class="escm-matbox__pe"><button type="button" class="u-botao forte" id="m-nsalvar">Criar e acrescentar</button><button type="button" class="u-botao" data-mm="">Cancelar</button></div></div>` : '';
  const matsCartao = P || ESC.banco ? escMateriaisDoCartao(c, P) : [];
  const listaMats = (!P && ESC.pgtCarregando) || (!ESC.banco && ESC.bancoCarregando) ? '<p class="pg-apoio">Lendo os materiais do PGT…</p>'
    : `${matsCartao.length ? `<div class="escm-mats">${matsCartao.map(linhaMat).join('')}</div>`
      : `<p class="pg-apoio">${c.origem_id ? 'Nenhum material neste cartão.' : 'Cartão acrescentado: nenhum material ainda.'}</p>`}
      ${escolher || `<div class="escm-matcmd"><button type="button" class="u-botao" data-mm="banco">${ESC_IC.mais}<span>Do banco do PGT</span></button>
        <button type="button" class="u-botao" data-mm="novo" ${podeNovo ? '' : 'disabled title="Este cartão não tem entrega, evento ou etapa no PGT para ligar o material"'}>${ESC_IC.mais}<span>Novo material</span></button></div>`}`;
  const alts = E.alteracoes.filter((a) => a.cartao_id === c.id && !(['duracao', 'mover'].includes(a.tipo) && !a.dias));
  const listaAlts = alts.length ? `<div class="escm-alts">${alts.map((a) => {
      const [nat, cls] = ESC_NATUREZA[a.natureza] || [a.natureza, ''];
      const d = new Date(a.em);
      return `<div class="escm-alt"><span class="pg-apoio">${escDM(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))}</span><span>${escHtml(escTextoAlteracao(a))}<small>${a.motivo ? escHtml(a.motivo) : 'motivo: a preencher'}</small></span>
        <span class="pg-etq ${cls}">${nat}</span><button type="button" class="pg-caixa" data-motivo="${a.id}" aria-label="Escrever o motivo" title="Escrever o motivo">${ESC_IC.lapis}</button></div>`;
    }).join('')}</div>` : '<p class="pg-apoio">Nada mudou neste cartão.</p>';
  raiz.innerHTML = `<div class="escm-fundo"><div class="escm${sel ? ' com-leitor' : ''}" role="dialog" aria-modal="true" aria-label="${escHtml((c.codigo || c.sigla || '') + ' ' + c.texto)}" style="--fase:${cor}">
    <header class="escm-cab"><div>
        <div class="escm-etqs"><span class="escm-cod">${escHtml(c.codigo || c.sigla || (c.adicionado ? 'novo' : ''))}</span>
          <span class="pg-etq">${etapa ? 'etapa' : c.tipo === 'entrega' ? 'entrega · estúdio' : `evento · ${{ est: 'estúdio', cli: 'tempo do cliente', out: 'tempo de terceiros', l1: 'estúdio e cliente', l2: 'estúdio e terceiros', tres: 'estúdio, cliente e terceiros' }[escCamada(c)]}`}</span>
          <span class="pg-etq escm-fase">${escHtml(c.fase_nome || '')}${!etapa && et.sigla ? ` · ${escHtml(et.sigla)} ${escHtml(et.texto || '')}` : ''}</span></div>
        <h2>${escHtml(c.texto)}</h2>
        <div class="escm-etqs">${etqs}${q ? `<span class="pg-apoio">${escDMA(q.ini)} a ${escDMA(M.ultimoDia(q.fim))}</span>` : ''}</div></div>
      <button type="button" class="pg-caixa escm-fechar" aria-label="Fechar" title="Fechar (Esc)">${ESC_IC.fechar}</button></header>
    <div class="escm-corpo">
      <div class="escm-esq">
        ${datas}${dec}
        ${bloco('Materiais', listaMats)}
        ${bloco('Observações', `<textarea id="m-obs" rows="3" class="escm-obs" placeholder="Anotações deste cartão no projeto">${escHtml(c.observacoes || '')}</textarea>`)}
        ${bloco('Alterações deste cartão', listaAlts)}
        <div class="escm-pe">${c.encerramento ? '<span></span>' : c.suprimido_em ? '<button type="button" class="u-botao" id="m-restaurar">Restaurar ao escopo</button>' : `<button type="button" class="btn-link perigo" id="m-suprimir">Suprimir ${etapa ? 'a etapa' : 'este cartão'}</button>`}
          <button type="button" class="u-botao" id="m-acrescentar">${ESC_IC.mais}<span>${etapa ? 'Acrescentar no começo da etapa' : 'Acrescentar depois deste'}</span></button></div>
      </div>
      ${sel ? `<div class="escm-dir"><div class="escm-dir__cab"><b>${escHtml(sel.nome)}</b><a class="u-botao" href="${escHtml(sel.link)}" target="_blank" rel="noopener">${ESC_IC.fora}<span>Abrir em nova aba</span></a></div>
        <iframe class="escm-leitor" src="${escHtml(escLeitura(sel.link))}" title="${escHtml(sel.nome)}" referrerpolicy="no-referrer"></iframe></div>` : ''}
    </div></div></div>`;
  raiz.querySelector('.escm-esq').scrollTop = rolagem;
  const $ = (s) => raiz.querySelector(s);
  $('.escm-fechar').onclick = escFecharCartao;
  raiz.querySelectorAll('[data-m-dur]').forEach((b2) => b2.onclick = () => escDuracao(c.id, Number(b2.dataset.mDur)));
  raiz.querySelectorAll('[data-m-mov]').forEach((b2) => b2.onclick = () => escMover(c.id, Number(b2.dataset.mMov)));
  const gd = $('#m-dias');
  if (gd) gd.onchange = () => { const n = Math.round(Number(gd.value)); if (n >= 1 && n !== c.dias) escDuracao(c.id, n - c.dias); };
  const gi = $('#m-inicio');
  if (gi && q) gi.onchange = () => {
    if (!gi.value) return;
    const alvo = escDia(gi.value);
    let n = 0, t = q.ini;     // diferença em dias úteis entre o começo atual e o novo
    if (alvo > t) { while (t < alvo) { t += ESC_DIA; if (M.util(t)) n++; } } else { while (t > alvo) { t -= ESC_DIA; if (M.util(t)) n--; } }
    if (!n) { ESC_P.previa = null; escPainelAtualizar(); return; }
    const sim = escSimular(E, (C) => { const x = C.cartoes.find((y) => y.id === c.id); x.folga = Math.max(-400, Math.min(400, x.folga + n)); });
    ESC_P.previa = { dia: gi.value, dias: n, ...sim };
    escPainelAtualizar();
  };
  const ap = $('#m-aplicar');
  if (ap) ap.onclick = () => { const n = ESC_P.previa.dias; ESC_P.previa = null; escMover(c.id, n); };
  const dz = $('#m-desfazer');
  if (dz) dz.onclick = () => { ESC_P.previa = null; escPainelAtualizar(); };
  raiz.querySelectorAll('[data-res]').forEach((b2) => b2.onclick = () => escAcao({ acao: 'decisao', cartao_id: c.id, resultado: b2.dataset.res === c.decisao_resultado ? null : b2.dataset.res }));
  raiz.querySelectorAll('[data-ler]').forEach((b2) => b2.onclick = () => { ESC_P.mat = ESC_P.mat === b2.dataset.ler ? null : b2.dataset.ler; escPainelAtualizar(); });
  // materiais (0028): tirar, acrescentar do banco, criar novo
  const matsOtimista = (fn) => (E2) => { const x = E2.cartoes.find((y) => y.id === c.id); if (x) { x.materiais = { mais: [...(x.materiais?.mais || [])], menos: [...(x.materiais?.menos || [])] }; fn(x.materiais); } };
  raiz.querySelectorAll('[data-tirar]').forEach((b2) => b2.onclick = () => {
    const id = b2.dataset.tirar;
    if (ESC_P.mat === id) ESC_P.mat = null;
    escAcao({ acao: 'materiais', cartao_id: c.id, tirar: id }, matsOtimista((m) => { if (m.mais.includes(id)) m.mais = m.mais.filter((x) => x !== id); else m.menos.push(id); }));
  });
  raiz.querySelectorAll('[data-mm]').forEach((b2) => b2.onclick = () => { ESC_P.matModo = b2.dataset.mm || null; ESC_P.busca = ''; escPainelAtualizar();
    const f = raiz.querySelector(ESC_P.matModo === 'banco' ? '#m-busca' : '#m-nnome'); if (f) f.focus(); });
  const caixaCands = $('#m-cands');
  if (caixaCands) {
    const todos = escCandidatosDoBanco(c, P, escMateriaisDoCartao(c, P));
    const desenhar = () => {
      const q = escNormal(ESC_P.busca);
      const vis = todos.filter((m) => !q || escNormal(`${m.nome} ${m.onde} ${escTipoMat(m.tipo)}`).includes(q)).slice(0, 40);
      caixaCands.innerHTML = !ESC.banco ? '<p class="pg-apoio">Lendo o banco…</p>' : vis.length ? vis.map((m) => `<button type="button" class="escm-cand" data-cand="${m.id}">
          <span class="escm-mat__ic">${ESC_IC.doc}</span><span class="escm-mat__txt"><b>${escHtml(m.nome)}</b><small>${escHtml(escTipoMat(m.tipo))}${m.onde ? ` · ${escHtml(m.onde)}` : ''}${m.peso === 0 ? ' · desta etapa' : ''}</small></span><span class="pg-caixa">${ESC_IC.mais}</span></button>`).join('')
        : '<p class="pg-apoio">Nada no banco com esse nome.</p>';
      caixaCands.querySelectorAll('[data-cand]').forEach((b3) => b3.onclick = () => {
        const id = b3.dataset.cand; ESC_P.matModo = null;
        escAcao({ acao: 'materiais', cartao_id: c.id, acrescentar: id }, matsOtimista((m) => { if (m.menos.includes(id)) m.menos = m.menos.filter((x) => x !== id); else m.mais.push(id); }));
      });
    };
    desenhar();
    $('#m-busca').oninput = (ev) => { ESC_P.busca = ev.target.value; desenhar(); };
  }
  const tipos = $('#m-tipo');
  if (tipos) tipos.querySelectorAll('[data-tipo]').forEach((b3) => b3.onclick = () => tipos.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-checked', String(x === b3))));
  const ns = $('#m-nsalvar');
  if (ns) ns.onclick = async () => {
    const nome = $('#m-nnome').value.trim(), link = $('#m-nlink').value.trim();
    const tipo = tipos.querySelector('[aria-checked="true"]').dataset.tipo;
    const erro = (t, f) => { $('#m-nerro').textContent = t; $(f).focus(); };
    if (!nome) return erro('Diga o nome do material.', '#m-nnome');
    if (!/^https:\/\/\S+$/i.test(link)) return erro('O link precisa começar com https://', '#m-nlink');
    ns.disabled = true; ESC_P.matModo = null;
    await escAcao({ acao: 'material_novo', cartao_id: c.id, tipo, nome, link });
    escCarregarBanco(true);
  };
  const go = $('#m-obs');
  go.onchange = () => escAcao({ acao: 'observacoes', cartao_id: c.id, observacoes: go.value });
  raiz.querySelectorAll('[data-motivo]').forEach((b2) => b2.onclick = async () => {
    const a = E.alteracoes.find((x) => x.id === b2.dataset.motivo);
    const m = prompt('Motivo desta alteração:', a.motivo || '');
    if (m !== null) escAcao({ acao: 'motivo', alteracao_id: a.id, motivo: m });
  });
  const sup = $('#m-suprimir');
  if (sup) sup.onclick = async () => {
    const motivo = prompt(`Suprimir ${c.codigo || c.sigla || ''} · ${c.texto}? Fica registrado nas Alterações de escopo (potencial aditivo).\n\nMotivo (opcional; dá para preencher depois):`, '');
    if (motivo === null) return;
    await escAcao({ acao: 'suprimir', cartao_id: c.id, motivo });
  };
  const res = $('#m-restaurar');
  if (res) res.onclick = () => escAcao({ acao: 'restaurar', cartao_id: c.id });
  $('#m-acrescentar').onclick = () => { escFecharCartao(); escAbrirAcrescentar(c.id); };
}
function reabrirDepois(fn) { ESC.fila.then(() => setTimeout(fn, 0)); }

function escAbrirAcrescentar(depoisDe) {
  const ref = escCartao(depoisDe);
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>Acrescentar ao escopo</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="p-aviso"></div>
    <p class="small">${ref.tipo === 'etapa' ? `No começo de ${escHtml(ref.sigla || '')} · ${escHtml(ref.texto)}` : `Depois de ${escHtml(ref.codigo || '')} · ${escHtml(ref.texto)}`}. Fica registrado como acrescentado (potencial aditivo).</p>
    <form id="f">
      <div class="field"><label class="field__label">É</label><span class="pg-seletor" role="radiogroup" aria-label="Tipo">
        <button type="button" role="radio" data-t="entrega" aria-checked="true">Entrega</button>
        <button type="button" role="radio" data-t="evento" aria-checked="false">Evento</button></span></div>
      <div class="field"><label class="field__label">O que é</label><input type="text" name="texto" required maxlength="400"></div>
      <div class="row-2">
        <div class="field"><label class="field__label">Duração (dias úteis)</label><input type="number" name="dias" min="1" max="400" value="1" required></div>
        <div class="field" id="campo-tempo" hidden><label class="field__label">Tempo de quem</label><select name="tempo">
          <option value="estudio">Estúdio</option><option value="cliente">Cliente</option><option value="terceiros">Terceiros</option><option value="pontual">Pontual</option></select></div>
      </div>
      <div class="field"><label class="field__label">Motivo (opcional)</label><textarea name="motivo" rows="2" placeholder="Dá para preencher depois, nas Alterações de escopo"></textarea></div>
      <div class="painel__acoes"><button class="u-botao forte" type="submit">Acrescentar</button></div>
    </form>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const f = painel.querySelector('#f');
  let tipo = 'entrega';
  painel.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
    tipo = b.dataset.t;
    painel.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    painel.querySelector('#campo-tempo').hidden = tipo !== 'evento';
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      ESC.E = await Universo.post(`escopo/${ESC.prj}/acao`, { acao: 'acrescentar', depois_de: depoisDe, tipo, texto: f.texto.value,
        dias: Number(f.dias.value), tempo: tipo === 'evento' ? f.tempo.value : null, motivo: f.motivo.value });
      fecharPainel(); ESC.aoMudar && ESC.aoMudar();
    } catch (err) { av(mensagemDe(err)); e.submitter.disabled = false; }
  };
  f.texto.focus();
}

// ---------------------------------------------------------------- Alterações de escopo
const ESC_NATUREZA = { aditivo: ['potencial aditivo', 'atencao'], prazo: ['ajuste de prazo', ''], extra: ['extra previsto', 'ok'] };
const ESC_TIPO = { andamento: 'Andamento', duracao: 'Duração', mover: 'Movido', suprimir: 'Suprimido', restaurar: 'Restaurado', acrescentar: 'Acrescentado',
  decisao: 'Decisão', suspender: 'Suspensão', retomar: 'Retomada', inicio: 'Início' };
let ESC_FILTRO = 'todas';
function escTextoAlteracao(a) {
  const d = a.dias;
  if (a.tipo === 'duracao') return `${d > 0 ? 'Estendido' : 'Reduzido'} ${plural(Math.abs(d), 'dia útil', 'dias úteis')} (${a.antes} → ${a.depois} dias)`;
  if (a.tipo === 'mover') return `${d > 0 ? 'Adiado' : 'Adiantado'} ${plural(Math.abs(d), 'dia útil', 'dias úteis')}${a.depois > 0 ? ` (hiato de ${a.depois} antes)` : a.depois < 0 ? ` (${-a.depois} em paralelo)` : ''}`;
  if (a.tipo === 'suprimir') return `Suprimido do escopo${d ? ` (${plural(-d, 'dia', 'dias')} a menos)` : ''}`;
  if (a.tipo === 'restaurar') return 'Restaurado ao escopo';
  if (a.tipo === 'acrescentar') return `Acrescentado ao escopo (${plural(d || 1, 'dia', 'dias')})`;
  return a.descricao || ESC_TIPO[a.tipo] || a.tipo;
}
function escDesenharAlteracoes(el, E) {
  const lista = E.alteracoes.filter((a) => !(['duracao', 'mover'].includes(a.tipo) && !a.dias));
  const soma = (nat, f = (a) => a.dias || 0) => lista.filter((a) => a.natureza === nat).reduce((t, a) => t + f(a), 0);
  const n = (nat) => lista.filter((a) => a.natureza === nat).length;
  const acresc = lista.filter((a) => a.tipo === 'acrescentar').length;
  const supr = lista.filter((a) => a.tipo === 'suprimir').length - lista.filter((a) => a.tipo === 'restaurar').length;
  const prazo = soma('prazo', (a) => (['duracao', 'mover', 'retomar'].includes(a.tipo) ? a.dias || 0 : 0));
  const vis = lista.filter((a) => ESC_FILTRO === 'todas' || a.natureza === ESC_FILTRO);
  el.innerHTML = `<div class="esc-placar">
      <div><span class="u-rotulo">Potencial aditivo</span><b>${acresc}</b><small>${plural(acresc, 'acrescentado', 'acrescentados')} · ${plural(Math.max(0, supr), 'suprimido', 'suprimidos')}</small></div>
      <div><span class="u-rotulo">Ajuste de prazo</span><b>${prazo > 0 ? '+' : ''}${prazo}</b><small>dias úteis no saldo</small></div>
      <div><span class="u-rotulo">Extra previsto</span><b>${n('extra')}</b><small>${plural(soma('extra'), 'dia', 'dias')}</small></div>
    </div>
    <div class="pg-filtros"><span class="pg-seletor" role="radiogroup" aria-label="Natureza">
      ${[['todas', 'Todas'], ['aditivo', 'Potencial aditivo'], ['prazo', 'Ajuste de prazo'], ['extra', 'Extra previsto']].map(([k, r]) =>
        `<button type="button" role="radio" data-nat="${k}" aria-checked="${ESC_FILTRO === k}">${r} <span class="n">${k === 'todas' ? lista.length : n(k)}</span></button>`).join('')}</span></div>
    <div class="pg-regua esc-grade-alt"><span>Quando</span><span>Cartão</span><span>O que mudou</span><span>Natureza</span><span>Motivo</span></div>
    <div class="pg-registro">${vis.map((a) => {
      const [nat, cls] = ESC_NATUREZA[a.natureza] || [a.natureza, ''];
      const d = new Date(a.em);
      return `<div class="pg-linha esc-grade-alt esc-alt">
        <span class="pg-apoio">${escDM(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))}/${d.getFullYear()}<small>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</small></span>
        <span>${a.cartao_id ? `<b>${escHtml(a.cartao_codigo || (a.cartao_tipo === 'etapa' ? '' : 'novo'))}</b> ${escHtml(a.cartao_texto || '')}` : '<span class="sem">projeto</span>'}</span>
        <span>${escHtml(escTextoAlteracao(a))}</span>
        <span><span class="pg-etq ${cls}">${nat}</span></span>
        <span class="esc-motivo">${a.motivo ? escHtml(a.motivo) : '<span class="sem">sem motivo</span>'}
          <button type="button" class="pg-caixa" data-motivo="${a.id}" title="Escrever o motivo" aria-label="Escrever o motivo">${ESC_IC.lapis}</button></span>
      </div>`;
    }).join('') || '<div class="pg-vazio">Nada alterado ainda.</div>'}</div>`;
  el.querySelectorAll('[data-nat]').forEach((b) => b.onclick = () => { ESC_FILTRO = b.dataset.nat; escDesenharAlteracoes(el, E); });
  el.querySelectorAll('[data-motivo]').forEach((b) => b.onclick = async () => {
    const a = E.alteracoes.find((x) => x.id === b.dataset.motivo);
    const m = prompt('Motivo desta alteração:', a.motivo || '');
    if (m === null) return;
    await escAcao({ acao: 'motivo', alteracao_id: a.id, motivo: m });
  });
}

// ---------------------------------------------------------------- Gerar escopo (projeto sem escopo)
//   com proposta assinada: nasce dela (serviço, área, etapas, entregas e prazos, inclusive os personalizados);
//   sem proposta: o serviço, a área, as etapas e o início escolhidos aqui, com o PGT × faixa (personalizável).
async function escCarregarPgt() {
  const [P, B] = await Promise.all([Universo.get('publicacoes/ultima', { tipo: 'pgt' }), Universo.get('publicacoes/ultima', { tipo: 'bases' })]);
  return { P: P.dados, B: B.dados, versao: P.numero };
}
async function escGerarDaProposta(F, contrato) {
  const pp = await Universo.get(`propostas/${contrato.proposta_id}`);
  let calc = pp.registro?.calculo;
  if (typeof calc === 'string') { try { calc = JSON.parse(calc); } catch (_) { calc = null; } }
  if (!calc || !calc.servicoId || !Array.isArray(calc.etapasSelecionadas)) return null;
  const { P, B, versao } = await escCarregarPgt();
  const semanas = {};
  for (const id of calc.etapasSelecionadas) {
    const m = calc.semanasManual && calc.semanasManual[id];
    if (m != null && m !== '' && calc.prazosPersonalizados) semanas[id] = Number(m);
  }
  const cartoes = escMontar(P, B, { servicoId: calc.servicoId, area: Number(calc.areaConstruida) || F.registro.area_m2 || 0, categoriaId: calc.categoriaId,
    etapas: calc.etapasSelecionadas, entregas: calc.entregasSelecionadas || null, clausulas: calc.clausulasSelecionadas || [], semanas });
  if (!cartoes.length) return null;
  return Universo.post(`escopo/${F.registro.id}/gerar`, { inicio: calc.dataInicio && calc.dataInicio >= (contrato.assinado_em || '') ? calc.dataInicio : contrato.assinado_em || F.registro.inicio,
    origem: { proposta_codigo: contrato.proposta_codigo || pp.registro?.codigo, pgt_versao: versao }, cartoes });
}
async function escAbrirGerar(F, aoGerar) {
  let dados;
  try { dados = await escCarregarPgt(); } catch (err) { escAviso(`Não consegui ler o PGT publicado (${mensagemDe(err)}).`); return; }
  const { P, B, versao } = dados;
  const p = F.registro;
  const SV = B.servicos || [];
  const srvPorNome = SV.find((s) => p.servico && (s.nome === p.servico || s.sigla === p.servico));
  const st = { srv: srvPorNome?.id || SV[0]?.id, area: p.area_m2 || '', inicio: p.inicio || escISO(escHoje()), etapas: null, pers: false, semanas: {} };
  const painel = abrirPainel(`<div class="painel__topo"><h2>Gerar escopo</h2><button class="painel__fechar" aria-label="Fechar">×</button></div><div id="p-aviso"></div><div id="g-corpo"></div>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const corpo = painel.querySelector('#g-corpo');
  const desenhar = () => {
    const srv = SV.find((s) => s.id === st.srv);
    const pert = (e) => (e.servicos && e.servicos[st.srv] ? e.servicos[st.srv].pertinencia || e.servicos[st.srv] : null);
    const etapas = P.etapas.filter((e) => pert(e) && (srv?.dinamica === 'ilha' ? e.servico_id === st.srv : !e.servico_id));
    if (!st.etapas) st.etapas = etapas.filter((e) => pert(e) === 'P').map((e) => e.id);
    const area = Number(String(st.area).replace(',', '.')) || 0;
    const semanasCalc = (e) => {
      const cs = escMontar(P, B, { servicoId: st.srv, area, etapas: [e.id] }).filter((c) => c.tipo !== 'etapa' && !c.liberado_por_ref && !c.encerramento);
      return Math.round((escDuracaoDaSequencia(cs) / 5) * 2) / 2;
    };
    corpo.innerHTML = `<p class="small">A partir do PGT publicado (v${versao}). As durações vêm do PGT × a faixa da área; personalize se precisar.</p>
      <div class="row-2">
        <div class="field"><label class="field__label">Serviço</label><select id="g-srv">${SV.map((s) => `<option value="${s.id}" ${s.id === st.srv ? 'selected' : ''}>${escHtml(s.sigla + ' · ' + s.nome)}</option>`).join('')}</select></div>
        <div class="field"><label class="field__label">Área (m²)</label><input type="text" inputmode="decimal" id="g-area" value="${escHtml(String(st.area))}"></div>
      </div>
      <div class="field"><label class="field__label">Começa em</label><input type="date" id="g-ini" value="${st.inicio}"></div>
      <div class="field"><label class="field__label">Etapas contratadas</label>
        <label class="small"><input type="checkbox" id="g-pers" ${st.pers ? 'checked' : ''}> Personalizar prazos</label>
        <div class="esc-etapas">${etapas.map((e) => {
          const on = st.etapas.includes(e.id); const calc = semanasCalc(e);
          return `<div class="esc-etapa-op"><label><input type="checkbox" data-et="${e.id}" ${on ? 'checked' : ''}> <b>${escHtml(e.sigla)}</b> ${escHtml(e.nome)}${pert(e) === 'O' ? ' <span class="pg-etq tracejada">opcional</span>' : ''}</label>
            ${st.pers && on ? `<span class="pg-unidade"><input type="number" step="0.5" min="0.5" data-sem="${e.id}" value="${st.semanas[e.id] ?? calc}"><i>sem.</i></span>` : `<span class="pg-apoio">${calc ? String(calc).replace('.', ',') + ' sem.' : 'sem prazo'}</span>`}</div>`;
        }).join('') || '<p class="small muted">Este serviço não tem etapas no PGT publicado.</p>'}</div></div>
      <div class="painel__acoes"><button class="u-botao forte" type="button" id="g-ok">Gerar escopo</button></div>`;
    corpo.querySelector('#g-srv').onchange = (ev) => { st.srv = ev.target.value; st.etapas = null; st.semanas = {}; desenhar(); };
    corpo.querySelector('#g-area').onchange = (ev) => { st.area = ev.target.value; desenhar(); };
    corpo.querySelector('#g-ini').onchange = (ev) => { st.inicio = ev.target.value; };
    corpo.querySelector('#g-pers').onchange = (ev) => { st.pers = ev.target.checked; desenhar(); };
    corpo.querySelectorAll('[data-et]').forEach((b) => b.onchange = () => {
      st.etapas = b.checked ? [...st.etapas, b.dataset.et] : st.etapas.filter((x) => x !== b.dataset.et); desenhar();
    });
    corpo.querySelectorAll('[data-sem]').forEach((i) => i.onchange = () => { st.semanas[i.dataset.sem] = Number(i.value); });
    corpo.querySelector('#g-ok').onclick = async (ev) => {
      if (!st.etapas.length) return av('Marque ao menos uma etapa.');
      if (!st.inicio) return av('Diga quando começa.');
      ev.currentTarget.disabled = true;
      try {
        const cartoes = escMontar(P, B, { servicoId: st.srv, area, etapas: st.etapas, semanas: st.pers ? st.semanas : null });
        const r = await Universo.post(`escopo/${p.id}/gerar`, { inicio: st.inicio, origem: { pgt_versao: versao }, cartoes });
        fecharPainel(); aoGerar(r);
      } catch (err) { av(mensagemDe(err)); ev.currentTarget.disabled = false; }
    };
  };
  desenhar();
}
