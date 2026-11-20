// KPIs do Universo (Cid, 19/11): seção própria no menu principal (#/kpis), com atalho em Ferramentas › Gestão.
//
//   GET  /api/kpis?mes=AAAA-MM   -> { hoje, ontem: { instagram, site }, metas, meses, mes, historico, balanco? }
//   GET  /api/kpis/balanco?mes=  -> balanço congelado do mês (404 se não houver)
//   PUT  /api/kpis/metas         <- { versao: 1, faixas: { <indicador>: { minimo, adequado, excelente } } }
//   POST /api/kpis/fechar        <- { mes }  refaz o balanço de um mês fechado (uso interno; o normal é o cron)
//
// Cron diário (wrangler.toml, 09:47 UTC = 06:47 de Brasília, depois da coleta do Instagram às 06:17):
//   1. guarda os números de ontem do Instagram e do site (e completa até 8 dias que faltem no mês atual e no
//      anterior), porque marketing e site só sabem responder dia a dia;
//   2. no dia 1º (e, se falhar, até o dia 5), fecha o mês anterior: calcula, congela o balanço e avisa a Início.
//
// Tudo no R2 privado (ARQUIVOS), nada no git e nada de migração:
//   kpis/metas.json              faixas de cada indicador (editadas na página)
//   kpis/dias/AAAA-MM.json       { 'AAAA-MM-DD': { ig: {…}, site: {…} } }
//   kpis/balancos/AAAA-MM.json   balanço congelado (o PDF é desenhado dele, sempre igual)
//   kpis/ultimo.json             { mes, feito_em } do último balanço, para o aviso da Início
//
// Comercial vem do D1 (vendas): leads = oportunidades criadas no mês; propostas = propostas emitidas
// (PDF congelado, sem simulação, sem contar revisões) pela data da proposta; contratos = contratos principais
// assinados no mês; tempo de decisão = da data da proposta à assinatura. Dias e meses de Brasília.

import { diaBR, somarDias } from './inicio.js';

// ---- catálogo de indicadores (definição, não dado) -----------------------------------------------
// sentido: 1 = quanto mais, melhor · -1 = quanto menos, melhor. formato: num · reais · pct · dias
export const INDICADORES = [
  { id: 'leads', grupo: 'comercial', nome: 'Leads', formato: 'num', sentido: 1, nota: 'Oportunidades criadas no Funil no mês' },
  { id: 'propostas', grupo: 'comercial', nome: 'Propostas emitidas', formato: 'num', sentido: 1, nota: 'Propostas com PDF emitido no mês; revisões e simulações não contam' },
  { id: 'contratos', grupo: 'comercial', nome: 'Contratos fechados', formato: 'num', sentido: 1, nota: 'Contratos principais assinados no mês' },
  { id: 'contratado', grupo: 'comercial', nome: 'Valor contratado', formato: 'reais', sentido: 1, nota: 'Soma dos contratos assinados no mês' },
  { id: 'ticket', grupo: 'comercial', nome: 'Ticket médio', formato: 'reais', sentido: 1, nota: 'Valor contratado ÷ contratos fechados' },
  { id: 'decisao', grupo: 'comercial', nome: 'Tempo de decisão', formato: 'dias', sentido: -1, nota: 'Média de dias entre a data da proposta e a assinatura do contrato' },
  { id: 'ief', grupo: 'comercial', nome: 'Eficiência do funil', formato: 'pct', sentido: 1, nota: 'IEF = 0,4 × propostas ÷ leads + 0,6 × contratos ÷ propostas' },
  { id: 'alcance', grupo: 'instagram', nome: 'Alcance', formato: 'num', sentido: 1, nota: 'Soma do alcance diário' },
  { id: 'interacoes', grupo: 'instagram', nome: 'Interações', formato: 'num', sentido: 1, nota: 'Soma das interações diárias' },
  { id: 'engajamento', grupo: 'instagram', nome: 'Taxa de resposta', formato: 'pct', sentido: 1, nota: 'Interações ÷ alcance' },
  { id: 'visitas_perfil', grupo: 'instagram', nome: 'Visitas ao perfil', formato: 'num', sentido: 1, nota: 'Soma das visitas diárias ao perfil' },
  { id: 'toques_link', grupo: 'instagram', nome: 'Toques no link', formato: 'num', sentido: 1, nota: 'Soma dos toques diários no link do perfil' },
  { id: 'seguidores', grupo: 'instagram', nome: 'Seguidores', formato: 'num', sentido: 1, nota: 'Total no fim do mês' },
  { id: 'novos_seguidores', grupo: 'instagram', nome: 'Novos seguidores', formato: 'num', sentido: 1, nota: 'Soma dos ganhos diários' },
  { id: 'visitas_site', grupo: 'site', nome: 'Visitas', formato: 'num', sentido: 1, nota: 'Soma dos visitantes diários de odisse.com.br' },
  { id: 'projetos_site', grupo: 'site', nome: 'Projetos abertos', formato: 'num', sentido: 1, nota: 'Páginas de projeto abertas no site' },
  { id: 'contatos_site', grupo: 'site', nome: 'Contatos', formato: 'num', sentido: 1, nota: 'Toques em WhatsApp, e-mail e telefone no site' },
];
// O que ainda não tem de onde vir (aparece tracejado, com a fonte que falta)
export const EM_BREVE = [
  { grupo: 'financeiro', nomes: ['Faturamento', 'Receita recorrente', 'Margem líquida', 'Dependência de um cliente', 'Previsibilidade de receita'], falta: 'Financeiro' },
  { grupo: 'operacional', nomes: ['Horas sobre o previsto', 'Retrabalho', 'Prazo médio de entrega'], falta: 'horas lançadas nos projetos e o Escopo do Projeto' },
  { grupo: 'cliente', nomes: ['NPS', 'Clientes recorrentes', 'Upsell', 'Cross-sell', 'LTV'], falta: 'pesquisa com o cliente e vínculo entre projetos' },
  { grupo: 'marketing', nomes: ['Publicações no mês'], falta: 'contagem mensal do calendário editorial no marketing' },
];
const POR_ID = Object.fromEntries(INDICADORES.map((i) => [i.id, i]));
export const ORIGENS = { indicacao: 'Indicação', instagram: 'Instagram', site: 'Site', landing_page: 'Landing page', herma: 'Herma', radar: 'Radar', outro: 'Outro', sem: 'Sem origem' };

// ---- meses ------------------------------------------------------------------------------------
export const mesDe = (dia) => dia.slice(0, 7);
export const somarMeses = (mes, n) => {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
const diasDoMes = (mes) => {
  const fim = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();
  return Array.from({ length: fim }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
};
const MES_OK = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---- R2 ---------------------------------------------------------------------------------------
async function lerJson(env, chave) {
  const o = await env.ARQUIVOS?.get(chave);
  return o ? JSON.parse(await o.text()) : null;
}
const gravarJson = (env, chave, v) => env.ARQUIVOS.put(chave, JSON.stringify(v), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
const chaveDias = (mes) => `kpis/dias/${mes}.json`;
const chaveBalanco = (mes) => `kpis/balancos/${mes}.json`;

// ---- canais (Instagram e site, dia a dia) -------------------------------------------------------
const LIMITE_MS = 8000;
async function comPrazo(p) {
  let t;
  try { return await Promise.race([p, new Promise((_, n) => { t = setTimeout(() => n(new Error('sem resposta')), LIMITE_MS); })]); }
  finally { clearTimeout(t); }
}
const n0 = (v) => (Number.isFinite(v) ? v : null);

// Números de um dia fechado. Instagram: o resumo do dia seguinte traz "ontem" (= o dia pedido) e o total de
// seguidores tirado na coleta da manhã seguinte. Cada parte falha sozinha (fica sem gravar).
export async function numerosDoDia(env, dia) {
  const [ig, site] = await Promise.all([
    env.MARKETING ? comPrazo(env.MARKETING.resumo(somarDias(dia, 1))).then((r) => r?.instagram).catch(() => null) : null,
    env.SITE_ODISSE ? comPrazo(env.SITE_ODISSE.metricasDoDia(dia)).then((r) => r?.total).catch(() => null) : null,
  ]);
  const out = {};
  if (ig?.atual && ig.dia === dia) {
    const a = ig.atual;
    out.ig = { alcance: n0(a.alcance), interacoes: n0(a.interacoes), visitas: n0(a.visitas), toques: n0(a.toques), novos: n0(a.novos), seguidores: n0(ig.seguidores) };
  }
  if (site) out.site = { visitantes: n0(site.visitantes), projetos: n0(site.projetos), contatos: n0(site.contatos) };
  return out;
}

// Completa os dias que faltam de um mês (até `limite` dias por vez, para não estourar a cota de chamadas).
export async function completarDias(env, mes, hoje, limite = 8) {
  const guardados = (await lerJson(env, chaveDias(mes))) || {};
  const faltam = diasDoMes(mes).filter((d) => d < hoje && !(guardados[d]?.ig && guardados[d]?.site)).slice(0, limite);
  if (!faltam.length) return { mes, novos: 0 };
  let novos = 0;
  for (const d of faltam) {
    const n = await numerosDoDia(env, d);
    if (n.ig || n.site) { guardados[d] = { ...(guardados[d] || {}), ...n }; novos++; }
  }
  if (novos) await gravarJson(env, chaveDias(mes), guardados);
  return { mes, novos };
}

function somarCanais(dias, mes) {
  const lista = diasDoMes(mes).map((d) => dias?.[d]).filter(Boolean);
  const soma = (parte, campo) => {
    const v = lista.map((x) => x[parte]?.[campo]).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  };
  const comIg = lista.filter((x) => x.ig).length, comSite = lista.filter((x) => x.site).length;
  const ultimoSeg = [...lista].reverse().find((x) => x.ig?.seguidores != null)?.ig.seguidores ?? null;
  const alcance = soma('ig', 'alcance'), interacoes = soma('ig', 'interacoes');
  return {
    valores: {
      alcance, interacoes, engajamento: alcance ? interacoes / alcance : null,
      visitas_perfil: soma('ig', 'visitas'), toques_link: soma('ig', 'toques'),
      seguidores: ultimoSeg, novos_seguidores: soma('ig', 'novos'),
      visitas_site: soma('site', 'visitantes'), projetos_site: soma('site', 'projetos'), contatos_site: soma('site', 'contatos'),
    },
    cobertura: { instagram: comIg, site: comSite, dias: diasDoMes(mes).length },
  };
}

// ---- comercial (D1) -------------------------------------------------------------------------------
const BR = (col) => `substr(datetime(${col}, '-3 hours'), 1, 7)`; // carimbo UTC → mês de Brasília

export async function comercialPorMes(env) {
  if (!env.DB) return {};
  const [leads, origens, propostas, contratos] = await Promise.all([
    env.DB.prepare(`SELECT ${BR('criado_em')} AS mes, COUNT(*) AS n FROM oportunidades WHERE arquivado_em IS NULL GROUP BY mes`).all(),
    env.DB.prepare(`SELECT ${BR('criado_em')} AS mes, COALESCE(origem, 'sem') AS origem, COUNT(*) AS n FROM oportunidades
      WHERE arquivado_em IS NULL GROUP BY mes, origem`).all(),
    env.DB.prepare(`SELECT substr(data, 1, 7) AS mes, COUNT(*) AS n FROM propostas
      WHERE simulacao = 0 AND revisao = 0 AND arquivo_pdf_id IS NOT NULL AND arquivado_em IS NULL AND data IS NOT NULL GROUP BY mes`).all(),
    env.DB.prepare(`SELECT c.assinado_em, c.valor_total, p.data AS proposta_data FROM contratos c
      LEFT JOIN propostas p ON p.id = c.proposta_id
      WHERE c.tipo = 'principal' AND c.situacao IN ('assinado', 'encerrado') AND c.arquivado_em IS NULL AND c.assinado_em IS NOT NULL`).all(),
  ]);
  const m = {};
  const de = (mes) => (m[mes] ||= { leads: 0, propostas: 0, contratos: 0, contratado: 0, decisoes: [], origens: {} });
  for (const r of leads.results) if (r.mes) de(r.mes).leads = r.n;
  for (const r of origens.results) if (r.mes) de(r.mes).origens[r.origem] = r.n;
  for (const r of propostas.results) if (r.mes) de(r.mes).propostas = r.n;
  for (const r of contratos.results) {
    const x = de(String(r.assinado_em).slice(0, 7));
    x.contratos++;
    x.contratado += (r.valor_total || 0) / 100;
    if (r.proposta_data) {
      const d = Math.round((Date.parse(String(r.assinado_em).slice(0, 10)) - Date.parse(String(r.proposta_data).slice(0, 10))) / 864e5);
      if (Number.isFinite(d) && d >= 0) x.decisoes.push(d);
    }
  }
  return m;
}

function valoresComerciais(x) {
  if (!x) return { leads: 0, propostas: 0, contratos: 0, contratado: 0, ticket: null, decisao: null, ief: null };
  return {
    leads: x.leads, propostas: x.propostas, contratos: x.contratos, contratado: x.contratado,
    ticket: x.contratos ? x.contratado / x.contratos : null,
    decisao: x.decisoes.length ? x.decisoes.reduce((a, b) => a + b, 0) / x.decisoes.length : null,
    ief: x.leads && x.propostas ? 0.4 * (x.propostas / x.leads) + 0.6 * (x.contratos / x.propostas) : null,
  };
}

async function propostasAbertas(env, hoje) {
  if (!env.DB) return { n: 0, valor: 0 };
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(valor_total), 0) AS v FROM propostas
    WHERE simulacao = 0 AND arquivo_pdf_id IS NOT NULL AND arquivado_em IS NULL AND situacao = 'enviada'
      AND (validade IS NULL OR validade >= ?)`).bind(hoje).first();
  return { n: r?.n || 0, valor: (r?.v || 0) / 100 };
}

// ---- faixas e frases --------------------------------------------------------------------------------
export function faixaDe(id, valor, metas) {
  const f = metas?.faixas?.[id];
  const ind = POR_ID[id];
  if (valor == null || !f || [f.minimo, f.adequado, f.excelente].some((x) => typeof x !== 'number')) return null;
  const s = ind?.sentido === -1 ? -1 : 1;
  const v = s * valor;
  if (v >= s * f.excelente) return 'excelente';
  if (v >= s * f.adequado) return 'adequado';
  if (v >= s * f.minimo) return 'minimo';
  return 'abaixo';
}

export function formatar(id, v) {
  if (v == null) return '—';
  const f = POR_ID[id]?.formato;
  if (f === 'reais') return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  if (f === 'pct') return (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  if (f === 'dias') return Math.round(v).toLocaleString('pt-BR') + (Math.round(v) === 1 ? ' dia' : ' dias');
  return Math.round(v).toLocaleString('pt-BR');
}
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeMes = (mes, ano = false) => NOME_MES[+mes.slice(5, 7) - 1] + (ano ? ` de ${mes.slice(0, 4)}` : '');
const FAIXA_TXT = { excelente: 'na faixa excelente', adequado: 'na faixa adequada', minimo: 'no mínimo', abaixo: 'abaixo do mínimo' };

const variacaoPct = (a, b) => (a == null || b == null || b === 0 ? null : (a - b) / Math.abs(b));
const media = (l) => { const v = l.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// Frase de um indicador: valor, comparação com o mês anterior e com a média dos 3 anteriores, faixa.
export function frase(id, mes, valores, historico, metas) {
  const v = valores[id];
  const ind = POR_ID[id];
  if (v == null) return null;
  const ant = historico.find((h) => h.mes === somarMeses(mes, -1))?.valores?.[id];
  const tres = media([1, 2, 3].map((k) => historico.find((h) => h.mes === somarMeses(mes, -k))?.valores?.[id]));
  const partes = [`${ind.nome}: ${formatar(id, v)}`];
  const comp = (p, de, igual) => (p == null ? null : Math.abs(p) < 0.005 ? igual : `${Math.round(Math.abs(p) * 100)}% ${p > 0 ? 'acima' : 'abaixo'} ${de}`);
  const nomeAnt = nomeMes(somarMeses(mes, -1));
  const c1 = comp(variacaoPct(v, ant), `de ${nomeAnt}`, `igual a ${nomeAnt}`);
  const c3 = comp(variacaoPct(v, tres), 'da média dos três meses anteriores', 'igual à média dos três meses anteriores');
  const comps = [c1, c3].filter(Boolean);
  if (comps.length) partes.push(comps.join(' e '));
  const fx = faixaDe(id, v, metas);
  if (fx) partes.push(FAIXA_TXT[fx]);
  return partes.join(', ') + '.';
}

// ---- montar um mês -------------------------------------------------------------------------------------
export async function montarMes(env, mes, { comercial, hoje } = {}) {
  comercial ||= await comercialPorMes(env);
  const canais = somarCanais(await lerJson(env, chaveDias(mes)), mes);
  return {
    mes,
    parcial: !!hoje && mesDe(hoje) <= mes,
    valores: { ...valoresComerciais(comercial[mes]), ...canais.valores },
    origens: comercial[mes]?.origens || {},
    cobertura: canais.cobertura,
  };
}

export async function historico(env, ate, n = 12, comercial) {
  comercial ||= await comercialPorMes(env);
  const meses = Array.from({ length: n }, (_, i) => somarMeses(ate, -(n - 1 - i)));
  return Promise.all(meses.map((m) => montarMes(env, m, { comercial })));
}

// Expectativa para o mês seguinte: só contas com o que já se sabe.
export async function expectativa(env, mes, hist, hoje) {
  const ult3 = [0, 1, 2].map((k) => hist.find((h) => h.mes === somarMeses(mes, -k))?.valores).filter(Boolean);
  const somaCampo = (c) => ult3.reduce((a, v) => a + (v[c] || 0), 0);
  const taxa = somaCampo('propostas') ? somaCampo('contratos') / somaCampo('propostas') : null;
  const abertas = await propostasAbertas(env, hoje);
  const ticket = media(ult3.map((v) => v.ticket));
  const contratosEsperados = taxa != null ? abertas.n * taxa : null;
  const proximo = somarMeses(mes, 1);
  const frases = [];
  frases.push(abertas.n
    ? `${abertas.n} ${abertas.n === 1 ? 'proposta emitida segue' : 'propostas emitidas seguem'} em aberto, somando ${formatar('contratado', abertas.valor)}.`
    : 'Nenhuma proposta emitida está em aberto.');
  if (contratosEsperados != null && abertas.n) {
    frases.push(`Com a taxa de fechamento dos últimos três meses (${formatar('ief', taxa)} das propostas viraram contrato), espera-se perto de ${contratosEsperados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${contratosEsperados >= 0.95 && contratosEsperados < 1.05 ? 'contrato' : 'contratos'} em ${nomeMes(proximo)}${ticket ? `, perto de ${formatar('contratado', contratosEsperados * ticket)} pelo ticket médio do período` : ''}.`);
  }
  const ml = media(ult3.map((v) => v.leads));
  if (ml != null) frases.push(`Pela média dos três últimos meses, ${nomeMes(proximo)} deve trazer cerca de ${Math.round(ml)} ${Math.round(ml) === 1 ? 'lead' : 'leads'}.`);
  const ma = media(ult3.map((v) => v.alcance));
  if (ma != null) frases.push(`No Instagram, a média dos três últimos meses aponta um alcance perto de ${formatar('alcance', ma)}.`);
  return { mes: proximo, abertas, taxa, contratosEsperados, ticket, leads: ml, alcance: ma, frases };
}

// ---- balanço (fechamento do mês) ----------------------------------------------------------------------
export async function fecharMes(env, mes, agora = new Date()) {
  const hoje = diaBR(agora);
  if (!MES_OK.test(mes) || mes >= mesDe(hoje)) throw new Error('só fecha um mês que já terminou');
  const comercial = await comercialPorMes(env);
  const hist = await historico(env, mes, 12, comercial);
  const atual = hist.at(-1);
  const metas = await lerJson(env, 'kpis/metas.json');
  const frases = INDICADORES.map((i) => frase(i.id, mes, atual.valores, hist, metas)).filter(Boolean);
  const balanco = {
    versao: 1, mes, feito_em: agora.toISOString(),
    valores: atual.valores, origens: atual.origens, cobertura: atual.cobertura,
    historico: hist.map((h) => ({ mes: h.mes, valores: h.valores })),
    metas: metas?.faixas || {}, frases,
    expectativa: await expectativa(env, mes, hist, hoje),
  };
  await gravarJson(env, chaveBalanco(mes), balanco);
  await gravarJson(env, 'kpis/ultimo.json', { mes, feito_em: balanco.feito_em });
  return balanco;
}

// ---- rotina diária -------------------------------------------------------------------------------------
export async function rotina(env, agora = new Date()) {
  const hoje = diaBR(agora);
  const mes = mesDe(hoje), anterior = somarMeses(mes, -1);
  const feito = { dias: [] };
  feito.dias.push(await completarDias(env, anterior, hoje, 8));
  feito.dias.push(await completarDias(env, mes, hoje, 8));
  if (+hoje.slice(8, 10) <= 5 && !(await env.ARQUIVOS.head(chaveBalanco(anterior)))) {
    feito.balanco = (await fecharMes(env, anterior, agora)).mes;
  }
  return feito;
}

// ---- leituras da página e da Início ---------------------------------------------------------------------
async function ontem(env, hoje) {
  const d = somarDias(hoje, -1);
  const [mkt, site] = await Promise.all([
    env.MARKETING ? comPrazo(env.MARKETING.resumo(hoje)).catch((e) => ({ erro: e.message })) : { erro: 'ligação não configurada' },
    env.SITE_ODISSE ? comPrazo(env.SITE_ODISSE.metricasDoDia(d)).catch((e) => ({ erro: e.message })) : { erro: 'ligação não configurada' },
  ]);
  return { dia: d, instagram: mkt?.erro ? { erro: mkt.erro } : mkt?.instagram || { erro: 'Instagram não conectado' }, site };
}

async function mesesFechados(env) {
  const l = await env.ARQUIVOS.list({ prefix: 'kpis/balancos/' });
  return l.objects.map((o) => o.key.slice(14, 21)).filter((m) => MES_OK.test(m)).sort().reverse();
}

export async function lerKpis(env, mesPedido, agora = new Date()) {
  if (!env.ARQUIVOS) return { status: 503, erro: 'R2 não configurado' };
  const hoje = diaBR(agora);
  const corrente = mesDe(hoje);
  const mes = MES_OK.test(mesPedido || '') && mesPedido <= corrente ? mesPedido : corrente;
  const [o, metas, fechados, balanco] = await Promise.all([
    ontem(env, hoje), lerJson(env, 'kpis/metas.json'), mesesFechados(env), lerJson(env, chaveBalanco(mes)),
  ]);
  const comercial = await comercialPorMes(env);
  const hist = await historico(env, mes, 12, comercial);
  const atual = { ...hist.at(-1), parcial: mes === corrente };
  return {
    status: 200,
    dados: {
      hoje, em: agora.toISOString(), ontem: o,
      metas: metas || { versao: 1, faixas: {} },
      indicadores: INDICADORES, em_breve: EM_BREVE, origens: ORIGENS,
      meses: [...new Set([corrente, ...fechados])].sort().reverse().map((m) => ({ mes: m, fechado: fechados.includes(m) })),
      mes: atual, historico: hist.map((h) => ({ mes: h.mes, valores: h.valores })),
      // mês corrente: só valor e faixa (comparar um mês pela metade com meses inteiros engana)
      frases: INDICADORES.map((i) => frase(i.id, mes, atual.valores, atual.parcial ? [] : hist, metas)).filter(Boolean),
      expectativa: mes === corrente ? await expectativa(env, mes, hist, hoje) : null,
      balanco: balanco ? { mes, feito_em: balanco.feito_em } : null,
    },
  };
}

export async function lerBalanco(env, mes) {
  if (!MES_OK.test(mes || '')) return { status: 400, erro: 'mes deve ser AAAA-MM' };
  const b = await lerJson(env, chaveBalanco(mes));
  return b ? { status: 200, dados: b } : { status: 404, erro: 'ainda não há balanço deste mês' };
}

// Aviso da Início: o último balanço, nos 10 dias seguintes ao fechamento.
export async function avisoBalanco(env, agora = new Date()) {
  const u = await lerJson(env, 'kpis/ultimo.json').catch(() => null);
  if (!u?.feito_em || agora.getTime() - Date.parse(u.feito_em) > 10 * 864e5) return null;
  return u;
}

export async function gravarMetas(env, corpo) {
  if (!corpo || corpo.versao !== 1 || typeof corpo.faixas !== 'object' || Array.isArray(corpo.faixas)) return { status: 400, erro: 'envie { versao: 1, faixas }' };
  const faixas = {};
  for (const [id, f] of Object.entries(corpo.faixas)) {
    const ind = POR_ID[id];
    if (!ind) return { status: 422, erro: `indicador desconhecido: ${id}` };
    const vals = ['minimo', 'adequado', 'excelente'].map((k) => (f?.[k] === '' || f?.[k] == null ? null : Number(f[k])));
    if (vals.every((v) => v == null)) continue;
    if (vals.some((v) => v == null || !Number.isFinite(v))) return { status: 422, erro: `${ind.nome}: preencha as três faixas com números` };
    const [mi, ad, ex] = vals.map((v) => v * ind.sentido);
    if (!(mi <= ad && ad <= ex)) return { status: 422, erro: `${ind.nome}: as faixas precisam ir do mínimo ao excelente${ind.sentido === -1 ? ' (aqui, menos é melhor)' : ''}` };
    faixas[id] = { minimo: vals[0], adequado: vals[1], excelente: vals[2] };
  }
  const metas = { versao: 1, faixas, atualizado_em: new Date().toISOString() };
  await gravarJson(env, 'kpis/metas.json', metas);
  return { status: 200, dados: metas };
}
