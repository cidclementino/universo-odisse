// Financeiro › Despesas fixas (0025; Cid, 20/11). Primeira parte do Financeiro, seção própria do menu principal.
//
//   GET  financeiro/despesas        -> { hoje, mes, cotacao, despesas, categorias } numa leitura só
//                                      (cada despesa com os seus valores ao longo do tempo)
//   POST financeiro/despesas/:id/meses { mes, valor|null } -> valor real do mês (despesa que varia)
//   POST financeiro/despesas/lote { itens: [{ nome, valor, dia, … }] }  -> várias de uma vez (colar de uma planilha)
//   POST / PATCH / arquivar / restaurar: rotas comuns (despesas-fixas).
//
// Regras (Cid, 20/11):
//   * cadastro o mais rápido possível: nome, valor e dia bastam; mensal e em reais vêm prontos;
//   * a moeda pode ser dólar: o valor fica em US$; nas somas da página vira real pela cotação do dia, com *;
//   * mudou o valor (ou a moeda), o antigo fica guardado em despesas_fixas_valores, com o mês desde quando vale;
//   * simulação (0026): despesa simulada fica fora das contas reais; serve para ver o impacto no orçamento.
//     Efetivar = passa a contar; uma real não volta a ser simulação; descartar = arquivar;
//   * valor que varia (0026): contas como a de luz seguem fixas; o valor é a estimativa, e o real de cada mês se
//     lança em POST financeiro/despesas/:id/meses { mes: 'AAAA-MM', valor } (valor nulo tira o lançamento);
//   * Pessoal (pró-labore, salários, encargos) é um grupo à parte; o histórico das despesas guarda só o nome dos
//     campos mudados, nunca o valor (os valores ficam na própria tabela de valores, só para o hub).
// A previsão do ano e as somas são calculadas na página (assets/financeiro-calculo.js), que tem tudo o que precisa.

import { ErroApi } from './regras.js';
import { hojeBrasilia, novoId, agoraISO } from './util.js';

// categorias sugeridas (a página aprende com as já usadas); texto livre, sem migração para crescer
export const CATEGORIAS = {
  geral: ['Espaço', 'Software e assinaturas', 'Contabilidade e taxas', 'Marketing', 'Seguros', 'Outros'],
  pessoal: ['Pró-labore', 'Salários', 'Encargos', 'Benefícios'],
};

const mesDe = (dia) => dia.slice(0, 7);
const mesAtual = () => mesDe(hojeBrasilia());
const numMesAtual = () => Number(hojeBrasilia().slice(5, 7));

function conferir(v) {
  if (v.valor !== undefined && v.valor !== null && v.valor < 0) throw new ErroApi(422, 'Valor: não pode ser negativo');
  if (v.inicio && v.fim && v.fim < v.inicio) throw new ErroApi(422, 'Fim: antes do início');
}

// grava o valor do mês (um por despesa e mês). Guardado pela versão nova do registro: só entra se o UPDATE pegou.
const sqlValor = (env, despesaId, desde, valor, moeda, por, versaoNova) => env.DB.prepare(
  `INSERT INTO despesas_fixas_valores (id, despesa_id, desde, valor, moeda, criado_em, criado_por)
   SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM despesas_fixas WHERE id = ? AND versao = ?)
   ON CONFLICT (despesa_id, desde) DO UPDATE SET valor = excluded.valor, moeda = excluded.moeda`,
).bind(novoId('dfv'), despesaId, desde, valor, moeda, agoraISO(), por, despesaId, versaoNova);

export const regraDespesas = {
  async criar(env, ferramenta, v, corpo, id) {
    conferir(v);
    if (v.periodicidade === 'mensal') v.mes = null;
    else if (!v.mes) v.mes = v.inicio ? Number(v.inicio.slice(5, 7)) : numMesAtual(); // primeiro pagamento no mês do início
    const desde = v.inicio && mesDe(v.inicio) > mesAtual() ? mesDe(v.inicio) : mesAtual();
    return [sqlValor(env, id, desde, v.valor, v.moeda || 'brl', ferramenta, 1)];
  },
  async alterar(env, ferramenta, atual, mudancas) {
    if (mudancas.simulada === 1 && atual.simulada === 0) throw new ErroApi(422, 'uma despesa real não volta a ser simulação');
    const v = { ...atual, ...mudancas };
    conferir(v);
    if ('periodicidade' in mudancas || 'mes' in mudancas) {
      if (v.periodicidade === 'mensal') { if (atual.mes !== null) mudancas.mes = null; else delete mudancas.mes; }
      else if (!v.mes) mudancas.mes = v.inicio ? Number(v.inicio.slice(5, 7)) : numMesAtual();
    }
    if (!('valor' in mudancas) && !('moeda' in mudancas)) return [];
    const desde = v.inicio && mesDe(v.inicio) > mesAtual() ? mesDe(v.inicio) : mesAtual();
    return [sqlValor(env, atual.id, desde, v.valor, v.moeda, ferramenta, atual.versao + 1)];
  },
};

// ---------------------------------------------------------------- cotação do dólar (PTAX do Banco Central)

const COTACAO = 'financeiro/cotacao.json';
const PTAX = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/';
const mdy = (d) => `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`;

// Lê a PTAX de venda mais recente dos últimos 10 dias (fim de semana e feriado não têm cotação).
export async function buscarPtax(buscar = fetch, hoje = hojeBrasilia()) {
  const ini = new Date(Date.parse(hoje) - 10 * 864e5).toISOString().slice(0, 10);
  const url = `${PTAX}CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${mdy(ini)}'&@dataFinalCotacao='${mdy(hoje)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const r = await buscar(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`PTAX ${r.status}`);
  const lista = (await r.json())?.value || [];
  const ult = lista.filter((x) => Number(x.cotacaoVenda) > 0).sort((a, b) => String(a.dataHoraCotacao).localeCompare(String(b.dataHoraCotacao))).pop();
  if (!ult) throw new Error('PTAX sem cotação no período');
  return { valor: Number(ult.cotacaoVenda), data: String(ult.dataHoraCotacao).slice(0, 10), fonte: 'PTAX (Banco Central), venda' };
}

// A cotação guardada; se ainda não foi lida hoje, tenta ler de novo (se falhar, fica a última).
export async function cotacao(env, { buscar = fetch, forcar = false } = {}) {
  if (!env.ARQUIVOS) return null;
  const hoje = hojeBrasilia();
  let guardada = null;
  try { guardada = await (await env.ARQUIVOS.get(COTACAO))?.json(); } catch { guardada = null; }
  if (guardada && guardada.lida_em === hoje && !forcar) return guardada;
  try {
    const nova = { ...(await buscarPtax(buscar, hoje)), lida_em: hoje };
    await env.ARQUIVOS.put(COTACAO, JSON.stringify(nova), { httpMetadata: { contentType: 'application/json' } });
    return nova;
  } catch (e) {
    console.warn('cotação do dólar:', e?.message || e);
    return guardada;
  }
}

// ---------------------------------------------------------------- leitura juntada

export async function despesas(env) {
  const [d, v, ms] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM despesas_fixas WHERE arquivado_em IS NULL ORDER BY grupo, categoria, nome`),
    env.DB.prepare(`SELECT v.despesa_id, v.desde, v.valor, v.moeda FROM despesas_fixas_valores v
      JOIN despesas_fixas d ON d.id = v.despesa_id AND d.arquivado_em IS NULL ORDER BY v.despesa_id, v.desde`),
    env.DB.prepare(`SELECT m.despesa_id, m.mes, m.valor FROM despesas_fixas_meses m
      JOIN despesas_fixas d ON d.id = m.despesa_id AND d.arquivado_em IS NULL`),
  ]);
  const meses = new Map();
  for (const x of ms.results) {
    if (!meses.has(x.despesa_id)) meses.set(x.despesa_id, {});
    meses.get(x.despesa_id)[x.mes] = x.valor;
  }
  const porDespesa = new Map();
  for (const x of v.results) {
    if (!porDespesa.has(x.despesa_id)) porDespesa.set(x.despesa_id, []);
    porDespesa.get(x.despesa_id).push({ desde: x.desde, valor: x.valor, moeda: x.moeda });
  }
  return d.results.map((x) => ({ ...x, valores: porDespesa.get(x.id) || [], meses: meses.get(x.id) || {} }));
}

export async function rotasFinanceiro(env, ferramenta, m, partes, corpo, h) {
  const [rota, id, acao, sub] = partes;
  if (rota !== 'financeiro' || id !== 'despesas') return undefined;
  // valor real de um mês (despesa que varia): grava, troca ou tira (valor nulo)
  if (acao && acao.startsWith('dfx_') && sub === 'meses' && m === 'POST') {
    h.exigir('despesas_fixas', ferramenta, 'E');
    const d = await env.DB.prepare('SELECT id, arquivado_em FROM despesas_fixas WHERE id = ?').bind(acao).first();
    if (!d || d.arquivado_em) throw new ErroApi(404, 'despesa não encontrada');
    const mes = String(corpo?.mes || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErroApi(422, 'Mês: no formato AAAA-MM');
    const valor = corpo?.valor;
    if (valor === null || valor === undefined || valor === '') {
      await env.DB.prepare('DELETE FROM despesas_fixas_meses WHERE despesa_id = ? AND mes = ?').bind(acao, mes).run();
      return { mes, valor: null };
    }
    if (!Number.isInteger(valor) || valor < 0) throw new ErroApi(422, 'Valor: em centavos, zero ou mais');
    const agora = agoraISO();
    await env.DB.prepare(`INSERT INTO despesas_fixas_meses (id, despesa_id, mes, valor, criado_em, atualizado_em, por)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (despesa_id, mes) DO UPDATE SET valor = excluded.valor,
      atualizado_em = excluded.atualizado_em, por = excluded.por`).bind(novoId('dfm'), acao, mes, valor, agora, agora, ferramenta).run();
    return { mes, valor };
  }
  if (!acao && m === 'GET') {
    h.exigir('despesas_fixas', ferramenta, 'L');
    const [lista, cot] = await Promise.all([despesas(env), cotacao(env).catch(() => null)]);
    return { hoje: hojeBrasilia(), mes: mesAtual(), cotacao: cot, despesas: lista, categorias: CATEGORIAS };
  }
  if (acao === 'lote' && m === 'POST') {
    h.exigir('despesas_fixas', ferramenta, 'E');
    const itens = Array.isArray(corpo?.itens) ? corpo.itens : [];
    if (!itens.length) throw new ErroApi(422, 'nada para acrescentar');
    if (itens.length > 100) throw new ErroApi(422, 'no máximo 100 despesas por vez');
    const criadas = [];
    const erros = [];
    for (const [i, it] of itens.entries()) {
      try { criadas.push((await h.criar(env, ferramenta, 'despesas_fixas', it)).registro); }
      catch (e) { erros.push({ linha: i + 1, erro: e.message }); }
    }
    return { criadas, erros };
  }
  throw new ErroApi(404, 'rota não encontrada');
}
