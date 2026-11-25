// Modelos de card por núcleo — reconstruídos a partir de post-3x4-templates.pdf
// e do Manual do sistema Odisse (v1). Cada núcleo tem o seu repertório.
// Medidas em px do canvas 1080 × 1440. Grid de 12 colunas, margem 52, gutter 16.

import { COR, tintaSobre } from './nucleos.js';
import { mark } from './marks.js';
import { E, TEXTO_POR_CLASSE, corpoMin, corpoMax, MACROS, MACRO_DA_CLASSE } from './padroes.js';
import { contatosDe, preenchimentosDe, corDaMarca, paletaDaMarca } from './marca.js';

// Todo espaçamento vem de padroes.js (E.bloco, E.proximo…). Nenhum valor solto nos modelos.
export const LARG = 1080;
export const ALT = 1440;
const M = E.margem;
const G = E.gutter;
const COLW = (LARG - 2 * M - 11 * G) / 12; // 66,67
export const X = (c) => M + (c - 1) * (COLW + G);
export const W = (a, b) => (b - a + 1) * COLW + (b - a) * G;
const W12 = W(1, 12);
const CORTE = E.corte;
const TOPO = E.topo;
const QUADRO = E.quadro;        // y 180: início do recorte quadrado
const FIM = ALT - E.quadro;     // y 1260: fim do recorte quadrado — base de todo bloco de texto
const px = (k) => `${E[k]}px`;
// cortes verticais no meio do gutter
const C4 = X(5) - G / 2;  // entre as colunas 4 e 5
const C6 = X(7) - G / 2;  // entre 6 e 7 (meio do card)
const C8 = X(9) - G / 2;  // entre 8 e 9
const h2 = CORTE / 2;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const pos = (x, y, w, h) =>
  `left:${x}px;top:${y}px;${w != null ? `width:${w}px;` : ''}${h != null ? `height:${h}px;` : ''}`;
const regraSobre = (fundo) => (tintaSobre(fundo) === COR.branco ? 'rgba(255,255,255,.55)' : 'rgba(63,75,87,.5)');
const B = COR.branco, A = COR.ardosia;
// Carimbo do cabeçalho: altura de um Bloco (48), centrado na linha dos pontos (y 50).
// Carimbo encostado no topo, de lado a lado, com a altura de um Bloco (25/11).
const CARIMBO = { y: 0, h: E.bloco };
// Campos que não entram em "Textos": rótulos, legendas, créditos, ficha e avisos.
const FORA_DOS_TEXTOS = /^(rotulo|legR|legT|fonte|aviso|link|assin|planta|cota|rodape|l\d|f\d+[rv])$/;
export const OP_CARIMBO = { k: 'carimbo', rot: 'Carimbo', valores: [['linhas', 'Só linhas'], ['cheio', 'Fundo cheio']], padrao: 'linhas' };
// Véu: opacidade dos gradientes do núcleo sobre a imagem, por card. Multiplica a opacidade que cada modelo
// já usa (Padrão = como o modelo foi desenhado). Só aparece no painel quando o card desenha algum véu.
export const FATOR_VEU = { sem: 0, leve: 0.5, padrao: 1, forte: 1.4 };
export const OP_VEU = { k: 'veu', rot: 'Véu', valores: [['sem', 'Sem'], ['leve', 'Leve'], ['padrao', 'Padrão'], ['forte', 'Forte']], padrao: 'padrao' };
// O véu de cima (e o do meio) e o de baixo se ajustam separados: nível, cor e mesclagem de cada um.
// Chaves no card: veu · veuCor · veuMescla (cima/meio) e veuBase · veuBaseCor · veuBaseMescla (baixo).
// Cards antigos só têm `veu`, que valia para os dois: o de baixo herda o nível de cima enquanto não tiver o seu.
export const MESCLAS = [['normal', 'Normal'], ['multiply', 'Multiplicar'], ['overlay', 'Sobrepor'], ['soft-light', 'Luz suave']];
export const VEU_PADRAO = { cor: 'nucleo', mescla: 'normal' };
const LADOS_VEU = {
  topo: { nivel: 'veu', cor: 'veuCor', mescla: 'veuMescla' },
  base: { nivel: 'veuBase', cor: 'veuBaseCor', mescla: 'veuBaseMescla' },
};
export const CHAVES_VEU = Object.values(LADOS_VEU).flatMap((l) => Object.values(l));
/** Opções de cor do véu: a do núcleo e as cores da paleta da Marca. */
const coresDoVeu = (n) => [['nucleo', 'Do núcleo', n.veu], ...paletaDaMarca().map((c) => [c.id, c.nome, c.valor])];
/** Lista de opções do véu de um card, só para os véus que o modelo desenha (veus = { topo, meio, base }). */
export function opcoesDoVeu(veus, n) {
  const l = [];
  const lado = (id, grupo) => {
    const k = LADOS_VEU[id];
    l.push({ ...OP_VEU, k: k.nivel, rot: 'Nível', grupo },
      { k: k.cor, rot: 'Cor', grupo, valores: coresDoVeu(n), padrao: VEU_PADRAO.cor, cor: true, amostras: true },
      { k: k.mescla, rot: 'Mesclagem', grupo, valores: MESCLAS, padrao: VEU_PADRAO.mescla });
  };
  if (veus.topo) lado('topo', veus.base ? 'Véu de cima' : 'Véu');
  else if (veus.meio) lado('topo', 'Véu');
  if (veus.base) lado('base', veus.topo || veus.meio ? 'Véu de baixo' : 'Véu');
  return l;
}
/** Nível, cor (hex) e mesclagem de um lado do véu, lidos do card. */
function veuDoCard(card, n, id) {
  const o = card.opcoes || {}, k = LADOS_VEU[id];
  const nivel = o[k.nivel] ?? (id === 'base' ? o.veu : null) ?? OP_VEU.padrao;
  const cor = o[k.cor] && o[k.cor] !== 'nucleo' ? corDaMarca(o[k.cor])?.valor || n.veu : n.veu;
  const mescla = MESCLAS.some(([m]) => m === o[k.mescla]) ? o[k.mescla] : VEU_PADRAO.mescla;
  return { fator: FATOR_VEU[nivel] ?? 1, cor, mescla };
}

// Preenchimento: a cor que pinta o fundo do card e o carimbo cheio. Existe em todo modelo cujo fundo
// não é imagem (declaram `preenche(n, op)` com a cor padrão). Opções: as cores de fundo, painel e véu
// do núcleo, lidas da Marca; a cor padrão do modelo entra na lista se não estiver nela (ex.: ocre).
const hexIgual = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const idDaCor = (hex) => Object.keys(COR).find((k) => hexIgual(COR[k], hex));
function opcaoPreenchimento(modelo, n, lerOp) {
  const padrao = modelo.preenche(n, lerOp);
  const lista = preenchimentosDe(n.id).map((c) => [c.id, c.nome, c.valor]);
  const idPad = idDaCor(padrao);
  if (idPad && !lista.some(([id]) => id === idPad)) lista.push([idPad, corDaMarca(idPad)?.nome || idPad, padrao]);
  return { k: 'fundo', rot: 'Preenchimento', valores: lista, padrao: idPad || lista[0]?.[0], cor: true };
}
/** Hex do preenchimento escolhido; aceita os valores antigos "papel" e "painel". */
function corDoPreenchimento(v, n) {
  if (v === 'painel') return n.painel;
  return corDaMarca(v)?.valor || COR[v] || null;
}

// ---------------------------------------------------------------------------
// Contexto de renderização

export function criarContexto({ card, indice, total, nucleo, globais, modelo, modo, fonteImagem }) {
  const n = nucleo;
  const g = globais;
  const editavel = modo === 'editar';
  const unico = !!modelo.unico;
  const ops = opcoesDe(modelo, card, n);
  const ex = resolverExemplo(modelo, n.id);
  // legenda no canto superior direito: modelos do Estúdio marcados, ou a opção "No topo"
  const legendaTopo = !!modelo.legendaTopo || ops.legenda === 'topo';

  // Textos de conteúdo (Título / Corpo): cada um escolhe um dos três estilos do macro e pode ser desligado
  // (card.textos[chave] = { estilo, ativo }). Desligado, não ocupa espaço: imagens e vazios tomam o lugar.
  const textos = [];
  const conferir = (chave, classe) => {
    const cls = classe.split(' ');
    const i = cls.findIndex((c) => MACRO_DA_CLASSE[c]);
    if (i < 0 || FORA_DOS_TEXTOS.test(chave)) return { classe, ativo: true };
    const macro = MACRO_DA_CLASSE[cls[i]];
    const ativo = textoAtivo(chave);
    if (!textos.some((x) => x.chave === chave)) textos.push({ chave, macro, padrao: cls[i], ativo });
    const conf = card.textos?.[chave] || {};
    if (conf.estilo && MACROS[macro].classes.includes(conf.estilo)) cls[i] = conf.estilo;
    return { classe: cls.join(' '), ativo };
  };
  // alguns textos começam desligados (ex.: o corpo do O-09)
  function textoAtivo(chave) {
    const a = card.textos?.[chave]?.ativo;
    return a ?? !(modelo.textosDesligados || []).includes(chave);
  }
  const fichas = []; // linhas de ficha do card, para o painel: [{ prefixo, linhas }]

  // Preenchimento do card (fundo + carimbo cheio) e a tinta que contrasta com ele
  const f = modelo.preenche ? corDoPreenchimento(ops.fundo, n) || modelo.preenche(n, (k) => ops[k]) : null;
  // Véu do card: cada lado com o seu fator (sobre a opacidade de cada gradiente, teto 1), cor e mesclagem
  const VEU = { topo: veuDoCard(card, n, 'topo'), base: veuDoCard(card, n, 'base') };
  const gradiente = (v, paradas) => (v.fator
    ? `background:linear-gradient(${paradas.map(([a, p]) => `${hexA(v.cor, Math.min(1, a * v.fator))}${p ? ` ${p}` : ''}`).join(',')})${v.mescla !== 'normal' ? `;mix-blend-mode:${v.mescla}` : ''}`
    : null);

  const t = {
    n, g, editavel, textos, fichas, veus: { topo: 0, meio: 0, base: 0 },
    f, tinta: f ? tintaSobre(f) : A, filete: f ? regraSobre(f) : regraSobre(COR.papel), // filete: cor das regras sobre o preenchimento
    op: (k) => ops[k],
    valor: (chave) => card.campos?.[chave] || ex[chave] || '',
    tem: (chave) => textoAtivo(chave) && !!String(card.campos?.[chave] ?? '').replace(/<[^>]+>|&nbsp;|\s/g, ''),

    campo(chave, classe, estilo = '', opc = {}) {
      // O rótulo de contexto (ex.: "A VISTA") só existe em posts únicos, fechamentos e nos modelos marcados (O-07).
      const comRotulo = typeof modelo.rotulo === 'function' ? modelo.rotulo(t) : modelo.rotulo;
      if (chave === 'rotulo' && !comRotulo && !['unico', 'fechamento'].includes(grupoDe(modelo))) return '';
      const cf = conferir(chave, classe);
      if (!cf.ativo) return '';
      classe = cf.classe;
      const valor = card.campos?.[chave] ?? '';
      // opc.fit = altura máxima da área; o corpo vai do máximo ao mínimo do estilo (padroes.js)
      let fit = '';
      if (opc.fit) {
        const est = TEXTO_POR_CLASSE[classe.split(' ').find((c) => TEXTO_POR_CLASSE[c])];
        fit = ` data-fit="${corpoMin(est)},${corpoMax(est)},${opc.fit}"${opc.resto ? ' data-resto' : ''}`;
      }
      const ph = esc(String(opc.ph ?? ex[chave] ?? '').replace(/<[^>]+>/g, ''));
      if (!editavel && !valor) return '';
      const attrs = editavel ? ` contenteditable="true" spellcheck="true" data-campo="${chave}" data-ph="${ph}"` : '';
      return `<div class="${classe}" style="${estilo}" data-txt${fit}${opc.attrs || ''}${attrs}>${valor}</div>`;
    },

    /** Texto de apoio: até 5 linhas; se passar, alarga a caixa (3/4 → tela inteira).
     *  Não há mais meia tela: col 7 começa em 3/4 (coluna 5). */
    apoio(chave, col, estilo = '') {
      const estagios = [5, 1].filter((c) => c <= Math.max(col, 5));
      return t.campo(chave, 't-texto', `margin-left:${X(col) - M}px;${estilo}`, { attrs: ` data-cresce="${estagios.join(',')}"` });
    },

    global(chave, classe, estilo = '') {
      const cf = conferir(chave, classe);
      const v = g[chave] ?? '';
      if (!v || !cf.ativo) return '';
      const attr = editavel ? ` data-global="${chave}" title="Informação padrão — edite no painel à esquerda"` : '';
      return `<div class="${cf.classe}" style="${estilo}" data-txt${attr}>${esc(v)}</div>`;
    },

    /** Contato do núcleo, lido da Marca (site, telefone, e-mail). Não se edita no card. */
    contato(chave, classe) {
      const v = contatosDe(n.id)[chave];
      return v ? `<div class="${classe}">${esc(v)}</div>` : '';
    },

    img(slot, x, y, w, h, opc = {}) {
      const im = card.imgs?.[slot];
      const segue = opc.segue ? ` data-segue="${opc.segue}" data-gap="${opc.gap ?? E.bloco}" data-fim="${y + h}"`
        : opc.antes ? ` data-antes="${opc.antes}" data-gap="${opc.gap ?? E.bloco}"` : '';
      const base = `class="slot${opc.contain ? ' contain' : ''}" style="${pos(x, y, w, h)}${opc.fundo ? `background:${opc.fundo};` : ''}" data-slot="${slot}"${segue}`;
      const src = im && (im.ref || im.src) ? fonteImagem(card, slot) : null;
      if (src) {
        const ox = im.x ?? 50, oy = im.y ?? 50, z = im.z ?? 1;
        return `<div ${base}><img src="${src}" alt="" draggable="false" style="object-position:${ox}% ${oy}%;transform-origin:${ox}% ${oy}%;transform:scale(${z});${opc.estiloImg || ''}"></div>`;
      }
      if (modo === 'exportar') return opc.opcional ? '' : `<div ${base}></div>`;
      const rotulo = editavel ? `<span class="slot-vazio"><b>+</b> ${esc(modelo.slots?.[slot] || 'Imagem')}</span>` : '';
      return `<div ${base} data-vazio="1">${rotulo}</div>`;
    },

    fundo(cor) { return `<div class="bloco" style="${pos(0, 0, LARG, ALT)}background:${cor}"></div>`; },
    painel(x, y, w, h, cor, extra = '') { return `<div class="bloco" style="${pos(x, y, w, h)}background:${cor}"${extra}></div>`; },
    regra(x, y, w, cor) { return `<div class="bloco" style="${pos(x, y, w, 1.5)}background:${cor}"></div>`; },

    veuTopo(h = 200, a = 0.6, x = 0, w = LARG) {
      t.veus.topo++;
      const bg = gradiente(VEU.topo, [[a], [0]]);
      return bg ? `<div class="bloco veu" style="${pos(x, 0, w, h)}${bg}"></div>` : '';
    },
    /** Véu no meio do card, para texto centralizado sobre imagem inteira (ajustado como o véu de cima). */
    veuMeio(a = 0.6) {
      t.veus.meio++;
      const bg = gradiente(VEU.topo, [[0.25], [a, '35%'], [a, '65%'], [0.35]]);
      return bg ? `<div class="bloco veu" style="${pos(0, 0, LARG, ALT)}${bg}"></div>` : '';
    },
    /** Véu na base; `alt` = altura do canvas (o pin tem 1620). */
    veuBase(h = 340, a = 0.72, x = 0, w = LARG, alt = ALT) {
      t.veus.base++;
      const bg = gradiente(VEU.base, [[0], [a]]);
      return bg ? `<div class="bloco veu" style="${pos(x, alt - h, w, h)}${bg}"></div>` : '';
    },

    /** Carimbo: faixa encostada no topo, de lado a lado (25/11). À esquerda o tema (nome da publicação;
     *  no Elaia, "Escrito por …"), a partir da margem; à direita a contagem (no post único, o aviso).
     *  Os dois pontos de cima ficam dentro dele. Opção "Carimbo": só linhas ou fundo cheio; a cor vem
     *  do que está sob ele (colorirPontos). Com a legenda no topo, ela desce para baixo do carimbo. */
    cab(corEsq, corDir = corEsq) {
      const nome = g.projeto || '';
      const pre = n.autoria && nome ? `${esc(n.autoria)} ` : '';
      const tema = pre + (editavel ? `<span data-global="projeto" title="Informação padrão — edite no painel à esquerda">${esc(nome)}</span>` : esc(nome));
      let dir;
      if (unico) {
        dir = t.campo('aviso', 'cab-txt', '', { ph: 'Aviso' });
      } else {
        const ultimo = indice === total - 1;
        // a seta aponta para o próximo card (depois do número); no último, volta para a esquerda (antes do número)
        const num = `${String(indice + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
        dir = ultimo ? `${SETA_VOLTA}${num}` : `${num}${SETA}`;
      }
      // O tema ocupa o que sobra, alinhado à esquerda; a contagem tem a largura do próprio texto mais o respiro.
      // O carimbo é inteiro: uma cor só, todo transparente ou todo cheio (colorirPontos).
      const cel = (cls, miolo) => `<div class="cel ${cls}">${miolo}</div>`;
      let h = `<div class="carimbo t-rotulo" data-fundo="${ops.carimbo}" data-preench="${f || COR.papel}" style="${pos(0, CARIMBO.y, LARG, CARIMBO.h)}color:${corEsq}">${cel('meio', tema)}${cel('dir', dir)}</div>`;
      if (legendaTopo && !unico) {
        const r = t.campo('legR', 't-rotulo', '', { ph: 'Rótulo' });
        const l = t.campo('legT', 't-legenda', `margin-top:${px('justo')}`, { ph: 'Legenda: quem, onde, quando.' });
        h += `<div class="legenda-topo" style="right:${M}px;top:${CARIMBO.y + CARIMBO.h + E.proximo}px;color:${corDir}">${r}${l}</div>`;
      }
      return h;
    },

    /** Selo centrado no rodapé, com o centro a E.selo da base. Post único: mão. */
    selo(cor) {
      const nome = unico ? 'mao' : n.selo;
      const h = nome === 'mao' ? 72 : 64;
      return `<div class="selo" style="top:${ALT - E.selo - h / 2}px;color:${cor}" data-cor="${cor}">${mark(nome, h)}</div>`;
    },

    /** Linha de contexto da capa: uma linha de texto, sempre abaixo do título (opcional). */
    linha(estilo = '') {
      // até 5 linhas, sempre na largura inteira do bloco (sem a trava de 3/4 dos outros corpos)
      return t.campo('linha', 't-texto linha', `margin-top:${px('assinatura')};${estilo}`, { ph: 'Linha de contexto (opcional)' });
    },

    /** Assinatura: selo 46 px + rótulo (campo do card). */
    assinatura(cor, estilo = '') {
      return `<div class="assinatura" style="color:${cor};${estilo}">${mark(n.selo, 46)}${t.campo('assin', 't-rotulo', '')}</div>`;
    },

    /** Ficha em linhas: rótulo na coluna 1, valor na coluna 5 (ou empilhado). */
    ficha(prefixo, linhas, cor, regra, opc = {}) {
      if (!fichas.some((x) => x.prefixo === prefixo)) fichas.push({ prefixo, linhas });
      let h = '';
      for (let i = 1; i <= linhas; i++) {
        const r = t.campo(`${prefixo}${i}r`, 't-rotulo ficha-r', '');
        const v = t.campo(`${prefixo}${i}v`, `${opc.valor || 't-texto'} ficha-v`, '');
        if (!r && !v && !(opc.todas && editavel)) continue;
        // soCheias: só as linhas preenchidas (no editor também); elas se editam no painel
        if (opc.soCheias && !t.tem(`${prefixo}${i}r`) && !t.tem(`${prefixo}${i}v`)) continue;
        h += `<div class="ficha-linha${opc.empilhada ? ' empilhada' : ''}" data-linha="${prefixo}${i}" style="border-color:${regra};${opc.linha || ''}">${r || '<div></div>'}${v}</div>`;
      }
      if (!h) return '';
      return `<div class="ficha${opc.distribuir ? ' distribuir' : ''}" style="color:${cor};border-color:${regra};${opc.estilo || ''}">${h}</div>`;
    },

    legenda(cor, largura = 380) {
      if (legendaTopo || ops.legenda === 'nao') return '';
      const r = t.campo('legR', 't-rotulo', '', { ph: 'Rótulo' });
      const l = t.campo('legT', 't-legenda', '', { ph: 'Legenda: quem, onde, quando.' });
      if (!r && !l) return '';
      return `<div class="legenda" style="color:${cor};width:${largura}px">${r}${l}</div>`;
    },

    fluxo(x, y, w, h, cor, miolo, classe = '', bloco = '') {
      return `<div class="fluxo ${classe}" style="${pos(x, y, w, h)}color:${cor}"${bloco ? ` data-bloco="${bloco}"` : ''}>${miolo}</div>`;
    },

  };
  return t;
}

// ---------------------------------------------------------------------------
// Peças reutilizadas por mais de um núcleo

// três etapas entre y 176 e o fim do recorte quadrado (1260), separadas por um Próximo
const PASSO_ETAPA = (ALT - E.quadro - 176 - 2 * E.proximo) / 3;
const processo = (exemplo) => ({
  id: 'processo',
  rotulo: true,
  nome: 'Processo',
  desc: 'Três etapas: imagens sangrando à esquerda, número e texto nas colunas 8–12.',
  slots: { a: 'Etapa 01', b: 'Etapa 02', c: 'Etapa 03' },
  exemplo,
  preenche: () => COR.papel,
  render(t) {
    const linhas = ['a', 'b', 'c'].map((s, i) => {
      const y = 176 + i * (PASSO_ETAPA + E.proximo);
      return `${t.img(s, 0, y, C6 - h2, PASSO_ETAPA, { fundo: COR.nevoa })}
        ${t.fluxo(X(8), y, W(8, 12), PASSO_ETAPA, t.tinta, `
          <div style="border-top:1.5px solid ${t.filete};padding-top:${px('filete')}">
            <div class="t-chamada">0${i + 1}</div>
            ${t.campo(`p${i + 1}r`, 't-rotulo', `margin:${px('proximo')} 0 ${px('proximo')}`)}
            ${t.campo(`p${i + 1}t`, 't-texto')}
          </div>`)}`;
    }).join('');
    return `${t.fundo(t.f)}${t.cab(t.tinta)}
      ${t.campo('rotulo', 't-rotulo', `position:absolute;left:${X(8)}px;top:${176 - E.proximo}px;transform:translateY(-100%);color:${t.tinta}`)}
      ${linhas}${t.selo(t.tinta)}`;
  },
});


const unicoTexto = ({ exemplo, fundo }) => ({
  id: 'unico',
  nome: 'Post único',
  desc: 'Aviso: rótulo, título, texto de apoio e ficha curta. Selo da mão.',
  unico: true,
  slots: {},
  exemplo,
  preenche: (n) => fundo({ n }),
  render(t) {
    const f = t.f, cor = t.tinta;
    return `${t.fundo(f)}${t.cab(cor)}
      ${t.fluxo(M, 236, W12, 1004, cor, `
        ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
        ${t.campo('titulo', 't-titulo', '', { fit: 460 })}
        ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}
        ${t.ficha('f', 3, cor, regraSobre(f), { estilo: 'margin-top:auto' })}`)}
      ${t.selo(cor)}`;
  },
});



const desenho = {
  id: 'desenho',
  nome: 'Desenho técnico',
  desc: 'Desenho ou diagrama sobre papel, planta no canto e cota.',
  slots: { a: 'Desenho (PNG/SVG)', b: 'Planta (opcional)' },
  exemplo: {
    rotulo: 'Geometria',
    texto: 'A seção gira em torno do eixo vertical à medida que sobe. As variações de diâmetro formam sulcos helicoidais contínuos da base à borda.',
    planta: 'Planta',
    cota: '135 mm',
  },
  preenche: () => COR.papel,
  render(t) {
    const A = t.tinta;
    return `${t.fundo(t.f)}${t.cab(A)}
      ${t.fluxo(M, TOPO, W(1, 6), 300, A, `
        ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
        ${t.campo('texto', 't-texto')}`, '', 'txt')}
      ${t.img('b', X(9), 150, W(9, 11), 240, { contain: true, opcional: true })}
      ${t.campo('planta', 't-rotulo', `position:absolute;${pos(X(9), 390 + E.proximo)}color:${A}`)}
      ${t.img('a', M, 440, W(1, 9), FIM - 440, { contain: true, segue: 'txt' })}
      ${t.campo('cota', 't-rotulo', `position:absolute;${pos(X(10), 860)}color:${A}`)}
      ${t.selo(A)}`;
  },
};

// ---------------------------------------------------------------------------
// ODISSE ESTÚDIO — pessoas, obras e bastidores. Ardósia, duotone, mão.

const ESTUDIO = [
  {
    id: 'janela',
    legendaTopo: true,
    nome: 'Janela',
    desc: 'Imagem inteira com outra inserida nas colunas 8–12.',
    slots: { a: 'Imagem de fundo', b: 'Janela (8–12)' },
    exemplo: { legR: 'Oficina', legT: 'Estudo em camadas e produção de peças.' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.img('b', X(8), 420, W(8, 12), 598)}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cab(B)}${t.legenda(B)}${t.selo(B)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// ODISSE ARQUITETOS — projetos. Papel e areia, cor plena, roda.

const ARQUITETOS = [
  {
    id: 'amplitude',
    nome: 'Três ambientes',
    desc: 'Título, três imagens em faixa com rótulos e texto na coluna 7.',
    slots: { a: 'Ambiente 1', b: 'Ambiente 2', c: 'Ambiente 3' },
    exemplo: {
      rotulo: 'A amplitude',
      titulo: 'A amplitude não é vazio.',
      l1: 'Estar', l2: 'Jantar', l3: 'Cozinha',
      texto: 'É a soma de programas distintos que encontram no mar seu horizonte comum.',
    },
    preenche: () => COR.papel,
    render(t) {
      const A = t.tinta;
      const y = 438, hh = 544, ly = y + hh + E.proximo;
      const seg = { segue: 'tit' };
      return `${t.fundo(t.f)}${t.cab(A)}
        ${t.fluxo(M, TOPO, W12, 300, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 230 })}`, '', 'tit')}
        ${t.img('a', 0, y, C4 - h2, hh, seg)}
        ${t.img('b', C4 + h2, y, C8 - C4 - CORTE, hh, seg)}
        ${t.img('c', C8 + h2, y, LARG - C8 - h2, hh, seg)}
        ${t.campo('l1', 't-rotulo', `position:absolute;${pos(M, ly)}color:${A}`)}
        ${t.campo('l2', 't-rotulo', `position:absolute;${pos(X(5), ly)}color:${A}`)}
        ${t.campo('l3', 't-rotulo', `position:absolute;${pos(X(9), ly)}color:${A}`)}
        ${t.fluxo(M, ly + 24 + E.bloco, W12, FIM - ly - 24 - E.bloco, A, t.apoio('texto', 7))}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'material',
    nome: 'Material',
    desc: 'Imagem no alto, rótulo e texto em faixa de papel, segunda imagem e legenda.',
    slots: { a: 'Imagem superior', b: 'Imagem inferior' },
    exemplo: {
      rotulo: 'Couro',
      texto: 'Um caminho em construção. A pacificação da tensão entre a expressão simbólico-material de uma cultura que nos é própria e a proficiência técnica da modernidade.',
      rodape: 'Concreto aparente',
    },
    preenche: () => COR.papel,
    render(t) {
      const A = t.tinta;
      return `${t.fundo(t.f)}
        ${t.img('a', 0, 0, LARG, 558)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, 558 + E.bloco)}color:${A}`)}
        ${t.fluxo(X(5), 558 + E.bloco, W(5, 12), 200, A, t.campo('texto', 't-texto'), '', 'txt')}
        ${t.img('b', 0, 802, LARG, FIM - 802, { segue: 'txt' })}
        ${t.campo('rodape', 't-rotulo', `position:absolute;${pos(M, 1364)}color:${A}`)}
        ${t.selo(A)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// ODISSE OBJETOS — peças e loja. Grafite, foto de estúdio, flor.

const OBJETOS = [
  desenho,
  {
    id: 'ficha-lateral',
    nome: 'Ficha + imagem lateral',
    desc: 'Detalhe da peça nas colunas 1–4; ficha empilhada nas 5–12.',
    slots: { a: 'Detalhe (1–4)' },
    exemplo: {
      rotulo: 'Ficha técnica',
      f1r: 'Coleção', f1v: 'Vórtice',
      f2r: 'Função', f2v: 'Vaso decorativo, uso seco',
      f3r: 'Dimensões', f3v: '115 × 115 × 135 mm',
      f4r: 'Material', f4v: 'PLA, pintura PU texturizada',
      f5r: 'Processo', f5v: 'Impressão 3D, acabamento à mão',
      f6r: 'Cor', f6v: 'Preto fosco',
      f7r: 'Design', f7v: 'Cid Clementino, Nathalia Linhares',
    },
    preenche: () => COR.papel,
    render(t) {
      const A = t.tinta;
      return `${t.fundo(t.f)}
        ${t.img('a', 0, 0, C4 - h2, ALT)}${t.veuTopo(200, 0.6, 0, C4 - h2)}
        ${t.cab(B, A)}
        ${t.fluxo(X(5), TOPO, W(5, 12), FIM - TOPO, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.ficha('f', 7, A, t.filete, { empilhada: true })}`)}
        ${t.selo(A)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// ELAIA — ensaios e podcast. Pêssego, duotone ocre, sol.

const ELAIA = [
  {
    id: 'imagem-ficha',
    nome: 'Recorte + ficha',
    desc: 'Imagem recortada sobre pêssego, texto e três linhas de ficha.',
    slots: { a: 'Imagem recortada (PNG)' },
    exemplo: {
      texto: 'Este estado foi caracterizado por <b>Gennep</b> como um rito de passagem processado em três etapas:',
      f1r: 'Rito de separação', f1v: 'A saída do ambiente familiar e da vida comunitária.',
      f2r: 'Rito de transição', f2v: 'Quando se enfrentam, sozinho, os desafios que farão surgir uma nova pessoa.',
      f3r: 'Rito de incorporação', f3v: 'A reintegração da nova pessoa ao ambiente comunitário, ocupando um novo espaço com responsabilidades e privilégios.',
    },
    preenche: () => COR.pessego,
    render(t) {
      const A = t.tinta;
      return `${t.fundo(t.f)}${t.cab(A)}
        ${t.img('a', X(2), 100, W(2, 11), 610, { contain: true, antes: 'txt' })}
        ${t.fluxo(M, 100 + IMG_MIN + E.bloco, W12, FIM - 100 - IMG_MIN - E.bloco, A, `
          ${t.campo('texto', 't-texto', `margin-bottom:${px('bloco')}`)}
          ${t.ficha('f', 3, A, t.filete)}`, 'fim', 'txt')}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'materia-bruta',
    nome: 'Matéria Bruta · episódio',
    desc: 'Post do podcast: faixa ocre com título, episódio, "Com" e "Ouça"; retrato abaixo.',
    unico: true,
    slots: { a: 'Retrato (duotone)' },
    exemplo: {
      aviso: 'Novo episódio',
      rotulo: 'Matéria Bruta · Episódio 01',
      titulo: 'Matéria Bruta.',
      sub: 'A matéria antes da forma.',
      f1r: 'Com', f1v: 'Cid Clementino e Nathalia Linhares',
      f2r: 'Ouça', f2v: 'Plataformas de áudio · link na bio',
    },
    preenche: () => COR.ocre,
    render(t) {
      const A = t.tinta;
      return `${t.fundo(t.f)}
        ${t.img('a', 0, 620, LARG, 820, { fundo: t.f, segue: 'tit' })}
        ${t.veuBase(300, 0.5)}
        ${t.cab(A)}
        ${t.fluxo(M, TOPO, W12, 620 - TOPO - E.bloco, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-capa', 'white-space:nowrap', { fit: 160 })}
          <div style="display:grid;grid-template-columns:${W(1, 6)}px ${W(7, 12)}px;column-gap:${G}px;margin-top:${px('bloco')};align-items:start">
            ${t.campo('sub', 't-chamada') || '<div></div>'}
            ${t.ficha('f', 2, A, t.filete, { empilhada: true, valor: 't-legenda' })}
          </div>`, '', 'tit')}
        ${t.selo(B)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// MODELOS UNIVERSAIS (O-01…O-11) — uma composição comum aos quatro núcleos.
// O núcleo continua definindo a identidade (papel, painel, véu, selo, tratamento, logotipo);
// o card define a composição, com opções escolhidas no painel esquerdo ("Personalização do card").

const FOTO_CLARA = (n) => n.id === 'objetos'; // foto de estúdio sobre fundo claro: texto ardósia, sem véu no alto
const FUNDO_FOTO = (n) => (FOTO_CLARA(n) ? '#EDEDEB' : undefined);
const op = (k, rot, valores, padrao) => ({ k, rot, valores, padrao });
const OP_LEGENDA = op('legenda', 'Legenda', [['nao', 'Sem'], ['topo', 'Topo'], ['pe', 'Base']], (n) => (n.id === 'estudio' ? 'topo' : 'pe'));
const porNucleo = (mapa) => (nid) => ({ ...(mapa[nid] || mapa.padrao) });

const EX_CAPA = {
  estudio: { titulo: 'Reserva Criativa.', linha: 'Cid Clementino e Nathalia Linhares' },
  arquitetos: { titulo: 'Um horizonte comum.', linha: 'Projeto de interiores do Apto RP 201' },
  objetos: { titulo: 'Vórtice I', linha: 'Receptáculo escultórico, impresso em 3D' },
  elaia: { titulo: 'Backrooms, Labirinto Domesticado.', linha: 'A partir de Backrooms, Labirinto Domesticado: Parte I' },
};

/** Fatias horizontais de uma faixa de imagens: 1 inteira, 2 no meio (6 | 6), 3 nos cortes 4 | 8. */
function fatias(qtd) {
  if (qtd === 3) return [[0, C4 - h2], [C4 + h2, C8 - C4 - CORTE], [C8 + h2, LARG - C8 - h2]];
  if (qtd === 2) return [[0, C6 - h2], [C6 + h2, LARG - C6 - h2]];
  return [[0, LARG]];
}

const O01 = {
  id: 'o01', cod: 'O-01', grupo: 'capa',
  nome: 'Capa com imagem inteira',
  desc: 'Imagem inteira, título e linha de contexto no topo, no centro ou na base.',
  slots: { a: 'Imagem da capa' },
  opcoes: [
    op('texto', 'Bloco de texto', [['alto', 'Topo'], ['centro', 'Centro'], ['pe', 'Base']], (n) => (FOTO_CLARA(n) ? 'alto' : 'pe')),
    op('alinhar', 'Alinhamento', [['esq', 'À esquerda'], ['centro', 'Centralizado']], 'esq'),
  ],
  exemplo: porNucleo(EX_CAPA),
  render(t) {
    const clara = FOTO_CLARA(t.n), pos_ = t.op('texto');
    const al = t.op('alinhar') === 'centro' ? 'text-align:center' : '';
    // foto clara: ardósia no topo e no centro (sem véu); na base, branco sobre o véu
    const cor = clara && pos_ !== 'pe' ? A : B;
    // o título mede o espaço que sobra depois da linha de contexto (até 5 linhas)
    const miolo = `${t.campo('titulo', 't-capa', al, { fit: 600, resto: true })}${t.linha(al)}`;
    const veus = clara ? (pos_ === 'pe' ? t.veuBase(520, 0.7) : '')
      : pos_ === 'alto' ? `${t.veuTopo(760, 0.6)}${t.veuBase()}`
      : pos_ === 'centro' ? t.veuMeio()
      : `${t.veuTopo()}${t.veuBase(820, 0.8)}`;
    const texto = pos_ === 'alto' ? t.fluxo(M, QUADRO, W12, 560, cor, miolo)
      : pos_ === 'centro' ? t.fluxo(M, QUADRO, W12, FIM - QUADRO, cor, miolo, 'meio')
      : t.fluxo(M, QUADRO, W12, FIM - QUADRO, cor, miolo, 'fim');
    return `${t.img('a', 0, 0, LARG, ALT, { fundo: FUNDO_FOTO(t.n) })}${veus}
      ${t.cab(clara ? A : B)}
      ${texto}
      ${t.selo(clara && pos_ !== 'pe' ? A : B)}`;
  },
};

const O02 = {
  id: 'o02', cod: 'O-02', grupo: 'capa',
  nome: 'Capa com faixa de imagens',
  desc: 'Título e linha acima ou abaixo de uma faixa de 1 a 3 imagens, tudo dentro do recorte quadrado (y 180–1260); a faixa cede espaço quando o texto cresce.',
  slots: { a: 'Imagem 1', b: 'Imagem 2', c: 'Imagem 3' },
  opcoes: [
    op('texto', 'Texto', [['acima', 'Acima da imagem'], ['abaixo', 'Abaixo da imagem']], 'acima'),
    op('imagens', 'Imagens na faixa', [['1', '1'], ['2', '2'], ['3', '3']], (n) => (n.id === 'estudio' ? '2' : '1')),
  ],
  preenche: (n) => (n.id === 'estudio' ? n.painel : COR.papel),
  slotsAtivos: (t) => ['a', 'b', 'c'].slice(0, Number(t.op('imagens'))),
  exemplo: porNucleo({ ...EX_CAPA, elaia: { titulo: 'Backrooms,<br>Labirinto<br>Domesticado', linha: EX_CAPA.elaia.linha } }),
  render(t) {
    const f = t.f, cor = t.tinta;
    const abaixo = t.op('texto') === 'abaixo';
    const miolo = `${t.campo('titulo', 't-capa', '', { fit: 480, resto: true })}${t.linha()}`;
    // acima: texto começa em 180 e a faixa segue até 1260; abaixo: faixa começa em 180 e desce até um Bloco antes do texto, que termina em 1260
    const imgs = fatias(Number(t.op('imagens'))).map(([x, w], i) => (abaixo
      ? t.img('abc'[i], x, QUADRO, w, 600, { antes: 'tit', fundo: FUNDO_FOTO(t.n) })
      : t.img('abc'[i], x, 560, w, FIM - 560, { segue: 'tit', fundo: FUNDO_FOTO(t.n) }))).join('');
    const texto = abaixo
      ? t.fluxo(M, QUADRO + IMG_MIN + E.bloco, W12, FIM - QUADRO - IMG_MIN - E.bloco, cor, miolo, 'fim', 'tit')
      : t.fluxo(M, QUADRO, W12, 560, cor, miolo, '', 'tit');
    return `${t.fundo(f)}${t.cab(cor)}
      ${texto}
      ${imgs}
      ${t.selo(cor)}`;
  },
};

const EX_TESE = {
  estudio: { titulo: 'Um espaço permanente de pesquisa.', texto: 'Rigor técnico, investigação histórica e sensibilidade artística, em arquitetura e design.' },
  arquitetos: { titulo: 'Três ambientes, um ponto de fuga.', texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.' },
  objetos: { titulo: 'Um coração em processo.', texto: 'Corpo único que se torce em torno do próprio eixo, em sulcos helicoidais contínuos.' },
  elaia: { titulo: 'A incerteza é mais assustadora que a alegoria.', texto: 'Ao traçar um paralelo entre os anseios da mente de Clark e os backrooms, a narrativa do filme homônimo perde forças na exploração do horror espacial ao dar sentido ao desconhecido.' },
};

const O03 = {
  id: 'o03', cod: 'O-03',
  nome: 'Título + imagem',
  desc: 'Título e texto de apoio com uma imagem sangrando, em cima ou embaixo.',
  slots: { a: 'Imagem' },
  opcoes: [
    op('ordem', 'Ordem', [['texto', 'Texto em cima'], ['imagem', 'Imagem em cima']], 'texto'),
    op('rotulo', 'Rótulo acima do título', [['nao', 'Sem'], ['sim', 'Com']], 'nao'),
  ],
  rotulo: (t) => t.op('rotulo') === 'sim',
  preenche: (n) => (n.id === 'objetos' ? n.painel : COR.papel),
  exemplo: porNucleo(EX_TESE),
  render(t) {
    const f = t.f, cor = t.tinta;
    const rot = t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`);
    const texto = (y, h, bloco = '') => t.fluxo(M, y, W12, h, cor, `${rot}
      ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
      ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`, '', bloco);
    if (t.op('ordem') === 'imagem') {
      // texto ancorado embaixo (fim em 1260, base do recorte quadrado); a imagem desce até um Bloco antes do início do texto
      const yTxt = IMG_MIN + E.bloco;
      return `${t.fundo(f)}
        ${t.img('a', 0, 0, LARG, 760, { antes: 'txt', fundo: FUNDO_FOTO(t.n) })}${FOTO_CLARA(t.n) ? '' : t.veuTopo()}
        ${t.cab(FOTO_CLARA(t.n) ? A : B)}
        ${t.fluxo(M, yTxt, W12, FIM - yTxt, cor, `${rot}
          ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`, 'fim', 'txt')}
        ${t.selo(cor)}`;
    }
    // texto em cima: a imagem acompanha o fim do texto, sobre o preenchimento do card
    return `${t.fundo(f)}
      ${t.img('a', 0, 640, LARG, ALT - 640, { segue: 'txt', fundo: FUNDO_FOTO(t.n) })}${t.veuBase()}
      ${t.cab(cor)}
      ${texto(TOPO, 800, 'txt')}
      ${t.selo(B)}`;
  },
};

const O04 = {
  id: 'o04', cod: 'O-04',
  nome: 'Imagem inteira',
  desc: 'Imagem inteira, sangrando. Legenda opcional no topo ou na base.',
  slots: { a: 'Imagem inteira' },
  opcoes: [OP_LEGENDA],
  exemplo: porNucleo({ estudio: { legR: 'Obra', legT: 'A figura sob a cobertura metálica.' }, padrao: { legR: '', legT: '' } }),
  render(t) {
    const clara = FOTO_CLARA(t.n);
    return `${t.img('a', 0, 0, LARG, ALT, { fundo: FUNDO_FOTO(t.n) })}
      ${clara ? '' : t.veuTopo()}${t.veuBase()}
      ${t.cab(clara ? A : B)}${t.legenda(B)}${t.selo(B)}`;
  },
};

const CORTES = { '4-8': C4, '8-4': C8, '6-6': C6 };
const O05 = {
  id: 'o05', cod: 'O-05',
  nome: 'Duas imagens verticais',
  desc: 'Duas imagens de altura inteira, com corte nas colunas 4 | 8, 8 | 4 ou 6 | 6.',
  slots: { a: 'Imagem esquerda', b: 'Imagem direita' },
  opcoes: [
    op('corte', 'Corte', [['4-8', '4 | 8'], ['8-4', '8 | 4'], ['6-6', '6 | 6']], (n) => (n.id === 'estudio' ? '8-4' : '4-8')),
    OP_LEGENDA,
  ],
  preenche: (n) => (n.id === 'estudio' ? A : COR.papel),
  exemplo: porNucleo({ estudio: { legR: 'Retrato', legT: 'Nathalia Linhares, desenho em campo.' }, padrao: { legR: '', legT: '' } }),
  render(t) {
    const c = CORTES[t.op('corte')] || C4;
    return `${t.fundo(t.f)}
      ${t.img('a', 0, 0, c - h2, ALT)}
      ${t.img('b', c + h2, 0, LARG - c - h2, ALT)}
      ${t.veuTopo()}${t.veuBase()}
      ${t.cab(B)}${t.legenda(B, 420)}${t.selo(B)}`;
  },
};

const EX_COLUNA = {
  elaia: { texto: 'O <b>Purgatório</b> descrito por Dante na Divina Comédia é um exemplo de espaço liminar.<br>Uma travessia com obstáculos que prenunciam uma transformação. É um estado intermediário que tem sentido e encaminha a um propósito.', fonte: '' },
  padrao: { texto: 'Partimos de expressões simbólicas já postas, que transcendem o figurativismo e se imbuem de uma narrativa mitopoética.', fonte: 'Gilvan Samico, A Árvore da Vida e o Infinito Azul, xilogravura.' },
};
const O06 = {
  id: 'o06', cod: 'O-06',
  nome: 'Imagem + coluna',
  desc: 'Uma ou duas imagens nas colunas 1–8 (de 128 a 1260); coluna de texto nas 9–12, com crédito opcional na base. O preenchimento muda só a cor, não a estrutura.',
  slots: { a: 'Imagem 1 (1–8)', b: 'Imagem 2 (1–8)' },
  opcoes: [
    op('imagens', 'Imagens', [['1', '1'], ['2', '2']], '1'),
    op('credito', 'Crédito na base', [['sim', 'Sim'], ['nao', 'Não']], (n) => (n.id === 'elaia' ? 'nao' : 'sim')),
  ],
  preenche: (n) => (n.id === 'elaia' ? n.painel : COR.papel),
  slotsAtivos: (t) => (t.op('imagens') === '2' ? ['a', 'b'] : ['a']),
  exemplo: porNucleo(EX_COLUNA),
  render(t) {
    const f = t.f, cor = t.tinta;
    const fimImg = C8 - h2;
    // respiro de um Bloco entre a imagem e a coluna de texto
    const xCol = fimImg + E.bloco, wCol = LARG - M - xCol;
    const y0 = TOPO, y1 = FIM;
    const dois = t.op('imagens') === '2';
    const hImg = dois ? (y1 - y0 - CORTE) / 2 : y1 - y0;
    const imgs = t.img('a', 0, y0, fimImg, hImg) + (dois ? t.img('b', 0, y0 + hImg + CORTE, fimImg, hImg) : '');
    const credito = t.op('credito') === 'sim'
      ? t.campo('fonte', 't-legenda fonte', `margin-top:auto;border-top:1.5px solid ${t.filete};padding-top:${px('filete')}`, { ph: 'Crédito ou legenda' })
      : '';
    return `${t.fundo(f)}
      ${imgs}
      ${t.cab(cor)}
      ${t.fluxo(xCol, TOPO, wCol, FIM - TOPO, cor, `${t.campo('texto', 't-texto')}${credito}`)}
      ${t.selo(cor)}`;
  },
};

const EX_PROCESSO = {
  objetos: {
    rotulo: 'Processo',
    p1r: 'Modelagem', p1t: 'A forma é modelada digitalmente: uma seção que gira em torno do eixo à medida que sobe.',
    p2r: 'Impressão', p2t: 'Impressa em PLA, em peça única e sem montagem, por deposição de filamento fundido.',
    p3r: 'Acabamento', p3t: 'Lixada, corrigida, preparada com primer e pintada à mão em PU texturizado preto fosco.',
  },
  padrao: {
    rotulo: 'Processo',
    p1r: 'Estudo', p1t: 'O enquadramento da vista a partir da mesa de jantar.',
    p2r: 'Croqui', p2t: 'Sala, jantar e cozinha desenhados sobre o mesmo ponto de fuga.',
    p3r: 'Imagem final', p3t: 'A vista atravessa toda a planta, da cozinha à varanda.',
  },
};
const O07 = { ...processo(porNucleo(EX_PROCESSO)), id: 'o07', cod: 'O-07' };

const EX_IMG_TITULO = {
  elaia: { titulo: 'Espaço liminar é qualquer espaço intermediário.', texto: 'Um estágio de transição que não se restringe à abordagem espacial, mas à sua condição transitória.' },
  padrao: { titulo: 'A vista atravessa a casa.', texto: 'Antes restrito à varanda, o mar passa a fazer parte da sala e do jantar.' },
};
const O08 = {
  id: 'o08', cod: 'O-08',
  nome: 'Imagem inteira + título',
  desc: 'Imagem inteira com título e texto de apoio brancos, no topo, no centro ou na base.',
  slots: { a: 'Imagem inteira' },
  opcoes: [op('texto', 'Bloco de texto', [['alto', 'Topo'], ['centro', 'Centro'], ['pe', 'Base']], 'pe')],
  exemplo: porNucleo(EX_IMG_TITULO),
  render(t) {
    const pos_ = t.op('texto');
    const miolo = `${t.campo('titulo', 't-titulo', '', { fit: 340 })}${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`;
    return `${t.img('a', 0, 0, LARG, ALT)}
      ${pos_ === 'alto' ? `${t.veuTopo(760, 0.6)}${t.veuBase()}` : pos_ === 'centro' ? t.veuMeio() : `${t.veuTopo()}${t.veuBase(860, 0.82)}`}
      ${t.cab(B)}
      ${pos_ === 'alto' ? t.fluxo(M, TOPO, W12, 700, B, miolo)
        : t.fluxo(M, QUADRO, W12, FIM - QUADRO, B, miolo, pos_ === 'centro' ? 'meio' : 'fim')}
      ${t.selo(B)}`;
  },
};

const FICHA_ARQ = {
  titulo: 'Ficha técnica.',
  f1r: 'Projeto', f1v: 'Retrofit de Interiores do Edf. AVS. Sala de Conferência',
  f2r: 'Escritório', f2v: 'Odisse, Estúdio de Arquitetura e Design',
  f3r: 'Tipo', f3v: 'Projeto de Interiores; Retrofit.',
  f4r: 'Programa', f4v: 'Sala de Conferência; Sala de Reuniões; Estações de Trabalho; Área de Exposição e Encontro.',
  f5r: 'Premissa', f5v: 'Atualização dos ambientes criativos do edifício segundo o estado da arte, tanto em termos concretos quanto simbólicos.',
};
const FICHA_OBJ = {
  titulo: '',
  f1r: 'Coleção', f1v: 'Vórtice',
  f2r: 'Função', f2v: 'Vaso decorativo, uso seco',
  f3r: 'Dimensões', f3v: '115 × 115 × 135 mm',
  f4r: 'Material', f4v: 'PLA, pintura PU texturizada',
  f5r: 'Processo', f5v: 'Impressão 3D, acabamento à mão',
  f6r: 'Cor', f6v: 'Preto fosco',
  f7r: 'Design', f7v: 'Cid Clementino, Nathalia Linhares',
};
// O-09: a imagem não fica menor que isto; quando o texto cresce, a ficha perde linhas antes
const IMG_MIN_FICHA = 480;
const O09 = {
  id: 'o09', cod: 'O-09',
  nome: 'Ficha',
  desc: 'Imagem no topo (opcional), título, corpo (desligado por padrão) e ficha travada embaixo. As linhas da ficha que não cabem saem do card e ficam marcadas no painel.',
  slots: { a: 'Imagem superior' },
  opcoes: [
    op('imagem', 'Imagem', [['sem', 'Sem'], ['com', 'Com imagem no topo']], (n) => (n.id === 'objetos' ? 'com' : 'sem')),
    op('linhas', 'Linhas da ficha', ['1', '2', '3', '4', '5', '6', '7', '8'].map((v) => [v, v]), (n) => (n.id === 'objetos' ? '7' : '5')),
  ],
  textosDesligados: ['texto'],
  // padrão: papel com imagem; o tom escuro do núcleo (véu) sem imagem
  preenche: (n, op) => (op('imagem') === 'com' ? COR.papel : n.veu),
  slotsAtivos: (t) => (t.op('imagem') === 'com' ? ['a'] : []),
  exemplo: porNucleo({ objetos: FICHA_OBJ, padrao: FICHA_ARQ }),
  render(t) {
    const linhas = Number(t.op('linhas'));
    const titulo = t.campo('titulo', 't-titulo', `margin-bottom:${px('bloco')}`, { fit: 250, ph: 'Título (opcional)' });
    const corpo = t.apoio('texto', 5, `margin-bottom:${px('bloco')}`);
    if (t.op('imagem') === 'com') {
      // pilha ancorada embaixo (título, corpo, ficha); a imagem desce até um Bloco antes dela
      const clara = FOTO_CLARA(t.n);
      return `${t.fundo(t.f)}
        ${t.img('a', 0, 0, LARG, 560, { fundo: FUNDO_FOTO(t.n), antes: 'txt' })}${clara ? '' : t.veuTopo()}
        ${t.cab(clara ? A : B)}
        <div class="fluxo fim" data-bloco="txt" data-podar style="${pos(M, IMG_MIN_FICHA + E.bloco, W12, FIM - IMG_MIN_FICHA - E.bloco)}color:${t.tinta}">
          ${titulo}${corpo}${t.ficha('f', linhas, t.tinta, t.filete, { soCheias: true })}</div>
        ${t.selo(t.tinta)}`;
    }
    // sem imagem: título e corpo no topo, ficha travada embaixo
    return `${t.fundo(t.f)}${t.cab(t.tinta)}
      <div class="fluxo" data-podar style="${pos(M, TOPO, W12, FIM - TOPO)}color:${t.tinta}">
        ${titulo}${corpo}${t.ficha('f', linhas, t.tinta, t.filete, { estilo: 'margin-top:auto', soCheias: true })}</div>
      ${t.selo(t.tinta)}`;
  },
};

const LOCKUP = {
  estudio: () => `${mark('mao', 62)}${mark('odisse', 32)}`,
  arquitetos: () => `${mark('mao', 62)}${mark('odisse', 32)}`,
  objetos: () => `${mark('flor', 70)}${mark('odisse', 32)}`,
  elaia: () => mark('elaia', 44),
};
const IMG_FECH = { y: 440, h: 544, w: 264 };
const O10 = {
  id: 'o10', cod: 'O-10', grupo: 'fechamento',
  nome: 'Fechamento',
  desc: 'Chamada no topo da imagem (rótulo acima), contatos (da Marca) na base dela e texto de apoio no meio; logotipo na meia altura do vazio abaixo, sem selo.',
  slots: { a: 'Imagem lateral (opcional)' },
  preenche: () => COR.papel,
  exemplo: porNucleo({ objetos: { rotulo: 'Loja' }, elaia: { rotulo: 'Leitura' }, padrao: { rotulo: 'Contato' } }),
  render(t) {
    const contatos = ['site', 'telefone', 'email'].map((k) => t.contato(k, 't-texto')).join(''); // da Marca, por núcleo
    const topo = IMG_FECH.y, base = IMG_FECH.y + IMG_FECH.h;
    const apoio = t.global('contatoTexto', 't-texto', 'margin:auto 0');
    return `${t.fundo(t.f)}
      ${t.cab(t.tinta)}
      ${t.img('a', 0, topo, IMG_FECH.w, IMG_FECH.h, { opcional: true })}
      ${t.campo('rotulo', 't-rotulo', `position:absolute;left:${X(4)}px;top:${topo - E.proximo}px;transform:translateY(-100%);color:${t.tinta}`)}
      ${t.fluxo(X(4), topo, W(4, 12), base - topo, t.tinta, `
        ${t.global('contatoTitulo', 't-chamada fech-chamada', '')}
        ${apoio || '<div style="margin-top:auto"></div>'}
        <div class="contatos" style="border-top:1.5px solid ${t.filete};padding-top:${px('filete')}">${contatos}</div>`)}
      <div class="lockup" style="position:absolute;left:${X(4)}px;top:${(base + ALT) / 2}px;transform:translateY(-50%);color:${t.tinta}">${LOCKUP[t.n.id]()}</div>`;
  },
};

const EX_UNICO = {
  elaia: {
    aviso: 'Novo ensaio', rotulo: 'Agora no Elaia', titulo: 'Backrooms, Labirinto Domesticado.',
    texto: 'Parte I da série de ensaios de <b>Cid Clementino</b> sobre o fenômeno dos backrooms.',
    f1r: 'Série', f1v: 'Backrooms, Labirinto Domesticado', f2r: 'Leitura', f2v: 'odisse.substack.com', f3r: 'Autor', f3v: 'Cid Clementino',
  },
  padrao: {
    aviso: 'Prêmio', rotulo: 'Casacor Paraíba 2023', titulo: 'Melhor uso de materiais inovadores.',
    texto: 'O Odisse recebeu o prêmio na edição 2023 da mostra.',
    f1r: 'Mostra', f1v: 'CASACOR Paraíba', f2r: 'Ano', f2v: '2023', f3r: 'Estúdio', f3v: 'Odisse Arquitetura & Design',
  },
};
const O11 = {
  ...unicoTexto({ exemplo: porNucleo(EX_UNICO), fundo: (t) => (t.n.id === 'elaia' ? COR.pessego : COR.papel) }),
  id: 'o11', cod: 'O-11',
};

const POS_TEXTO = (padrao) => op('texto', 'Bloco de texto', [['alto', 'Topo'], ['centro', 'Centro'], ['pe', 'Base']], padrao);

const EX_CITACAO = {
  elaia: {
    rotulo: 'O horror',
    citacao: 'O <b>horror</b> está em nunca saber o que esperar deste cenário antinatural, em não saber o que vem a seguir ou de estar <b>preso</b> em um contínuo sem propósito.',
  },
  padrao: {
    rotulo: 'Ideia',
    citacao: 'A <b>arquitetura</b> começa quando a forma passa a abrigar o tempo de quem a habita.',
  },
};
const O12 = {
  id: 'o12', cod: 'O-12',
  nome: 'Citação',
  desc: 'Só texto: rótulo e citação (Corpo 01), ancorados no topo, no centro ou na base do recorte quadrado. Selecione palavras e use Ctrl+B para destacar.',
  slots: {},
  opcoes: [POS_TEXTO('centro'), op('rotulo', 'Rótulo acima do texto', [['nao', 'Sem'], ['sim', 'Com']], 'sim')],
  rotulo: (t) => t.op('rotulo') === 'sim',
  preenche: (n) => (n.id === 'elaia' ? COR.pessego : COR.papel),
  exemplo: porNucleo(EX_CITACAO),
  render(t) {
    const cor = t.tinta, pos_ = t.op('texto');
    const miolo = `${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('bloco')}`)}
      ${t.campo('citacao', 't-citacao', '', { fit: FIM - QUADRO, resto: true })}`;
    return `${t.fundo(t.f)}${t.cab(cor)}
      ${t.fluxo(M, QUADRO, W12, FIM - QUADRO, cor, miolo, pos_ === 'centro' ? 'meio' : pos_ === 'pe' ? 'fim' : '')}
      ${t.selo(cor)}`;
  },
};

const EX_TIPOGRAFICO = {
  objetos: {
    rotulo: 'O uso',
    titulo: 'Como o coração que o inspira, guarda um pouco de tudo.',
    texto: 'Flores secas e arranjos permanentes, ou o que se deposita ao longo do dia: chaves, lápis e pequenos objetos.',
  },
  padrao: {
    rotulo: 'Partido',
    titulo: 'Três ambientes, um ponto de fuga.',
    texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.',
  },
};
const O13 = {
  id: 'o13', cod: 'O-13',
  nome: 'Título + texto',
  desc: 'Rótulo, título grande e texto. Sem imagem, o bloco fica no centro; com imagem, o título fica no topo e o texto (colunas 1–5) e a imagem (7–12) seguem logo abaixo dele.',
  slots: { a: 'Imagem (7–12)' },
  rotulo: true,
  opcoes: [op('imagem', 'Imagem', [['sem', 'Sem'], ['com', 'Com']], 'sem')],
  preenche: (n) => (n.id === 'objetos' ? COR.grafite : COR.papel),
  slotsAtivos: (t) => (t.op('imagem') === 'com' ? ['a'] : []),
  exemplo: porNucleo(EX_TIPOGRAFICO),
  render(t) {
    const cor = t.tinta;
    const rot = t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`);
    if (t.op('imagem') !== 'com') {
      return `${t.fundo(t.f)}${t.cab(cor)}
        ${t.fluxo(M, QUADRO, W12, FIM - QUADRO, cor, `${rot}
          ${t.campo('titulo', 't-titulo', '', { fit: 600, resto: true })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`, 'meio')}
        ${t.selo(cor)}`;
    }
    // título no topo; texto (1–5) e imagem (7–12) começam um Bloco depois dele
    const y = 644;
    return `${t.fundo(t.f)}${t.cab(cor)}
      ${t.fluxo(M, TOPO, W(1, 11), 490, cor, `${rot}${t.campo('titulo', 't-titulo', '', { fit: 430, resto: true })}`, '', 'tit')}
      <div class="fluxo" data-segue="tit" data-gap="${E.bloco}" data-fim="${FIM}" style="${pos(M, y, W(1, 5), FIM - y)}color:${cor}">${t.campo('texto', 't-texto')}</div>
      ${t.img('a', X(7), y, W(7, 12), FIM - y, { segue: 'tit', gap: E.bloco })}
      ${t.selo(cor)}`;
  },
};

// O-14: o O-03 sobre imagem inteira — os textos numa caixa com a cor de preenchimento
const RESPIRO_CAIXA = E.bloco;
const O14 = {
  id: 'o14', cod: 'O-14',
  nome: 'Imagem + caixa de texto',
  desc: 'Imagem inteira ao fundo; rótulo (opcional), título e texto de apoio numa caixa com a cor de preenchimento, no topo ou na base do recorte quadrado. A caixa cresce com o texto; só com o texto de apoio, ela começa na coluna 5, junto dele.',
  slots: { a: 'Imagem de fundo' },
  opcoes: [
    op('caixa', 'Caixa de texto', [['alto', 'Topo'], ['pe', 'Base']], 'pe'),
    op('rotulo', 'Rótulo acima do título', [['nao', 'Sem'], ['sim', 'Com']], 'nao'),
  ],
  rotulo: (t) => t.op('rotulo') === 'sim',
  preenche: () => COR.papel,
  exemplo: porNucleo(EX_TESE),
  render(t) {
    const pad = RESPIRO_CAIXA;
    const rot = t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`);
    const tit = t.campo('titulo', 't-titulo', '', { fit: 340 });
    // só o texto de apoio na caixa (rótulo e título desligados ou vazios): a caixa se ajusta a ele —
    // começa na coluna 5 e vai para a largura toda se o texto passar de 5 linhas (data-caixa, em crescer)
    const soTexto = !rot && !tit;
    const miolo = [
      rot,
      tit,
      // texto de apoio: começa na coluna 5 do card (descontado o respiro da caixa) e vai para a largura toda se passar de 5 linhas
      t.campo('texto', 't-texto', `margin-top:${px('bloco')};margin-left:${soTexto ? 0 : X(5) - M - pad}px`, { attrs: ` data-cresce="5,1" data-recuo="${pad}"${soTexto ? ' data-caixa' : ''}` }),
    ].join('');
    const ancora = t.op('caixa') === 'alto' ? `top:${QUADRO}px` : `bottom:${ALT - FIM}px`;
    const x0 = soTexto ? X(5) - pad : M;
    const caixa = miolo.trim()
      ? `<div class="bloco fluxo caixa" style="left:${x0}px;width:${M + W12 - x0}px;${ancora};max-height:${FIM - QUADRO}px;padding:${pad}px;box-sizing:border-box;background:${t.f};color:${t.tinta}">${miolo}</div>`
      : '';
    return `${t.img('a', 0, 0, LARG, ALT)}${t.veuTopo()}${t.veuBase(300, 0.55)}
      ${t.cab(B)}
      ${caixa}
      ${t.selo(B)}`;
  },
};

// ---------------------------------------------------------------------------
// PINS 2:3 (Pinterest) — desenhados em 1080 × 1620 e exportados em 1000 × 1500 (mesma proporção:
// a margem de 52 vira 48). Um modelo universal; o núcleo escolhe a composição padrão.
// Sem carimbo e sem pontos: no feed do Pinterest a imagem compete sozinha, sem o contexto do perfil.
// O selo fica centrado no rodapé, menor que no Instagram.

export const ALT_PIN = 1620;
const PIN_FAIXA = 270;                 // faixa de painel abaixo (e acima) da imagem
const PIN_SELO = PIN_FAIXA / 2;        // centro do selo, a partir da base (meio da faixa de baixo)
const EX_PIN = {
  elaia: { titulo: 'A incerteza é mais assustadora que a alegoria.', linha: 'Backrooms, Labirinto Domesticado · Parte I' },
  padrao: { titulo: 'Um horizonte comum.', linha: '' },
};
const P01 = {
  id: 'p01', cod: 'P-01', grupo: 'pin', formato: 'pin', semCarimbo: true, semPontos: true,
  nome: 'Pin',
  desc: 'Imagem plena (sem texto), foto sobre painel ou título + imagem. Selo do núcleo centrado no rodapé. O texto do pin vai nos campos do Pinterest, não na imagem — salvo na composição com título (padrão do Elaia).',
  slots: { a: 'Imagem do pin' },
  opcoes: [
    op('composicao', 'Composição', [['plena', 'Imagem plena'], ['painel', 'Foto sobre painel'], ['titulo', 'Título + imagem']],
      (n) => ({ objetos: 'painel', elaia: 'titulo' }[n.id] || 'plena')),
  ],
  // na imagem plena não há fundo à mostra: sem preenchimento
  preenche: (n) => n.painel,
  semPreenchimento: (lerOp) => lerOp('composicao') === 'plena',
  exemplo: porNucleo(EX_PIN),
  render(t) {
    const comp = t.op('composicao');
    const selo = (cor) => {
      const h = t.n.selo === 'mao' ? 54 : 48;
      return `<div class="selo" style="top:${ALT_PIN - PIN_SELO - h / 2}px;color:${cor}" data-cor="${cor}">${mark(t.n.selo, h)}</div>`;
    };
    const fundo = `<div class="bloco" style="${pos(0, 0, LARG, ALT_PIN)}background:${t.f}"></div>`;
    if (comp === 'painel') {
      return `${fundo}${t.img('a', 0, PIN_FAIXA, LARG, ALT_PIN - 2 * PIN_FAIXA, { fundo: FUNDO_FOTO(t.n) })}${selo(t.tinta)}`;
    }
    if (comp === 'titulo') {
      // título e linha de contexto no alto; a imagem, entre as margens, segue um Bloco depois do texto até a faixa de baixo
      const y = 760, fim = ALT_PIN - PIN_FAIXA;
      return `${fundo}
        ${t.fluxo(M, TOPO, W12, 640, t.tinta, `${t.campo('titulo', 't-capa', '', { fit: 640, resto: true })}${t.linha()}`, '', 'tit')}
        ${t.img('a', M, y, W12, fim - y, { segue: 'tit' })}
        ${selo(t.tinta)}`;
    }
    // imagem plena, sem texto; véu leve na base para o selo
    const veu = FOTO_CLARA(t.n) ? '' : t.veuBase(420, 0.42, 0, LARG, ALT_PIN);
    return `${t.img('a', 0, 0, LARG, ALT_PIN, { fundo: FUNDO_FOTO(t.n) })}${veu}${selo(B)}`;
  },
};
const PINS = [P01];
const PIN_POR_ID = Object.fromEntries(PINS.map((m) => [m.id, m]));


// ---------------------------------------------------------------------------
// PEÇAS EDITORIAIS E DE TRABALHO (25/11)
// Editoriais: chão ardósia (ou foto), folha solta com sombra. De trabalho: chão âmbar, folha recortada sem
// sombra, traço e texto na tinta do fundo. Conteúdo principal no recorte quadrado (180–1260).

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// medidas das folhas: capa 3:4 (540 × 720), capa A4 (690 × 976), miniatura do arquivo (162 × 216)
const FOLHA = { capa: [540, 720], a4: [690, Math.round(690 * Math.SQRT2)], mini: [162, 216] };
const EX_FOLHA = {
  elaia: { num: '1', titulo: 'Backrooms,<br>Labirinto<br>Domesticado', serie: 'Elaia · Parte I', cabFolha: 'Elaia — escritos do Odisse', cabDir: 'Arquivo' },
  padrao: { num: '1', titulo: 'Título<br>da publicação', serie: 'Série · Parte I', cabFolha: 'Escritos do Odisse', cabDir: 'Arquivo' },
};
const O15 = {
  id: 'o15', cod: 'O-15', grupo: 'pecas',
  nome: 'Folha sobre ardósia',
  desc: 'Peça impressa solta sobre o fundo, com sombra: a capa numerada (3:4 ou A4, centrada no card) ou o arquivo da série (as capas em miniatura; as que faltam ficam tracejadas).',
  slots: {},
  opcoes: [
    op('folha', 'Folha', [['capa', 'Capa 3:4'], ['a4', 'Capa A4'], ['arquivo', 'Arquivo']], 'capa'),
    op('publicadas', 'Publicadas no arquivo', [1, 2, 3, 4, 5, 6, 7, 8].map((i) => [String(i), String(i)]), '3'),
  ],
  preenche: () => COR.ardosia,
  exemplo: porNucleo(EX_FOLHA),
  render(t) {
    const tipo = t.op('folha');
    // capa numerada: número no canto, título no centro (a 40% da altura), série no pé
    const capa = (w, h, { num, titulo, serie }) => {
      const k = w / FOLHA.capa[0];
      return `<div class="folha-capa" style="width:${w}px;height:${h}px;background:${COR.nevoa};color:${COR.grafite}">
        <div style="position:absolute;left:${28 * k}px;top:${20 * k}px;font-size:${40 * k}px;font-weight:300;line-height:1">${num}</div>
        <div style="position:absolute;left:0;top:${h * 0.4}px;width:100%;text-align:center">${titulo}</div>
        <div style="position:absolute;left:0;bottom:${28 * k}px;width:100%;text-align:center">${serie}</div></div>`;
    };
    if (tipo !== 'arquivo') {
      const [w, h] = FOLHA[tipo] || FOLHA.capa, k = w / FOLHA.capa[0];
      const miolo = capa(w, h, {
        num: t.campo('num', 'cab-txt', '', { ph: '1' }) || '',
        titulo: t.campo('titulo', 't-titulo', `font-size:${Math.round(46 * k)}px;line-height:1.02;padding:0 ${Math.round(32 * k)}px`),
        serie: t.campo('serie', 't-rotulo', `font-size:${Math.round(14 * k)}px`),
      });
      return `${t.fundo(t.f)}${t.cab(t.tinta)}
        <div class="folha-solta" style="${pos((LARG - w) / 2, Math.round((ALT - h) / 2) - 10, w, h)}">${miolo}</div>
        ${t.selo(t.tinta)}`;
    }
    // arquivo: folha de papel nas 12 colunas, cabeçalho com filete e a grade 4 × 2 das capas
    const n = Number(t.op('publicadas')) || 0, [mw, mh] = FOLHA.mini;
    const titulo = t.valor('titulo');
    const itens = Array.from({ length: 8 }, (_, i) => (i < n
      ? `<div class="arq-item">${capa(mw, mh, { num: i + 1, titulo: `<span class="t-titulo" style="font-size:14px;line-height:1.02">${titulo}</span>`, serie: '' })}<span class="t-rotulo" style="font-size:12px">Parte ${ROMANOS[i]}</span></div>`
      : `<div class="arq-item"><div class="arq-vaga" style="width:${mw}px;height:${mh}px"></div><span class="t-rotulo" style="font-size:12px;opacity:.5">A publicar</span></div>`)).join('');
    const y = QUADRO + 200, h = 680;
    return `${t.fundo(t.f)}${t.cab(t.tinta)}
      <div class="folha-solta" style="${pos(M, y, W12, h)}background:${COR.papel};color:${COR.grafite}">
        <div style="position:absolute;left:32px;top:28px">${t.campo('cabFolha', 't-rotulo', '', { ph: 'Cabeçalho da folha' })}</div>
        <div style="position:absolute;right:32px;top:28px">${t.campo('cabDir', 't-rotulo', '')}</div>
        <div style="position:absolute;left:32px;top:64px;width:${W12 - 64}px;height:1.5px;background:${COR.grafite}"></div>
        <div class="arq-grade" style="position:absolute;left:32px;top:104px;width:${W12 - 64}px">${itens}</div></div>
      ${t.selo(t.tinta)}`;
  },
};

const EX_APRESENTACAO = {
  padrao: { texto: 'O Odisse é um estúdio de arquitetura e design em João Pessoa, com pesquisa no centro da prática.<br><br>Fundado por Cid Clementino e Nathalia Linhares.' },
};
const O16 = {
  id: 'o16', cod: 'O-16', grupo: 'pecas',
  nome: 'Texto de apresentação',
  desc: 'Texto corrido em Corpo 01 sobre o fundo (ardósia), no recorte quadrado, colunas 1–11.',
  slots: {},
  preenche: () => COR.ardosia,
  exemplo: porNucleo(EX_APRESENTACAO),
  render(t) {
    return `${t.fundo(t.f)}${t.cab(t.tinta)}
      ${t.fluxo(M, QUADRO, W(1, 11), FIM - QUADRO, t.tinta, t.campo('texto', 't-citacao', '', { fit: FIM - QUADRO }))}
      ${t.selo(t.tinta)}`;
  },
};

const EX_CITACAO_IMG = {
  padrao: { citacao: '«Como transformar um espaço indiferenciado em um conjunto de partes reconhecíveis.»' },
};
const O17 = {
  id: 'o17', cod: 'O-17', grupo: 'pecas',
  nome: 'Citação sobre imagem',
  desc: 'Citação em caixa alta, branca, sobre a imagem inteira em duotone ardósia (o tratamento do Estúdio), com véu em cima e embaixo. Sem atribuição e sem código.',
  slots: { a: 'Imagem de fundo' },
  opcoes: [op('tom', 'Imagem', [['duotone', 'Duotone ardósia'], ['original', 'Cor original']], 'duotone')],
  exemplo: porNucleo(EX_CITACAO_IMG),
  render(t) {
    // duotone por mesclagem: a foto em tons de cinza, o escuro levado ao ardósia (lighten) e o claro à névoa (darken)
    const duo = t.op('tom') === 'duotone';
    const tons = duo ? `<div class="duo" style="${pos(0, 0, LARG, ALT)}background:${COR.ardosia};mix-blend-mode:lighten"></div>
      <div class="duo" style="${pos(0, 0, LARG, ALT)}background:${COR.nevoa};mix-blend-mode:darken"></div>` : '';
    return `${t.img('a', 0, 0, LARG, ALT, { estiloImg: duo ? 'filter:grayscale(1) contrast(1.12)' : '' })}${tons}
      ${t.veuTopo(1000, 0.86)}${t.veuBase(380, 0.8)}
      ${t.cab(B)}
      ${t.fluxo(M, QUADRO, W12, 600, B, t.campo('citacao', 't-citacao caixa-alta', '', { fit: 600 }))}
      ${t.selo(B)}`;
  },
};

const EX_DESENHO = {
  padrao: { texto: 'Descrição do desenho: o que ele mostra e como ler.' },
};
const O18 = {
  id: 'o18', cod: 'O-18', grupo: 'pecas',
  nome: 'Desenho sobre cor',
  desc: 'Desenho em linha (planta, corte, diagrama) sobre o fundo âmbar, nas 12 colunas, com caixa de texto centrada embaixo (colunas 3–10). O branco do desenho some no fundo (multiplicar).',
  slots: { a: 'Desenho (fundo branco ou transparente)' },
  preenche: () => COR.ambar,
  exemplo: porNucleo(EX_DESENHO),
  render(t) {
    const yTxt = 1090;
    return `${t.fundo(t.f)}${t.cab(t.tinta)}
      ${t.img('a', M, QUADRO - 40, W12, yTxt - E.bloco - (QUADRO - 40), { contain: true, estiloImg: 'mix-blend-mode:multiply' })}
      ${t.fluxo(X(3), yTxt, W(3, 10), FIM - yTxt, t.tinta, t.campo('texto', 't-texto', 'text-align:center'))}
      ${t.selo(t.tinta)}`;
  },
};

const EX_PAGINA = {
  padrao: {
    titulo: 'A conversa com <u>Cid Clementino</u> e <u>Nathalia Linhares</u> [Odisse], em [local], em [data].',
    legR: 'Tema da conversa', pergunta: '[pergunta]', texto: 'Nome: [resposta corrida, que segue no próximo card].', rodape: '02',
  },
};
const PAGINA = { y0: 96, y1: 1296 };   // a folha vai de um Bloco abaixo do carimbo até acima do selo
const O19 = {
  id: 'o19', cod: 'O-19', grupo: 'pecas',
  nome: 'Página recortada',
  desc: 'Folha de papel sobre o fundo âmbar, sangrando pela borda. Abertura: a folha começa na coluna 2 e sangra à direita, com o texto de abertura. Corrida: espelhada, com rótulo, pergunta recuada, resposta e número da página.',
  slots: {},
  opcoes: [op('pagina', 'Página', [['abertura', 'Abertura'], ['corrida', 'Corrida']], 'abertura')],
  preenche: () => COR.ambar,
  exemplo: porNucleo(EX_PAGINA),
  render(t) {
    const tin = A, h = PAGINA.y1 - PAGINA.y0;
    if (t.op('pagina') !== 'corrida') {
      return `${t.fundo(t.f)}${t.painel(X(2), PAGINA.y0, LARG - X(2), h, COR.papel)}${t.cab(t.tinta)}
        ${t.fluxo(X(3), QUADRO, W(3, 11), FIM - QUADRO, tin, t.campo('titulo', 't-citacao', '', { fit: FIM - QUADRO }))}
        ${t.selo(t.tinta)}`;
    }
    const larg = LARG - X(2);
    return `${t.fundo(t.f)}${t.painel(0, PAGINA.y0, larg, h, COR.papel)}${t.cab(t.tinta)}
      ${t.fluxo(M, QUADRO - 40, W(1, 10), 40, tin, t.campo('legR', 't-legenda', 'text-align:right'))}
      ${t.fluxo(X(4), QUADRO + 60, W(4, 10), 180, tin, t.campo('pergunta', 't-texto'))}
      ${t.fluxo(M, QUADRO + 250, W(1, 10), FIM - QUADRO - 250 - 64, tin, t.campo('texto', 't-texto', 'text-align:justify;hyphens:auto', { fit: FIM - QUADRO - 314 }))}
      ${t.fluxo(M, PAGINA.y1 - 64, W(1, 4), 40, tin, t.campo('rodape', 't-legenda'))}
      ${t.selo(t.tinta)}`;
  },
};

const UNIVERSAIS = [O01, O02, O03, O04, O05, O06, O07, O08, O09, O10, O11, O12, O13, O14, O15, O16, O17, O18, O19];
const UNIV_POR_ID = Object.fromEntries(UNIVERSAIS.map((m) => [m.id, m]));

/** Cards de versões anteriores → universal + opções equivalentes (a aparência não muda). */
const MIGRA = {
  'estudio:capa': ['o01', { texto: 'pe' }], 'arquitetos:capa': ['o01', { texto: 'pe' }], 'elaia:capa': ['o01', { texto: 'pe' }],
  'objetos:capa': ['o01', { texto: 'alto' }], 'objetos:capa-centro': ['o01', { texto: 'alto', alinhar: 'centro' }],
  'arquitetos:capa-papel': ['o02', { imagens: '1', fundo: 'papel' }], 'elaia:capa-papel': ['o02', { imagens: '1', fundo: 'papel' }],
  'arquitetos:capa-tres': ['o02', { imagens: '3', fundo: 'painel' }], 'estudio:capa-painel': ['o02', { imagens: '2', fundo: 'painel' }],
  'arquitetos:tese': ['o03', { ordem: 'texto', fundo: 'papel' }], 'elaia:tese': ['o03', { ordem: 'texto', fundo: 'papel' }],
  'objetos:painel-imagem': ['o03', { ordem: 'texto', fundo: 'painel' }],
  'arquitetos:vista': ['o03', { ordem: 'imagem', fundo: 'papel' }], 'elaia:titulo-imagem': ['o03', { ordem: 'imagem', fundo: 'papel' }],
  'arquitetos:abertura-projeto': ['o03', { ordem: 'imagem', fundo: 'papel' }],
  'objetos:imagem-painel': ['o03', { ordem: 'imagem', fundo: 'painel' }],
  'estudio:imagem-legenda': ['o04', { legenda: 'topo' }], 'arquitetos:pausa': ['o04', { legenda: 'pe' }], 'objetos:pausa': ['o04', { legenda: 'pe' }],
  'estudio:vertical-8-4': ['o05', { corte: '8-4', legenda: 'topo' }], 'estudio:vertical-4-8': ['o05', { corte: '4-8', legenda: 'topo' }],
  'arquitetos:vertical-4-8': ['o05', { corte: '4-8', legenda: 'pe' }],
  'arquitetos:referencia': ['o06', { imagens: '1', fundo: 'papel', credito: 'sim' }],
  'arquitetos:duas-coluna': ['o06', { imagens: '2', fundo: 'papel', credito: 'sim' }],
  'elaia:imagem-coluna': ['o06', { imagens: '1', fundo: 'painel', credito: 'nao' }],
  'arquitetos:processo': ['o07', {}], 'objetos:processo': ['o07', {}],
  'elaia:imagem-titulo-topo': ['o08', { texto: 'alto' }], 'elaia:imagem-titulo-base': ['o08', { texto: 'pe' }],
  'arquitetos:ficha': ['o09', { imagem: 'sem' }], 'objetos:imagem-ficha': ['o09', { imagem: 'com' }],
  'arquitetos:fechamento': ['o10', {}], 'objetos:fechamento': ['o10', {}], 'elaia:fechamento': ['o10', {}],
  'estudio:unico': ['o11', {}], 'elaia:unico': ['o11', {}],
  // 14/11: fusões
  'elaia:imagem-texto': ['o03', { ordem: 'imagem', rotulo: 'sim', fundo: 'papel' }, (c) => { c.textos = { ...(c.textos || {}), titulo: { ativo: false } }; }],
  'objetos:unico-imagem': ['o03', { ordem: 'imagem', rotulo: 'sim', fundo: 'grafite' }, (c) => {
    const k = c.campos || {};
    if (k.link) k.texto = [k.texto, k.link].filter(Boolean).join('<br>'); // o link passa para o texto
    delete k.link; delete k.aviso;
  }],
  'elaia:citacao': ['o12', { texto: 'centro', fundo: 'pessego' }],
  'objetos:uso-janela': ['o13', { imagem: 'com', fundo: 'grafite' }],
  'objetos:tipografico': ['o13', { imagem: 'sem', fundo: 'grafite' }],
  'estudio:abertura-ficha': ['o09', { imagem: 'com', linhas: '5', fundo: 'ardosia' }, (c) => { delete c.campos?.rotulo; }],
  'estudio:tipografico-ficha': ['o09', { imagem: 'sem', linhas: '5', fundo: 'ardosia' }, (c) => {
    delete c.campos?.rotulo;
    c.textos = { ...(c.textos || {}), texto: { ...(c.textos?.texto || {}), ativo: true } };
  }],
};

/** Converte um card antigo para o universal equivalente. Devolve true se mudou. */
export function migrarCard(nucleoId, card) {
  const m = MIGRA[`${nucleoId}:${card.modelo}`];
  if (!m) return false;
  card.modelo = m[0];
  card.opcoes = { ...m[1], ...(card.opcoes || {}) };
  if (m[2]) m[2](card);
  const c = card.campos || {};
  if (c.rotulo && !c.linha && UNIV_POR_ID[m[0]].grupo === 'capa') c.linha = c.rotulo; // autoria do Estúdio vira linha
  if (m[0] === 'o06' && c.rotulo) delete c.rotulo;
  return true;
}

/** Opções do card, com os padrões do modelo para o núcleo. */
export function opcoesDoModelo(modelo, n, card) {
  const base = modelo?.opcoes || [];
  const carimbo = modelo?.semCarimbo ? [] : [OP_CARIMBO];
  const lerOp = (k) => {
    const d = base.find((x) => x.k === k);
    return card?.opcoes?.[k] ?? (typeof d?.padrao === 'function' ? d.padrao(n) : d?.padrao);
  };
  if (!modelo?.preenche || !n?.painel || modelo.semPreenchimento?.(lerOp)) return [...base, ...carimbo];
  return [...base, opcaoPreenchimento(modelo, n, lerOp), ...carimbo];
}
export function opcoesDe(modelo, card, n) {
  const o = {};
  for (const d of opcoesDoModelo(modelo, n, card)) {
    const pad = typeof d.padrao === 'function' ? d.padrao(n) : d.padrao;
    o[d.k] = card?.opcoes?.[d.k] ?? pad;
    if (d.k === 'fundo' && o.fundo === 'painel') o.fundo = idDaCor(n.painel) || pad; // valor antigo
    if (d.k === 'fundo' && !d.valores.some(([v]) => v === o.fundo)) o.fundo = pad;
  }
  return o;
}

// ---------------------------------------------------------------------------

/** Catálogo de cada núcleo: os universais (O-01…O-11) seguidos dos modelos específicos do núcleo. */
export const CATALOGO = {
  estudio: [...UNIVERSAIS, ...ESTUDIO],
  arquitetos: [...UNIVERSAIS, ...ARQUITETOS],
  objetos: [...UNIVERSAIS, ...OBJETOS],
  elaia: [...UNIVERSAIS, ...ELAIA],
};

/** Sequências de abertura de cada núcleo (seguem os carrosséis de referência). */
export const SEQUENCIAS = {
  estudio: ['o01', 'o05', 'o04', 'janela', 'o09', 'o10'],
  arquitetos: ['o01', 'o03', 'o07', 'amplitude', 'o06', 'o09', 'o10'],
  objetos: ['o01', 'o03', 'o13', 'o07', 'desenho', 'o09', 'o10'],
  elaia: ['o01', 'o03', 'o12', 'o08', 'o06', 'imagem-ficha', 'o10'],
};
/** Um projeto de pins começa com um pin; os outros entram pelo +. */
export const SEQUENCIA_PIN = ['p01'];

/**
 * Códigos de referência fixos: sigla do núcleo + número. A ordem destas listas é a numeração
 * original; modelo retirado deixa o número vago (OA-04, Abertura do projeto, saiu em 13/11)
 * e modelo novo recebe o próximo número.
 */
const NUMERACAO = {
  estudio: ['capa', 'capa-painel', 'imagem-legenda', 'vertical-8-4', 'vertical-4-8', 'janela', 'abertura-ficha', 'tipografico-ficha', 'unico'],
  arquitetos: ['capa', 'capa-papel', 'capa-tres', null, 'tese', 'vista', 'amplitude', 'pausa', 'referencia', 'duas-coluna', 'material', 'vertical-4-8', 'processo', 'ficha', 'fechamento'],
  objetos: ['capa', 'painel-imagem', 'imagem-painel', 'pausa', 'uso-janela', 'tipografico', 'processo', 'desenho', 'ficha-lateral', 'imagem-ficha', 'fechamento', 'unico-imagem', 'capa-centro'],
  elaia: ['capa', 'capa-papel', 'tese', 'titulo-imagem', 'imagem-texto', 'imagem-titulo-topo', 'imagem-titulo-base', 'imagem-coluna', 'citacao', 'imagem-ficha', 'fechamento', 'materia-bruta', 'unico'],
};
const SIGLAS = { estudio: 'OE', arquitetos: 'OA', objetos: 'OO', elaia: 'EL' };
export function codigoDe(nucleoId, modeloId) {
  if (UNIV_POR_ID[modeloId]) return UNIV_POR_ID[modeloId].cod;
  if (PIN_POR_ID[modeloId]) return PIN_POR_ID[modeloId].cod;
  const i = NUMERACAO[nucleoId]?.indexOf(modeloId) ?? -1;
  return i < 0 ? '' : `${SIGLAS[nucleoId]}-${String(i + 1).padStart(2, '0')}`;
}

/** Modelos de um núcleo num formato: '3x4' (posts) ou 'pin' (o pin universal). */
export function modelosDo(nucleoId, formato = '3x4') { return formato === 'pin' ? PINS : CATALOGO[nucleoId] || []; }
export function modeloDe(nucleoId, id) {
  if (PIN_POR_ID[id]) return PIN_POR_ID[id];
  const lista = modelosDo(nucleoId);
  return lista.find((m) => m.id === id) || lista[0];
}
/** Formato de um modelo ('3x4' ou 'pin'). */
export const formatoDoModelo = (m) => m?.formato || '3x4';

/** Seta fina para a direita, na altura das maiúsculas do Rótulo. */
const SETA = '<svg class="seta" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true"><path d="M0 7H28M22 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SETA_VOLTA = '<svg class="seta" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true"><path d="M30 7H2M8 1L2 7l6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

/** Renderiza o miolo de um card (1080 × 1440) como HTML. */
export function renderCard(opc) {
  const modelo = modeloDe(opc.nucleo.id, opc.card.modelo);
  const t = criarContexto({ ...opc, modelo });
  return modelo.render(t) + (modelo.semPontos ? '' : pontos());
}

/** Textos de conteúdo do card (Título / Corpo), na ordem em que aparecem: [{ chave, macro, padrao }]. */
export function textosDe(opc) { return estruturaDe(opc).textos; }

/** Textos, fichas e véu do card (render seco no modo de edição): { textos, fichas: [{ prefixo, linhas }], veu }. */
export function estruturaDe({ card, nucleo, globais }) {
  const modelo = modeloDe(nucleo.id, card.modelo);
  const t = criarContexto({ card, indice: 0, total: 2, nucleo, globais, modelo, modo: 'editar', fonteImagem: () => '' });
  modelo.render(t);
  const veus = { topo: t.veus.topo > 0, meio: t.veus.meio > 0, base: t.veus.base > 0 };
  return { textos: t.textos, fichas: t.fichas, veu: veus.topo || veus.meio || veus.base, veus };
}

/**
 * Quatro pontos (25/11): dois dentro do carimbo, na altura do centro da faixa, e dois na altura do centro
 * do selo; todos centrados na margem. A cor é definida em colorirPontos (ajustarLayout).
 */
function pontos() {
  const d = E.ponto;
  const ys = [CARIMBO.y + CARIMBO.h / 2, ALT - E.selo];
  const xs = [M / 2, LARG - M / 2];
  return xs.flatMap((x) => ys.map((y) => `<div class="ponto" style="${pos(x - d / 2, y - d / 2, d, d)}"></div>`)).join('');
}

/** Cor que contrasta com o que está sob o ponto: imagem ou fundo escuro → branco; claro → ardósia. */
function corSob(card, x, y) {
  const els = [...card.children].reverse();
  for (const el of els) {
    if (!el.classList.contains('bloco') && !el.classList.contains('slot')) continue;
    const l = el.offsetLeft, t = el.offsetTop;
    if (x < l || x > l + el.offsetWidth || y < t || y > t + el.offsetHeight) continue;
    const bg = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
    const transparente = !bg || (bg.length > 3 && bg[3] === 0);
    const lum = transparente ? null : (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
    if (el.classList.contains('slot') && !el.dataset.vazio) {
      // imagem: branco, salvo foto de estúdio sobre fundo muito claro (Objetos)
      return lum !== null && lum > 0.85 ? A : B;
    }
    if (transparente) continue; // véu (gradiente) ou transparente
    return lum < 0.5 ? B : A;
  }
  return A;
}

/** Fundo sob um ponto: { img: true } sobre imagem, ou { cor: [r,g,b] } do bloco opaco mais alto. */
function fundoSob(card, x, y) {
  const els = [...card.children].reverse();
  for (const el of els) {
    if (!el.classList.contains('bloco') && !el.classList.contains('slot')) continue;
    const l = el.offsetLeft, t = el.offsetTop;
    if (x < l || x > l + el.offsetWidth || y < t || y > t + el.offsetHeight) continue;
    const bg = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
    const transparente = !bg || (bg.length > 3 && bg[3] === 0);
    if (el.classList.contains('slot') && !el.dataset.vazio) return { img: true, cor: transparente ? null : bg };
    if (transparente) continue;
    return { cor: bg };
  }
  return { cor: [250, 250, 247] };
}
const lumDe = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export function colorirPontos(card) {
  card.querySelectorAll(':scope > .ponto').forEach((p) => {
    p.style.background = corSob(card, p.offsetLeft + p.offsetWidth / 2, p.offsetTop + p.offsetHeight / 2);
  });
  // Carimbo inteiro, sem partição: uma cor só para as três células.
  // Só linhas → transparente, com a tinta que contrasta com a maior parte do que está sob ele;
  // fundo cheio → a cor de preenchimento do card e a tinta que contrasta.
  card.querySelectorAll(':scope > .carimbo').forEach((cb) => {
    const y = cb.offsetTop + cb.offsetHeight / 2, N = 15;
    const xs = Array.from({ length: N }, (_, i) => cb.offsetLeft + (cb.offsetWidth * (i + 0.5)) / N);
    cb.querySelectorAll('.cel').forEach((c) => { c.style.background = ''; c.style.color = ''; });
    if (cb.dataset.fundo !== 'cheio') {
      cb.style.background = '';
      cb.style.color = maioria(xs.map((x) => corSob(card, x, y)));
      return;
    }
    // cheio: a cor de preenchimento escolhida no card (papel nos cards de imagem inteira)
    const cor = cb.dataset.preench || COR.papel;
    cb.style.background = cor;
    cb.style.color = tintaSobre(cor);
  });
  // Selo: quando a imagem chega até ele (texto desligado), a cor passa a contrastar com a imagem
  card.querySelectorAll(':scope > .selo').forEach((s) => {
    const x = LARG / 2, y = s.offsetTop + s.offsetHeight / 2; // centro do selo (a altura do card varia com o formato)
    const topo = [...card.children].reverse().find((el) => (el.classList.contains('bloco') || el.classList.contains('slot'))
      && x >= el.offsetLeft && x <= el.offsetLeft + el.offsetWidth && y >= el.offsetTop && y <= el.offsetTop + el.offsetHeight);
    s.style.color = topo?.classList.contains('slot') && !topo.dataset.vazio ? corSob(card, x, y) : s.dataset.cor;
  });
}

function maioria(lista) {
  const n = new Map();
  lista.forEach((v) => n.set(v, (n.get(v) || 0) + 1));
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const resolverExemplo = (m, nid) => (typeof m?.exemplo === 'function' ? m.exemplo(nid) : { ...(m?.exemplo || {}) });
export function exemploDe(nucleoId, modeloId) {
  return resolverExemplo(modeloDe(nucleoId, modeloId), nucleoId);
}

/** Áreas de imagem que o card usa de fato (algumas opções escondem slots). */
export function slotsDe(nucleoId, card) {
  const m = modeloDe(nucleoId, card.modelo);
  const todos = Object.entries(m.slots || {});
  if (!m.slotsAtivos) return todos;
  const ops = opcoesDe(m, card, { id: nucleoId });
  const ativos = m.slotsAtivos({ op: (k) => ops[k] });
  return todos.filter(([s]) => ativos.includes(s));
}

/** Grupo do modelo no painel direito. */
const CAPAS = new Set();
const FECHAMENTOS = new Set(['tipografico-ficha']);
export const GRUPOS = [
  ['capa', 'Capas'],
  ['corpo', 'Corpo'],
  ['fechamento', 'Fechamento'],
  ['pecas', 'Peças editoriais e de trabalho'],
  ['unico', 'Posts únicos'],
  ['pin', 'Pins'],
];
export function grupoDe(m) {
  if (m.grupo) return m.grupo;
  if (m.unico) return 'unico';
  if (CAPAS.has(m.id)) return 'capa';
  if (FECHAMENTOS.has(m.id)) return 'fechamento';
  return 'corpo';
}

const LINHAS_MAX = 5;
const IMG_MIN = 220;

/**
 * Passe de layout depois de renderizar um card:
 * 1. títulos ajustam o corpo (data-fit);
 * 2. textos de apoio com mais de 5 linhas alargam a caixa: meia tela → 3/4 → tela inteira (data-cresce);
 * 3. imagens e painéis abaixo do texto mantêm distância fixa do fim do texto (data-segue).
 */
export function ajustarLayout(raiz) {
  raiz.querySelectorAll('[data-fit]').forEach(ajustar);
  raiz.querySelectorAll('[data-cresce]').forEach(crescer);
  refluir(raiz);
}

/** Reposiciona imagens e painéis que dependem dos textos (segue/antes) e recolore pontos, carimbo e selo.
 *  Roda a cada digitação: as imagens são empurradas para cima e para baixo à medida que o texto cresce. */
export function refluir(raiz) {
  raiz.querySelectorAll('[data-resto]').forEach(ajustar);
  raiz.querySelectorAll('[data-podar]').forEach(podar);
  raiz.querySelectorAll('[data-segue]').forEach((el) => seguir(el, raiz));
  raiz.querySelectorAll('[data-antes]').forEach((el) => anteceder(el, raiz));
  const cards = raiz.classList?.contains('card') ? [raiz] : raiz.querySelectorAll('.card');
  cards.forEach(colorirPontos);
}

/** Ficha que não cabe: as linhas saem de baixo para cima até a pilha caber no bloco.
 *  Cada linha que sai fica marcada (data-suprimida) para o painel avisar. */
export function podar(bloco) {
  const linhas = [...bloco.querySelectorAll('.ficha-linha')];
  linhas.forEach((l) => { l.style.display = ''; delete l.dataset.suprimida; });
  const usado = () => [...bloco.children].reduce((s, c) => {
    if (!c.offsetHeight) return s;
    const cs = getComputedStyle(c);
    return s + c.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
  }, 0);
  for (let i = linhas.length - 1; i >= 0 && usado() > bloco.clientHeight + 1; i--) {
    linhas[i].style.display = 'none';
    linhas[i].dataset.suprimida = '1';
  }
}

export function crescer(el) {
  const estagios = el.dataset.cresce.split(',').map(Number);
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 39;
  const recuo = Number(el.dataset.recuo || 0); // texto dentro de caixa: desconta o respiro dela para seguir o grid do card
  // data-caixa: o texto está sozinho numa caixa (O-14) — quem anda é a borda esquerda da caixa, não o texto
  const caixa = el.dataset.caixa !== undefined ? el.parentElement : null;
  for (const col of estagios) {
    if (caixa) {
      const x0 = Math.max(M, X(col) - recuo);
      caixa.style.left = x0 + 'px';
      caixa.style.width = M + W(1, 12) - x0 + 'px';
      el.style.marginLeft = '0px';
    } else el.style.marginLeft = Math.max(0, X(col) - M - recuo) + 'px';
    if (Math.round(el.scrollHeight / lh) <= LINHAS_MAX) break;
  }
}

function fimDoBloco(bloco) {
  let b = 0;
  for (const c of bloco.children) {
    if (!c.offsetHeight) continue;
    b = Math.max(b, c.offsetTop + c.offsetHeight);
  }
  return bloco.offsetTop + b;
}

/** Bloco sem nada visível (todos os textos desligados ou vazios na exportação). */
const blocoVazio = (bloco) => ![...bloco.querySelectorAll('*')].some((c) => c.offsetHeight && (c.textContent.trim() || c.dataset.ph || c.dataset.campo));

export function seguir(el, raiz) {
  const card = raiz.classList?.contains('card') ? raiz : el.closest('.card') || raiz;
  const bloco = card.querySelector(`[data-bloco="${el.dataset.segue}"]`);
  if (!bloco) return;
  if (blocoVazio(bloco)) {
    // sem texto, a imagem sobe até o topo do card (e o painel some)
    const fim = Number(el.dataset.fim || card.offsetHeight || ALT);
    if (el.dataset.modo === 'altura') el.style.height = '0px';
    else { el.style.top = '0px'; el.style.height = fim + 'px'; }
    return;
  }
  const y = Math.round(fimDoBloco(bloco) + Number(el.dataset.gap || 96));
  if (el.dataset.modo === 'altura') {
    el.style.height = Math.max(0, y - el.offsetTop) + 'px';
  } else {
    const fim = Number(el.dataset.fim || card.offsetHeight || ALT);
    const topo = Math.min(y, fim - IMG_MIN);
    el.style.top = topo + 'px';
    el.style.height = fim - topo + 'px';
  }
}

function inicioDoBloco(bloco) {
  let t = Infinity;
  for (const c of bloco.children) {
    if (!c.offsetHeight) continue;
    t = Math.min(t, c.offsetTop);
  }
  return bloco.offsetTop + (t === Infinity ? bloco.offsetHeight : t);
}

/** Imagem acima de um bloco ancorado embaixo: desce até data-gap antes do início do bloco. */
export function anteceder(el, raiz) {
  const card = raiz.classList?.contains('card') ? raiz : el.closest('.card') || raiz;
  const bloco = card.querySelector(`[data-bloco="${el.dataset.antes}"]`);
  if (!bloco) return;
  if (blocoVazio(bloco)) { el.style.height = (card.offsetHeight || ALT) - el.offsetTop + 'px'; return; } // sem texto, a imagem desce até a base
  const fim = Math.round(inicioDoBloco(bloco) - Number(el.dataset.gap || E.bloco));
  el.style.height = Math.max(IMG_MIN, fim - el.offsetTop) + 'px';
}

/** Ajusta o corpo dos títulos marcados com data-fit="min,max,alturaMax". */
export function ajustarTextos(raiz) {
  ajustarLayout(raiz);
}
export function ajustar(el) {
  const [min, max, alt0] = el.dataset.fit.split(',').map(Number);
  let alt = alt0;
  // data-resto: a área máxima é o que sobra no bloco depois dos irmãos (ex.: linha de contexto de até 5 linhas)
  if (el.dataset.resto !== undefined && el.parentElement) {
    let usado = 0;
    for (const c of el.parentElement.children) {
      if (c === el) continue;
      const cs = getComputedStyle(c);
      usado += c.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    }
    alt = Math.max(0, Math.min(alt, el.parentElement.clientHeight - usado));
  }
  let s = max;
  el.style.fontSize = s + 'px';
  while (s > min && (el.scrollHeight > alt || el.scrollWidth > el.clientWidth + 1)) {
    s -= 2;
    el.style.fontSize = s + 'px';
  }
}
