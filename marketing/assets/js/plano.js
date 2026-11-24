// Plano de publicação: plataformas, grade semanal por fase da escalada de cada plataforma, banco de pautas e
// ciclo de produção. Fonte: odisse-estrategia-instagram.pdf (out. 2026), seções 02 (grade), 03 (escalada e
// horários), 04/05 (modelos e formatos), 06 (da obra à mídia: pautas) e 07 (calendário de produção).
// Guardado na nuvem em cfg:estrategia (versão 2, ver grade.js) e cfg:pautas (banco de pautas).

import * as local from './store.js';
import * as nuvem from './nuvem.js';
import * as pool from './pool.js';
import { segundaDe, somarDias, hoje, isoDia } from './pool.js';
import * as G from './grade.js';

export { POST_DE, REELS, GRADE_PADRAO, DIAS, PECAS, PECA_DESCRICAO, horariosDe, slug, plataformaDaPauta, gradeVazia } from './grade.js';

// ---------------------------------------------------------------------------
// Estratégia guardada (normalizada para a versão 2)

const CHAVE_EST = 'estrategia';
let est = null;

export const estrategia = () => est || (est = G.normalizar(null, hoje()));

export async function carregarEstrategia() {
  if (!est) { const l = await local.lerMeta(CHAVE_EST); if (l) est = G.normalizar(l, hoje()); }
  try {
    const r = await nuvem.lerConfig(CHAVE_EST);
    if (r && (r.versao === 2 || r.grade || Array.isArray(r.fases))) {
      const n = G.normalizar(r, hoje());
      if (JSON.stringify(n) !== JSON.stringify(est)) { est = n; await local.gravarMeta(CHAVE_EST, est); return true; }
    }
  } catch (e) { console.warn('[plano] estratégia da nuvem', e); }
  if (!est) est = G.normalizar(null, hoje());
  return false;
}
export async function gravarEstrategia(nova) {
  est = G.normalizar(nova, hoje());
  await local.gravarMeta(CHAVE_EST, est);
  await nuvem.gravarConfig(CHAVE_EST, est);
}

// ---------------------------------------------------------------------------
// Plataformas, formatos, tipos

export const plataformas = () => G.plataformasAtivas(estrategia());
export const todasPlataformas = () => estrategia().plataformas;
export const plataforma = (id) => G.plataformaDe(estrategia(), id);
export const formato = (pid, fid) => G.formatoDe(plataforma(pid), fid);
export const tipo = (pid, fid, tid) => G.tipoDe(formato(pid, fid), tid);
export const formatosAtivos = (pid) => (plataforma(pid)?.formatos || []).filter((f) => !f.arquivado);
export const tiposAtivos = (pid, fid) => (formato(pid, fid)?.tipos || []).filter((t) => !t.arquivado);
export const nomePlataforma = (id) => plataforma(id)?.nome || (id ? id[0].toUpperCase() + id.slice(1) : '');
export const rotuloDe = (e) => G.rotuloDe(estrategia(), e);

// ---------------------------------------------------------------------------
// Fases e ciclo

export const faseDe = (pid, dia) => G.faseDe(estrategia(), pid, dia);
export const faseAtualDe = (pid) => faseDe(pid, hoje());
export const semanaDoCiclo = (dia) => G.semanaNaEstrategia(estrategia(), dia, hoje());
export const gradeDe = (pid, fase) => G.gradeDe(estrategia(), pid, fase);

/** Encaixes previstos num dia (todas as plataformas; ver grade.js › encaixesNaEstrategia). */
export const encaixesDoDia = (dia) => G.encaixesNaEstrategia(estrategia(), dia, hoje());
/** Só os encaixes com posição (modo encaixes) de uma plataforma. */
export const encaixesDe = (dia, pid) => encaixesDoDia(dia).filter((e) => e.plataforma === pid && e.pos != null);
/** A cota do dia de uma plataforma no modo cota (0 quando não há). */
export const cotaDoDia = (dia, pid) => encaixesDoDia(dia).find((e) => e.plataforma === pid && e.cota != null)?.cota || 0;

/** Texto curto das fases em vigor: "Instagram fase 2 · Pinterest fase 2". */
export const fasesEmVigor = () => plataformas().map((p) => `${p.nome} fase ${faseAtualDe(p.id)}`).join(' · ');

/**
 * Prazos que caem numa semana de trabalho (antecedências da seção 07):
 * pautas do ciclo 3 semanas antes; captação 2 a 3 semanas antes; textos 2; design 1;
 * revisão e agendamento até a sexta anterior; revisão das métricas na última semana do ciclo.
 */
export function prazosDaSemana(seg) {
  const out = [];
  const c3 = semanaDoCiclo(somarDias(seg, 21));
  if (c3.n === 1) out.push({ k: 'pautas', rot: 'Pautas do ciclo', alvo: c3.seg, dia: seg });
  out.push({ k: 'captacao', rot: 'Captação de vídeos', alvo: somarDias(seg, 14), ate: somarDias(seg, 21), dia: seg });
  out.push({ k: 'textos', rot: 'Textos e roteiros', alvo: somarDias(seg, 14), dia: seg });
  out.push({ k: 'design', rot: 'Design e edição', alvo: somarDias(seg, 7), dia: seg });
  out.push({ k: 'agendar', rot: 'Revisão e agendamento', alvo: somarDias(seg, 7), dia: somarDias(seg, 4) });
  if (semanaDoCiclo(seg).n === 4) out.push({ k: 'metricas', rot: 'Revisão das métricas do ciclo', alvo: '', dia: seg });
  return out;
}

// ---------------------------------------------------------------------------
// Banco de pautas (seção 06): cada fonte com os ângulos ainda não publicados.

export const FONTES = [
  ['projeto', 'Projeto de arquitetura', 'arquitetos', ['Macroconceito', 'Uma solução técnica', 'Um material', 'O território e a história', 'O antes e depois', 'O percurso']],
  ['objeto', 'Objeto', 'objetos', ['A peça inteira', 'O material', 'O encaixe ou detalhe construtivo', 'O uso', 'O processo de fabricação']],
  ['ensaio', 'Ensaio da Elaia', 'elaia', ['Argumento do ensaio', 'Uma citação', 'Corte do Matéria Bruta', 'Derivação do artigo']],
  ['rotina', 'Rotina do estúdio', 'estudio', ['Pessoas', 'Obra em andamento', 'Dia de trabalho', 'Processo de criação']],
];
export const FONTE_POR_ID = Object.fromEntries(FONTES.map((f) => [f[0], f]));
export const STATUS_PAUTA = [['pauta', 'Pauta'], ['producao', 'Em produção'], ['pronta', 'Pronta'], ['publicada', 'Publicada']];

const CHAVE_PAUTAS = 'pautas';
let pautas = null;
export const listaPautas = () => pautas || [];
export const pauta = (id) => listaPautas().find((p) => p.id === id) || null;

export async function carregarPautas() {
  if (!pautas) pautas = (await local.lerMeta(CHAVE_PAUTAS)) || [];
  try {
    const r = await nuvem.lerConfig(CHAVE_PAUTAS);
    if (Array.isArray(r) && JSON.stringify(r) !== JSON.stringify(pautas)) { pautas = r; await local.gravarMeta(CHAVE_PAUTAS, pautas); return true; }
  } catch (e) { console.warn('[plano] pautas da nuvem', e); }
  return false;
}
let timerPautas;
/** Grava as pautas (na hora no navegador; na nuvem logo depois, juntando as mudanças seguidas). */
export function gravarPautas(lista) {
  pautas = lista;
  local.gravarMeta(CHAVE_PAUTAS, pautas);
  clearTimeout(timerPautas);
  return new Promise((ok) => {
    timerPautas = setTimeout(() => nuvem.gravarConfig(CHAVE_PAUTAS, pautas).then(() => ok(true), () => ok(false)), 500);
  });
}
export function novaPauta(dados = {}) {
  const f = FONTE_POR_ID[dados.fonte || 'projeto'];
  return {
    id: 'pt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fonte: f[0], obra: '', nucleo: f[2], angulo: '', plataforma: 'instagram', formato: 'post', tipo: '', modelo: '', status: 'pauta', dia: '', pos: null, notas: '',
    criado: new Date().toISOString(), ...dados,
  };
}
/** Formato e tipo de uma pauta, para mostrar: "Reel E2 · Antes & Depois". */
export function rotuloDaPauta(p) {
  const pid = G.plataformaDaPauta(p);
  const t = p.tipo || (p.modelo ? p.modelo.toLowerCase() : '');
  return rotuloDe({ plataforma: pid, formato: p.formato || 'post', tipo: t });
}

// ---------------------------------------------------------------------------
// Ocupação dos encaixes

/** O que ocupa um encaixe: o item do pool e a pauta. */
export function ocupantes(dia, pid, pos) {
  return {
    item: pool.lista().find((x) => x.rede === pid && x.dia === dia && x.pos === pos) || null,
    pauta: listaPautas().find((p) => G.plataformaDaPauta(p) === pid && p.dia === dia && p.pos === pos) || null,
  };
}
/** Núcleo efetivo do encaixe: o do item, o da pauta ou nenhum. */
export const ocupacao = (dia, pid, pos) => { const o = ocupantes(dia, pid, pos); return o.item || o.pauta || null; };
export const itemServe = (e, it) => G.itemServe(estrategia(), e, it);
export const pautaServe = (e, pt) => G.pautaServe(e, pt);

/**
 * Conflitos de núcleo na semana de uma plataforma (pelas regras dela): núcleo repetido em publicações seguidas,
 * Estúdio ao lado de Objetos. Devolve Map('dia:pos' → mensagem).
 */
export function conflitosDaSemana(seg, pid) {
  const p = plataforma(pid);
  const out = new Map();
  if (!p || p.modo !== 'encaixes' || !(p.regras?.nucleoSeguido || p.regras?.estudioObjetos)) return out;
  const seq = [];
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(seg, i);
    for (const e of encaixesDe(dia, pid)) seq.push({ dia, pos: e.pos, nucleo: ocupacao(dia, pid, e.pos)?.nucleo || e.nucleo });
  }
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    let msg = '';
    if (p.regras.nucleoSeguido && a.nucleo && a.nucleo === b.nucleo) msg = 'Mesmo núcleo em publicações seguidas';
    else if (p.regras.estudioObjetos && [a.nucleo, b.nucleo].sort().join() === 'estudio,objetos') msg = 'Estúdio encostado em Objetos';
    if (msg) out.set(`${b.dia}:${b.pos}`, msg);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Escalada por plataforma (os termos de cada uma ficam em plataforma.escalada)

/** Publicações de uma plataforma previstas numa semana da fase atual. `soPool`: só os formatos que vêm do pool
 *  (peças do editor: 3:4 e 2:3), que são os que formam a reserva. */
export function porSemana(pid, fase = faseAtualDe(pid), { soPool = false } = {}) {
  const p = plataforma(pid);
  const g = gradeDe(pid, fase);
  const doPool = (e) => !soPool || ['3x4', 'pin'].includes(G.formatoDe(p, e.formato)?.peca);
  const conta = (sem) => (sem || []).flat().filter(doPool).reduce((s, e) => s + (p?.modo === 'cota' ? Number(e.cota) || 0 : 1), 0);
  return Math.max(conta(g.A), conta(g.B || g.A));
}

/** Um dia cumprido numa plataforma: todo encaixe com publicação publicada (item ou pauta) e a cota publicada. */
function diaCumprido(dia, pid) {
  const p = plataforma(pid);
  if (p?.modo === 'cota') {
    const meta = cotaDoDia(dia, pid);
    return pool.lista().filter((x) => x.rede === pid && x.dia === dia && x.status === 'publicado').length >= meta;
  }
  return encaixesDe(dia, pid).every((e) => {
    const o = ocupantes(dia, pid, e.pos);
    return o.item?.status === 'publicado' || o.pauta?.status === 'publicada';
  });
}
/** Semanas seguidas cumpridas, da última semana fechada para trás. */
export function semanasCumpridas(pid, limite = 12) {
  let seg = somarDias(segundaDe(hoje()), -7), n = 0;
  while (n < limite) {
    let ok = true;
    for (let i = 0; i < 7 && ok; i++) ok = diaCumprido(somarDias(seg, i), pid);
    if (!ok) break;
    n++;
    seg = somarDias(seg, -7);
  }
  return n;
}
/** Reserva: prontos no pool (sem dia) da plataforma, contra as semanas de reserva da fase atual. */
export function reserva(pid) {
  const p = plataforma(pid);
  const semanas = Number(p?.escalada?.reserva) || 0;
  return { prontos: pool.lista().filter((x) => x.rede === pid && x.status === 'pronto').length, precisa: semanas * porSemana(pid, faseAtualDe(pid), { soPool: true }) };
}
/** A escalada de uma plataforma avança com a reserva formada e as semanas cumpridas que ela pede. */
export function escalada(pid) {
  const p = plataforma(pid);
  const fase = faseAtualDe(pid);
  const fases = Number(p?.escalada?.fases) || 1;
  const meta = Number(p?.escalada?.cumpridas) || 4;
  const r = reserva(pid);
  const cumpridas = semanasCumpridas(pid);
  const vazia = porSemana(pid, fase) === 0;
  return { fase, fases, ...r, cumpridas: vazia ? 0 : cumpridas, meta, vazia, pode: !vazia && fase < fases && r.prontos >= r.precisa && cumpridas >= meta };
}

export { isoDia };
