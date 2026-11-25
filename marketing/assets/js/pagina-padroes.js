// Padrões (#/padroes): os padrões dos cards — modelos, estilos de texto, espaçamentos, véu e carimbo.
// Abas Modelos · Estilos de texto · Espaçamentos · Véu e carimbo. Página de ação: sem barra de números.
//
// Modelos: cada modelo aparece uma vez (universais, o pin e os específicos do núcleo escolhido). "Ver como" troca o
// núcleo em que tudo se desenha. A bancada mostra o modelo escolhido com nome editável, as variáveis de teste
// (opções, textos, texto curto/longo, imagens) e a conferência nos quatro núcleos. "Tornar padrão" muda o padrão
// do modelo; valem só para os cards novos (padroes-cards.js → padraoInicial).
// As edições ficam num rascunho, mostrado aqui (previsualizar) e gravado em Salvar padrões (cfg:padroes-cards).
// Ao sair da página sem salvar, os módulos voltam ao gravado; o rascunho fica até Descartar ou recarregar.

import { TEXTO, ESPACO, GRUPOS_ESPACO, MACROS, TEXTO_POR_CLASSE, corpoMin, corpoMax } from './padroes.js';
import { NUCLEOS, ORDEM_NUCLEOS, padroesDoNucleo } from './nucleos.js';
import { codigoDe, renderCard, exemploDe, ajustarLayout, grupoDe, GRUPOS, opcoesDoModelo, estruturaDe, opcoesDoVeu, OP_VEU, MESCLAS, VEU_PADRAO, LARG } from './templates.js';
import * as PC from './padroes-cards.js';
import { abas, cabecalho, segmentado, secao, bandeja, acao, etiqueta, quando, icone, toque, esc, link } from '/base/v2/componentes.js';

const { ENTRADAS, ENTRADA, ORIGINAL } = PC;
const POR_CHAVE = ENTRADA;
const codDe = (e, nid) => codigoDe(e.dono || nid, e.m.id);
const nomeOriginal = ORIGINAL.nomes;
const nomeNucleo = (nid) => NUCLEOS[nid].nome;

// ------------------------------------------------------------------ estado
const est = {
  aba: 'modelos', nucleo: 'arquitetos', formato: '3x4', teste: 'exemplo', imagens: 'fotos', filtro: 'todos', busca: '',
  sel: 'o01', ver: 'um', guias: 'recorte',
  vars: {}, // variáveis de teste por modelo ({ opcoes, textos }): só o que se vê aqui, não são padrão
};
let rascunho = null; // padrões em edição (forma de padroes-cards.js)
let raiz = null, avisar = () => {}, ligado = false, espera;

const veuDe = (id) => (id === 'sem' ? 0 : rascunho.veu[id] ?? ORIGINAL.veu[id]);
const veuPadraoDe = () => rascunho.veuPadrao ?? ORIGINAL.veuPadrao;
const mesclaDe = () => rascunho.veuMescla ?? ORIGINAL.veuMescla;
const carimboDe = () => rascunho.carimbo ?? ORIGINAL.carimbo;
const textoDe = (id) => ({ ...structuredClone(ORIGINAL.texto[id]), ...structuredClone(rascunho.texto[id] || {}) });

/** Quantas mudanças o rascunho tem em relação ao que está gravado. */
function pendentes() {
  const a = PC.normalizar(rascunho), b = PC.atual();
  let n = 0;
  for (const k of ['nomes', 'veu', 'texto']) for (const x of new Set([...Object.keys(a[k]), ...Object.keys(b[k])])) n += JSON.stringify(a[k][x]) !== JSON.stringify(b[k][x]);
  for (const k of ['opcoes', 'textos']) for (const x of new Set([...Object.keys(a[k]), ...Object.keys(b[k])])) {
    const ka = a[k][x] || {}, kb = b[k][x] || {};
    for (const y of new Set([...Object.keys(ka), ...Object.keys(kb)])) n += JSON.stringify(ka[y]) !== JSON.stringify(kb[y]);
  }
  n += (a.veuPadrao !== b.veuPadrao) + (a.veuMescla !== b.veuMescla) + (a.carimbo !== b.carimbo);
  return n;
}

function hostConferencia() {
  let h = document.getElementById('mk-pd-host');
  if (!h) {
    h = Object.assign(document.createElement('div'), { id: 'mk-pd-host' });
    h.setAttribute('aria-hidden', 'true');
    document.body.appendChild(h);
  }
  return h;
}

// ------------------------------------------------------------------ fotos de teste (geradas, tons médios)
function foto(semente) {
  const c = document.createElement('canvas'); c.width = 540; c.height = 720;
  const x = c.getContext('2d');
  let s = semente * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const ceu = x.createLinearGradient(0, 0, 0, 720);
  const tons = [['#9FA9B0', '#D8D2C6'], ['#B9A58C', '#E9DFCE'], ['#7D8A86', '#C9CEC4']][semente % 3];
  ceu.addColorStop(0, tons[0]); ceu.addColorStop(1, tons[1]); x.fillStyle = ceu; x.fillRect(0, 0, 540, 720);
  for (let i = 0; i < 7; i++) {
    const w = 80 + r() * 220, h = 160 + r() * 420, px = r() * 540 - 60, py = 720 - h;
    const g = 120 + r() * 80;
    x.fillStyle = `rgb(${g},${g - 6},${g - 14})`; x.fillRect(px, py, w, h);
    x.fillStyle = `rgba(40,38,36,${0.25 + r() * 0.3})`;
    for (let yy = py + 20; yy < 700; yy += 34) for (let xx = px + 12; xx < px + w - 16; xx += 26) x.fillRect(xx, yy, 12, 18);
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px, py, 6, h);
  }
  const chao = x.createLinearGradient(0, 600, 0, 720); chao.addColorStop(0, 'rgba(60,55,50,0)'); chao.addColorStop(1, 'rgba(60,55,50,.55)');
  x.fillStyle = chao; x.fillRect(0, 600, 540, 120);
  const d = x.getImageData(0, 0, 540, 720);
  for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/jpeg', 0.8);
}
const FOTOS = {};
const fotoDe = (slot) => (FOTOS[slot] ||= foto('abcdefgh'.indexOf(slot[0]) + 1 || 4));


// ------------------------------------------------------------------ montar e conferir um card
const resolver = (d, n) => (typeof d.padrao === 'function' ? d.padrao(n) : d.padrao);
function listaOpcoes(e, nid, card) {
  const n = NUCLEOS[nid];
  const l = opcoesDoModelo(e.m, n, card);
  l.push(...opcoesDoVeu(estruturaDe({ card, nucleo: n, globais: padroesDoNucleo(nid) }).veus, n)
    .map((d) => ({ ...d, rot: d.grupo ? `${d.grupo} · ${d.rot.toLowerCase()}` : d.rot })));
  return l;
}
/** Padrão de uma opção: o editado nesta página, senão o do modelo. */
function padraoDe(e, d, nid) {
  const ed = rascunho.opcoes[e.chave]?.[d.k];
  if (ed != null) return ed;
  if (d.k === 'carimbo') return carimboDe();
  if (d.k === 'veu' || d.k === 'veuBase') return veuPadraoDe();
  if (d.k === 'veuMescla' || d.k === 'veuBaseMescla') return mesclaDe();
  return resolver(d, NUCLEOS[nid]);
}
const textoCurto = (h) => String(h).replace(/<br\s*\/?>/g, ' ').split(/\s+/).slice(0, 3).join(' ');
const textoLongo = (h) => `${h} ${String(h).replace(/<br\s*\/?>/g, ' ')}`;

function montarCard(e, nid) {
  const n = NUCLEOS[nid];
  const base = { id: 'pp', modelo: e.m.id, campos: exemploDe(nid, e.m.id), imgs: {}, opcoes: {}, textos: {} };
  if (est.imagens === 'fotos') for (const s of Object.keys(e.m.slots || {})) base.imgs[s] = { ref: s };
  // padrões (editados ou não) entram primeiro; as variáveis de teste por cima
  const v = est.vars[e.chave] || {};
  for (const d of listaOpcoes(e, nid, base)) {
    const p = padraoDe(e, d, nid);
    const val = v.opcoes?.[d.k] ?? p;
    if (d.valores.some(([x]) => x === val)) base.opcoes[d.k] = val;
  }
  base.textos = { ...structuredClone(rascunho.textos[e.chave] || {}) };
  for (const [ch, t] of Object.entries(v.textos || {})) base.textos[ch] = { ...(base.textos[ch] || {}), ...t };
  if (est.teste !== 'exemplo') {
    const chaves = new Set(estruturaDe({ card: base, nucleo: n, globais: padroesDoNucleo(nid) }).textos.map((t) => t.chave));
    for (const k of chaves) if (base.campos[k]) base.campos[k] = est.teste === 'curto' ? textoCurto(base.campos[k]) : textoLongo(base.campos[k]);
  }
  return base;
}

function htmlCard(e, nid) {
  const card = montarCard(e, nid);
  return `<div class="card${e.formato === 'pin' ? ' pin' : ''}">${renderCard({
    card, indice: 1, total: 8, nucleo: NUCLEOS[nid], globais: padroesDoNucleo(nid), modo: 'miniatura',
    fonteImagem: (c, s) => fotoDe(s),
  })}</div>`;
}

/** O que está quebrando num card já montado no documento (em 1080 de largura). */
function conferir(cardEl, e) {
  const p = [];
  const alto = cardEl.offsetHeight, base = cardEl.getBoundingClientRect();
  const fim = e.formato === 'pin' ? alto : 1260;
  cardEl.querySelectorAll('.fluxo').forEach((f) => {
    if (f.scrollHeight > f.clientHeight + 2) p.push({ t: 'Bloco de texto não cabe na área', tom: 'atraso' });
  });
  cardEl.querySelectorAll('.fluxo [data-txt]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.height) return;
    const y = Math.round(r.bottom - base.top);
    if (y > fim + 1) p.push({ t: `Texto passa do recorte quadrado (até y ${y}, limite ${fim})`, tom: 'atraso' });
    if (el.scrollWidth > el.clientWidth + 2) p.push({ t: 'Palavra maior que a coluna', tom: 'atraso' });
  });
  cardEl.querySelectorAll('[data-txt]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height && (r.bottom - base.top > alto + 1 || r.right - base.left > LARG + 1)) p.push({ t: 'Texto sai do card', tom: 'atraso' });
  });
  const sup = cardEl.querySelectorAll('[data-suprimida]').length;
  if (sup) p.push({ t: `${sup} ${sup === 1 ? 'linha' : 'linhas'} da ficha fora por falta de espaço`, tom: 'atencao' });
  cardEl.querySelectorAll('[data-fit]').forEach((el) => {
    const [min] = el.dataset.fit.split(',').map(Number);
    if (parseFloat(el.style.fontSize || '0') && parseFloat(el.style.fontSize) <= min && el.closest('.fluxo')?.scrollHeight > el.closest('.fluxo').clientHeight + 2)
      p.push({ t: `Título no corpo mínimo (${min} px) e ainda não cabe`, tom: 'atraso' });
  });
  // uma linha por tipo de problema
  const vistos = new Set();
  return p.filter((x) => !vistos.has(x.t) && vistos.add(x.t));
}

// Conferência de todos os modelos nos quatro núcleos (render fora da tela, como na página atual).
let CONF = {};
function conferirTudo() {
  const host = hostConferencia();
  CONF = {};
  for (const e of ENTRADAS) {
    CONF[e.chave] = {};
    for (const nid of e.dono ? [e.dono] : ORDEM_NUCLEOS) {
      host.innerHTML = htmlCard(e, nid);
      const c = host.firstElementChild;
      ajustarLayout(c);
      CONF[e.chave][nid] = conferir(c, e);
    }
  }
  host.innerHTML = '';
}
const problemas = (e, nid) => CONF[e.chave]?.[nid] || [];
const nucleosQuebrando = (e) => Object.entries(CONF[e.chave] || {}).filter(([, l]) => l.length).map(([nid]) => nid);

// ------------------------------------------------------------------ miniaturas (escala pela largura)
function escalar(raiz) {
  raiz.querySelectorAll('.mk-pd-mini').forEach((mini) => {
    const c = mini.firstElementChild;
    if (!c) return;
    if (!c.dataset.ok) { ajustarLayout(c); c.dataset.ok = 1; }
    c.style.transform = `scale(${mini.clientWidth / LARG})`;
  });
}


function filtros() {
  const nucleos = ORDEM_NUCLEOS.map((nid) => ({ id: nid, rotulo: nomeNucleo(nid) }));
  return `<div class="mk-pd-filtros">
    <div class="mk-pd-filtro"><span>Ver como</span>${segmentado(nucleos, est.nucleo, 'nucleo', 'Núcleo')}</div>
    <div class="mk-pd-filtro"><span>Formato</span>${segmentado([{ id: '3x4', rotulo: 'Post 3:4' }, { id: 'pin', rotulo: 'Pin 2:3' }], est.formato, 'formato', 'Formato')}</div>
    <div class="mk-pd-filtro"><span>Texto de teste</span>${segmentado([{ id: 'curto', rotulo: 'Curto' }, { id: 'exemplo', rotulo: 'Exemplo' }, { id: 'longo', rotulo: 'Longo' }], est.teste, 'teste', 'Texto de teste')}</div>
    <div class="mk-pd-filtro"><span>Imagens</span>${segmentado([{ id: 'fotos', rotulo: 'Fotos de teste' }, { id: 'vazias', rotulo: 'Vazias' }], est.imagens, 'imagens', 'Imagens')}</div>
    <label class="mk-pd-busca">${icone('busca', 14)}<input type="search" data-campo="busca" value="${esc(est.busca)}" placeholder="Código ou nome" aria-label="Procurar modelo"></label>
  </div>`;
}

function itemGrade(e) {
  const nid = e.dono || est.nucleo;
  const p = problemas(e, nid);
  const outros = nucleosQuebrando(e).filter((x) => x !== nid);
  const alterado = rascunho.nomes[e.chave] != null || rascunho.opcoes[e.chave] || rascunho.textos[e.chave];
  return `<button type="button" class="mk-pd-item${est.sel === e.chave ? ' is-sel' : ''}" data-sel="${esc(e.chave)}" aria-pressed="${est.sel === e.chave}">
    <span class="mk-pd-mini${e.formato === 'pin' ? ' is-pin' : ''}">${htmlCard(e, nid)}</span>
    <span class="mk-pd-item__txt"><span class="mk-pd-cod">${esc(codDe(e, nid))}</span><b>${esc(e.m.nome)}</b></span>
    <span class="mk-pd-item__est">${p.length ? quando(`${p.length} ${p.length === 1 ? 'problema' : 'problemas'}`, 'atraso', { pequeno: true }) : quando('ok', 'ok', { pequeno: true })}
      ${outros.length ? `<small>também em ${outros.map(nomeNucleo).join(', ')}</small>` : ''}${alterado ? etiqueta('alterado') : ''}</span>
  </button>`;
}

function grades() {
  const q = est.busca.trim().toLowerCase();
  const passa = (e) => (!q || `${codDe(e, e.dono || est.nucleo)} ${e.m.nome}`.toLowerCase().includes(q))
    && (est.filtro === 'todos' || problemas(e, e.dono || est.nucleo).length);
  const doFormato = ENTRADAS.filter((e) => e.formato === est.formato);
  const univ = doFormato.filter((e) => !e.dono && passa(e));
  const esp = doFormato.filter((e) => e.dono === est.nucleo && passa(e));
  const comProb = doFormato.filter((e) => (!e.dono || e.dono === est.nucleo) && problemas(e, e.dono || est.nucleo).length).length;
  const porGrupo = (lista) => GRUPOS.map(([gid, gnome]) => {
    const it = lista.filter((e) => grupoDe(e.m) === gid);
    return it.length ? `<div class="mk-pd-grupo">${esc(gnome)} <small>${it.length}</small></div><div class="mk-pd-grade">${it.map(itemGrade).join('')}</div>` : '';
  }).join('');
  const lado = segmentado([{ id: 'todos', rotulo: 'Todos' }, { id: 'problemas', rotulo: 'Com problemas', n: comProb }], est.filtro, 'filtro', 'Mostrar');
  const vazio = '<p class="mk-pd-vazio">Nenhum modelo com esse filtro.</p>';
  return secao({ titulo: est.formato === 'pin' ? 'Pin universal' : 'Universais', n: univ.length, lado, corpo: bandeja(univ.length ? porGrupo(univ) : vazio, { cartao: false }) })
    + (est.formato === '3x4' ? secao({ titulo: `Só do ${nomeNucleo(est.nucleo)}`, n: esp.length, corpo: bandeja(esp.length ? porGrupo(esp) : vazio, { cartao: false }) }) : '');
}

function bancada() {
  const e = POR_CHAVE[est.sel] && POR_CHAVE[est.sel].formato === est.formato ? POR_CHAVE[est.sel] : ENTRADAS.find((x) => x.formato === est.formato);
  est.sel = e.chave;
  const nid = e.dono || est.nucleo;
  const card = montarCard(e, nid);
  const v = est.vars[e.chave] || {};
  const nucleosDoModelo = e.dono ? [e.dono] : ORDEM_NUCLEOS;

  // Personalização: valor de teste (Segmentado) + padrão do modelo
  const ops = listaOpcoes(e, nid, card).map((d) => {
    const p = padraoDe(e, d, nid);
    const atual = card.opcoes[d.k] ?? p;
    const orig = d.k === 'carimbo' ? ORIGINAL.carimbo : ['veu', 'veuBase'].includes(d.k) ? ORIGINAL.veuPadrao
      : ['veuMescla', 'veuBaseMescla'].includes(d.k) ? ORIGINAL.veuMescla : resolver(d, NUCLEOS[nid]);
    const rotPad = d.valores.find(([x]) => x === p)?.[1] || p;
    return `<div class="mk-pd-var">
      <span class="mk-pd-var__rot">${esc(d.rot)}</span>
      <div class="mk-pd-var__ctl">${segmentado(d.valores.map(([id, r]) => ({ id, rotulo: r })), atual, `op:${d.k}`, d.rot)}</div>
      <span class="mk-pd-var__pad">${atual === p ? `Padrão${p !== orig ? ' <b>editado</b>' : ''}` : `Padrão: ${esc(rotPad)} · <button type="button" class="mk-pd-mini-acao" data-padrao="${esc(d.k)}" data-v="${esc(atual)}">Tornar padrão</button>`}
        ${rascunho.opcoes[e.chave]?.[d.k] != null ? `<button type="button" class="mk-pd-mini-acao" data-voltar-op="${esc(d.k)}">Voltar ao original</button>` : ''}</span>
    </div>`;
  }).join('');

  const QUAL = { linha: 'linha de contexto', citacao: 'citação', sub: 'subtítulo', p1t: 'etapa 01', p2t: 'etapa 02', p3t: 'etapa 03', contatoTitulo: 'chamada', contatoTexto: 'apoio' };
  const txts = estruturaDe({ card, nucleo: NUCLEOS[nid], globais: padroesDoNucleo(nid) }).textos.map((t) => {
    const conf = card.textos?.[t.chave] || {};
    const atual = conf.estilo && MACROS[t.macro].classes.includes(conf.estilo) ? conf.estilo : t.padrao;
    const nome = MACROS[t.macro].nome + (QUAL[t.chave] ? ` · ${QUAL[t.chave]}` : ` · ${t.chave}`);
    const padEstilo = rascunho.textos[e.chave]?.[t.chave]?.estilo || t.padrao;
    const opcoes = MACROS[t.macro].classes.map((cls, i) => ({ id: cls, rotulo: String(i + 1).padStart(2, '0') }));
    const tam = (cls) => { const x = TEXTO_POR_CLASSE[cls]; return corpoMin(x) === corpoMax(x) ? `${corpoMax(x)} px` : `${corpoMin(x)}–${corpoMax(x)} px`; };
    return `<div class="mk-pd-var">
      <label class="mk-pd-var__rot mk-pd-check"><input type="checkbox" data-txt-ativo="${esc(t.chave)}" ${t.ativo ? 'checked' : ''}> ${esc(nome)}</label>
      <div class="mk-pd-var__ctl">${segmentado(opcoes, atual, `txt:${t.chave}`, nome)}<small class="mk-pd-tam">${tam(atual)}</small></div>
      <span class="mk-pd-var__pad">${atual === padEstilo ? 'Padrão' : `Padrão: ${padEstilo.replace(/.*-/, '')} · <button type="button" class="mk-pd-mini-acao" data-padrao-txt="${esc(t.chave)}" data-v="${esc(atual)}">Tornar padrão</button>`}</span>
    </div>`;
  }).join('');

  const palco = est.ver === 'quatro' && !e.dono
    ? `<div class="mk-pd-quatro">${ORDEM_NUCLEOS.map((n) => {
      const p = problemas(e, n);
      return `<figure class="mk-pd-quatro__item${n === nid ? ' is-atual' : ''}"><span class="mk-pd-mini${e.formato === 'pin' ? ' is-pin' : ''} mk-pd-guias-${est.guias}">${htmlCard(e, n)}</span>
        <figcaption><b>${nomeNucleo(n)}</b> ${p.length ? quando(`${p.length}`, 'atraso', { pequeno: true }) : quando('ok', 'ok', { pequeno: true })} <span class="mk-pd-cod">${esc(codDe(e, n))}</span></figcaption></figure>`;
    }).join('')}</div>`
    : `<div class="mk-pd-palco"><span class="mk-pd-mini mk-pd-grande${e.formato === 'pin' ? ' is-pin' : ''} mk-pd-guias-${est.guias}">${htmlCard(e, nid)}</span></div>`;

  const confs = nucleosDoModelo.map((n) => {
    const l = problemas(e, n);
    return `<div class="mk-pd-conf__linha${n === nid ? ' is-atual' : ''}"><button type="button" class="mk-pd-conf__nuc" data-ver-nucleo="${n}">${esc(nomeNucleo(n))}</button>
      <span>${l.length ? l.map((x) => `<span class="mk-pd-conf__p is-${x.tom}">${esc(x.t)}</span>`).join('') : '<span class="mk-pd-conf__p is-ok">Nada quebrando</span>'}</span></div>`;
  }).join('');

  const temVars = Object.keys(v.opcoes || {}).length || Object.keys(v.textos || {}).length;
  return `<div class="mk-pd-bancada">
    <div class="mk-pd-bancada__cab">
      <span class="mk-pd-cod mk-pd-cod--grande">${esc(codDe(e, nid))}</span>
      <label class="mk-pd-nome"><input data-campo="nome" value="${esc(e.m.nome)}" aria-label="Nome do modelo"><span class="mk-pd-lapis">${icone('contratos', 13)}</span></label>
      <span class="mk-pd-bancada__etq">${etiqueta(GRUPOS.find(([g]) => g === grupoDe(e.m))?.[1] || '')}${e.dono ? etiqueta('Só ' + nomeNucleo(e.dono)) : etiqueta(e.formato === 'pin' ? 'Pin universal' : 'Universal · 4 núcleos')}</span>
    </div>
    <p class="mk-pd-desc">${esc(e.m.desc || '')}</p>
    <div class="mk-pd-bancada__ctl">
      ${e.dono ? '' : segmentado([{ id: 'um', rotulo: nomeNucleo(nid) }, { id: 'quatro', rotulo: 'Os quatro núcleos' }], est.ver, 'ver', 'Vista')}
      ${segmentado([{ id: 'sem', rotulo: 'Sem guias' }, { id: 'recorte', rotulo: 'Recorte quadrado' }, { id: 'grid', rotulo: 'Grid' }], est.guias, 'guias', 'Guias')}
    </div>
    ${palco}
    <div class="mk-pd-bloco"><div class="mk-pd-bloco__tit">Conferência <small>${nucleosDoModelo.length === 1 ? 'só neste núcleo' : 'nos quatro núcleos'}</small></div><div class="mk-pd-conf">${confs}</div></div>
    ${ops ? `<div class="mk-pd-bloco"><div class="mk-pd-bloco__tit">Personalização ${temVars ? '<button type="button" class="mk-pd-mini-acao" data-faz="limpar-vars">Voltar tudo ao padrão</button>' : ''}</div>${ops}</div>` : ''}
    ${txts ? `<div class="mk-pd-bloco"><div class="mk-pd-bloco__tit">Textos</div>${txts}</div>` : ''}
  </div>`;
}

function vistaModelos() {
  return `${filtros()}<div class="mk-pd-duas"><div class="mk-pd-esq">${grades()}</div><aside class="mk-pd-dir">${bandeja(bancada())}</aside></div>
    <div class="ui-nota mk-pd-notas">As variáveis da bancada mudam só o que se vê aqui, para testar. <b>Tornar padrão</b> muda o padrão do modelo nas publicações novas; o nome vale para o editor e para o arquivo. A conferência roda nos quatro núcleos a cada mudança: bloco que não cabe, texto abaixo de y 1260, palavra maior que a coluna e linhas de ficha que saíram. O código não muda.</div>`;
}

function vistaTexto() {
  const AM = { capa: 'Um horizonte', titulo: 'Três ambientes, um ponto de fuga.', chamada: 'Vamos conversar.', citacao: 'O horror está em nunca saber o que esperar.', texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.', legenda: 'A figura sob a cobertura metálica.', rotulo: 'A tese' };
  const campo = (id, k, v, passo, larg = 64) => `<input class="mk-pd-num" type="number" step="${passo}" value="${v}" data-estilo="${id}" data-k="${k}" style="width:${larg}px" aria-label="${k}">`;
  const linhas = TEXTO.map((t) => {
    const p = textoDe(t.id);
    const faixa = Array.isArray(p.tamanho);
    const corpo = faixa ? `${campo(t.id, 'min', p.tamanho[0], 1, 56)}<span>–</span>${campo(t.id, 'max', p.tamanho[1], 1, 56)}` : campo(t.id, 'tam', p.tamanho, 1, 56);
    const n = ENTRADAS.filter((e) => e.formato === '3x4').length;
    const mudou = JSON.stringify(p) !== JSON.stringify(ORIGINAL.texto[t.id]);
    return `<div class="mk-pd-tx">
      <div class="mk-pd-tx__amostra"><div class="card mk-pd-amostra"><div class="${t.classe}">${esc(AM[t.id])}</div></div></div>
      <div class="mk-pd-tx__nome"><b>${t.nome}</b> ${mudou ? etiqueta('alterado') : ''}<small>${esc(t.uso)}</small></div>
      <div class="mk-pd-tx__campos">
        <label><span>Corpo px</span><span class="mk-pd-par">${corpo}</span></label>
        <label><span>Peso</span>${campo(t.id, 'peso', p.peso, 10)}</label>
        <label><span>Entrelinha</span>${campo(t.id, 'entrelinha', p.entrelinha, 0.01)}</label>
        <label><span>Tracking em</span>${campo(t.id, 'tracking', p.tracking, 0.005, 84)}</label>
      </div>
    </div>`;
  }).join('');
  const probTotal = ENTRADAS.reduce((s, e) => s + Object.values(CONF[e.chave] || {}).filter((l) => l.length).length, 0);
  return secao({ titulo: 'Estilos de texto', n: TEXTO.length, lado: probTotal ? quando(`${probTotal} combinações de modelo e núcleo com problema`, 'atraso') : quando('Nenhum modelo quebrando', 'ok'), corpo: bandeja(`<div class="mk-pd-txs">${linhas}</div>`) })
    + '<div class="ui-nota mk-pd-notas">Amostras em 42%. Corpo em faixa (Título 01, Título 02, Corpo 01): o texto começa no máximo e desce até o mínimo para caber. Cada mudança refaz a conferência de todos os modelos; o número ao lado do título diz quantas combinações de modelo e núcleo estão quebrando.</div>';
}

function vistaEspaco() {
  const blocos = GRUPOS_ESPACO.map(([g, nome]) => {
    const it = ESPACO.filter((x) => x.grupo === g);
    return secao({ titulo: nome, n: it.length, corpo: bandeja(`<div class="mk-pd-esp">${it.map((x) => `<div class="mk-pd-esp__l">
      <span class="mk-pd-esp__barra"><i style="width:${Math.min(x.v, 180) / 1.8}%"></i></span><b class="mk-pd-esp__v">${x.v} px</b>
      <span class="mk-pd-esp__nome"><b>${esc(x.nome)}</b><small>${esc(x.uso)}</small></span></div>`).join('')}</div>`) });
  }).join('');
  return blocos + '<div class="ui-nota mk-pd-notas">Só leitura: os espaçamentos montam o grid de todos os modelos (colunas, recorte quadrado, posições do carimbo e do selo); mudar um deles é trabalho de código, numa conversa com o Claude.</div>';
}

function vistaVeu() {
  const NIVEIS = OP_VEU.valores;
  const amostraVeu = (f) => `<span class="mk-pd-veu-am">${ORDEM_NUCLEOS.map((n) => `<i style="background:linear-gradient(90deg, transparent, ${NUCLEOS[n].veu}${Math.round(Math.min(1, 0.72 * f) * 255).toString(16).padStart(2, '0')}), url(${fotoDe('a')}) center/cover;background-blend-mode:${mesclaDe()}, normal"></i>`).join('')}</span>`;
  const linhas = NIVEIS.map(([id, rot]) => `<div class="mk-pd-veu__l">
    <b>${esc(rot)}</b>
    <label class="mk-pd-veu__f"><input type="range" min="0" max="2" step="0.05" value="${veuDe(id)}" data-veu="${id}" ${id === 'sem' ? 'disabled' : ''} aria-label="Fator do véu ${rot}"><input class="mk-pd-num" type="number" min="0" max="2" step="0.05" value="${veuDe(id)}" data-veu="${id}" ${id === 'sem' ? 'disabled' : ''} aria-label="Fator ${rot}"></label>
    ${amostraVeu(veuDe(id))}
    <span>${veuDe(id) !== (ORIGINAL.veu[id] ?? 0) ? `${etiqueta('alterado')} <small>original ${String(ORIGINAL.veu[id]).replace('.', ',')}</small>` : ''}</span>
  </div>`).join('');
  const prev = ENTRADA.o08;
  const strip = `<div class="mk-pd-quatro">${ORDEM_NUCLEOS.map((n) => `<figure class="mk-pd-quatro__item"><span class="mk-pd-mini">${htmlCard(prev, n)}</span><figcaption><b>${nomeNucleo(n)}</b> <small>véu ${esc(NUCLEOS[n].veu)}</small></figcaption></figure>`).join('')}</div>`;
  return secao({ titulo: 'Véu', lado: `<span class="mk-pd-filtro"><span>Padrão dos cards novos</span>${segmentado(NIVEIS.map(([id, r]) => ({ id, rotulo: r })), veuPadraoDe(), 'veupadrao', 'Véu padrão')}</span>
      <span class="mk-pd-filtro"><span>Mesclagem</span>${segmentado(MESCLAS.map(([id, r]) => ({ id, rotulo: r })), mesclaDe(), 'veumescla', 'Mesclagem padrão do véu')}</span>`,
    corpo: bandeja(`<div class="mk-pd-veu">${linhas}</div>`) })
    + secao({ titulo: 'Prévia no O-08', lado: segmentado(NIVEIS.map(([id, r]) => ({ id, rotulo: r })), est.vars.o08?.opcoes?.veu ?? veuPadraoDe(), 'previaveu', 'Nível na prévia'), corpo: bandeja(strip, { cartao: false }) })
    + secao({ titulo: 'Carimbo', lado: segmentado([{ id: 'linhas', rotulo: 'Só linhas' }, { id: 'cheio', rotulo: 'Fundo cheio' }], carimboDe(), 'carimbo', 'Carimbo padrão'), corpo: '' })
    + '<div class="ui-nota mk-pd-notas">O fator multiplica a opacidade de cada gradiente do modelo (teto 1). A cor do véu de cada núcleo vem da Marca (Perfil › Marca: Estúdio e Arquitetos ardósia, Objetos grafite, Elaia terra); outra cor da paleta se escolhe por modelo (Modelos › Tornar padrão) ou por card, no editor. O nível e a mesclagem escolhidos aqui valem para os véus de cima e de baixo dos cards novos; no editor, cada card ajusta os dois separados.</div>';
}

const ABAS = [['modelos', 'Modelos', ''], ['texto', 'Estilos de texto', 'texto'], ['espaco', 'Espaçamentos', 'espaco'], ['veu', 'Véu e carimbo', 'veu']];

function topo() {
  const n = pendentes();
  return `${abas('Padrões', ABAS.map(([id, r, sub]) => ({ href: `#/padroes${sub ? '/' + sub : ''}`, rotulo: r, ativa: est.aba === id })))}
    ${cabecalho('Padrões dos cards', n ? `<span class="mk-pd-pend">${n} ${n === 1 ? 'alteração não salva' : 'alterações não salvas'}</span>` : 'Tudo salvo',
      `<div class="mk-pd-acoes">${link('Publicações', '#/publicacoes/posts')}${n ? acao('Descartar', { dados: { faz: 'descartar' } }) : ''}${acao('Salvar padrões', { principal: true, dados: { faz: 'salvar' }, desligada: !n })}</div>`)}`;
}

function desenhar() {
  if (!raiz) return;
  const corpo = { modelos: vistaModelos, texto: vistaTexto, espaco: vistaEspaco, veu: vistaVeu }[est.aba]();
  const rolagem = raiz.scrollTop;
  const rolBancada = raiz.querySelector('.mk-pd-dir')?.scrollTop || 0;
  raiz.innerHTML = `<div class="mk-pagina">${topo()}${corpo}</div>`;
  escalar(raiz);
  raiz.scrollTop = rolagem;
  const dir = raiz.querySelector('.mk-pd-dir');
  if (dir) dir.scrollTop = rolBancada;
}

/** Mudou um padrão: mostra o rascunho, refaz a conferência e redesenha. */
function mudouPadrao({ conferir: refazer = true } = {}) {
  PC.previsualizar(rascunho);
  if (refazer) conferirTudo();
  desenhar();
}
const varsDe = (k) => (est.vars[k] ||= { opcoes: {}, textos: {} });
const limpo = (o) => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object' && !Object.keys(o[k]).length) delete o[k]; };

async function salvar() {
  try {
    await PC.gravar(rascunho);
    rascunho = structuredClone(PC.atual());
    toque('Padrões salvos');
  } catch (e) {
    console.warn('[padrões] gravar', e);
    rascunho = structuredClone(PC.atual());
    avisar('Guardado neste computador; não foi possível salvar na nuvem.');
  }
  desenhar();
}

function ligar() {
  if (ligado) return;
  ligado = true;
  raiz.addEventListener('click', (ev) => {
    const seg = ev.target.closest('[data-segmentado]');
    if (seg) {
      const g = seg.dataset.segmentado, v = seg.dataset.valor;
      if (['nucleo', 'formato', 'filtro', 'ver', 'guias'].includes(g)) { est[g] = v; return desenhar(); }
      if (['teste', 'imagens'].includes(g)) { est[g] = v; conferirTudo(); return desenhar(); }
      if (g.startsWith('op:')) { varsDe(est.sel).opcoes[g.slice(3)] = v; conferirTudo(); return desenhar(); }
      if (g.startsWith('txt:')) { const t = varsDe(est.sel).textos; t[g.slice(4)] = { ...(t[g.slice(4)] || {}), estilo: v }; conferirTudo(); return desenhar(); }
      if (g === 'veupadrao') { rascunho.veuPadrao = v; return mudouPadrao({ conferir: false }); }
      if (g === 'veumescla') { rascunho.veuMescla = v; return mudouPadrao({ conferir: false }); }
      if (g === 'previaveu') { Object.assign(varsDe('o08').opcoes, { veu: v, veuBase: v }); return desenhar(); }
      if (g === 'carimbo') { rascunho.carimbo = v; return mudouPadrao(); }
    }
    const it = ev.target.closest('[data-sel]');
    if (it) { est.sel = it.dataset.sel; desenhar(); if (innerWidth <= 1180) raiz.querySelector('.mk-pd-dir')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    const pd = ev.target.closest('[data-padrao]');
    if (pd) {
      (rascunho.opcoes[est.sel] ||= {})[pd.dataset.padrao] = pd.dataset.v;
      delete est.vars[est.sel]?.opcoes[pd.dataset.padrao];
      toque('Padrão do modelo alterado');
      return mudouPadrao();
    }
    const vo = ev.target.closest('[data-voltar-op]');
    if (vo) { delete rascunho.opcoes[est.sel]?.[vo.dataset.voltarOp]; limpo(rascunho.opcoes); return mudouPadrao(); }
    const pt = ev.target.closest('[data-padrao-txt]');
    if (pt) {
      const t = (rascunho.textos[est.sel] ||= {});
      t[pt.dataset.padraoTxt] = { ...(t[pt.dataset.padraoTxt] || {}), estilo: pt.dataset.v };
      delete est.vars[est.sel]?.textos[pt.dataset.padraoTxt];
      toque('Estilo padrão alterado');
      return mudouPadrao();
    }
    const vn = ev.target.closest('[data-ver-nucleo]');
    if (vn) { est.nucleo = vn.dataset.verNucleo; est.ver = 'um'; return desenhar(); }
    const f = ev.target.closest('[data-faz]');
    if (f?.dataset.faz === 'limpar-vars') { delete est.vars[est.sel]; conferirTudo(); return desenhar(); }
    if (f?.dataset.faz === 'descartar') { rascunho = structuredClone(PC.atual()); toque('Alterações descartadas'); return mudouPadrao(); }
    if (f?.dataset.faz === 'salvar') salvar();
  });
  raiz.addEventListener('change', (ev) => {
    const a = ev.target.closest('[data-txt-ativo]');
    if (a) { const t = varsDe(est.sel).textos; t[a.dataset.txtAtivo] = { ...(t[a.dataset.txtAtivo] || {}), ativo: a.checked }; conferirTudo(); return desenhar(); }
    const n = ev.target.closest('[data-campo="nome"]');
    if (n) {
      const v = n.value.trim();
      if (!v || v === nomeOriginal[est.sel]) delete rascunho.nomes[est.sel]; else rascunho.nomes[est.sel] = v;
      return mudouPadrao({ conferir: false });
    }
    const s = ev.target.closest('[data-estilo]');
    if (s) {
      const v = Number(s.value);
      if (!Number.isFinite(v)) return desenhar();
      const p = textoDe(s.dataset.estilo);
      if (s.dataset.k === 'min') p.tamanho = [Math.min(v, p.tamanho[1]), p.tamanho[1]];
      else if (s.dataset.k === 'max') p.tamanho = [p.tamanho[0], Math.max(v, p.tamanho[0])];
      else if (s.dataset.k === 'tam') p.tamanho = v;
      else p[s.dataset.k] = v;
      rascunho.texto[s.dataset.estilo] = p;
      return mudouPadrao();
    }
  });
  raiz.addEventListener('input', (ev) => {
    const b = ev.target.closest('[data-campo="busca"]');
    if (b) {
      est.busca = b.value;
      clearTimeout(espera);
      espera = setTimeout(() => { desenhar(); const c = raiz.querySelector('[data-campo="busca"]'); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 200);
    }
    const vv = ev.target.closest('[data-veu]');
    if (vv) {
      const v = Number(vv.value);
      if (!Number.isFinite(v)) return;
      rascunho.veu[vv.dataset.veu] = Math.max(0, Math.min(2, v));
      clearTimeout(espera);
      espera = setTimeout(() => mudouPadrao(), 150);
    }
  });
  raiz.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('[data-campo="nome"]')) ev.target.blur(); });
  // fora da página, vale o que está gravado; o rascunho espera a volta
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/padroes')) PC.restaurar(); });
  window.addEventListener('beforeunload', (ev) => { if (rascunho && pendentes() && location.hash.startsWith('#/padroes')) { ev.preventDefault(); ev.returnValue = ''; } });
  new ResizeObserver(() => escalar(raiz)).observe(raiz);
}

export async function renderPadroes(el, sub = '', opc = {}) {
  raiz = el;
  avisar = opc.aviso || avisar;
  est.aba = ABAS.find(([, , s]) => s && s === sub)?.[0] || 'modelos';
  ligar();
  if (!rascunho) {
    raiz.innerHTML = '<div class="mk-pagina"><p class="mk-pd-vazio">Conferindo os modelos…</p></div>';
    await PC.atualizarDaNuvem();
    rascunho = structuredClone(PC.atual());
  }
  PC.previsualizar(rascunho);
  await document.fonts.ready;
  conferirTudo();
  desenhar();
}
