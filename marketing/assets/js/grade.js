// Grade do plano de publicação, sem navegador: plataformas, formatos, tipos, grade semanal e encaixes de um dia.
// Usada pelo plano.js (página) e pelo Worker (Início do Universo: publicações de hoje), para os dois
// calcularem os encaixes do mesmo jeito. Datas em AAAA-MM-DD; nada aqui lê o relógio nem o armazenamento.
// Cópia em marketing-odisse/assets/js/grade.js (o Worker importa de lá): mudou aqui, mude lá.
//
// Estratégia guardada (cfg:estrategia, versão 2):
//   { versao: 2, cicloInicio, plataformas: [plataforma], grades: { <plataforma>: { <fase>: { A, B } } } }
//   plataforma = { id, nome, modo: 'encaixes' | 'cota', horarios: [..], cotaMax, regras: {..},
//                  escalada: { fases, reserva, cumpridas }, fases: [{ fase, desde }], formatos: [formato], arquivada }
//   formato    = { id, nome, peca: '3x4' | 'pin' | '9x16' | 'video', tipos: [tipo], arquivado }
//   tipo       = { id, nome, codigo, nucleo, arquivado }
//   A e B = 7 dias (segunda a domingo); no modo encaixes, cada dia é [{ formato, tipo, nucleo }] na ordem de
//   publicação; no modo cota, [{ formato, cota }]. B nulo = igual à A.
// A versão 1 (só Instagram: { grade, fases, cicloInicio }) é convertida por normalizar(), sem perder nada.

// ---------------------------------------------------------------------------
// Formatos e modelos do documento (seção 05)

export const POST_DE = {
  arquitetos: 'Carrossel de projeto',
  objetos: 'Ensaio de peças',
  elaia: 'Carrossel resumo',
  estudio: 'Fotografias',
};
export const REELS = {
  E1: ['elaia', 'Book Phrase'], E2: ['arquitetos', 'Antes & Depois'], E3: ['arquitetos', 'Tour + Voiceover'],
  E4: ['arquitetos', 'Spatial Glitch'], E5: ['arquitetos', 'Materiais'], E6: ['elaia', 'Cortes'],
  E7: ['objetos', 'Unboxing'], E8: ['objetos', 'Compilação de materiais'], E9: ['estudio', 'Pure Edit'], E10: ['estudio', 'Creation Takes'],
};
/** Peça do editor (ou arquivo) que atende um formato. O pool guarda `formato` = '3x4' | 'pin'. */
export const PECAS = [['3x4', '3:4'], ['pin', '2:3'], ['9x16', '9:16'], ['video', 'Vídeo']];
export const PECA_DESCRICAO = { '3x4': '3:4 · 1080 × 1440', pin: '2:3 · 1000 × 1500', '9x16': '9:16 · 1080 × 1920', video: 'vídeo' };

// ---------------------------------------------------------------------------
// Grade semanal do documento (seções 02 e 03): o Instagram da versão 1. Dias de segunda (0) a domingo (6).

const P = (nucleo) => ({ nucleo, formato: 'post', rotulo: POST_DE[nucleo] });
const R = (nucleo, e) => ({ nucleo, formato: 'reel', rotulo: e });
const [ARQ, OBJ, EL, EST] = ['arquitetos', 'objetos', 'elaia', 'estudio'];
const F3 = [[R(ARQ, 'E2'), P(OBJ)], [P(ARQ), R(EL, 'E6')], [R(ARQ, 'E3'), P(OBJ)], [P(ARQ), P(EL)], [P(EST)], [P(ARQ)], [P(EL)]];
export const GRADE_PADRAO = {
  1: { A: [[P(OBJ)], [P(ARQ)], [P(OBJ)], [P(EL), P(ARQ)], [P(EST)], [P(ARQ)], [P(EL)]], B: null },
  2: { A: [[R(ARQ, 'E2'), P(OBJ)], [P(ARQ)], [P(OBJ), R(ARQ, 'E3')], [P(EL), P(ARQ)], [P(EST)], [P(ARQ)], [P(EL)]], B: null },
  3: { A: F3, B: null },
  4: { A: F3.map((d, i) => (i === 4 ? [R(ARQ, 'E4'), P(EST)] : d)), B: null },
  5: {
    A: [[P(OBJ), R(ARQ, 'E2')], [R(EL, 'E6'), P(ARQ)], [P(OBJ), R(ARQ, 'E3')], [P(EL), P(ARQ), R(EST, 'E10')], [R(ARQ, 'E4'), P(EST)], [P(ARQ), R(EL, 'E1')], [R(EST, 'E9'), P(EL)]],
    B: [[R(ARQ, 'E2'), P(OBJ)], [P(ARQ), R(EL, 'E6')], [R(ARQ, 'E3'), P(OBJ)], [P(ARQ), P(EL), R(ARQ, 'E5')], [P(EST), R(ARQ, 'E4')], [R(OBJ, 'E7'), P(ARQ)], [R(OBJ, 'E8'), P(EL)]],
  },
};
export const FASES = [1, 2, 3, 4, 5];
export const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// ---------------------------------------------------------------------------
// Plataformas padrão

export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const semana = (f) => Array.from({ length: 7 }, (_, i) => f(i));

function tiposDoPost() {
  return Object.entries(POST_DE).map(([nucleo, nome]) => ({ id: slug(nome), nome, codigo: '', nucleo }));
}
function tiposDoReel() {
  return Object.entries(REELS).map(([codigo, [nucleo, nome]]) => ({ id: codigo.toLowerCase(), nome, codigo, nucleo }));
}
export function plataformasPadrao() {
  return [
    {
      id: 'instagram', nome: 'Instagram', modo: 'encaixes', horarios: ['11h–13h', '15h–17h', '20h–22h'], cotaMax: 3,
      regras: { nucleoSeguido: true, estudioObjetos: true, umProjetoPorDia: false, pastasAlternadas: false },
      escalada: { fases: 5, reserva: 1, cumpridas: 4 }, fases: [{ fase: 1, desde: '2000-01-03' }],
      formatos: [
        { id: 'post', nome: 'Post', peca: '3x4', tipos: tiposDoPost() },
        { id: 'reel', nome: 'Reel', peca: 'video', tipos: tiposDoReel() },
      ],
    },
    {
      id: 'pinterest', nome: 'Pinterest', modo: 'cota', horarios: [], cotaMax: 3,
      regras: { nucleoSeguido: false, estudioObjetos: false, umProjetoPorDia: true, pastasAlternadas: true },
      escalada: { fases: 3, reserva: 0, cumpridas: 4 }, fases: [{ fase: 2, desde: '2000-01-03' }],
      formatos: [{ id: 'pin', nome: 'Pin', peca: 'pin', tipos: [] }],
    },
    {
      id: 'tiktok', nome: 'TikTok', modo: 'encaixes', horarios: ['18h–20h'], cotaMax: 3,
      regras: { nucleoSeguido: false, estudioObjetos: false, umProjetoPorDia: false, pastasAlternadas: false },
      escalada: { fases: 1, reserva: 0, cumpridas: 4 }, fases: [{ fase: 1, desde: '2000-01-03' }],
      formatos: [{ id: 'video', nome: 'Vídeo', peca: 'video', tipos: [] }],
    },
  ];
}
/** Grade vazia de uma fase: no modo cota, a cota da fase (1, 2, 3…) em todos os dias. */
export function gradeVazia(p, fase) {
  if (p.modo === 'cota') {
    const f = p.formatos.find((x) => !x.arquivado)?.id || 'pin';
    return { A: semana(() => [{ formato: f, cota: Math.min(fase, p.cotaMax || 3) }]), B: null };
  }
  return { A: semana(() => []), B: null };
}

// ---------------------------------------------------------------------------
// Versão 1 → 2

function encaixeV1(e, tiposPost) {
  if (e.formato === 'reel') {
    const cod = String(e.rotulo || 'E1').toUpperCase();
    return { formato: 'reel', tipo: cod.toLowerCase(), nucleo: e.nucleo };
  }
  const nome = String(e.rotulo || POST_DE[e.nucleo] || '').trim();
  let t = tiposPost.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
  if (!t && nome) { t = { id: slug(nome), nome, codigo: '', nucleo: e.nucleo }; tiposPost.push(t); }
  return { formato: 'post', tipo: t?.id || '', nucleo: e.nucleo };
}

/** Estratégia na versão 2, completa (aceita a versão 1, nula ou parcial). Não altera o objeto recebido. */
export function normalizar(est, hojeIso = '2000-01-03') {
  const ini = est?.cicloInicio || segundaDeG(hojeIso);
  if (est?.versao === 2 && Array.isArray(est.plataformas)) {
    const n = { ...est, cicloInicio: ini, grades: { ...(est.grades || {}) } };
    for (const p of n.plataformas) n.grades[p.id] ||= {};
    return n;
  }
  const plataformas = plataformasPadrao();
  const ig = plataformas[0];
  if (Array.isArray(est?.fases) && est.fases.length) ig.fases = est.fases.map((x) => ({ fase: Number(x.fase) || 1, desde: x.desde }));
  const tiposPost = ig.formatos[0].tipos;
  const conv = (sem) => (sem ? sem.map((dia) => (dia || []).map((e) => encaixeV1(e, tiposPost))) : null);
  const fonte = est?.grade || GRADE_PADRAO;
  const grades = { instagram: {}, pinterest: {}, tiktok: {} };
  for (const f of FASES) {
    const g = fonte[f] || GRADE_PADRAO[f];
    grades.instagram[f] = { A: conv(g.A), B: conv(g.B) };
  }
  for (const f of [1, 2, 3]) grades.pinterest[f] = gradeVazia(plataformas[1], f);
  grades.tiktok[1] = gradeVazia(plataformas[2], 1);
  return { versao: 2, cicloInicio: ini, plataformas, grades };
}

// ---------------------------------------------------------------------------
// Consultas

export const plataformasAtivas = (est) => (est?.plataformas || []).filter((p) => !p.arquivada);
export const plataformaDe = (est, id) => (est?.plataformas || []).find((p) => p.id === id) || null;
export const formatoDe = (p, id) => p?.formatos?.find((f) => f.id === id) || null;
export const tipoDe = (f, id) => f?.tipos?.find((t) => t.id === id) || null;

/** Horários pela posição entre os encaixes da mesma plataforma: a primeira, as do meio e a última. */
export function horariosDe(lista, n) {
  const hs = (lista || []).filter(Boolean);
  if (!hs.length) return Array.from({ length: n }, () => '');
  if (n <= 1) return [hs[0]];
  if (n === 2) return [hs[0], hs[hs.length - 1]];
  return Array.from({ length: n }, (_, i) => (i === 0 ? hs[0] : i === n - 1 ? hs[hs.length - 1] : hs[Math.min(i, hs.length - 2)] || hs[1] || hs[0]));
}
/** Compatibilidade: horários do Instagram da versão 1. */
export const horarios = (n) => horariosDe(['11h–13h', '15h–17h', '20h–22h'], n);

/** Rótulo de um encaixe: "Post · Carrossel de projeto", "Reel E2 · Antes & Depois". */
export function rotuloDe(est, e) {
  const p = plataformaDe(est, e.plataforma || 'instagram');
  const f = formatoDe(p, e.formato);
  const t = tipoDe(f, e.tipo);
  const fn = f?.nome || e.formato || '';
  return t ? `${fn}${t.codigo ? ' ' + t.codigo : ''} · ${t.nome}` : fn;
}

// ---------------------------------------------------------------------------
// Datas puras (dia civil AAAA-MM-DD, sem fuso: meio-dia UTC)

const dUTC = (iso) => new Date(`${iso}T12:00:00Z`);
const isoUTC = (d) => d.toISOString().slice(0, 10);
export const somarDiasG = (iso, n) => isoUTC(new Date(dUTC(iso).getTime() + n * 864e5));
export const diaDaSemana = (iso) => (dUTC(iso).getUTCDay() + 6) % 7; // 0 = segunda
export const segundaDeG = (iso) => somarDiasG(iso, -diaDaSemana(iso));

// ---------------------------------------------------------------------------
// Encaixes de um dia a partir da estratégia guardada (normalizada)

/** Fase da escalada de uma plataforma num dia (a fase muda a partir da segunda-feira em que foi trocada). */
export function faseDe(est, plataforma, dia) {
  const p = typeof plataforma === 'string' ? plataformaDe(est, plataforma) : plataforma;
  const fs = [...(p?.fases || [])].sort((a, b) => a.desde.localeCompare(b.desde));
  let f = 1;
  for (const x of fs) if (x.desde <= dia) f = x.fase;
  return Math.min(Math.max(1, f), p?.escalada?.fases || f);
}

/** Semana do ciclo de 4 (1–4, A nas ímpares e B nas pares). `hojeIso` só vale quando não há início guardado. */
export function semanaNaEstrategia(est, dia, hojeIso) {
  const ini = est?.cicloInicio || segundaDeG(hojeIso || dia);
  const seg = segundaDeG(dia);
  const k = Math.round((dUTC(seg) - dUTC(ini)) / (7 * 864e5));
  const n = ((k % 4) + 4) % 4 + 1;
  return { n, ab: n % 2 ? 'A' : 'B', inicio: somarDiasG(seg, -(n - 1) * 7), seg };
}

/** Grade { A, B } de uma plataforma numa fase (vazia quando ainda não foi desenhada). */
export function gradeDe(est, pid, fase) {
  const p = plataformaDe(est, pid);
  return est?.grades?.[pid]?.[fase] || (p ? gradeVazia(p, fase) : { A: semana(() => []), B: null });
}
/** Lista do dia da semana (0 = segunda) numa plataforma, fase e semana A/B. */
export function diaDaGrade(est, pid, fase, ab, dow) {
  const g = gradeDe(est, pid, fase);
  const sem = ab === 'B' && g.B ? g.B : g.A;
  return sem?.[dow] || [];
}

/**
 * Encaixes previstos num dia, de todas as plataformas ativas:
 *   modo encaixes → { plataforma, pos, formato, tipo, nucleo, horario, rotulo }  (pos = ordem dentro da plataforma)
 *   modo cota     → { plataforma, cota, formato, rotulo }                         (um por plataforma, se a cota > 0)
 */
export function encaixesNaEstrategia(estBruta, dia, hojeIso) {
  const est = normalizar(estBruta, hojeIso || dia);
  const ab = semanaNaEstrategia(est, dia, hojeIso).ab;
  const dow = diaDaSemana(dia);
  const out = [];
  for (const p of plataformasAtivas(est)) {
    const lista = diaDaGrade(est, p.id, faseDe(est, p, dia), ab, dow).filter((e) => !formatoDe(p, e.formato)?.arquivado);
    if (p.modo === 'cota') {
      const cota = lista.reduce((s, e) => s + (Number(e.cota) || 0), 0);
      if (cota > 0) out.push({ plataforma: p.id, cota, formato: lista[0].formato, rotulo: formatoDe(p, lista[0].formato)?.nome || '' });
      continue;
    }
    const hs = horariosDe(p.horarios, lista.length);
    lista.forEach((e, pos) => out.push({ plataforma: p.id, pos, formato: e.formato, tipo: e.tipo, nucleo: e.nucleo, horario: hs[pos], rotulo: rotuloDe(est, { ...e, plataforma: p.id }) }));
  }
  return out;
}

/** Plataforma de uma pauta (as antigas não guardavam: pin → Pinterest, o resto → Instagram). */
export const plataformaDaPauta = (p) => p?.plataforma || (p?.formato === 'pin' ? 'pinterest' : 'instagram');

/** Um item do pool serve a um encaixe? Mesma plataforma e a peça do formato é a do item. */
export function itemServe(est, e, it) {
  if (!it || it.rede !== e.plataforma) return false;
  const f = formatoDe(plataformaDe(est, e.plataforma), e.formato);
  return !f || f.peca === (it.formato || '3x4');
}
/** Uma pauta serve a um encaixe? Mesma plataforma e mesmo formato. */
export const pautaServe = (e, pt) => !!pt && plataformaDaPauta(pt) === e.plataforma && (pt.formato === e.formato || (!pt.formato && e.formato === 'post'));
