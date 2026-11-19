// Teste dos textos das ferramentas (0017): o hub grava a descrição editada no lápis da página Ferramentas.
// Rodar: node --no-warnings worker/testes/ferramentas.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';

const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const pedir = async (m, caminho, corpo, ferr = 'hub') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  return { status: r.status, j: await r.json().catch(() => null) };
};
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

let r = await pedir('GET', 'ferramentas-textos');
ok(r.status === 200 && r.j.itens.length === 0, 'começa vazio: valem as descrições do ferramentas.json');

r = await pedir('POST', 'ferramentas-textos', { chave: 'funil', descricao: '  Oportunidades do pedido ao contrato  ' });
ok(r.status < 300 && r.j.registro.descricao === 'Oportunidades do pedido ao contrato' && r.j.registro.id.startsWith('frt_'), 'cria a descrição editada');
const reg = r.j.registro;

r = await pedir('POST', 'ferramentas-textos', { chave: 'funil', descricao: 'outra' });
ok(r.status === 409, 'uma descrição por ferramenta');

r = await pedir('PATCH', 'ferramentas-textos/' + reg.id, { versao: reg.versao, descricao: 'Acompanha as oportunidades' });
ok(r.status === 200 && r.j.registro.descricao === 'Acompanha as oportunidades' && r.j.registro.versao === reg.versao + 1, 'edita com a versão');

r = await pedir('PATCH', 'ferramentas-textos/' + reg.id, { versao: reg.versao, descricao: 'velha' });
ok(r.status === 409, 'versão antiga dá conflito');

r = await pedir('POST', 'ferramentas-textos', { chave: 'radar', descricao: 'x'.repeat(121) });
ok(r.status === 422, 'descrição com no máximo 120 caracteres');

r = await pedir('GET', 'ferramentas-textos', null, 'vendas');
ok(r.status === 403 || r.status === 404, 'só o hub vê');
