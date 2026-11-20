// KPIs (#/kpis; Cid, 19/11) — seção própria no menu principal, com atalho em Ferramentas › Gestão.
// Duas subpáginas, com as Abas em caixa (nome da seção à esquerda) acima do título:
//   Painel (#/kpis)        disposição Boletim: um Bloco por tema (Comercial, Redes sociais, Site); em cada um,
//                          a Régua e uma linha por indicador com o valor do mês, a régua das faixas da meta
//                          (com o marcador no valor; no mês corrente, no ritmo do mês), a variação sobre o mês
//                          anterior, os últimos 12 meses em barras e, nos canais, o número de ontem. Embaixo,
//                          a leitura do mês e a expectativa; nas notas, o que ainda não tem dados.
//   Metas (#/kpis/metas)   Ficha: um Bloco por tema, três colunas (mínimo, adequado, excelente); Barra de salvar.
// Uma leitura só (GET /api/kpis?mes=, worker/kpis.js). Balanço do mês: o servidor fecha sozinho no dia 1º e
// congela os números; o PDF é desenhado deles pelo desenhista da Marca (folha Coluna), sempre igual.

import { lerCopia, gravarCopia, igual } from './memoria.js';

const COPIA = 'kpis';
const LEMBRAR = 'universo:kpis:';
const MARCA = 'https://marca.odisse.com.br/v1/documentos/';
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const FONTES = 'https://vendas.odisse.com.br/fonts-inter.js';
const METRICAS = 'https://marketing.odisse.com.br/#/metricas';
const SITE_PAINEL = 'https://www.odisse.com.br/admin/';
const FUNIL = 'https://vendas.odisse.com.br/crm.html';

// Temas (como na planilha de KPIs). `ontem`: o tema traz a coluna com o número do dia anterior.
const GRUPOS = [
  { id: 'comercial', nome: 'Comercial', onde: 'vendas.odisse', link: FUNIL },
  { id: 'instagram', nome: 'Redes sociais', onde: 'Instagram e Pinterest', link: METRICAS, ontem: true },
  { id: 'site', nome: 'Site', onde: 'odisse.com.br', link: SITE_PAINEL, ontem: true },
];
// Somas no mês (dá para projetar pelo ritmo); as outras são médias, razões ou retratos.
const SOMA = new Set(['leads', 'propostas', 'contratos', 'contratado', 'alcance', 'interacoes', 'visitas_perfil', 'toques_link',
  'novos_seguidores', 'publicacoes', 'pins', 'visitas_site', 'projetos_site', 'contatos_site']);
const ORIGENS = { indicacao: 'Indicação', instagram: 'Instagram', site: 'Site', landing_page: 'Landing page', herma: 'Herma', radar: 'Radar', outro: 'Outro', sem: 'Sem origem' };
const NOME_BREVE = { financeiro: 'Financeiro', operacional: 'Operacional', cliente: 'Experiência do cliente', marketing: 'Marketing' };
const FAIXA = {
  excelente: ['excelente', 'ok'], adequado: ['adequado', 'ok'], minimo: ['no mínimo', 'atencao'], abaixo: ['abaixo do mínimo', 'problema'],
};
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (mes, ano = false) => (mes ? NOME_MES[+mes.slice(5, 7) - 1] + (ano ? ` de ${mes.slice(0, 4)}` : '') : '');
const Maius = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const somarMeses = (mes, n) => { const [a, m] = mes.split('-').map(Number); const t = a * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };

const SVG = {
  sobe: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 9.5V2.5M2.8 5.7 6 2.5l3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  desce: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.5v7M2.8 6.3 6 9.5l3.2-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fora: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3H13v3.5M13 3 7.5 8.5M11 9.5V13H3V5h3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  seta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---- números ----------------------------------------------------------------------------------------
const curto = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 10000) return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return Math.round(n).toLocaleString('pt-BR');
};
function formatar(formato, v, longo = false) {
  if (v == null) return '—';
  if (formato === 'reais') return longo ? 'R$ ' + Math.round(v).toLocaleString('pt-BR') : 'R$ ' + curto(v);
  if (formato === 'pct') return (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  if (formato === 'dias') return Math.round(v) + (Math.round(v) === 1 ? ' dia' : ' dias');
  return longo ? Math.round(v).toLocaleString('pt-BR') : curto(v);
}
function faixaDe(ind, v, metas) {
  const f = metas?.faixas?.[ind.id];
  if (v == null || !f) return null;
  const s = ind.sentido === -1 ? -1 : 1;
  if (s * v >= s * f.excelente) return 'excelente';
  if (s * v >= s * f.adequado) return 'adequado';
  if (s * v >= s * f.minimo) return 'minimo';
  return 'abaixo';
}
const varPct = (a, b) => (a == null || b == null || b === 0 ? null : Math.round(((a - b) / Math.abs(b)) * 100));

// ---- PDF do balanço (desenhista da Marca) -----------------------------------------------------------------
let modDoc = null, modPdf = null, rec = null;
const script = (src) => new Promise((ok, erro) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não carregou ' + src));
  document.head.appendChild(s);
});
async function prepararPdf() {
  if (!document.querySelector('link[data-documentos-css]')) {
    const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: MARCA + 'documentos.css' });
    l.dataset.documentosCss = '';
    document.head.appendChild(l);
  }
  if (!modDoc) modDoc = await import(MARCA + 'documentos.js');
  if (!rec) rec = await modDoc.recursos();
  if (!modPdf) modPdf = await import(MARCA + 'pdf.js');
  if (!window.jspdf) await script(JSPDF);
  if (typeof window.INTER_REGULAR_B64 === 'undefined' && typeof INTER_REGULAR_B64 === 'undefined') await script(FONTES);
}

// Conteúdo do balanço na folha da Marca. `b` = balanço congelado (ou a prévia do mês corrente).
export function docDoBalanco(b, indicadores) {
  const POR = Object.fromEntries(indicadores.map((i) => [i.id, i]));
  const ant = b.historico.find((h) => h.mes === somarMeses(b.mes, -1))?.valores || {};
  const linhas = (grupo) => indicadores.filter((i) => i.grupo === grupo).map((i) => {
    const v = b.valores[i.id];
    const fx = faixaDe(i, v, { faixas: b.metas });
    const p = varPct(v, ant[i.id]);
    return [i.nome, formatar(i.formato, v, true), fx ? FAIXA[fx][0] : '—', p == null ? '—' : `${p > 0 ? '+' : ''}${p}%`];
  });
  const tabela = (grupo) => ({
    tipo: 'tabela',
    colunas: [{ titulo: 'Indicador', largura: '40%' }, { titulo: 'Valor', alinhar: 'direita' }, { titulo: 'Faixa' }, { titulo: `Sobre ${nomeMes(somarMeses(b.mes, -1))}`, alinhar: 'direita' }],
    linhas: linhas(grupo),
  });
  const seis = b.historico.slice(-6);
  const chaves = ['leads', 'propostas', 'contratos', 'contratado', 'alcance', 'seguidores', 'publicacoes', 'visitas_site', 'contatos_site'];
  const retro = {
    tipo: 'tabela',
    colunas: [{ titulo: 'Indicador', largura: '28%' }, ...seis.map((h) => ({ titulo: Maius(nomeMes(h.mes)).slice(0, 3), alinhar: 'direita' }))],
    // dinheiro em mil reais, para caber na coluna do mês
    linhas: chaves.filter((k) => POR[k]).map((k) => [POR[k].formato === 'reais' ? `${POR[k].nome} (R$ mil)` : POR[k].nome,
      ...seis.map((h) => { const v = h.valores?.[k]; return POR[k].formato === 'reais' ? (v == null ? '—' : (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })) : formatar(POR[k].formato, v, true); })]),
  };
  const origens = Object.entries(b.origens || {}).sort((x, y) => y[1] - x[1]);
  const cob = b.cobertura || {};
  const feito = b.feito_em ? new Date(b.feito_em).toLocaleDateString('pt-BR') : 'prévia, ainda não fechado';
  return {
    modelo: 'coluna', miolo: 'texto', codigo: `KPI-${b.mes}`,
    campos: [{ rotulo: 'Período', valor: Maius(nomeMes(b.mes, true)) }, { rotulo: 'Fechado em', valor: feito }],
    titulo: `Balanço de KPIs de ${nomeMes(b.mes, true)}`,
    blocos: [
      { tipo: 'secao', texto: 'Resultado do mês' },
      { tipo: 'paragrafo', texto: 'Comercial', negrito: true }, tabela('comercial'),
      ...(origens.length ? [{ tipo: 'nota', texto: 'Origem dos leads: ' + origens.map(([o, n]) => `${(ORIGENS[o] || o).toLowerCase()} ${n}`).join(' · ') + '.' }] : []),
      { tipo: 'paragrafo', texto: 'Instagram', negrito: true }, tabela('instagram'),
      { tipo: 'paragrafo', texto: 'Site', negrito: true }, tabela('site'),
      { tipo: 'secao', texto: 'Retrospecto' },
      { tipo: 'lista', itens: b.frases || [] },
      retro,
      { tipo: 'secao', texto: `Expectativa para ${nomeMes(b.expectativa?.mes || somarMeses(b.mes, 1))}` },
      { tipo: 'lista', itens: b.expectativa?.frases || [] },
      { tipo: 'nota', texto: `Números do Universo: comercial do vendas (Funil, Propostas e Contratos), Instagram do marketing.odisse e site de odisse.com.br${cob.dias ? `, com ${cob.instagram} de ${cob.dias} dias do Instagram e ${cob.site} do site registrados` : ''}. Faixas pelas metas do Universo no dia do fechamento. Financeiro, operacional e experiência do cliente entram quando houver dados.` },
    ],
  };
}

export async function pdfDoBalanco(b, indicadores, { baixar = false, janela = null } = {}) {
  await prepararPdf();
  const blob = await modPdf.pdf(docDoBalanco(b, indicadores), rec, {
    jsPDF: window.jspdf.jsPDF,
    fontes: { normal: globalThis.INTER_REGULAR_B64 ?? INTER_REGULAR_B64, negrito: globalThis.INTER_BOLD_B64 ?? INTER_BOLD_B64 },
  });
  const url = URL.createObjectURL(blob);
  if (baixar) {
    const a = Object.assign(document.createElement('a'), { href: url, download: `kpis-${b.mes}.pdf` });
    document.body.appendChild(a); a.click(); a.remove();
  } else if (janela) janela.location.href = url;
  else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Para a Início: busca o balanço congelado e mostra ou baixa o PDF.
export async function abrirBalanco(api, mes, { baixar = false } = {}) {
  const janela = baixar ? null : window.open('', '_blank');
  if (janela) janela.document.title = 'Montando o balanço…';
  const [b, k] = await Promise.all([api(`/api/kpis/balanco?mes=${mes}`), api(`/api/kpis?mes=${mes}`)]);
  if (b.status !== 200 || k.status !== 200) { janela?.close(); throw new Error(b.error || k.error || 'não foi possível ler o balanço'); }
  await pdfDoBalanco(b, k.indicadores, { baixar, janela });
}

// ---- página ---------------------------------------------------------------------------------------------
const FAIXAS = ['abaixo', 'minimo', 'adequado', 'excelente'];

// Posição do valor na régua (0–1): quatro zonas iguais (abaixo · mínimo · adequado · excelente); dentro de cada
// uma, proporcional entre os limites. As pontas (abaixo do mínimo e acima do excelente) usam a largura vizinha.
function posicaoNaRegua(ind, v, f) {
  if (v == null || !f) return null;
  const s = ind.sentido === -1 ? -1 : 1;
  const [a, b, c] = [f.minimo, f.adequado, f.excelente].map((x) => s * x);
  const x = s * v;
  const passoBaixo = b - a || 1, passoAlto = c - b || 1;
  let t;
  if (x < a) t = 0.25 * Math.max(0, 1 - (a - x) / passoBaixo);
  else if (x < b) t = 0.25 + 0.25 * ((x - a) / passoBaixo);
  else if (x < c) t = 0.5 + 0.25 * ((x - b) / passoAlto);
  else t = 0.75 + 0.25 * Math.min(1, (x - c) / passoAlto);
  return Math.max(0.01, Math.min(0.99, t));
}

export function criarKpis({ esc, api, toque }) {
  let raiz = null;
  let sub = 'painel';
  let mesPedido = null;
  let dados = lerCopia(COPIA);
  let editando = null;
  const fechados = (() => { try { return new Set(JSON.parse(localStorage.getItem(LEMBRAR + 'fechados') || '[]')); } catch { return new Set(); } })();
  const lembrarFechados = () => { try { localStorage.setItem(LEMBRAR + 'fechados', JSON.stringify([...fechados])); } catch {} };

  // ---- comum
  const abas = () => `<nav class="abas-caixa-linha" aria-label="KPIs"><span class="u-rotulo">KPIs</span>
      <span class="abas-caixa">${[['painel', 'Painel', '#/kpis'], ['metas', 'Metas', '#/kpis/metas']].map(([id, nome, href]) =>
        `<a href="${href}"${id === sub ? ' class="ativa" aria-current="page"' : ''}>${nome}</a>`).join('')}</span></nav>`;
  const cabecalho = (titulo, lado = '') => `${abas()}<div class="cab"><h1 class="u-titulo">${esc(titulo)}</h1>${lado ? `<div class="lado u-apoio">${lado}</div>` : ''}</div>`;
  const seta = (aberto) => `<span class="bol-seta${aberto ? ' aberta' : ''}" aria-hidden="true">${SVG.seta}</span>`;
  const cabBloco = (id, titulo, onde, link, extra = '') => {
    const aberto = !fechados.has(sub + ':' + id);
    return `<div class="bol-cab">
        <button type="button" class="bol-titulo" data-recolher="${id}" aria-expanded="${aberto}"><h2>${esc(titulo)}</h2>${extra}</button>
        ${link ? `<a class="bol-fonte" href="${esc(link)}" target="_blank" rel="noopener">${esc(onde)}<i>${SVG.fora}</i></a>` : onde ? `<span class="bol-fonte">${esc(onde)}</span>` : ''}
        <button type="button" class="bol-caixa" data-recolher="${id}" aria-label="${aberto ? 'Recolher' : 'Abrir'} ${esc(titulo)}">${seta(aberto)}</button>
      </div>`;
  };
  const aberto = (id) => !fechados.has(sub + ':' + id);

  // ---- Painel (Boletim)
  const fracaoDoMes = (d) => {
    if (!d.mes.parcial) return 1;
    const total = new Date(Date.UTC(+d.mes.mes.slice(0, 4), +d.mes.mes.slice(5, 7), 0)).getUTCDate();
    return Math.max(1, +d.hoje.slice(8, 10) - 1) / total;
  };
  function ontemDe(id, o) {
    if (!o) return null;
    const a = o.instagram?.atual || {}, b = o.instagram?.anterior || {}, s = o.site?.total || {}, sa = o.site?.anterior || {};
    const m = {
      alcance: [a.alcance, b.alcance], interacoes: [a.interacoes, b.interacoes], visitas_perfil: [a.visitas, b.visitas],
      toques_link: [a.toques, b.toques], novos_seguidores: [a.novos, b.novos], seguidores: [o.instagram?.seguidores, null],
      engajamento: [a.alcance ? a.interacoes / a.alcance : null, b.alcance ? b.interacoes / b.alcance : null],
      visitas_site: [s.visitantes, sa.visitantes], projetos_site: [s.projetos, sa.projetos], contatos_site: [s.contatos, sa.contatos],
    }[id];
    return m && m[0] != null ? m : null;
  }
  const delta = (p, bom, titulo = '') => (p == null ? '<span class="bol-nada">—</span>'
    : p === 0 ? `<span class="bol-delta" title="${esc(titulo)}">=</span>`
      : `<span class="bol-delta ${bom ? 'bom' : 'ruim'}" title="${esc(titulo)}">${p > 0 ? SVG.sobe : SVG.desce}${Math.abs(p)}%</span>`);

  function regua(ind, v, metas, ritmo) {
    const f = metas?.faixas?.[ind.id];
    if (!f) return `<a class="bol-regua sem" href="#/kpis/metas">sem meta · definir</a>`;
    const alvo = ritmo != null ? ritmo : v;
    const fx = faixaDe(ind, alvo, metas);
    const pos = posicaoNaRegua(ind, alvo, f);
    const lim = (k) => formatar(ind.formato, f[k], true);
    return `<span class="bol-regua" title="Mínimo ${esc(lim('minimo'))} · adequado ${esc(lim('adequado'))} · excelente ${esc(lim('excelente'))}">
        <span class="bol-trilho">${FAIXAS.map((z) => `<i class="z-${z}${z === fx ? ' on' : ''}"></i>`).join('')}${pos != null ? `<b style="left:${(pos * 100).toFixed(1)}%"></b>` : ''}</span>
        <span class="bol-faixa f-${fx || 'nada'}">${fx ? (ritmo != null ? 'no ritmo: ' : '') + FAIXA[fx][0] : '—'}</span>
      </span>`;
  }

  function linha(ind, d, g) {
    const v = d.mes.valores[ind.id];
    const mesAnt = somarMeses(d.mes.mes, -1);
    const ant = d.historico.find((h) => h.mes === mesAnt)?.valores?.[ind.id];
    const fr = fracaoDoMes(d);
    const ritmo = d.mes.parcial && SOMA.has(ind.id) && v != null && fr < 1 ? v / fr : null;
    const p = d.mes.parcial ? null : varPct(v, ant);
    const bom = p != null && (p > 0) === (ind.sentido !== -1);
    const on = g.ontem ? ontemDe(ind.id, d.ontem) : null;
    const pOn = on ? varPct(on[0], on[1]) : null;
    return `<div class="bol-linha" role="row">
        <span class="bol-nome" role="cell"><b>${esc(ind.nome)}</b>${ind.sentido === -1 ? '<small>menos é melhor</small>' : ''}</span>
        <span class="bol-valor" role="cell">${esc(formatar(ind.formato, v, true))}${ritmo != null ? `<small>ritmo ${esc(formatar(ind.formato, ritmo))}</small>` : ''}</span>
        <span role="cell">${regua(ind, v, d.metas, ritmo)}</span>
        <span class="bol-var" role="cell">${delta(p, bom, ant != null ? `${Maius(nomeMes(mesAnt))}: ${formatar(ind.formato, ant, true)}` : '')}</span>
        <span role="cell">${barras(d.historico, ind)}</span>
        ${g.ontem ? `<span class="bol-ontem" role="cell">${on ? `<b>${esc(formatar(ind.formato, on[0]))}</b>${delta(pOn, (pOn > 0) === (ind.sentido !== -1), 'Anteontem')}` : '<span class="bol-nada">—</span>'}</span>` : '<span role="cell"></span>'}
      </div>`;
  }

  function barras(hist, ind) {
    const vals = hist.map((h) => h.valores?.[ind.id] ?? null);
    const max = Math.max(...vals.map((v) => (v == null ? 0 : Math.abs(v))), 0);
    const L = 8, G = 3, H = 24;
    return `<svg class="bol-barras" viewBox="0 0 ${vals.length * (L + G) - G} ${H}" role="img" aria-label="${esc(ind.nome)}, últimos ${vals.length} meses">${vals.map((v, i) => {
      const h = v == null || !max ? 0 : Math.max(2, Math.round((Math.abs(v) / max) * H));
      const cls = i === vals.length - 1 ? 'atual' : v == null ? 'vazia' : '';
      return `<rect x="${i * (L + G)}" y="${H - (h || 2)}" width="${L}" height="${h || 2}" rx="2"${cls ? ` class="${cls}"` : ''}><title>${esc(Maius(nomeMes(hist[i].mes)))}: ${esc(formatar(ind.formato, v, true))}</title></rect>`;
    }).join('')}</svg>`;
  }

  function blocoTema(g, d) {
    const inds = d.indicadores.filter((i) => i.grupo === g.id);
    const comMeta = inds.filter((i) => d.metas.faixas?.[i.id]).length;
    const cob = d.mes.cobertura || {};
    const dias = g.id === 'instagram' ? cob.instagram : g.id === 'site' ? cob.site : null;
    const extra = `<span class="bol-conta">${comMeta}/${inds.length} com meta${dias != null && cob.dias && dias < cob.dias && !d.mes.parcial ? ` · ${dias} de ${cob.dias} dias` : ''}</span>`;
    const ab = aberto(g.id);
    let origem = '';
    if (g.id === 'comercial') {
      const o = Object.entries(d.mes.origens || {}).sort((a, b) => b[1] - a[1]);
      const tot = o.reduce((s, [, n]) => s + n, 0);
      origem = `<div class="bol-linha bol-origem" role="row"><span class="bol-nome" role="cell"><b>Origem dos leads</b></span>
          <span class="bol-origem__lista" role="cell">${tot ? o.map(([k, n]) => `<span><b>${n}</b> ${esc(ORIGENS[k] || k)}</span>`).join('') : '<span class="bol-nada">sem leads no mês</span>'}</span></div>`;
    }
    const nomeCol = Maius(nomeMes(d.mes.mes));
    return `<section class="bol-bloco${ab ? '' : ' fechado'}">
        ${cabBloco(g.id, g.nome, g.onde, g.link, extra)}
        ${ab ? `<div class="bol-tabela" role="table" aria-label="${esc(g.nome)}">
          <div class="bol-regua-cab" role="row"><span role="columnheader">Indicador</span><span role="columnheader">${esc(nomeCol)}${d.mes.parcial ? ' até agora' : ''}</span>
            <span role="columnheader">Faixa${d.mes.parcial ? ' no ritmo do mês' : ''}</span><span role="columnheader">Sobre ${esc(nomeMes(somarMeses(d.mes.mes, -1)))}</span>
            <span role="columnheader">12 meses</span><span role="columnheader">${g.ontem ? 'Ontem' : ''}</span></div>
          ${inds.map((i) => linha(i, d, g)).join('')}${origem}
        </div>` : ''}
      </section>`;
  }

  function painel(d) {
    const fechado = !!d.balanco;
    const estado = fechado
      ? `<span class="ini-etq ok">balanço feito em ${esc(new Date(d.balanco.feito_em).toLocaleDateString('pt-BR'))}</span>`
      : d.mes.parcial ? `<span class="ini-etq opcional">parcial · fecha em 1º de ${esc(nomeMes(somarMeses(d.mes.mes, 1)))}</span>` : '<span class="ini-etq opcional">sem balanço</span>';
    const acoes = fechado
      ? '<button type="button" class="u-botao" data-pdf="ver">Ver balanço</button><button type="button" class="u-botao forte" data-pdf="baixar">Baixar balanço em PDF</button>'
      : '<button type="button" class="u-botao" data-pdf="previa">Prévia do balanço</button>';
    const meses = `<div class="pas-seletor kpi-meses" role="group" aria-label="Mês">${d.meses.map((m) => {
      const ativo = m.mes === d.mes.mes;
      const rot = Maius(nomeMes(m.mes)) + (m.mes.slice(0, 4) !== d.hoje.slice(0, 4) ? ` ${m.mes.slice(0, 4)}` : '');
      return `<button type="button" data-mes="${m.mes}" aria-pressed="${ativo}"${ativo ? ' class="ativo"' : ''}>${esc(rot)}</button>`;
    }).join('')}</div>`;
    const exp = d.expectativa;
    const lado = d.em ? `atualizado às ${new Date(d.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
    return cabecalho('Painel', esc(lado)) + `
      <div class="bol-filtros">${meses}${estado}<span class="bol-acoes">${acoes}</span></div>
      ${GRUPOS.map((g) => blocoTema(g, d)).join('')}
      <div class="bol-pe">
        ${d.mes.parcial ? '' : `<section class="bol-bloco bol-texto"><h2>Leitura do mês</h2>
          ${d.frases.length ? `<ul>${d.frases.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="u-apoio">Ainda sem números neste mês.</p>'}</section>`}
        ${exp ? `<section class="bol-bloco bol-texto"><h2>Expectativa para ${esc(nomeMes(exp.mes))}</h2><ul>${exp.frases.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
      </div>
      <section class="pas-notas">
        <div><h3 class="u-rotulo">Como ler</h3>
          <p><b>Faixa</b>: a régua tem as quatro faixas da meta (abaixo do mínimo, mínimo, adequado, excelente) e o traço marca onde o valor caiu. No mês corrente, as somas são lidas pelo <b>ritmo</b>: o que já entrou, levado ao mês inteiro.</p>
          <p><b>Sobre o mês anterior</b> aparece só nos meses fechados: comparar meio mês com um mês inteiro engana. <b>12 meses</b>: o mês escolhido é a barra escura.</p></div>
        <div><h3 class="u-rotulo">Ainda sem dados</h3><ul>${d.em_breve.map((b) => `<li><b>${esc(NOME_BREVE[b.grupo] || b.grupo)}</b>: ${esc(b.nomes.join(', '))}. Falta ${esc(b.falta)}.</li>`).join('')}</ul></div>
        <div><h3 class="u-rotulo">Fechamento</h3>
          <p>Todo dia, às 06h47, o Universo guarda os números de ontem do Instagram e do site. No dia 1º fecha o mês anterior: congela os números, as faixas das metas e as frases, e avisa na Início. O PDF é desenhado desse retrato, então sai sempre igual.</p></div>
      </section>`;
  }

  // ---- Metas (Ficha)
  const paraTela = (ind, v) => (v == null ? '' : ind.formato === 'pct' ? String(+(v * 100).toFixed(2)).replace('.', ',') : String(v).replace('.', ','));
  const daTela = (ind, t) => { const s = String(t ?? '').trim().replace(/\./g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? (ind.formato === 'pct' ? n / 100 : n) : NaN; };
  const iguais = (a, b) => a === b || (a != null && b != null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)));
  const sujo = () => !!editando && !!dados && dados.indicadores.some((i) => ['minimo', 'adequado', 'excelente'].some((k) => !iguais(daTela(i, editando[i.id]?.[k]), dados.metas.faixas?.[i.id]?.[k] ?? null)));
  const comecarEdicao = () => { editando ||= Object.fromEntries(dados.indicadores.map((i) => [i.id, Object.fromEntries(['minimo', 'adequado', 'excelente'].map((k) => [k, paraTela(i, dados.metas.faixas?.[i.id]?.[k])]))])); };

  function campo(i, k) {
    const pre = i.formato === 'reais' ? 'R$' : '';
    const pos = i.formato === 'pct' ? '%' : i.formato === 'dias' ? 'dias' : '';
    return `<label class="met-campo">${pre ? `<span>${pre}</span>` : ''}<input inputmode="decimal" data-ind="${i.id}" data-faixa="${k}" value="${esc(editando[i.id][k])}" aria-label="${esc(i.nome)}, ${k === 'minimo' ? 'mínimo' : k}" placeholder="—">${pos ? `<span>${pos}</span>` : ''}</label>`;
  }
  function metas(d) {
    comecarEdicao();
    const n = Object.keys(d.metas.faixas || {}).length;
    const blocos = GRUPOS.map((g) => {
      const inds = d.indicadores.filter((i) => i.grupo === g.id);
      const ab = aberto(g.id);
      const comMeta = inds.filter((i) => ['minimo', 'adequado', 'excelente'].every((k) => String(editando[i.id][k]).trim() !== '')).length;
      return `<section class="bol-bloco met-bloco${ab ? '' : ' fechado'}">
          ${cabBloco(g.id, g.nome, '', '', `<span class="bol-conta">${comMeta}/${inds.length} com meta</span>`)}
          ${ab ? `<div class="met-tabela" role="table">
            <div class="bol-regua-cab met-cols" role="row"><span role="columnheader">Indicador</span><span role="columnheader">Mínimo</span><span role="columnheader">Adequado</span><span role="columnheader">Excelente</span></div>
            ${inds.map((i) => `<div class="met-linha met-cols" role="row">
              <span class="bol-nome" role="cell"><b>${esc(i.nome)}</b><small>${esc(i.nota)}${i.sentido === -1 ? ' · menos é melhor' : ''}</small></span>
              ${['minimo', 'adequado', 'excelente'].map((k) => `<span role="cell">${campo(i, k)}</span>`).join('')}
            </div>`).join('')}
          </div>` : ''}
        </section>`;
    }).join('');
    const lado = n ? `${n} de ${d.indicadores.length} indicadores com faixas` : 'nenhuma faixa definida ainda';
    return cabecalho('Metas', esc(lado)) + blocos + `
      <section class="pas-notas">
        <div><h3 class="u-rotulo">Como preencher</h3>
          <p>Três números por indicador: o <b>mínimo</b> aceitável, o <b>adequado</b> e o <b>excelente</b>. Porcentagens como número cheio (28 = 28%); reais sem o R$. Em tempo de decisão, menos é melhor: o mínimo é o maior número. Linha em branco fica sem faixa.</p></div>
        <div><h3 class="u-rotulo">Onde valem</h3>
          <p>As faixas aparecem no Painel na hora em que forem salvas. Cada balanço congela as faixas do dia do fechamento: mudar uma meta não muda um mês já fechado.</p></div>
      </section>
      <div class="kpi-barra-salvar" hidden><span>Metas alteradas</span><span class="kpi-barra-salvar__acoes">
        <button type="button" class="u-botao" data-acao="descartar">Descartar</button>
        <button type="button" class="u-botao forte" data-acao="salvar">Salvar metas</button></span></div>`;
  }
  const barraSalvar = () => { const b = raiz?.querySelector('.kpi-barra-salvar'); if (b) b.hidden = !sujo(); };

  // ---- desenho e dados
  function desenhar() {
    if (!raiz) return;
    if (!dados) { raiz.innerHTML = cabecalho(sub === 'metas' ? 'Metas' : 'Painel') + '<p class="u-apoio kpi-carregando">Carregando os indicadores…</p>'; return; }
    raiz.innerHTML = sub === 'metas' ? metas(dados) : painel(dados);
    barraSalvar();
  }

  async function buscar() {
    const r = await api('/api/kpis' + (mesPedido ? `?mes=${mesPedido}` : '')).catch((e) => ({ status: 0, error: e.message }));
    if (r.status !== 200) {
      if (!dados && raiz) raiz.querySelector('.kpi-carregando')?.replaceWith(Object.assign(document.createElement('p'),
        { className: 'ini-vazio', textContent: 'Não foi possível ler os indicadores agora. Tente de novo em instantes.' }));
      return;
    }
    const { status, ...novo } = r;
    const mudou = !igual({ ...novo, em: null }, dados ? { ...dados, em: null } : null);
    dados = novo;
    if (!mesPedido) gravarCopia(COPIA, dados);
    if (mudou && !sujo()) editando = null;
    if (mudou && !(sub === 'metas' && sujo())) desenhar();
  }

  async function salvar() {
    const faixas = {};
    for (const i of dados.indicadores) {
      const v = ['minimo', 'adequado', 'excelente'].map((k) => daTela(i, editando[i.id][k]));
      if (v.some(Number.isNaN)) { toque(`${i.nome}: use só números`); return; }
      faixas[i.id] = { minimo: v[0], adequado: v[1], excelente: v[2] };
    }
    const r = await api('/api/kpis/metas', { method: 'PUT', body: JSON.stringify({ versao: 1, faixas }) }).catch((e) => ({ status: 0, error: e.message }));
    if (r.status !== 200) { toque(r.error || 'Não foi possível salvar as metas'); return; }
    dados.metas = { versao: 1, faixas: r.faixas || {} };
    editando = null;
    toque('Metas salvas');
    desenhar();
    buscar();
  }

  async function pdf(modo, botao) {
    botao.disabled = true;
    const janela = modo === 'baixar' ? null : window.open('', '_blank');
    try {
      let b;
      if (modo === 'previa') {
        b = { mes: dados.mes.mes, feito_em: null, valores: dados.mes.valores, origens: dados.mes.origens, cobertura: dados.mes.cobertura,
          historico: dados.historico, metas: dados.metas.faixas, frases: dados.frases, expectativa: dados.expectativa };
      } else {
        const r = await api(`/api/kpis/balanco?mes=${dados.mes.mes}`);
        if (r.status !== 200) throw new Error(r.error || 'balanço não encontrado');
        b = r;
      }
      await pdfDoBalanco(b, dados.indicadores, { baixar: modo === 'baixar', janela });
    } catch (e) {
      janela?.close();
      toque('Não foi possível montar o PDF: ' + e.message);
    } finally { botao.disabled = false; }
  }

  function aoClicar(ev) {
    const m = ev.target.closest('[data-mes]');
    if (m) {
      mesPedido = m.dataset.mes === dados?.meses?.[0]?.mes ? null : m.dataset.mes;
      history.replaceState(null, '', '#/kpis' + (mesPedido ? `?mes=${mesPedido}` : ''));
      buscar();
      return;
    }
    const p = ev.target.closest('[data-pdf]');
    if (p) { pdf(p.dataset.pdf, p); return; }
    const r = ev.target.closest('[data-recolher]');
    if (r) {
      const k = sub + ':' + r.dataset.recolher;
      fechados.has(k) ? fechados.delete(k) : fechados.add(k);
      lembrarFechados();
      desenhar();
      raiz.querySelector(`.bol-caixa[data-recolher="${r.dataset.recolher}"]`)?.focus();
      return;
    }
    const a = ev.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'descartar') { editando = null; desenhar(); }
    if (a === 'salvar') salvar();
  }

  let ligado = false;
  function ligar(el) {
    raiz = el;
    sub = /^#\/kpis\/metas/.test(location.hash) ? 'metas' : 'painel';
    const pedido = (location.hash.match(/[?&]mes=(\d{4}-\d{2})/) || [])[1] || null;
    if (sub === 'painel' && pedido !== mesPedido) { mesPedido = pedido; if (mesPedido && dados?.mes?.mes !== mesPedido) dados = null; }
    if (sub === 'metas' && mesPedido) { mesPedido = null; dados = lerCopia(COPIA); }
    if (!sujo()) editando = null;
    desenhar();
    buscar();
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('input', (ev) => {
      const i = ev.target.closest('.met-campo input');
      if (!i) return;
      comecarEdicao();
      editando[i.dataset.ind][i.dataset.faixa] = i.value;
      barraSalvar();
    });
    raiz.addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 's' && sujo()) { ev.preventDefault(); salvar(); } });
    if (!ligado) {
      window.addEventListener('beforeunload', (ev) => { if (sujo()) { ev.preventDefault(); ev.returnValue = ''; } });
      ligado = true;
    }
  }

  return { ligar };
}
