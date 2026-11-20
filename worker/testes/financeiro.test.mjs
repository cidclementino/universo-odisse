// Teste do Financeiro › Despesas fixas (migração 0025), sobre SQLite em memória, e das contas da página.
// Rodar: node --no-warnings worker/testes/financeiro.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
import { buscarPtax, cotacao } from '../dados/financeiro.js';
import {
  valorNoMes, custoMensal, previsaoAnual, proximoVencimento, mesesDePagamento, lerValor, interpretarColagem, sugerirCategoria,
} from '../../assets/financeiro-calculo.js';

const DIR = decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname);
const env = { DB: criarD1(DIR) };
const pedir = async (m, caminho, corpo, ferr = 'hub') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  return { status: r.status, j: await r.json() };
};
const chamar = async (m, caminho, corpo, ferr) => {
  const { status, j } = await pedir(m, caminho, corpo, ferr);
  if (status >= 400) throw new Error(`${m} ${caminho} → ${status} ${JSON.stringify(j)}`);
  return j;
};
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const mes = hoje.slice(0, 7);

// ---- API
const q0 = await chamar('GET', 'financeiro/despesas');
ok(q0.despesas.length === 0 && q0.categorias.geral.includes('Espaço') && q0.cotacao === null, 'leitura vazia, com as categorias e sem cotação (sem R2)');
ok((await pedir('GET', 'financeiro/despesas', null, 'vendas')).status === 403, 'vendas não vê o financeiro');
ok((await pedir('POST', 'despesas-fixas', { nome: 'Aluguel', valor: 100000 })).status === 422, 'dia é obrigatório');
ok((await pedir('POST', 'despesas-fixas', { nome: 'X', valor: -1, dia: 5 })).status === 422, 'valor negativo é recusado');

const alug = (await chamar('POST', 'despesas-fixas', { nome: 'Aluguel da sala', valor: 180000, dia: 10, categoria: 'Espaço' })).registro;
ok(alug.periodicidade === 'mensal' && alug.moeda === 'brl' && alug.grupo === 'geral' && alug.mes === null, 'mensal, em reais e geral por padrão');
const cau = (await chamar('POST', 'despesas-fixas', { nome: 'Anuidade CAU PJ', valor: 90000, dia: 31, periodicidade: 'anual' })).registro;
ok(cau.mes === +hoje.slice(5, 7), 'anual sem mês ganha o mês atual');
const sw = (await chamar('POST', 'despesas-fixas', { nome: 'Licença render', valor: 2000, moeda: 'usd', dia: 3 })).registro;
const pl = (await chamar('POST', 'despesas-fixas', { nome: 'Pró-labore', valor: 500000, dia: 5, grupo: 'pessoal', categoria: 'Pró-labore' })).registro;

let q = await chamar('GET', 'financeiro/despesas');
ok(q.despesas.length === 4 && q.despesas.every((d) => d.valores.length === 1 && d.valores[0].desde === mes), 'cada despesa nasce com o valor do mês');

// mudar o valor guarda o valor do mês (sobrescreve no mesmo mês) e o histórico não guarda valores
const a2 = (await chamar('PATCH', `despesas-fixas/${alug.id}`, { versao: alug.versao, valor: 190000 })).registro;
q = await chamar('GET', 'financeiro/despesas');
const vAlug = q.despesas.find((d) => d.id === alug.id).valores;
ok(vAlug.length === 1 && vAlug[0].valor === 190000, 'novo valor no mesmo mês substitui o do mês');
const hist = await chamar('GET', `despesas-fixas/${alug.id}/historico`);
ok(JSON.stringify(hist).includes('"campos"') && !JSON.stringify(hist).includes('190000'), 'histórico guarda só o nome dos campos');
ok((await pedir('PATCH', `despesas-fixas/${alug.id}`, { versao: alug.versao, valor: 1 })).status === 409, 'versão velha dá conflito');
q = await chamar('GET', 'financeiro/despesas');
ok(q.despesas.find((d) => d.id === alug.id).valores[0].valor === 190000, 'conflito não grava o valor');

// periodicidade: mensal limpa o mês; voltar a anual devolve um mês
const c2 = (await chamar('PATCH', `despesas-fixas/${cau.id}`, { versao: cau.versao, periodicidade: 'mensal' })).registro;
ok(c2.mes === null, 'mensal fica sem mês');
const c3 = (await chamar('PATCH', `despesas-fixas/${cau.id}`, { versao: c2.versao, periodicidade: 'semestral' })).registro;
ok(c3.mes === +hoje.slice(5, 7), 'semestral ganha o mês atual');
ok((await pedir('PATCH', `despesas-fixas/${cau.id}`, { versao: c3.versao, inicio: '2026-05-01', fim: '2026-01-01' })).status === 422, 'fim antes do início é recusado');

// encerrar e arquivar
const e1 = (await chamar('PATCH', `despesas-fixas/${sw.id}`, { versao: sw.versao, fim: hoje })).registro;
ok(e1.fim === hoje, 'encerrar grava o fim');
await chamar('POST', `despesas-fixas/${pl.id}/arquivar`, { versao: pl.versao });
q = await chamar('GET', 'financeiro/despesas');
ok(!q.despesas.some((d) => d.id === pl.id), 'arquivada sai da leitura');

// lote
const lote = await chamar('POST', 'financeiro/despesas/lote', { itens: [{ nome: 'Internet', valor: 12000, dia: 15 }, { nome: 'Sem dia', valor: 1 }] });
ok(lote.criadas.length === 1 && lote.erros.length === 1 && lote.erros[0].linha === 2, 'lote cria o que dá e devolve o erro de cada linha');

// cotação: PTAX com resposta de exemplo, guardada no R2 e não relida no mesmo dia
const resp = { value: [{ cotacaoVenda: 5.31, dataHoraCotacao: '2026-11-18 13:09:00.0' }, { cotacaoVenda: 5.4, dataHoraCotacao: '2026-11-19 13:05:00.0' }] };
let chamadas = 0;
const buscar = async () => { chamadas++; return new Response(JSON.stringify(resp), { status: 200 }); };
const pt = await buscarPtax(buscar, '2026-11-20');
ok(pt.valor === 5.4 && pt.data === '2026-11-19', 'PTAX: a cotação mais recente do período');
const guardado = new Map();
const R2 = { get: async (k) => (guardado.has(k) ? { json: async () => JSON.parse(guardado.get(k)) } : null), put: async (k, v) => guardado.set(k, v) };
const c1 = await cotacao({ ARQUIVOS: R2 }, { buscar });
const cB = await cotacao({ ARQUIVOS: R2 }, { buscar });
ok(c1.valor === 5.4 && cB.valor === 5.4 && chamadas === 2, 'cotação lida uma vez por dia');
const falha = async () => new Response('x', { status: 500 });
ok((await cotacao({ ARQUIVOS: R2 }, { buscar: falha, forcar: true })).valor === 5.4, 'falha na leitura mantém a última cotação');

// ---- contas da página
const cot = { valor: 5 };
const d = (o) => ({ grupo: 'geral', moeda: 'brl', periodicidade: 'mensal', dia: 10, mes: null, inicio: null, fim: null, valores: [], ...o });
ok(valorNoMes(d({ valor: 3, valores: [{ desde: '2026-03', valor: 1, moeda: 'brl' }, { desde: '2026-08', valor: 2, moeda: 'brl' }] }), '2026-05').valor === 1, 'valor do mês: o vigente na época');
ok(valorNoMes(d({ valores: [{ desde: '2026-08', valor: 2, moeda: 'brl' }] }), '2026-01').valor === 2, 'antes do primeiro valor vale o primeiro');
ok(mesesDePagamento(d({ periodicidade: 'trimestral', mes: 11 })).join() === '2,5,8,11', 'trimestral a partir de novembro: fev, mai, ago, nov');
const lista = [
  d({ valor: 120000, valores: [{ desde: '2026-01', valor: 120000, moeda: 'brl' }] }),
  d({ valor: 2000, moeda: 'usd', valores: [{ desde: '2026-01', valor: 2000, moeda: 'usd' }], categoria: 'Software' }),
  d({ valor: 120000, periodicidade: 'anual', mes: 3, valores: [{ desde: '2026-01', valor: 120000, moeda: 'brl' }] }),
  d({ valor: 500000, grupo: 'pessoal', valores: [{ desde: '2026-01', valor: 500000, moeda: 'brl' }] }),
  d({ valor: 9999, fim: '2026-01-31', valores: [{ desde: '2026-01', valor: 9999, moeda: 'brl' }] }),
];
const cm = custoMensal(lista, cot, '2026-06-15');
ok(cm.geral === 120000 + 10000 + 10000 && cm.pessoal === 500000 && cm.estimado.geral && !cm.estimado.pessoal, 'custo por mês: anual ÷ 12, dólar convertido e marcado, encerrada fora');
const pv = previsaoAnual(lista, 2026, cot);
ok(pv.meses[2] === 120000 + 10000 + 120000 + 500000 && pv.meses[0] === 120000 + 10000 + 500000 + 9999 && pv.meses[1] === 630000, 'previsão: anual no mês dela, encerrada só até o fim');
ok(pv.total === 12 * 630000 + 120000 + 9999 && pv.estimado && pv.linhas.at(-1).categoria === 'Pessoal', 'previsão: total do ano, com *, Pessoal numa linha no fim');
ok(previsaoAnual(lista, 2026, null).falta, 'sem cotação, avisa que o dólar ficou de fora');
ok(proximoVencimento(d({ dia: 31 }), '2026-02-10') === '2026-02-28', 'dia 31 em fevereiro vence no último dia');
ok(proximoVencimento(d({ periodicidade: 'anual', mes: 3, dia: 5 }), '2026-03-06') === '2027-03-05', 'anual já paga no ano vai para o ano seguinte');
ok(proximoVencimento(d({ fim: '2026-03-01' }), '2026-03-02') === null, 'encerrada não tem próximo vencimento');

ok(lerValor('1.234,56') === 123456 && lerValor('1234.5') === 123450 && lerValor('R$ 1.234') === 123400 && lerValor('1,234.56') === 123456 && lerValor('abc') === null, 'lê valores nos formatos de sempre');
const col = interpretarColagem('Aluguel\t1.800,00\t10\nAdobe\tUS$ 54,99\t3\nlinha ruim');
ok(col.length === 3 && col[0].valor === 180000 && col[0].dia === 10 && col[1].moeda === 'usd' && col[1].valor === 5499 && !col[2].ok, 'colar de planilha: nome, valor, dia e moeda');
ok(sugerirCategoria('Aluguel novo', 'geral') === 'Espaço' && sugerirCategoria('Adobe CC', 'geral') === 'Software e assinaturas' && sugerirCategoria('INSS', 'pessoal') === 'Encargos', 'categoria sugerida por palavra-chave');
ok(sugerirCategoria('Zeta plano', 'geral', [{ nome: 'Zeta antigo', grupo: 'geral', categoria: 'Outros' }]) === 'Outros', 'categoria aprendida da despesa parecida');
console.log('financeiro: tudo certo');
