// Teste das rotas de contatos e co-clientes, sobre SQLite em memória (node:sqlite, Node 22+).
// Rodar: node --no-warnings worker/testes/contatos.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const chamar = async (m, caminho, corpo, ferr = 'vendas') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  const j = await r.json();
  if (r.status >= 400) throw new Error(`${m} ${caminho} → ${r.status} ${JSON.stringify(j)}`);
  return j;
};
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

const ana = (await chamar('POST', 'pessoas', { nome: 'Ana Lins', email: 'ana@x.com', whatsapp: '83999990001' })).registro;
const raf = (await chamar('POST', 'pessoas', { nome: 'Rafael Lins', whatsapp: '83999990002' })).registro;
const org = (await chamar('POST', 'organizacoes', { nome: 'Lins Engenharia', cidade: 'João Pessoa', uf: 'PB' })).registro;
await chamar('POST', 'atuacoes', { pessoa_id: raf.id, organizacao_id: org.id, papel: 'socio', cargo: 'Diretor' });
const opo = (await chamar('POST', 'oportunidades', { titulo: 'Casa Jacumã', cliente_id: ana.id, contato_pessoa_id: ana.id })).registro;
await chamar('POST', 'vinculos', { de_id: opo.id, para_id: raf.id, papel: 'cliente' });
const opo2 = (await chamar('POST', 'oportunidades', { titulo: 'Sede Lins', cliente_id: org.id, contato_pessoa_id: raf.id, etapa_funil: 'ganha' })).registro;
await chamar('POST', 'interacoes', { sobre_id: opo.id, pessoa_id: raf.id, tipo: 'ligacao', data: '2026-11-10', proxima_acao: 'mandar proposta' });

const lista = await chamar('GET', 'comercial/contatos');
ok(lista.pessoas.length === 2 && lista.organizacoes.length === 1, 'lista traz 2 pessoas e 1 organização');
const r = lista.pessoas.find((p) => p.id === raf.id);
ok(r.ligacoes[0].nome === 'Lins Engenharia' && r.ligacoes[0].papel === 'socio', 'pessoa mostra a organização e o papel');
ok(r.n_oportunidades === 2 && r.n_abertas === 1, `Rafael: 2 oportunidades (co-cliente + contato), 1 aberta (${r.n_oportunidades}/${r.n_abertas})`);
const o = lista.organizacoes[0];
ok(o.ligacoes[0].nome === 'Rafael Lins' && o.n_oportunidades === 1 && o.n_abertas === 0, 'organização mostra a pessoa e a oportunidade ganha');

const f = await chamar('GET', 'comercial/contatos/' + raf.id);
ok(f.registro.nome === 'Rafael Lins', 'ficha traz o registro');
ok(f.atuacoes.length === 1 && f.atuacoes[0].organizacao_nome === 'Lins Engenharia', 'ficha traz a atuação com nome da organização');
const papeis = Object.fromEntries(f.oportunidades.map((x) => [x.titulo, x.papel]));
ok(papeis['Casa Jacumã'] === 'cocliente' && papeis['Sede Lins'] === 'contato', 'papéis: co-cliente e contato ' + JSON.stringify(papeis));
ok(f.oportunidades[0].titulo === 'Casa Jacumã', 'abertas antes das fechadas');
ok(f.interacoes.length === 1 && f.interacoes[0].oportunidade_titulo === 'Casa Jacumã', 'interação com o título da oportunidade');
const fo = await chamar('GET', 'comercial/contatos/' + org.id);
ok(fo.atuacoes[0].pessoa_nome === 'Rafael Lins' && fo.oportunidades[0].papel === 'titular', 'ficha da organização');

const painel = await chamar('GET', 'comercial/painel');
const pj = painel.itens.find((x) => x.id === opo.id);
ok(JSON.stringify(pj.coclientes) === '["Rafael Lins"]', 'painel traz os co-clientes');
ok(painel.itens.find((x) => x.id === opo2.id).coclientes.length === 0, 'sem co-clientes = lista vazia');

// arquivados e permissões
await chamar('POST', `pessoas/${ana.id}/arquivar`, { versao: ana.versao });
ok((await chamar('GET', 'comercial/contatos')).pessoas.length === 1, 'arquivada sai da lista');
ok((await chamar('GET', 'comercial/contatos?arquivados=1')).pessoas.length === 2, '?arquivados=1 inclui');
let negado = false; try { await chamar('GET', 'comercial/contatos', null, 'marketing'); } catch (e) { negado = /403/.test(e.message); }
ok(negado, 'marketing não lê a lista de contatos');
let nf = false; try { await chamar('GET', 'comercial/contatos/opo_123'); } catch (e) { nf = /404/.test(e.message); }
ok(nf, 'id que não é contato → 404');
// vínculo repetido
let dup = false; try { await chamar('POST', 'vinculos', { de_id: opo.id, para_id: raf.id, papel: 'cliente' }); } catch (e) { dup = /409|UNIQUE|constraint/i.test(e.message); console.log('   repetido →', e.message.slice(0, 120)); }
ok(dup, 'vínculo repetido é recusado');
console.log('TUDO CERTO');
