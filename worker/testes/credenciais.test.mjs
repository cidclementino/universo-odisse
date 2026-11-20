// Teste das Credenciais (migração 0021), sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/credenciais.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
import { vencidas } from '../dados/credenciais.js';
import { inicio } from '../inicio.js';

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
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

// quadro vazio, com o catálogo
const q0 = await chamar('GET', 'credenciais/quadro');
ok(q0.catalogo.length > 25 && q0.lugares.regularidade.pagina === 'credenciais' && q0.itens.length === 0, 'quadro traz catálogo e lugares, sem itens');
ok((await pedir('GET', 'credenciais/quadro', null, 'vendas')).status === 403, 'vendas não vê as credenciais');

// regras do catálogo
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'xyz' })).status === 422, 'tipo fora do catálogo é recusado');
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cnd_federal' })).status === 422, 'certidão que vence exige a validade');
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cau_pf', vence_em: dia(30) })).status === 422, 'documento da equipe não vai para a empresa');
const cs = (await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'contrato_social', vence_em: dia(10) })).registro;
ok(cs.vence_em === null, 'documento sem validade ignora a data');
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'contrato_social' })).status === 409, 'documento único não entra duas vezes');
await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'balanco', titulo: '2024' });
await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'balanco', titulo: '2025' });
ok(true, 'balanço aceita vários (um por exercício)');

// vencida → aviso; editar a validade é recusado; substituir tira o aviso
const velha = (await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cnd_federal', emitido_em: dia(-200), vence_em: dia(-2), numero: 'A1' })).registro;
const emDia = (await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cndt', vence_em: dia(10) })).registro;
const v1 = await vencidas(env);
ok(v1.length === 1 && v1[0].id === velha.id && v1[0].pagina === 'credenciais', 'vencida aparece nas vencidas, com a página onde mora');
const q1 = await chamar('GET', 'credenciais/quadro');
ok(q1.itens.find((i) => i.id === velha.id).estado === 'vencido' && q1.itens.find((i) => i.id === emDia.id).estado === 'vence', 'estados: vencido e vence em breve');
ok((await pedir('PATCH', `credenciais/${velha.id}`, { versao: velha.versao, vence_em: dia(90) })).status === 422, 'validade de documento vencido não se edita');
const nomeEd = (await chamar('PATCH', `credenciais/${velha.id}`, { versao: velha.versao, observacao: 'pedir na Receita' })).registro;
ok(nomeEd.observacao === 'pedir na Receita', 'outros campos do vencido podem mudar');
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cnd_federal', substitui_id: velha.id, vence_em: dia(-1) })).status === 422, 'substituto já vencido é recusado');
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cndt', substitui_id: velha.id, vence_em: dia(90) })).status === 422, 'substituto de outro tipo é recusado');

// arquivo do documento: passa a ser do documento
const arq = (await chamar('POST', 'arquivos', { nome_original: 'cnd.pdf', tipo_mime: 'application/pdf', categoria: 'outro' })).registro;
const nova = (await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cnd_federal', substitui_id: velha.id, vence_em: dia(170), arquivo_id: arq.id })).registro;
ok(nova.titulo === velha.titulo, 'substituto herda o detalhe');
const ant = (await chamar('GET', `credenciais/${velha.id}`)).registro;
ok(!!ant.arquivado_em, 'substituir arquiva o anterior no mesmo lote');
ok((await vencidas(env)).length === 0, 'aviso sai com a substituição');
ok((await chamar('GET', `arquivos/${arq.id}`)).registro.dono_id === nova.id, 'arquivo enviado fica com o documento');
ok((await pedir('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'cnd_federal', substitui_id: velha.id, vence_em: dia(100) })).status === 409, 'não se substitui duas vezes o mesmo documento');

// equipe: documentos da pessoa; desligada não gera aviso
const pes = (await chamar('POST', 'producao/equipe', { nome: 'Ana Teste', email: 'ana@x.com', papel: 'arquiteto' })).registro;
const cau = (await chamar('POST', 'credenciais', { dono_id: pes.id, tipo: 'cau_pf', vence_em: dia(-5) })).registro;
const v2 = await vencidas(env);
ok(v2.length === 1 && v2[0].dono_nome === 'Ana Teste' && v2[0].pagina === 'equipe', 'certidão vencida da equipe com o nome da pessoa');
const e = (await chamar('GET', `equipe/${pes.id}`)).registro;
await chamar('PATCH', `equipe/${pes.id}`, { versao: e.versao, ativo: 0, ate: dia(0) });
ok((await vencidas(env)).length === 0, 'pessoa desligada não gera aviso');

// Início traz as vencidas
await chamar('POST', `credenciais/${cau.id}/arquivar`, { versao: cau.versao });
const alv = (await chamar('POST', 'credenciais', { dono_id: 'emp_odisse', tipo: 'alvara', vence_em: dia(-1) })).registro;
const ini = await inicio(env);
ok(ini.credenciais.itens.length === 1 && ini.credenciais.itens[0].id === alv.id && ini.credenciais.itens[0].pagina === 'empresa', 'Início traz o alvará vencido, que mora na Empresa');

// empresa: campos novos
const emp = (await chamar('GET', 'empresa/emp_odisse')).registro;
const emp2 = (await chamar('PATCH', 'empresa/emp_odisse', { versao: emp.versao, capital_social: 1000000, inscricao_estadual: 'isento' })).registro;
ok(emp2.capital_social === 1000000 && emp2.inscricao_estadual === 'isento', 'empresa com capital social e inscrição estadual');
console.log('todos os testes das credenciais passaram');
