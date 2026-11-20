// Teste do Escopo do Projeto (0023): gerar, duração e mover com a janela de 10 s, suprimir, acrescentar, decisão,
// suspensão, motivo e as horas que passam para a etapa do escopo. Sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/escopo.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const pedir = async (m, caminho, corpo, ferr = 'projetos') => {
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
const falha = async (m, caminho, corpo, ferr) => (await pedir(m, caminho, corpo, ferr)).status;
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

// projeto cadastrado à mão, com uma etapa antiga e horas nela
const eqp = (await chamar('GET', 'equipe/quadro', null, 'hub')).itens?.[0] || (await chamar('GET', 'equipe/quadro?todos=1', null, 'hub')).itens[0];
const prj = (await chamar('POST', 'projetos', { nome: 'Casa Teste', inicio: '2026-11-02', codigo: 'OA-2025-031',
  etapas: [{ nome: 'Concepção Esquemática', ref_vendas: 'pet_ce', semanas: 2 }] })).registro;
const fic = await chamar('GET', 'producao/projetos/' + prj.id);
const h = (await chamar('POST', 'horas', { equipe_id: eqp.id, projeto_id: prj.id, etapa_id: fic.etapas[0].id, data: '2026-11-03', minutos: 120 })).registro;

ok((await chamar('GET', 'escopo/' + prj.id)).cartoes.length === 0, 'projeto sem escopo');
const cartoes = [
  { ref: 'e1', tipo: 'etapa', origem_id: 'pet_ce', sigla: 'CE', texto: 'Concepção Esquemática', fase_id: 'pfa_conceitual', fase_nome: 'Conceitual' },
  { ref: 'a', tipo: 'entrega', etapa_ref: 'e1', origem_id: 'pen_ce_01', codigo: 'CE-01', texto: 'Estudo de massa', dias: 3 },
  { ref: 'b', tipo: 'entrega', etapa_ref: 'e1', origem_id: 'pen_ce_02', codigo: 'CE-02', texto: 'Plantas esquemáticas', dias: 4, junto_anterior: 1 },
  { ref: 'd', tipo: 'evento', etapa_ref: 'e1', origem_id: 'pev_ce_m03', codigo: 'CE-M03', texto: 'Aprovação do cliente', tempo: 'cliente', cliente: 1, dias: 3,
    decisao: [{ id: 'aprovado', nome: 'Aprovada', libera: [] }, { id: 'segunda', nome: 'Segunda rodada', libera: ['r'] }] },
  { ref: 'r', tipo: 'evento', etapa_ref: 'e1', origem_id: 'pev_ce_m04', codigo: 'CE-M04', texto: 'Segunda rodada de ajustes', tempo: 'estudio', dias: 2, liberado_por_ref: 'd' },
];
ok(await falha('POST', `escopo/${prj.id}/gerar`, { inicio: '2026-11-02', cartoes }, 'vendas') === 403, 'vendas não gera escopo');
let E = await chamar('POST', `escopo/${prj.id}/gerar`, { inicio: '2026-11-02', origem: { pgt_versao: 6 }, cartoes });
const id = (cod) => E.cartoes.find((c) => c.codigo === cod || c.sigla === cod && c.tipo === 'etapa').id;
ok(E.cartoes.length === 5 && E.projeto.escopo_inicio === '2026-11-02' && E.cartoes[1].dias_contratados === 3, 'escopo gerado com 5 cartões e o início');
ok(E.cartoes.find((c) => c.codigo === 'CE-M04').liberado_por === id('CE-M03') && E.cartoes.find((c) => c.codigo === 'CE-M03').decisao[1].libera[0] === id('CE-M04'),
  'decisão aponta para os cartões do escopo');
ok(E.alteracoes.length === 1 && E.alteracoes[0].tipo === 'inicio', 'registro: escopo gerado');
ok(await falha('POST', `escopo/${prj.id}/gerar`, { inicio: '2026-11-02', cartoes }) === 409, 'segundo gerar → 409');
const hh = await env.DB.prepare('SELECT cartao_id FROM horas WHERE id = ?').bind(h.id).first();
ok(hh.cartao_id === id('CE'), 'horas da etapa antiga passaram para a etapa do escopo');

// duração: três cliques seguidos viram uma alteração só (+3)
const acao = (corpo) => chamar('POST', `escopo/${prj.id}/acao`, corpo);
for (let i = 0; i < 3; i++) E = await acao({ acao: 'duracao', cartao_id: id('CE-01'), dias: 1 });
ok(E.cartoes.find((c) => c.codigo === 'CE-01').dias === 6, 'duração estendida para 6 dias');
let dur = E.alteracoes.filter((a) => a.tipo === 'duracao');
ok(dur.length === 1 && dur[0].dias === 3 && dur[0].antes === 3 && dur[0].depois === 6 && dur[0].natureza === 'prazo', 'três cliques = uma alteração de +3 dias');
// mexer em outro cartão fecha a janela
E = await acao({ acao: 'mover', cartao_id: id('CE-02'), dias: 2 });
E = await acao({ acao: 'duracao', cartao_id: id('CE-01'), dias: -1 });
dur = E.alteracoes.filter((a) => a.tipo === 'duracao');
ok(dur.length === 2 && dur[0].dias === -1, 'depois de mexer em outro cartão, nova alteração (−1)');
ok(E.cartoes.find((c) => c.codigo === 'CE-02').folga === 2 && E.alteracoes.find((a) => a.tipo === 'mover').dias === 2, 'mover: folga de 2 dias (hiato), registrada');
// janela de 10 s vencida
await env.DB.prepare("UPDATE escopo_alteracoes SET atualizado_em = '2026-01-01T00:00:00.000Z' WHERE tipo = 'duracao'").run();
E = await acao({ acao: 'duracao', cartao_id: id('CE-01'), dias: 1 });
ok(E.alteracoes.filter((a) => a.tipo === 'duracao').length === 3, 'passados 10 s, outra alteração');
ok(await falha('POST', `escopo/${prj.id}/acao`, { acao: 'duracao', cartao_id: id('CE-01'), para: 0 }) === 422, 'duração mínima de 1 dia');

// suprimir, restaurar e acrescentar: potencial aditivo, motivo opcional preenchido depois
E = await acao({ acao: 'suprimir', cartao_id: id('CE-02') });
ok(E.cartoes.find((c) => c.codigo === 'CE-02').suprimido_em && E.alteracoes[0].tipo === 'suprimir' && E.alteracoes[0].natureza === 'aditivo' && !E.alteracoes[0].motivo,
  'suprimir: registrado como potencial aditivo, sem motivo');
E = await acao({ acao: 'motivo', alteracao_id: E.alteracoes[0].id, motivo: 'O cliente já tinha o levantamento' });
ok(E.alteracoes.find((a) => a.tipo === 'suprimir').motivo === 'O cliente já tinha o levantamento', 'motivo preenchido depois');
E = await acao({ acao: 'acrescentar', depois_de: id('CE-01'), tipo: 'entrega', texto: 'Estudo de insolação', dias: 2, motivo: 'Pedido do cliente' });
const novo = E.cartoes.find((c) => c.texto === 'Estudo de insolação');
const ordem = E.cartoes.map((c) => c.texto);
ok(novo.adicionado === 1 && novo.etapa_id === id('CE') && ordem.indexOf('Estudo de insolação') === ordem.indexOf('Estudo de massa') + 1, 'acrescentado logo depois de CE-01, na mesma etapa');
ok(E.alteracoes[0].tipo === 'acrescentar' && E.alteracoes[0].natureza === 'aditivo' && E.alteracoes[0].motivo === 'Pedido do cliente', 'acrescentar: potencial aditivo');
// acrescentar um cartão do PGT que não foi contratado: entra com a origem e o código; não entra duas vezes
E = await acao({ acao: 'acrescentar', depois_de: id('CE-01'), tipo: 'evento', texto: 'Visita extra', dias: 1, tempo: 'pontual', cliente: 1,
  origem_id: 'pev_teste_extra', codigo: 'CE-M09', evento_tipo: 'visita' });
const doPgt = E.cartoes.find((c) => c.origem_id === 'pev_teste_extra');
ok(doPgt && doPgt.codigo === 'CE-M09' && doPgt.cliente === 1 && doPgt.adicionado === 1 && doPgt.evento_tipo === 'visita'
  && E.alteracoes[0].descricao.startsWith('CE-M09'), 'acrescentar do PGT: código, origem e cliente');
ok(await falha('POST', `escopo/${prj.id}/acao`, { acao: 'acrescentar', depois_de: id('CE-01'), tipo: 'evento', texto: 'Visita extra', origem_id: 'pev_teste_extra' }) === 409,
  'o mesmo cartão do PGT duas vezes → 409');

// decisão: a segunda rodada é extra previsto; o caminho esperado não registra
E = await acao({ acao: 'decisao', cartao_id: id('CE-M03'), resultado: 'aprovado' });
ok(E.cartoes.find((c) => c.codigo === 'CE-M03').decisao_resultado === 'aprovado' && !E.alteracoes.some((a) => a.tipo === 'decisao'), 'aprovada: nada no registro');
E = await acao({ acao: 'decisao', cartao_id: id('CE-M03'), resultado: 'segunda' });
const dec = E.alteracoes.find((a) => a.tipo === 'decisao');
ok(dec && dec.natureza === 'extra' && dec.dias === 2 && dec.descricao.includes('CE-M04'), 'segunda rodada: extra previsto, com os dias liberados');

// suspensão
E = await acao({ acao: 'suspender', de: '2026-11-23' });
ok(E.projeto.situacao === 'pausado' && E.projeto.suspensoes.length === 1 && !E.projeto.suspensoes[0].ate, 'projeto suspenso');
ok(await falha('POST', `escopo/${prj.id}/acao`, { acao: 'suspender', de: '2026-11-24' }) === 409, 'suspender de novo → 409');
E = await acao({ acao: 'retomar', ate: '2026-12-07' });
ok(E.projeto.situacao === 'ativo' && E.projeto.suspensoes[0].ate === '2026-12-07' && E.alteracoes[0].dias === 10, 'retomado: 10 dias úteis suspenso');

// horas na etapa do escopo; de outro projeto → recusa
const h2 = (await chamar('POST', 'horas', { equipe_id: eqp.id, projeto_id: prj.id, cartao_id: id('CE'), data: '2026-11-04', minutos: 60 })).registro;
ok(h2.cartao_id === id('CE'), 'hora lançada na etapa do escopo');
const outro = (await chamar('POST', 'projetos', { nome: 'Outro', inicio: '2026-11-02' })).registro;
ok(await falha('POST', 'horas', { equipe_id: eqp.id, projeto_id: outro.id, cartao_id: id('CE'), data: '2026-11-04', minutos: 60 }) >= 400, 'etapa do escopo de outro projeto → recusa');
ok((await chamar('GET', 'escopo/' + prj.id, null, 'vendas')).cartoes.length === 7, 'vendas lê o escopo');
console.log('TUDO CERTO');
