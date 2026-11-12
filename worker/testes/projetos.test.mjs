// Teste de projetos, etapas, horas e da assinatura do contrato (que cria o projeto), sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/projetos.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const pedir = async (m, caminho, corpo, ferr = 'vendas') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  return { status: r.status, j: await r.json() };
};
const chamar = async (m, caminho, corpo, ferr = 'vendas') => {
  const { status, j } = await pedir(m, caminho, corpo, ferr);
  if (status >= 400) throw new Error(`${m} ${caminho} → ${status} ${JSON.stringify(j)}`);
  return j;
};
const falha = async (m, caminho, corpo, ferr) => (await pedir(m, caminho, corpo, ferr)).status;
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

// comercial de base: cliente com co-cliente, oportunidade e proposta
await chamar('POST', 'propostas/numeracao', { minimo: 10 });
const ana = (await chamar('POST', 'pessoas', { nome: 'Ana Lins', email: 'ana@x.com' })).registro;
const raf = (await chamar('POST', 'pessoas', { nome: 'Rafael Lins' })).registro;
const opo = (await chamar('POST', 'oportunidades', { titulo: 'Casa Jacumã', cliente_id: ana.id, nucleo_id: 'arquitetos', etapa_funil: 'negociacao' })).registro;
await chamar('POST', 'vinculos', { de_id: opo.id, para_id: raf.id, papel: 'cliente' });
const ppt = (await chamar('POST', 'propostas', { oportunidade_id: opo.id, titulo: 'Projeto Residencial', valor_total: 4500000, situacao: 'enviada' })).registro;

// assinar já na criação do contrato
const projetoDados = {
  nome: 'Casa Jacumã', inicio: '2026-11-16', tipologia: 'Residência unifamiliar', area_m2: 220, bairro: 'Jacumã', cidade: 'Conde', uf: 'PB',
  etapas: [
    { nome: 'Programação Projetual', fase: 'Projeto Conceitual', ref_vendas: 'programacao_projetual', semanas: 2 },
    { nome: 'Concepção Básica', fase: 'Projeto Conceitual', ref_vendas: 'concepcao_basica', semanas: 3 },
  ],
  local: { logradouro: 'Rua das Ostras', numero: '10', cep: '58322-000' },
};
const ctr = (await chamar('POST', 'contratos', { proposta_id: ppt.id, situacao: 'assinado', assinado_em: '2026-11-12', projeto: projetoDados })).registro;
ok(ctr.projeto_id && ctr.projeto_id.startsWith('prj_'), 'contrato assinado ganhou projeto ' + ctr.projeto_id);
ok(ctr.valor_total === 4500000, 'valor do contrato veio da proposta');
const prj = (await chamar('GET', 'projetos/' + ctr.projeto_id)).registro;
ok(prj.codigo === 'OA-2026-052', 'código continua do 051: ' + prj.codigo);
ok(prj.cliente_id === ana.id && prj.oportunidade_id === opo.id && prj.contrato_id === ctr.id, 'projeto com cliente, oportunidade e contrato');
ok(prj.previsao_fim === '2026-12-21', 'previsão de fim = início + 5 semanas: ' + prj.previsao_fim);
const ficha = await chamar('GET', 'producao/projetos/' + prj.id);
ok(ficha.etapas.length === 2 && ficha.etapas[1].inicio_previsto === '2026-11-30' && ficha.etapas[1].fim_previsto === '2026-12-21', 'etapas com prazos encadeados');
ok(ficha.local.logradouro === 'Rua das Ostras' && ficha.local.cep === '58322000', 'local do imóvel gravado');
ok(ficha.coclientes.length === 1 && ficha.coclientes[0].nome === 'Rafael Lins', 'co-cliente copiado da oportunidade');
ok(ficha.contratos.length === 1 && ficha.contratos[0].codigo === ctr.codigo, 'ficha traz o contrato');
ok((await chamar('GET', 'propostas/' + ppt.id)).registro.situacao === 'aceita', 'proposta virou aceita');
const opoDepois = (await chamar('GET', 'oportunidades/' + opo.id)).registro;
ok(opoDepois.etapa_funil === 'ganha' && opoDepois.fechada_em, 'oportunidade virou ganha');
const painelCom = await chamar('GET', 'comercial/painel');
ok(painelCom.itens.find((x) => x.id === opo.id).projeto.codigo === 'OA-2026-052', 'funil mostra o projeto da oportunidade');
const marketingLe = (await chamar('GET', 'producao/projetos/' + prj.id, null, 'hub')).local === undefined;
ok(marketingLe, 'hub lê a ficha sem o local');
ok(await falha('GET', 'producao/painel', null, 'marketing') === 403, 'marketing não lê o painel (tem clientes)');

// contrato em rascunho assinado depois (PATCH), na mesma oportunidade de uma proposta nova
const opo2 = (await chamar('POST', 'oportunidades', { titulo: 'Sala Lins', cliente_id: raf.id })).registro;
const ppt2 = (await chamar('POST', 'propostas', { oportunidade_id: opo2.id, titulo: 'Interiores', valor_total: 900000 })).registro;
const c2 = (await chamar('POST', 'contratos', { proposta_id: ppt2.id })).registro;
ok(!c2.projeto_id && c2.situacao === 'rascunho', 'contrato em rascunho não cria projeto');
const c2b = (await chamar('PATCH', 'contratos/' + c2.id, { versao: c2.versao, situacao: 'assinado', projeto: { etapas: [{ nome: 'Estudo', semanas: 1 }] } })).registro;
const prj2 = (await chamar('GET', 'projetos/' + c2b.projeto_id)).registro;
ok(prj2.codigo === 'OA-2026-053' && prj2.nome === 'Sala Lins' && c2b.assinado_em, 'PATCH para assinado cria o projeto OA-2026-053 com nome da oportunidade');
ok(await falha('PATCH', 'contratos/' + c2.id, { versao: c2.versao, situacao: 'assinado' }) === 409, 'versão velha → 409, sem projeto duplicado');
ok((await chamar('GET', 'projetos?oportunidade_id=' + opo2.id, null, 'projetos')).itens.length === 1, 'continua um projeto só');

// simulação não vira contrato
const sim = (await chamar('POST', 'propostas', { simulacao: 1, titulo: 'teste' })).registro;
ok(await falha('POST', 'contratos', { proposta_id: sim.id, situacao: 'assinado' }) === 422, 'simulação não vira contrato');

// cadastro manual com código antigo (projeto anterior ao Universo)
const avs = (await chamar('POST', 'projetos', { nome: 'Retrofit AVS', codigo: '2026-031', inicio: '2026-05-04', nucleo_id: 'arquitetos',
  etapas: [{ nome: 'Levantamento', semanas: 2, situacao: 'concluida' }] }, 'projetos')).registro;
ok(avs.codigo === 'OA-2026-031' && avs.numero === 31, 'manual aceita o código que já existia');
ok(await falha('POST', 'projetos', { nome: 'Outro', codigo: '2026-031' }, 'projetos') === 409, 'código repetido → 409');
const novo = (await chamar('POST', 'projetos', { nome: 'Antigo', codigo: '2025-047' }, 'projetos')).registro;
ok(novo.ano === 2025, 'código de outro ano');
const auto = (await chamar('POST', 'projetos', { nome: 'Manual novo', inicio: '2026-11-20' }, 'projetos')).registro;
ok(auto.codigo === 'OA-2026-054', 'manual sem código segue a sequência: ' + auto.codigo);
const em2027 = (await chamar('POST', 'projetos', { nome: 'Ano novo', inicio: '2027-01-10' }, 'projetos')).registro;
ok(em2027.codigo === 'OA-2027-001', 'em 2027 recomeça do 001');
ok(await falha('POST', 'projetos', { nome: 'x' }, 'vendas') === 403, 'vendas não cria projeto à mão');

// equipe e horas
const cid = (await chamar('POST', 'producao/equipe', { nome: 'Cid Clementino', email: 'cid@odisse.com.br', papel: 'socio' }, 'projetos')).registro;
const de2 = await chamar('POST', 'producao/equipe', { nome: 'Cid Clementino', email: 'cid@odisse.com.br' }, 'projetos');
ok(de2.ja_estava && de2.registro.id === cid.id, 'mesma pessoa não entra duas vezes na equipe');
const eta1 = ficha.etapas[0];
await chamar('POST', 'horas', { equipe_id: cid.id, projeto_id: prj.id, etapa_id: eta1.id, data: '2026-11-17', minutos: 150, descricao: 'visita' }, 'projetos');
await chamar('POST', 'horas', { equipe_id: cid.id, projeto_id: prj.id, data: '2026-11-18', minutos: 60 }, 'projetos');
ok(await falha('POST', 'horas', { equipe_id: cid.id, projeto_id: prj2.id, etapa_id: eta1.id, data: '2026-11-18', minutos: 30 }, 'projetos') === 422,
  'hora com etapa de outro projeto → 422');
const f2 = await chamar('GET', 'producao/projetos/' + prj.id, null, 'projetos');
ok(f2.etapas[0].minutos === 150 && f2.horas.length === 2 && f2.horas_por_pessoa[0].minutos === 210, 'ficha soma horas por etapa e por pessoa');
const painel = await chamar('GET', 'producao/painel', null, 'projetos');
const linha = painel.itens.find((x) => x.id === prj.id);
ok(linha.minutos === 210 && linha.etapa_atual.nome === 'Programação Projetual' && linha.coclientes[0] === 'Rafael Lins', 'painel com horas, etapa atual e co-clientes');
ok(painel.equipe.length === 1 && painel.equipe[0].nome === 'Cid Clementino', 'painel traz a equipe');
const hp = await chamar('GET', 'producao/horas?de=2026-11-17&ate=2026-11-17', null, 'projetos');
ok(hp.itens.length === 1 && hp.itens[0].projeto_codigo === 'OA-2026-052', 'horas do período com o código do projeto');

// marketing: só o nome público
await chamar('PATCH', 'projetos/' + prj.id, { versao: prj.versao, nome_publico: 'Casa das Ostras' }, 'marketing');
ok(await falha('PATCH', 'projetos/' + prj.id, { versao: prj.versao + 1, nome: 'x' }, 'marketing') === 403, 'marketing não muda outros campos');
const vistoMkt = (await chamar('GET', 'projetos/' + prj.id, null, 'marketing')).registro;
ok(vistoMkt.nome_publico === 'Casa das Ostras' && !('cliente_id' in vistoMkt), 'marketing vê o nome público, não o cliente');
ok(await falha('GET', 'projetos-local/' + prj.id, null, 'hub') === 403, 'hub não lê o local do imóvel');

// busca
const b = await chamar('GET', 'busca?q=2026-052', null, 'projetos');
ok(b.itens.some((x) => x.id === prj.id), 'projeto aparece na busca pelo código');
console.log('TUDO CERTO');
