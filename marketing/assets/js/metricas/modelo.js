// Métricas — formato comum entre redes e cálculos.
//
// Cada rede entra por um adaptador que devolve posts no mesmo formato:
//   { rede, chave, id, data, dia, hora, dow, formato, link, legenda, mini,
//     nucleo, pub, vinc, tema, objetivo,
//     m: { alcance, views, curtidas, comentarios, salvos, compart, inter, seguiu, visitas },
//     proprias: { ...métricas que só existem nesta rede } }
// As páginas só conhecem esse formato; ligar TikTok ou YouTube = escrever outro adaptador.

export const REDES = [
  { id: 'instagram', nome: 'Instagram', ativa: true },
  { id: 'tiktok', nome: 'TikTok', ativa: false },
  { id: 'youtube', nome: 'YouTube', ativa: false },
];

export const DIA = 86400000;
export const FUSO = -3 * 3600000;
export const diaLocal = (ms) => new Date(ms + FUSO).toISOString().slice(0, 10);
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_SEMANA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const FAIXAS = [
  ['madrugada', 'Madrugada', 0, 6],
  ['manha', 'Manhã', 6, 12],
  ['tarde', 'Tarde', 12, 18],
  ['noite', 'Noite', 18, 24],
];
export const faixaDe = (h) => FAIXAS.find(([, , a, b]) => h >= a && h < b)?.[0];

export const OBJETIVOS = [
  ['atrair', 'Atrair', 'alcançar quem ainda não segue'],
  ['converter', 'Converter', 'levar a contato, visita ou orçamento'],
  ['relacionar', 'Relacionar', 'manter quem já segue por perto'],
];

const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const soma = (a) => a.reduce((x, y) => x + (y || 0), 0);
const def = (v) => v != null && Number.isFinite(v);

export const interacoesDe = (m) => m.interacoes ?? ((m.curtidas || 0) + (m.comentarios || 0) + (m.salvos || 0) + (m.compart || 0));

/** Hora e dia da semana em Brasília. */
function quando(iso) {
  const d = new Date(Date.parse(iso) + FUSO);
  return { hora: d.getUTCHours(), dow: d.getUTCDay() };
}

function formatoIG(p) {
  if (p.produto === 'REELS') return 'Reel';
  return { CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Imagem', VIDEO: 'Vídeo' }[p.tipo] || p.tipo || '—';
}

// ---------------------------------------------------------------------------
// Adaptador do Instagram

function postsInstagram(d) {
  const pubs = d.pubs || {};
  const et = d.etiquetas || {};
  return (d.posts || []).map((p) => {
    const v = d.vinculos?.[p.id];
    const pub = v?.pub ? pubs[v.pub] : null;
    const e = et[`ig:${p.id}`] || {};
    const m = p.m || {};
    return {
      rede: 'instagram', chave: `ig:${p.id}`, id: p.id, data: p.data, dia: p.dia, ...quando(p.data),
      formato: formatoIG(p), link: p.link, legenda: p.legenda || '', mini: p.mini ? p.id : '',
      vinc: v || null, pub, nucleo: pub?.nucleo || 'sem', tema: e.tema || '', objetivo: e.objetivo || '',
      m: {
        alcance: m.alcance ?? null, views: m.views ?? null, curtidas: m.curtidas ?? null, comentarios: m.comentarios ?? null,
        salvos: m.salvos ?? null, compart: m.compart ?? null, inter: interacoesDe(m), seguiu: m.seguiu ?? null, visitas: m.visitas ?? null,
      },
      proprias: { retencao: m.retencao ?? null },
    };
  });
}

/** Junta tudo o que veio do servidor no formato comum. */
export function normalizar(d) {
  const est = d.estado || {};
  return {
    bruto: d,
    contas: { instagram: est.conectado ? est : null },
    dias: { instagram: d.dias || {} },
    posts: postsInstagram(d),
    stories: d.stories || [],
    publico: { instagram: d.publico || {} },
    publicoHist: { instagram: d.publicoHist || {} },
    online: { instagram: d.online || {} },
    concorrentes: d.concorrentes || { max: 0, contas: [] },
  };
}

// ---------------------------------------------------------------------------
// Recorte pelos filtros

export function recortar(N, { periodo, rede, nucleo }) {
  const hoje = diaLocal(Date.now());
  const todosDias = Object.keys(N.dias.instagram).sort();
  const primeiro = todosDias[0] || hoje;
  const ndias = periodo === 'tudo'
    ? Math.max(1, Math.round((Date.parse(hoje) - Date.parse(primeiro)) / DIA))
    : Number(periodo);
  const inicio = periodo === 'tudo' ? primeiro : diaLocal(Date.now() - ndias * DIA);
  const inicioAnt = diaLocal(Date.parse(inicio) - ndias * DIA + 12 * 3600000);
  const okRede = (p) => rede === 'todas' || p.rede === rede;
  const okNuc = (p) => nucleo === 'todos' || p.nucleo === nucleo;
  const base = N.posts.filter((p) => okRede(p) && okNuc(p));
  const posts = base.filter((p) => p.dia >= inicio);
  const postsAnt = periodo === 'tudo' ? [] : base.filter((p) => p.dia >= inicioAnt && p.dia < inicio);
  // eixo diário: de `inicio` até ontem
  const eixo = [];
  for (let t = Date.parse(inicio); ; t += DIA) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (d >= hoje) break;
    eixo.push(d);
  }
  const diasIG = eixo.map((d) => ({ d, ...(N.dias.instagram[d] || {}) }));
  const diasAntIG = [];
  if (periodo !== 'tudo') for (let t = Date.parse(inicioAnt); ; t += DIA) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (d >= inicio) break;
    diasAntIG.push({ d, ...(N.dias.instagram[d] || {}) });
  }
  return { periodo, rede, nucleo, ndias, inicio, inicioAnt, hoje, eixo, posts, postsAnt, dias: { instagram: diasIG }, diasAnt: { instagram: diasAntIG } };
}

// ---------------------------------------------------------------------------
// Estatísticas

export const taxa = (p, k) => (p.m.alcance ? (p.m[k] ?? null) / p.m.alcance : null);
export const engaj = (p) => (p.m.alcance ? p.m.inter / p.m.alcance : null);

/** Médias de um grupo de posts. Taxas são razão de somas (posts grandes pesam mais). */
export function resumo(posts) {
  const comAlc = posts.filter((p) => p.m.alcance);
  const alcTotal = soma(comAlc.map((p) => p.m.alcance));
  const razao = (k) => {
    const ps = comAlc.filter((p) => def(p.m[k]));
    const a = soma(ps.map((p) => p.m.alcance));
    return a ? soma(ps.map((p) => p.m[k])) / a : null;
  };
  return {
    n: posts.length,
    alcance: media(comAlc.map((p) => p.m.alcance)),
    views: media(posts.filter((p) => def(p.m.views)).map((p) => p.m.views)),
    inter: media(posts.map((p) => p.m.inter)),
    engaj: alcTotal ? soma(comAlc.map((p) => p.m.inter)) / alcTotal : null,
    salvosTx: razao('salvos'),
    compartTx: razao('compart'),
    seguiuMil: (() => { const r = razao('seguiu'); return r == null ? null : r * 1000; })(),
    visitas: media(posts.filter((p) => def(p.m.visitas)).map((p) => p.m.visitas)),
  };
}

/** Agrupa posts por uma chave; devolve linhas com resumo e índice frente à média geral. */
export function agrupar(posts, chaveDe, nomeDe = (k) => k) {
  const geral = resumo(posts);
  const g = {};
  for (const p of posts) {
    const k = chaveDe(p);
    if (k == null || k === '') continue;
    (g[k] = g[k] || []).push(p);
  }
  return {
    geral,
    linhas: Object.entries(g).map(([k, ps]) => {
      const r = resumo(ps);
      return { k, nome: nomeDe(k), ...r, ind: geral.engaj && r.engaj != null ? r.engaj / geral.engaj : null, indAlc: geral.alcance && r.alcance != null ? r.alcance / geral.alcance : null };
    }),
  };
}

export const valores = (dias, k) => dias.map((x) => x[k]).filter(def);
export const somaDias = (dias, k) => { const v = valores(dias, k); return v.length ? soma(v) : null; };
export const mediaDias = (dias, k) => media(valores(dias, k));

/** Variação de seguidores no período (fotos diárias); senão, soma dos novos. */
export function ganhoSeguidores(N, c) {
  const dias = N.dias.instagram;
  const fotos = Object.keys(dias).sort().filter((d) => d >= c.inicio && dias[d].seguidores != null);
  if (fotos.length >= 2) return dias[fotos.at(-1)].seguidores - dias[fotos[0]].seguidores;
  const s = somaDias(c.dias.instagram, 'seguiram');
  const u = somaDias(c.dias.instagram, 'deixaram');
  if (s != null) return s - (u || 0);
  return somaDias(c.dias.instagram, 'novos');
}

/** Matriz 7×24 (dom..sáb × 0..23 h, Brasília) com a média de seguidores online. */
export function matrizOnline(online, desde) {
  const acc = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => []));
  for (const [d, horas] of Object.entries(online || {})) {
    if (d.startsWith('_') || (desde && d < desde)) continue;
    const dow = new Date(d + 'T12:00:00Z').getUTCDay();
    for (const [h, v] of Object.entries(horas)) if (def(v)) acc[dow][Number(h)].push(v);
  }
  const m = acc.map((linha) => linha.map(media));
  const ndias = new Set(Object.keys(online || {}).filter((d) => !d.startsWith('_') && (!desde || d >= desde))).size;
  return { m, ndias };
}

/** As melhores janelas de horário (dia + hora), pela média de seguidores online. */
export function melhoresJanelas(mat, n = 3) {
  // o pico de cada dia, depois os dias mais fortes (evita listar 19h, 20h, 21h do mesmo dia)
  const picos = [];
  mat.m.forEach((linha, dow) => {
    let melhor = null;
    linha.forEach((v, h) => { if (def(v) && (!melhor || v > melhor.v)) melhor = { dow, h, v }; });
    if (melhor) picos.push(melhor);
  });
  return picos.sort((a, b) => b.v - a.v).slice(0, n);
}

/**
 * Resumo de um concorrente nos últimos `dias` (padrão 30). Métricas públicas apenas.
 * Muitas contas escondem as curtidas: o engajamento público usa só os posts com curtidas
 * visíveis (sem misturar com posts que só têm comentários); os comentários valem para todos.
 */
export function resumoConcorrente(c, dias = 30) {
  const corte = diaLocal(Date.now() - dias * DIA);
  const posts = (c.posts || []).filter((p) => p.dia >= corte);
  const seg = c.perfil?.seguidores || null;
  const engPub = (p) => (seg && p.curtidas != null ? (p.curtidas + (p.comentarios || 0)) / seg : null);
  const ultimos = (c.posts || []).slice(0, 30);
  const mediana = (arr) => { const v = arr.filter(def).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const visiveis = ultimos.filter((p) => p.curtidas != null);
  const engMediana = visiveis.length >= 3 ? mediana(visiveis.map(engPub)) : null;
  const comMediana = mediana(ultimos.map((p) => p.comentarios));
  const formatos = {};
  for (const p of ultimos) { const f = formatoIG(p); formatos[f] = (formatos[f] || 0) + 1; }
  const fotos = Object.keys(c.fotos || {}).sort();
  const desde = fotos.find((d) => d >= corte) || fotos[0];
  const ganho = fotos.length >= 2 && desde !== fotos.at(-1) ? c.fotos[fotos.at(-1)] - c.fotos[desde] : null;
  /** Quanto um post superou a mediana da própria conta (curtidas+coment. se visíveis; senão comentários). */
  const fator = (p) => {
    if (p.curtidas != null && engMediana) return engPub(p) / engMediana;
    if (p.comentarios != null && comMediana) return p.comentarios / comMediana;
    return null;
  };
  return {
    seguidores: seg, ganho, ganhoDesde: desde, postsPeriodo: posts.length, porSemana: posts.length / (dias / 7),
    engMediana, comMediana, nVisiveis: visiveis.length, nUltimos: ultimos.length, formatos, ultimos,
    ultimo: c.posts?.[0]?.dia || null, curtidasOcultas: ultimos.length > 0 && visiveis.length < 3,
    engPub, fator,
  };
}

export { media, soma, def, formatoIG };
