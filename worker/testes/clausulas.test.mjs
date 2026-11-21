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
ok(l.itens.length === 4 && l.itens[0].id === 'vcl_plotagem' && l.itens[3].id === 'vcl_rrt', 'quatro despesas reembolsáveis semeadas, na ordem (RRT por último, 0027)');
const nova = (await chamar('POST', 'vendas-clausulas', { grupo: 'despesa', texto: 'Cópias autenticadas.', ordem: 5 })).registro;
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
ok(u.dados.clausulas.filter((c) => c.grupo === 'despesa').length === 5, 'retrato dos Honorários com as despesas');
await chamar('PATCH', `vendas-clausulas/${nova.id}`, { texto: 'Cópias autenticadas de documentos.', versao: nova.versao });
// marca no PGT, texto no vendas: marcado sem texto = a redigir (fora do retrato)
const g2 = await chamar('GET', 'pgt-eventos/pev_ce_m01'); const e1 = g2.registro || g2;
ok(e1.clausula_marcada === 0, 'evento sem cláusula começa desmarcado');
await chamar('PATCH', 'pgt-eventos/pev_ce_m01', { clausula_marcada: 1, versao: e1.versao }, 'projetos');
const pg = await chamar('GET', 'pgt', null, 'projetos');
ok(pg.eventos.find((v) => v.id === 'pev_ce_m01').clausula_marcada === 1 && !('clausula' in pg.eventos[0]), 'PGT marca a cláusula e não mostra o texto');
ok((await pedir('PATCH', 'pgt-eventos/pev_ce_m01', { clausula_marcada: 0, versao: e1.versao + 1 })).status === 403, 'vendas não muda a marca');
const h = await chamar('GET', 'honorarios');
ok(!('pev_ce_m01' in h.clausulas_eventos) && h.clausulas_eventos.pev_ce_m03, 'cláusula a redigir fica fora; as redigidas vêm na página dos Honorários');
ok(h.pendente === true, 'mudar uma cláusula deixa os Honorários pendentes de publicação');

// 0027: cláusulas gerais do contrato (15 seções) e dados bancários da Empresa
const gerais = (await chamar('GET', 'vendas-clausulas?grupo=geral&limite=200')).itens;
ok(gerais.length === 55 && gerais.every((c) => c.secao >= 1 && c.secao <= 15 && c.titulo), '55 cláusulas gerais semeadas, cada uma com seção e nome');
ok(new Set(gerais.map((c) => c.secao)).size === 15, 'todas as 15 seções têm cláusula geral');
ok(gerais.filter((c) => c.tipo === 'fixa').every((c) => c.padrao === 1), 'cláusula fixa sempre marcada');
ok(gerais.find((c) => c.id === 'vcl_c06_05').padrao === 0, 'reajuste entra desmarcado');
ok(gerais.filter((c) => c.condicao === 'projeto_legal').length === 2, 'duas cláusulas só com Projeto Legal');
ok((await chamar('GET', 'vendas-clausulas?grupo=despesa')).itens.some((c) => c.id === 'vcl_rrt'), 'RRT vira despesa reembolsável');
const cg = (await chamar('POST', 'vendas-clausulas', { grupo: 'geral', secao: 12, titulo: 'Teste', tipo: 'fixa', texto: 'Texto de teste.', ordem: 1299 })).registro;
ok(cg.secao === 12 && cg.tipo === 'fixa', 'vendas cria cláusula geral numa seção');
ok((await pedir('POST', 'vendas-clausulas', { grupo: 'geral', secao: 16, texto: 'x' })).status === 422, 'seção fora de 1–15 recusada');
ok((await pedir('POST', 'vendas-clausulas', { grupo: 'geral', secao: 3, texto: 'x', condicao: 'outra' })).status === 422, 'condição fora da lista recusada');
const ret = await chamar('GET', 'honorarios');
ok(ret.pendente === true, 'cláusula geral nova deixa os Honorários pendentes');
await chamar('POST', 'honorarios/publicar', { nota: 'gerais' });
const u2 = await chamar('GET', 'publicacoes/ultima?tipo=honorarios');
ok(u2.dados.clausulas.find((c) => c.id === 'vcl_c15_02')?.secao === 15, 'retrato dos Honorários leva as cláusulas gerais com a seção');
const emp = await chamar('GET', 'empresa/emp_odisse', null, 'hub'); const er = emp.registro || emp;
const e2 = (await chamar('PATCH', 'empresa/emp_odisse', { banco: 'BS2 (218)', agencia: '0001', conta: '632055-4', pix: '38.440.925/0001-26', versao: er.versao }, 'hub')).registro;
ok(e2.pix === '38.440.925/0001-26', 'hub grava os dados bancários da Empresa');
const ev2 = await chamar('GET', 'empresa/emp_odisse', null, 'vendas'); ok((ev2.registro || ev2).conta === '632055-4', 'vendas lê os dados bancários');
const em = await chamar('GET', 'empresa/emp_odisse', null, 'marketing'); const emr = em.registro || em;
ok(!('conta' in emr) && !('pix' in emr) && emr.nome, 'marketing não enxerga os dados bancários');
console.log('todos os testes das cláusulas passaram');
