// Grade do plano de publicação, sem navegador: formatos, grade padrão, horários e encaixes de um dia.
// Usada pelo plano.js (página) e pelo Worker (Início do Universo: publicações de hoje), para os dois
// calcularem os encaixes do mesmo jeito. Datas em AAAA-MM-DD; nada aqui lê o relógio nem o armazenamento.

// ---------------------------------------------------------------------------
// Formatos e modelos (seção 05)

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
export const rotuloDe = (e) => (e.formato === 'reel' ? `Reel ${e.rotulo}${REELS[e.rotulo] ? ` · ${REELS[e.rotulo][1]}` : ''}` : `Post · ${e.rotulo || POST_DE[e.nucleo] || ''}`);

// ---------------------------------------------------------------------------
// Grade semanal (seções 02 e 03). Dias de segunda (0) a domingo (6); em cada dia, a ordem de publicação.
// Fases 1 a 4 têm uma semana só; a fase 5 alterna semana A (1 e 3 do ciclo) e semana B (2 e 4).

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

/** Horário pela posição no dia, não pelo tipo (seção 03). */
export function horarios(n) {
  if (n <= 1) return ['11h–13h'];
  if (n === 2) return ['11h–13h', '20h–22h'];
  if (n === 3) return ['11h–13h', '15h–17h', '20h–22h'];
  return Array.from({ length: n }, (_, i) => (i === 0 ? '11h–13h' : i === n - 1 ? '20h–22h' : '15h–17h'));
}

// ---------------------------------------------------------------------------
// Datas puras (dia civil AAAA-MM-DD, sem fuso: meio-dia UTC)

const dUTC = (iso) => new Date(`${iso}T12:00:00Z`);
const isoUTC = (d) => d.toISOString().slice(0, 10);
export const somarDiasG = (iso, n) => isoUTC(new Date(dUTC(iso).getTime() + n * 864e5));
export const diaDaSemana = (iso) => (dUTC(iso).getUTCDay() + 6) % 7; // 0 = segunda
export const segundaDeG = (iso) => somarDiasG(iso, -diaDaSemana(iso));

// ---------------------------------------------------------------------------
// Encaixes de um dia a partir da estratégia guardada ({ grade, fases, cicloInicio })

/** Fase da escalada valendo num dia (a fase muda a partir da segunda-feira em que foi trocada). */
export function faseNaEstrategia(est, dia) {
  const fs = [...(est?.fases || [])].sort((a, b) => a.desde.localeCompare(b.desde));
  let f = 1; // antes da primeira troca registrada, fase 1
  for (const x of fs) if (x.desde <= dia) f = x.fase;
  return f;
}

/** Semana do ciclo de 4 (1–4, A nas ímpares e B nas pares). `hojeIso` só vale quando não há início guardado. */
export function semanaNaEstrategia(est, dia, hojeIso) {
  const ini = est?.cicloInicio || segundaDeG(hojeIso || dia);
  const seg = segundaDeG(dia);
  const k = Math.round((dUTC(seg) - dUTC(ini)) / (7 * 864e5));
  const n = ((k % 4) + 4) % 4 + 1;
  return { n, ab: n % 2 ? 'A' : 'B', inicio: somarDiasG(seg, -(n - 1) * 7), seg };
}

/** Grade de um dia da semana (0 = segunda) numa fase e semana. */
export function gradeNaEstrategia(est, fase, ab, dow) {
  const g = est?.grade?.[fase] || GRADE_PADRAO[fase];
  const sem = ab === 'B' && g.B ? g.B : g.A;
  return sem?.[dow] || [];
}

/** Encaixes previstos num dia: [{ pos, nucleo, formato, rotulo, horario }]. */
export function encaixesNaEstrategia(est, dia, hojeIso) {
  const lista = gradeNaEstrategia(est, faseNaEstrategia(est, dia), semanaNaEstrategia(est, dia, hojeIso).ab, diaDaSemana(dia));
  const hs = horarios(lista.length);
  return lista.map((e, pos) => ({ ...e, pos, horario: hs[pos] }));
}
