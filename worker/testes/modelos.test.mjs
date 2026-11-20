// Teste dos padrões de material (0024): criar, ligar a vários cartões, mudar em um lugar e valer em todos,
// campos conferidos, arquivar o padrão tira as ligações do retrato. Sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/modelos.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const pedir = async (m, caminho, corpo, ferr = 'projetos') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  return { status: r.status, j: await r.json() };
};
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const campos = [{ id: 'c1', tipo: 'secao', rotulo: 'Identificação' }, { id: 'c2', tipo: 'automatico', fonte: 'projeto', rotulo: 'Projeto' },
  { id: 'c3', tipo: 'tabela', rotulo: 'Decisões', colunas: ['Assunto', 'Decisão'], linhas: 3 }, { id: 'c4', tipo: 'assinatura', rotulo: 'Cliente' }];
let r = await pedir('POST', 'pgt-modelos', { nome: 'Ata de reunião', campos });
ok(r.status === 201 || r.status === 200, 'padrão criado');
const mod = r.j.registro;
ok(mod.folha === 'ficha' && mod.tipo === 'formulario' && mod.prova === 1, 'padrões da tabela (ficha, formulário, vira prova)');
ok((await pedir('POST', 'pgt-modelos', { nome: 'X', campos: [{ id: 'a', tipo: 'nada' }] })).status === 422, 'campo de tipo desconhecido → 422');
ok((await pedir('POST', 'pgt-modelos', { nome: 'X', campos: [{ id: 'a', tipo: 'texto' }, { id: 'a', tipo: 'texto' }] })).status === 422, 'id repetido → 422');
// ligar a dois cartões de fases diferentes
for (const alvo of ['pev_lv_m01', 'pen_lv_01']) {
  const x = await pedir('POST', 'pgt-materiais', { alvo_id: alvo, modelo_id: mod.id, tipo: 'formulario', nome: mod.nome });
  ok(x.status < 300, 'ligado a ' + alvo);
}
let P = (await pedir('GET', 'pgt')).j;
ok(P.modelos.length === 1 && P.modelos[0].campos.length === 4, 'o PGT traz o padrão com os campos');
ok(P.materiais.filter((m) => m.modelo_id === mod.id).length === 2, 'duas ligações');
// mudar o padrão vale para todos
await pedir('PATCH', 'pgt-modelos/' + mod.id, { versao: mod.versao, nome: 'Ata de reunião com o cliente', folha: 'coluna' });
P = (await pedir('GET', 'pgt')).j;
ok(P.modelos[0].nome === 'Ata de reunião com o cliente' && P.modelos[0].folha === 'coluna', 'mudou no padrão');
// arquivar o padrão tira as ligações
const v = P.modelos[0].versao;
r = await pedir('POST', `pgt-modelos/${mod.id}/arquivar`, { versao: v });
if (r.status >= 300) r = await pedir('DELETE', `pgt-modelos/${mod.id}`, { versao: v });
P = (await pedir('GET', 'pgt')).j;
ok(!P.modelos.length && !P.materiais.some((m) => m.modelo_id === mod.id), 'padrão arquivado: some com as ligações');
ok(P.arquivados.some((a) => a.tipo === 'padrao'), 'aparece nos arquivados como padrão');
console.log('TUDO CERTO');
