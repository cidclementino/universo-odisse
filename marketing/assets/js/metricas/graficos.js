// Métricas — gráficos (SVG e HTML simples, sem bibliotecas).
// Regras: um eixo só; uma cor por série; texto sempre em tinta, nunca na cor da série;
// toda marca tem dica ao passar o mouse.

export const NF = new Intl.NumberFormat('pt-BR');
const NFc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const n = (v) => (v == null || !Number.isFinite(v) ? '—' : NF.format(Math.round(v)));
export const nc = (v) => (v == null || !Number.isFinite(v) ? '—' : Math.abs(v) < 10000 ? NF.format(Math.round(v)) : NFc.format(v));
export const pct = (v, casas = 1) => (v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(casas).replace('.', ',') + '%');
export const dec = (v, casas = 1) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(casas).replace('.', ','));
export const dataCurta = (d, ano = true) => { if (!d) return '—'; const [a, m, dd] = d.split('-'); return `${dd}/${m}${ano ? '/' + a.slice(2) : ''}`; };
export const sinal = (v, f = n) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`);

// Cores de dados (validadas para daltonismo sobre o papel): série 1 azul, série 2 ocre.
export const COR = { s1: '#2F6FAF', s2: '#BB8248', tinta: '#3F4B57' };

// ---------------------------------------------------------------------------
// Dica flutuante única para qualquer elemento com data-tip (HTML permitido, já escapado)

let dica = null;
export function ligarDicas(raiz) {
  if (raiz.dataset.dicas) return;
  raiz.dataset.dicas = '1';
  dica = document.createElement('div');
  dica.className = 'g-tip';
  document.body.appendChild(dica);
  raiz.addEventListener('pointerover', (e) => {
    const alvo = e.target.closest('[data-tip]');
    if (!alvo || !raiz.contains(alvo)) return;
    dica.innerHTML = alvo.dataset.tip;
    dica.style.opacity = 1;
    const r = alvo.getBoundingClientRect();
    const w = dica.offsetWidth;
    dica.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`;
    dica.style.top = `${Math.max(8, r.top - dica.offsetHeight - 8)}px`;
  });
  raiz.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) dica.style.opacity = 0; });
  raiz.addEventListener('scroll', () => { dica.style.opacity = 0; }, true);
}

// ---------------------------------------------------------------------------
// Linha diária (uma série por vez)

const G = { w: 1000, h: 240, e: 48, d: 12, t: 14, b: 30 };
let seq = 0;

/**
 * @param o { eixo: ['AAAA-MM-DD'], valores: [n|null], nome, marcas?: Set(dia), notaMarca?: (dia) => texto }
 * Devolve { html, ligar(raiz) }.
 */
export function linha(o) {
  const id = 'gl' + (++seq);
  const vals = o.valores.filter((v) => v != null);
  if (!o.eixo.length) return { html: '<p class="met-vazio">Ainda não há dias coletados.</p>', ligar() {} };
  // séries de nível (ex.: total de seguidores) não começam no zero, senão a variação some
  const vmin = vals.length ? Math.min(...vals) : 0;
  const vmax = vals.length ? Math.max(...vals) : 1;
  const desdeZero = o.zero !== false || !vals.length;
  const amp = desdeZero ? Math.max(1, vmax) : Math.max(4, vmax - vmin);
  const bruto = amp / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto);
  const min = desdeZero ? 0 : Math.floor(vmin / passo) * passo;
  const max = min + passo * Math.max(4, Math.ceil((vmax - min) / passo));
  const x = (i) => G.e + (o.eixo.length <= 1 ? 0 : (i * (G.w - G.e - G.d)) / (o.eixo.length - 1));
  const y = (v) => G.t + (1 - (v - min) / (max - min)) * (G.h - G.t - G.b);
  const grade = Array.from({ length: Math.round((max - min) / passo) + 1 }, (_, k) => k / Math.round((max - min) / passo)).map((f) => {
    const v = min + (max - min) * f;
    return `<line x1="${G.e}" x2="${G.w - G.d}" y1="${y(v)}" y2="${y(v)}" class="g-grade${f === 0 ? ' base' : ''}"/><text x="${G.e - 8}" y="${y(v) + 4}" class="g-rot" text-anchor="end">${v >= 10000 ? NFc.format(v) : NF.format(v)}</text>`;
  }).join('');
  let cam = '';
  let aberto = false;
  o.valores.forEach((v, i) => {
    if (v == null) { aberto = false; return; }
    cam += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    aberto = true;
  });
  const isolados = o.valores.map((v, i) => (v != null && o.valores[i - 1] == null && o.valores[i + 1] == null ? `<circle cx="${x(i)}" cy="${y(v)}" r="4" class="g-ponto"/>` : '')).join('');
  const marcas = o.marcas ? o.eixo.map((d, i) => (o.marcas.has(d) ? `<line x1="${x(i)}" x2="${x(i)}" y1="${G.h - G.b}" y2="${G.h - G.b + 6}" class="g-post"/>` : '')).join('') : '';
  const nRot = Math.min(6, o.eixo.length);
  const rotX = Array.from({ length: nRot }, (_, k) => Math.round((k * (o.eixo.length - 1)) / Math.max(1, nRot - 1)))
    .map((i) => `<text x="${x(i)}" y="${G.h - 6}" class="g-rot" text-anchor="${i === 0 ? 'start' : i === o.eixo.length - 1 ? 'end' : 'middle'}">${dataCurta(o.eixo[i], false)}</text>`).join('');
  const html = `<div class="met-grafico" id="${id}">
    <svg viewBox="0 0 ${G.w} ${G.h}" role="img" aria-label="${esc(o.nome)} por dia">
      ${grade}${marcas}<path d="${cam}" class="g-linha"/>${isolados}
      <line class="g-mira" y1="${G.t}" y2="${G.h - G.b}" x1="0" x2="0"/>
      <circle class="g-foco" r="5" cx="-10" cy="-10"/>
      ${rotX}
      <rect class="g-alvo" x="${G.e}" y="0" width="${G.w - G.e - G.d}" height="${G.h}"/>
    </svg>
    <div class="g-dica"></div>
    ${vals.length ? '' : '<p class="met-vazio sob">Sem dados desta métrica no período.</p>'}
  </div>`;
  const ligar = (raiz) => {
    const el = raiz.querySelector('#' + id);
    const alvo = el?.querySelector('.g-alvo');
    if (!alvo) return;
    const svg = alvo.ownerSVGElement;
    const mira = el.querySelector('.g-mira');
    const foco = el.querySelector('.g-foco');
    const dc = el.querySelector('.g-dica');
    alvo.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * G.w;
      const i = Math.max(0, Math.min(o.eixo.length - 1, Math.round(((px - G.e) / (G.w - G.e - G.d)) * (o.eixo.length - 1))));
      const v = o.valores[i];
      mira.setAttribute('x1', x(i)); mira.setAttribute('x2', x(i)); mira.style.opacity = 1;
      if (v != null) { foco.setAttribute('cx', x(i)); foco.setAttribute('cy', y(v)); foco.style.opacity = 1; } else foco.style.opacity = 0;
      const extra = o.notaMarca?.(o.eixo[i]);
      dc.innerHTML = `<b>${dataCurta(o.eixo[i])}</b><span>${esc(o.nome)}: <b>${v == null ? 'sem dado' : n(v)}</b></span>${extra ? `<span class="g-dica-post">${esc(extra)}</span>` : ''}`;
      dc.style.opacity = 1;
      dc.style.left = `${Math.min(Math.max((x(i) / G.w) * r.width, 80), r.width - 80)}px`;
    });
    alvo.addEventListener('pointerleave', () => { mira.style.opacity = 0; foco.style.opacity = 0; dc.style.opacity = 0; });
  };
  return { html, ligar };
}

// ---------------------------------------------------------------------------
// Barras horizontais (uma série; categorias em ordem dada)

/** itens: [{ rot, v, tip?, nota? }]; fmt formata o valor mostrado. */
export function barras(itens, { fmt = n, max } = {}) {
  if (!itens.length) return '<p class="met-vazio">Sem dados.</p>';
  const topo = max ?? Math.max(...itens.map((i) => i.v || 0), 1e-9);
  return `<div class="g-barras">${itens.map((i) => `
    <div class="g-barra-l" data-tip="${esc(i.tip || `<b>${esc(i.rot)}</b> ${fmt(i.v)}`)}">
      <span class="g-barra-rot">${esc(i.rot)}</span>
      <span class="g-barra-trilho"><i style="width:${Math.max(0, ((i.v || 0) / topo) * 100)}%"></i></span>
      <span class="g-barra-v">${fmt(i.v)}${i.nota ? ` <small>${esc(i.nota)}</small>` : ''}</span>
    </div>`).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Barra dividida em duas partes (ex.: seguidores × não seguidores)

export function divisao(a, b, rotA, rotB) {
  const t = (a || 0) + (b || 0);
  if (!t) return '<p class="met-vazio">Sem dados no período.</p>';
  const pa = a / t;
  return `<div class="g-div">
    <div class="g-div-barra">
      <i style="width:${pa * 100}%;background:${COR.s1}" data-tip="<b>${esc(rotA)}</b> ${n(a)} · ${pct(pa)}"></i>
      <i style="width:${(1 - pa) * 100}%;background:${COR.s2}" data-tip="<b>${esc(rotB)}</b> ${n(b)} · ${pct(1 - pa)}"></i>
    </div>
    <div class="g-legenda">
      <span><i style="background:${COR.s1}"></i>${esc(rotA)} <b>${pct(pa, 0)}</b></span>
      <span><i style="background:${COR.s2}"></i>${esc(rotB)} <b>${pct(1 - pa, 0)}</b></span>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Mapa de calor 7 × 24 (uma cor, do claro ao escuro)

/**
 * mat: [7][24] valores; marcas: { 'dow-h': texto } (posts publicados nesse horário).
 * Linhas na ordem seg..dom.
 */
export function mapaCalor(mat, { marcas = {}, nome = 'Seguidores online', fmt = n } = {}) {
  const todos = mat.flat().filter((v) => v != null);
  if (!todos.length) return '<p class="met-vazio">Os horários aparecem depois das primeiras coletas (o Instagram só informa contas com 100 seguidores ou mais).</p>';
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const cel = (dow, h) => {
    const v = mat[dow][h];
    const f = v == null ? null : max === min ? 1 : (v - min) / (max - min);
    const marca = marcas[`${dow}-${h}`];
    const bg = f == null ? 'transparent' : `color-mix(in srgb, ${COR.s2} ${Math.round(12 + f * 88)}%, #FAFAF7)`;
    const tip = `<b>${nomes[dow]} ${String(h).padStart(2, '0')}h</b> ${esc(nome)}: ${v == null ? 'sem dado' : fmt(v)}${marca ? `<br>${esc(marca)}` : ''}`;
    return `<span class="g-cel${f == null ? ' vazia' : ''}${marca ? ' marca' : ''}" style="background:${bg}" data-tip="${esc(tip)}"></span>`;
  };
  return `<div class="g-calor">
    <span></span>${Array.from({ length: 24 }, (_, h) => `<span class="g-calor-h">${h % 3 === 0 ? h : ''}</span>`).join('')}
    ${ordem.map((dow) => `<span class="g-calor-d">${nomes[dow]}</span>${Array.from({ length: 24 }, (_, h) => cel(dow, h)).join('')}`).join('')}
  </div>
  <div class="g-calor-leg"><span>menos</span><i></i><span>mais</span>${Object.keys(marcas).length ? '<span class="g-calor-marca"><b></b> horário com post publicado no período</span>' : ''}</div>`;
}
