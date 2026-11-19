// Teste das cláusulas do vendas (migração 0019), sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/clausulas.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';

const DIR = decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname);
const env = { DB: criarD1(DIR) };
const pedir = async (m, caminho, corpo, ferr = 'vendas') => {
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

const l = await chamar('GET', 'vendas-clausulas?grupo=despesa');
ok(l.itens.length === 3 && l.itens[0].id === 'vcl_plotagem', 'três despesas reembolsáveis semeadas, na ordem');
const nova = (await chamar('POST', 'vendas-clausulas', { grupo: 'despesa', texto: 'Cópias autenticadas.', ordem: 4 })).registro;
ok(nova.id.startsWith('vcl_') && nova.padrao === 1, 'vendas cria despesa (marcada por padrão)');
ok((await pedir('POST', 'vendas-clausulas', { grupo: 'despesa', texto: 'x' }, 'projetos')).status === 403, 'Projetos não cria cláusula');

// texto da cláusula de evento: o vendas edita só esse campo
const g = await chamar('GET', 'pgt-eventos/pev_ce_m03'); const ev = g.registro || g;
const ed = (await chamar('PATCH', 'pgt-eventos/pev_ce_m03', { clausula: 'Inclui uma rodada de ajuste do estudo.', versao: ev.versao })).registro;
ok(ed.clausula === 'Inclui uma rodada de ajuste do estudo.', 'vendas edita o texto da cláusula do evento');
ok((await pedir('PATCH', 'pgt-eventos/pev_ce_m03', { nome: 'Outro nome', versao: ed.versao })).status === 403, 'vendas não edita outros campos do evento');

// retrato dos Honorários leva as cláusulas
const pub = await chamar('POST', 'honorarios/publicar', { nota: 'cláusulas' });
const u = await chamar('GET', 'publicacoes/ultima?tipo=honorarios');
ok(u.numero === pub.numero && u.dados.clausulas_eventos.pev_ce_m03 === 'Inclui uma rodada de ajuste do estudo.', 'retrato dos Honorários com o texto do evento');
ok(u.dados.clausulas.filter((c) => c.grupo === 'despesa').length === 4, 'retrato dos Honorários com as despesas');
await chamar('PATCH', `vendas-clausulas/${nova.id}`, { texto: 'Cópias autenticadas de documentos.', versao: nova.versao });
const h = await chamar('GET', 'honorarios');
ok(h.pendente === true, 'mudar uma cláusula deixa os Honorários pendentes de publicação');
console.log('todos os testes das cláusulas passaram');
