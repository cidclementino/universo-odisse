// KPIs (#/kpis; Cid, 19/11) — seção própria no menu principal, com atalho em Ferramentas › Gestão.
//
// Uma leitura só (GET /api/kpis?mes=, worker/kpis.js). Ordem da página:
//   1. Ontem: o Placar que saiu da Início (Instagram e site, dia anterior fechado, variação sobre anteontem).
//   2. Mês: Seletor dos meses (o corrente, parcial, e os fechados); Placar por grupo (Comercial, Instagram,
//      Site) com a faixa da meta em Etiqueta, a variação sobre o mês anterior e os últimos 12 meses em barras;
//      origem dos leads; leitura do mês (frases geradas dos números); expectativa para o mês seguinte.
//      O que ainda não tem de onde vir fica tracejado, com a fonte que falta.
//   3. Metas: Bloco recolhível com a Matriz das faixas (mínimo / adequado / excelente), Barra de salvar.
//   4. Notas: como se calcula cada indicador.
// Balanço do mês: o servidor fecha sozinho no dia 1º e congela os números; o PDF é desenhado deles pelo
// desenhista da Marca (folha Coluna), sempre igual. Ver e baixar aqui e no aviso da Início.

import { lerCopia, gravarCopia, igual } from './memoria.js';

const COPIA = 'kpis';
const LEMBRAR = 'universo:kpis:';
const MARCA = 'https://marca.odisse.com.br/v1/documentos/';
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const FONTES = 'https://vendas.odisse.com.br/fonts-inter.js';
const METRICAS = 'https://marketing.odisse.com.br/#/metricas';
const SITE_PAINEL = 'https://www.odisse.com.br/admin/';
const FUNIL = 'https://vendas.odisse.com.br/crm.html';

const GRUPOS = [
  { id: 'comercial', nome: 'Comercial', onde: 'vendas.odisse', cor: 'var(--odisse-ocre, #BB8248)', link: FUNIL },
  { id: 'instagram', nome: 'Instagram', onde: '@odisseestudio', cor: 'var(--odisse-ambar, #ECC28F)', link: METRICAS },
  { id: 'site', nome: 'Site', onde: 'odisse.com.br', cor: 'color-mix(in srgb, var(--odisse-ardosia, #3F4B57) 45%, white)', link: SITE_PAINEL },
];
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

// ---- página -------------------------------------------------------------------------------------------
export function criarKpis({ esc, api, toque }) {
  let raiz = null;
  let mesPedido = null;
  let dados = lerCopia(COPIA);
  let editando = null; // metas em edição: { id: { minimo, adequado, excelente } } (como digitadas)
  let metasAbertas = (() => { try { return localStorage.getItem(LEMBRAR + 'metas') === '1'; } catch { return false; } })();

  // ---- 1. Ontem
  function variacao(atual, antes, rot = 'Anteontem') {
    if (atual == null || antes == null) return '';
    if (antes === 0) return atual === 0 ? '<span class="ini-var">=</span>' : '';
    const p = Math.round(((atual - antes) / antes) * 100);
    if (p === 0) return '<span class="ini-var">=</span>';
    return `<span class="ini-var ${p > 0 ? 'sobe' : 'desce'}" title="${esc(rot)}">${p > 0 ? SVG.sobe : SVG.desce}${Math.abs(p)}%</span>`;
  }
  const numero = (rotulo, valor, antes, extra = '') => `<div class="ini-num"><span class="ini-num__rot">${esc(rotulo)}</span><b>${curto(valor)}</b><span class="ini-num__pe">${variacao(valor, antes)}${extra}</span></div>`;
  const grupoPlacar = ({ nome, cor, onde, link, corpo, erro, colunas }) => `<section class="ini-grupo" style="--g:${cor}">
      <a class="ini-grupo__faixa" href="${esc(link)}" target="_blank" rel="noopener">${esc(nome)}<span>${esc(onde)}</span><i class="ini-fora">${SVG.fora}</i></a>
      ${erro ? `<p class="ini-vazio">${esc(erro)}</p>` : `<div class="ini-placar" style="--n:${colunas}">${corpo}</div>`}
    </section>`;

  function ontem(o) {
    if (!o) return '';
    const ig = o.instagram || {};
    const a = ig.atual || {}, b = ig.anterior || {};
    const instagram = grupoPlacar({
      nome: 'Instagram', cor: GRUPOS[1].cor, onde: '@odisseestudio', link: METRICAS, colunas: 4,
      erro: ig.erro ? 'Não foi possível ler o Instagram agora.' : !ig.atual ? 'O Instagram ainda não tem os números de ontem.' : '',
      corpo: numero('Alcance', a.alcance, b.alcance) + numero('Interações', a.interacoes, b.interacoes)
        + numero('Seguidores', ig.seguidores, null, a.novos != null ? `<span class="ini-num__extra">+${curto(a.novos)} ontem</span>` : '')
        + numero('Visitas ao perfil', a.visitas, b.visitas, a.toques != null ? `<span class="ini-num__extra">${curto(a.toques)} ${a.toques === 1 ? 'toque' : 'toques'} no link</span>` : ''),
    });
    const s = o.site || {}, st = s.total || {}, sa = s.anterior || {};
    const site = grupoPlacar({
      nome: 'Site', cor: GRUPOS[2].cor, onde: 'odisse.com.br', link: SITE_PAINEL, colunas: 3,
      erro: s.erro || !s.total ? 'Não foi possível ler as métricas do site agora.' : '',
      corpo: numero('Visitantes', st.visitantes, sa.visitantes) + numero('Projetos abertos', st.projetos, sa.projetos)
        + numero('Contatos', st.contatos, sa.contatos, '<span class="ini-num__extra">WhatsApp, e-mail e telefone</span>'),
    });
    const dia = new Date(o.dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return `<section class="ini-sec"><h2 class="ini-sec__titulo">Ontem <span>${esc(dia)}</span></h2><div class="ini-placares">${instagram}${site}</div></section>`;
  }

  // ---- 2. Mês
  function barras(hist, ind) {
    const vals = hist.map((h) => h.valores?.[ind.id] ?? null);
    const max = Math.max(...vals.map((v) => (v == null ? 0 : Math.abs(v))), 0);
    const L = 12, G = 3, H = 26;
    const rects = vals.map((v, i) => {
      const h = v == null || !max ? 0 : Math.max(2, Math.round((Math.abs(v) / max) * H));
      const ult = i === vals.length - 1;
      return `<rect x="${i * (L + G)}" y="${H - h}" width="${L}" height="${h || 1}" rx="1.5" class="${ult ? 'kpi-barra--atual' : v == null ? 'kpi-barra--vazia' : ''}"><title>${esc(Maius(nomeMes(hist[i].mes)))}: ${esc(formatar(ind.formato, v, true))}</title></rect>`;
    }).join('');
    return `<svg class="kpi-barras" viewBox="0 0 ${vals.length * (L + G) - G} ${H}" preserveAspectRatio="none" role="img" aria-label="Últimos ${vals.length} meses">${rects}</svg>`;
  }

  function cartao(ind, d) {
    const v = d.mes.valores[ind.id];
    const ant = d.historico.find((h) => h.mes === somarMeses(d.mes.mes, -1))?.valores?.[ind.id];
    const fx = faixaDe(ind, v, d.metas);
    const p = varPct(v, ant);
    const melhor = p == null ? null : (p > 0) === (ind.sentido !== -1);
    // mês parcial: comparar com um mês inteiro engana; a variação só aparece nos meses fechados
    const varTxt = p == null || d.mes.parcial ? '' : p === 0 ? '<span class="ini-var">=</span>'
      : `<span class="ini-var ${melhor ? 'sobe' : 'desce'}" title="${esc(Maius(nomeMes(somarMeses(d.mes.mes, -1))))}: ${esc(formatar(ind.formato, ant, true))}">${p > 0 ? SVG.sobe : SVG.desce}${Math.abs(p)}%</span>`;
    return `<div class="ini-num kpi-num" title="${esc(ind.nota)}">
        <span class="ini-num__rot">${esc(ind.nome)}</span>
        <b>${esc(formatar(ind.formato, v))}</b>
        <span class="ini-num__pe">${varTxt}${fx ? `<span class="ini-etq ${FAIXA[fx][1]}">${FAIXA[fx][0]}</span>` : ''}</span>
        ${barras(d.historico, ind)}
      </div>`;
  }

  function grupoMes(g, d) {
    const inds = d.indicadores.filter((i) => i.grupo === g.id);
    let extra = '';
    if (g.id === 'comercial') {
      const o = Object.entries(d.mes.origens || {}).sort((a, b) => b[1] - a[1]);
      extra = `<div class="ini-num kpi-num kpi-origens"><span class="ini-num__rot">Origem dos leads</span>
        ${o.length ? `<span class="kpi-etqs">${o.map(([k, n]) => `<span class="ini-etq">${esc(d.origens[k] || k)} ${n}</span>`).join('')}</span>` : '<span class="ini-num__pe">sem leads no mês</span>'}</div>`;
    }
    const cob = d.mes.cobertura || {};
    const parte = g.id === 'instagram' ? cob.instagram : g.id === 'site' ? cob.site : null;
    const onde = parte != null && cob.dias ? `${parte} de ${cob.dias} dias registrados` : g.onde;
    return `<section class="ini-grupo" style="--g:${g.cor}">
        <a class="ini-grupo__faixa" href="${esc(g.link)}" target="_blank" rel="noopener">${esc(g.nome)}<span>${esc(onde)}</span><i class="ini-fora">${SVG.fora}</i></a>
        <div class="ini-placar kpi-placar">${inds.map((i) => cartao(i, d)).join('')}${extra}</div>
      </section>`;
  }

  function emBreve(d) {
    return `<div class="kpi-breve">${d.em_breve.map((b) => `<div class="kpi-breve__item">
        <span class="ini-num__rot">${esc(NOME_BREVE[b.grupo] || b.grupo)}</span>
        <span>${esc(b.nomes.join(' · '))}</span>
        <small>Falta: ${esc(b.falta)}</small></div>`).join('')}</div>`;
  }

  function seletorMeses(d) {
    return `<div class="pas-seletor kpi-meses" role="group" aria-label="Mês">${d.meses.map((m) => {
      const ativo = m.mes === d.mes.mes;
      const rot = Maius(nomeMes(m.mes)) + (m.mes.slice(0, 4) !== d.hoje.slice(0, 4) ? ` ${m.mes.slice(0, 4)}` : '') + (m.fechado ? '' : ' (parcial)');
      return `<button type="button" data-mes="${m.mes}" aria-pressed="${ativo}"${ativo ? ' class="ativo"' : ''}>${esc(rot)}</button>`;
    }).join('')}</div>`;
  }

  function mes(d) {
    const m = d.mes;
    const fechado = !!d.balanco;
    const acoes = fechado
      ? `<button type="button" class="u-botao" data-pdf="ver">Ver balanço</button><button type="button" class="u-botao forte" data-pdf="baixar">Baixar balanço em PDF</button>`
      : `<button type="button" class="u-botao" data-pdf="previa">Prévia do balanço</button>`;
    const estado = fechado
      ? `<span class="ini-etq ok">fechado em ${esc(new Date(d.balanco.feito_em).toLocaleDateString('pt-BR'))}</span>`
      : m.parcial ? `<span class="ini-etq opcional">parcial · fecha em 1º de ${esc(nomeMes(somarMeses(m.mes, 1)))}</span>` : '<span class="ini-etq opcional">sem balanço</span>';
    const exp = d.expectativa;
    return `<section class="ini-sec">
        <div class="kpi-cab-sec"><h2 class="ini-sec__titulo">${esc(Maius(nomeMes(m.mes, true)))} ${estado}</h2><span class="kpi-acoes">${acoes}</span></div>
        <div class="kpi-filtros">${seletorMeses(d)}</div>
        ${GRUPOS.map((g) => grupoMes(g, d)).join('')}
        <div class="kpi-leituras">
          <div class="kpi-bloco"><h3 class="u-rotulo">${d.mes.parcial ? 'Até agora' : 'Leitura do mês'}</h3>
            ${d.frases.length ? `<ul>${d.frases.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="u-apoio">Ainda sem números neste mês.</p>'}</div>
          ${exp ? `<div class="kpi-bloco"><h3 class="u-rotulo">Expectativa para ${esc(nomeMes(exp.mes))}</h3><ul>${exp.frases.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
        </div>
        <h3 class="u-rotulo kpi-breve__tit">Ainda sem dados</h3>
        ${emBreve(d)}
      </section>`;
  }

  // ---- 3. Metas
  const paraTela = (ind, v) => (v == null ? '' : ind.formato === 'pct' ? String(+(v * 100).toFixed(2)).replace('.', ',') : String(v).replace('.', ','));
  const daTela = (ind, t) => { const s = String(t ?? '').trim().replace(/\./g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? (ind.formato === 'pct' ? n / 100 : n) : NaN; };
  const unidade = (ind) => ({ reais: 'R$', pct: '%', dias: 'dias' }[ind.formato] || '');

  function metas(d) {
    const fx = editando || Object.fromEntries(d.indicadores.map((i) => [i.id, Object.fromEntries(['minimo', 'adequado', 'excelente'].map((k) => [k, paraTela(i, d.metas.faixas?.[i.id]?.[k])]))]));
    editando = fx;
    const n = Object.keys(d.metas.faixas || {}).length;
    const linhas = d.indicadores.map((i) => `<tr>
        <td><b>${esc(i.nome)}</b>${i.sentido === -1 ? ' <span class="ini-etq">menos é melhor</span>' : ''}</td>
        ${['minimo', 'adequado', 'excelente'].map((k) => `<td class="num"><input class="u-campo-txt kpi-meta" inputmode="decimal" data-ind="${i.id}" data-faixa="${k}" value="${esc(fx[i.id][k])}" aria-label="${esc(i.nome)}: ${k}"></td>`).join('')}
        <td class="kpi-un">${esc(unidade(i))}</td>
      </tr>`).join('');
    return `<section class="ini-sec kpi-metas${metasAbertas ? ' aberto' : ''}">
        <button type="button" class="kpi-metas__cab" data-acao="metas" aria-expanded="${metasAbertas}">
          <h2 class="ini-sec__titulo">Metas <span>${n ? `${n} de ${d.indicadores.length} indicadores com faixas` : 'nenhuma faixa definida ainda'}</span></h2>
          <span class="kpi-seta">${SVG.seta}</span></button>
        ${metasAbertas ? `<div class="kpi-matriz"><table class="u-tabela">
          <thead><tr><th>Indicador</th><th class="num">Mínimo</th><th class="num">Adequado</th><th class="num">Excelente</th><th></th></tr></thead>
          <tbody>${linhas}</tbody></table></div>` : ''}
      </section>`;
  }

  const sujo = () => {
    if (!editando || !dados) return false;
    return dados.indicadores.some((i) => ['minimo', 'adequado', 'excelente'].some((k) => {
      const a = daTela(i, editando[i.id]?.[k]); const b = dados.metas.faixas?.[i.id]?.[k] ?? null;
      return !(a === b || (a != null && b != null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))));
    }));
  };
  function barraSalvar() {
    const b = raiz?.querySelector('.kpi-barra-salvar');
    if (!b) return;
    b.hidden = !sujo();
  }

  function notas(d) {
    return `<section class="pas-notas">
      <div><h3 class="u-rotulo">Como se calcula</h3><ul>${d.indicadores.map((i) => `<li><b>${esc(i.nome)}</b>: ${esc(i.nota)}.</li>`).join('')}</ul></div>
      <div><h3 class="u-rotulo">Fechamento</h3>
        <p>Todo dia, às 06h47, o Universo guarda os números de ontem do Instagram e do site. No dia 1º, fecha o mês anterior: congela os números, as faixas das metas e as frases, e avisa na Início. O PDF é desenhado desse retrato, então sai sempre igual.</p>
        <p>As faixas valem como estavam no dia do fechamento: mudar uma meta depois não muda um balanço já feito.</p></div>
    </section>`;
  }

  // ---- desenho
  function desenhar() {
    if (!raiz) return;
    const lado = dados?.em ? `atualizado às ${new Date(dados.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
    const cab = `<div class="cab"><h1 class="u-titulo">KPIs</h1><div class="lado u-apoio">${esc(lado)}</div></div>`;
    if (!dados) { raiz.innerHTML = cab + '<p class="u-apoio kpi-carregando">Carregando os indicadores…</p>'; return; }
    raiz.innerHTML = cab + ontem(dados.ontem) + mes(dados) + metas(dados) + notas(dados)
      + `<div class="kpi-barra-salvar" hidden><span>Metas alteradas</span><span class="kpi-barra-salvar__acoes">
          <button type="button" class="u-botao" data-acao="descartar">Descartar</button>
          <button type="button" class="u-botao forte" data-acao="salvar">Salvar metas</button></span></div>`;
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
    if (mudou) desenhar();
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
    editando = null;
    toque('Metas salvas');
    await buscar();
    desenhar();
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

  function ligar(el) {
    raiz = el;
    mesPedido = (location.hash.match(/[?&]mes=(\d{4}-\d{2})/) || [])[1] || null;
    if (mesPedido && dados?.mes?.mes !== mesPedido) dados = null;
    editando = null;
    desenhar();
    buscar();
    raiz.addEventListener('click', (ev) => {
      const m = ev.target.closest('[data-mes]');
      if (m) {
        mesPedido = m.dataset.mes === dados?.meses?.[0]?.mes ? null : m.dataset.mes;
        history.replaceState(null, '', '#/kpis' + (mesPedido ? `?mes=${mesPedido}` : ''));
        buscar();
        return;
      }
      const p = ev.target.closest('[data-pdf]');
      if (p) { pdf(p.dataset.pdf, p); return; }
      const a = ev.target.closest('[data-acao]')?.dataset.acao;
      if (a === 'metas') {
        metasAbertas = !metasAbertas;
        try { localStorage.setItem(LEMBRAR + 'metas', metasAbertas ? '1' : '0'); } catch {}
        desenhar();
      }
      if (a === 'descartar') { editando = null; desenhar(); }
      if (a === 'salvar') salvar();
    });
    raiz.addEventListener('input', (ev) => {
      const i = ev.target.closest('.kpi-meta');
      if (!i) return;
      editando[i.dataset.ind][i.dataset.faixa] = i.value;
      barraSalvar();
    });
    raiz.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 's' && sujo()) { ev.preventDefault(); salvar(); }
    });
  }

  return { ligar };
}
