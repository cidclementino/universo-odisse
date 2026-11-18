// Teste dos documentos do estúdio (carta/ofício, declaração, memorando), sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/documentos.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
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

const assinaturas = [{ nome: 'Cid Clementino', cargo: 'Arquiteto e urbanista', registro: 'CAU [nº]' }];
const c1 = (await chamar('POST', 'documentos', {
  tipo: 'carta', data: '2026-11-17', destinatario: 'Fulano\nCondomínio X', assunto: 'Entrega do estudo preliminar',
  corpo: 'Primeiro parágrafo.\n\nSegundo parágrafo.', assinaturas,
})).registro;
ok(c1.codigo === 'CA-2026-0001' && c1.numero === 1 && c1.ano === 2026, 'carta numerada CA-2026-0001');
ok(c1.modelo === 'coluna' && c1.oficio === 0, 'modelo Coluna por padrão, sem ofício');
ok(JSON.parse(c1.assinaturas)[0].nome === 'Cid Clementino', 'assinaturas guardadas como JSON');

const c2 = (await chamar('POST', 'documentos', { tipo: 'carta', oficio: true, data: '2026-12-01', referencia: 'Processo 123' })).registro;
ok(c2.codigo === 'CA-2026-0002' && c2.oficio === 1, 'ofício usa a mesma sequência da carta');

const d1 = (await chamar('POST', 'documentos', { tipo: 'declaracao', oficio: true, data: '2026-11-18', titulo: 'Declaração' })).registro;
ok(d1.codigo === 'DE-2026-0001' && d1.oficio === 0, 'declaração tem sequência própria e nunca é ofício');

const m1 = (await chamar('POST', 'documentos', { tipo: 'memorando', data: '2027-01-05', modelo: 'ficha' })).registro;
ok(m1.codigo === 'MI-2027-0001' && m1.modelo === 'ficha', 'memorando de 2027 começa do 0001');

const c3 = (await chamar('POST', 'documentos', { tipo: 'carta', data: '2027-02-01' })).registro;
ok(c3.codigo === 'CA-2027-0001', 'a sequência da carta recomeça no ano novo');

const semData = (await chamar('POST', 'documentos', { tipo: 'carta' })).registro;
ok(/^\d{4}-\d{2}-\d{2}$/.test(semData.data) && semData.codigo.startsWith('CA-'), 'sem data, grava a data de hoje');

const alt = (await chamar('PATCH', 'documentos/' + c1.id, { versao: c1.versao, assunto: 'Entrega do estudo preliminar (revisto)', data: '2026-11-20' })).registro;
ok(alt.assunto.endsWith('(revisto)') && alt.codigo === 'CA-2026-0001', 'alterar mantém o número');
ok((await pedir('PATCH', 'documentos/' + c1.id, { versao: alt.versao, data: '2027-01-02' })).status === 409, 'data em outro ano é recusada');
ok((await pedir('PATCH', 'documentos/' + c1.id, { versao: alt.versao, tipo: 'memorando' })).status >= 400, 'tipo não muda');
ok((await pedir('PATCH', 'documentos/' + d1.id, { versao: d1.versao, oficio: true })).j.registro?.oficio === 0, 'declaração continua sem ofício');

const lista = await chamar('GET', 'documentos?tipo=carta');
ok(lista.itens.length === 4 && lista.itens.every((d) => d.tipo === 'carta'), 'lista filtra por tipo');
const busca = await chamar('GET', 'documentos?q=revisto');
ok(busca.itens.length === 1 && busca.itens[0].id === c1.id, 'busca pelo assunto');
ok((await pedir('POST', 'documentos', { tipo: 'carta' }, 'marketing')).status === 403, 'o marketing não emite documentos');
ok((await pedir('GET', 'documentos', null, 'vendas')).status === 200, 'o vendas lê');
console.log('documentos: tudo certo');
