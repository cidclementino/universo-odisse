// Teste das Bases e do PGT (migração 0005) e dos códigos com o ano antes do número, sobre SQLite em memória.
// Rodar: node --no-warnings worker/testes/pgt.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const DIR = decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname);
const env = { DB: criarD1(DIR) };
const pedir = async (m, caminho, corpo, ferr = 'projetos') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  return { status: r.status, j: await r.json() };
};
const chamar = async (m, caminho, corpo, ferr = 'projetos') => {
  const { status, j } = await pedir(m, caminho, corpo, ferr);
  if (status >= 400) throw new Error(`${m} ${caminho} → ${status} ${JSON.stringify(j)}`);
  return j;
};
const falha = async (m, caminho, corpo, ferr) => (await pedir(m, caminho, corpo, ferr)).status;
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

// ---------------------------------------------------------------- sementes
let B = await chamar('GET', 'bases');
ok(B.servicos.length === 9 && B.categorias.length === 12 && B.usos.length === 49, `Bases: 9 serviços, 12 categorias, 49 usos (${B.servicos.length}/${B.categorias.length}/${B.usos.length})`);
ok(B.servicos.map((s) => s.sigla).join(',') === 'NE,RF,RT,IN,AM,CO,EV,CR,LA', 'serviços na ordem combinada');
ok(!('parametros' in B), 'Bases sem parâmetros de custo (foram para os honorários)');
ok(B.pendente === true && B.publicacao === null, 'Bases ainda não publicadas');
const ne = B.servicos.find((s) => s.sigla === 'NE');
ok(!('modificador' in ne) && !('preco_por_etapa' in ne) && typeof ne.ic_ajustes === 'object', 'Bases: serviço sem preço (estrutura só)');
ok(B.categorias.find((c) => c.id === 'tca_hospedagem').grupo === 'comercial', 'Hospedagem no grupo comercial');
const hotel = B.usos.find((u) => u.descricao === 'Hotéis de luxo');
ok(hotel.categoria_id === 'tca_hospedagem' && hotel.cub_codigo === 'R-16-A' && hotel.fator_adequacao === 3 && hotel.categoria_cau === 4, 'uso Hotéis de luxo com CUB, fator e categoria do CAU');

let P = await chamar('GET', 'pgt');
ok(P.fases.length === 5 && P.etapas.length === 13 && P.entregaveis.length === 81, `PGT: 5 fases, 13 etapas, 81 entregas (0008: seis viraram eventos) (${P.entregaveis.length})`);
ok(P.etapas.map((e) => e.sigla).join(',') === 'LV,PP,EV,CE,CB,PL,PX,PE,DE,AS,AB,CR,LR', 'etapas na ordem');
const ce = P.etapas.find((e) => e.sigla === 'CE');
ok(ce.nbr_nome === 'Estudo Preliminar' && ce.nbr_sigla === 'EP-ARQ', 'CE ↔ Estudo Preliminar (EP-ARQ)');
ok(ce.servicos.srv_ne.pertinencia === 'P' && !('peso' in ce.servicos.srv_ne) && !ce.servicos.srv_ev, 'matriz etapa × serviço sem pesos');
ok(P.fases.every((f) => !('parcela' in f)), 'fases sem parcela no PGT');
const ce3 = P.entregaveis.find((x) => x.codigo === 'CE-03');
ok(ce3.texto === 'Diagramas de zoneamento' && ce3.servicos.srv_am === 'O' && !ce3.servicos.srv_ev, 'CE-03 com pertinência por serviço');
ok(P.entregaveis.find((x) => x.codigo === 'DE-03').categorias.length === 5, 'DE-03 restrito a 5 categorias');
ok(P.entregaveis.filter((x) => x.etapa_id === 'pet_cr').every((x) => Object.keys(x.servicos).join() === 'srv_cr'), 'etapa-ilha CR só no serviço CR');
ok(P.fases.find((f) => f.id === 'pfa_ilhas').ilha === 1 && P.fases.find((f) => f.id === 'pfa_ilhas').solta === 1, 'Ilhas: grupo solto, em estado de ilha (0007)');
ok(P.fases.every((f) => !('travado' in f) || f.travado === 0) && P.fases.find((f) => f.id === 'pfa_legal').descricao.startsWith('Fase de preparação'), 'fases com descrição (0007)');
ok(ce3.pessoas === 1 && ce3.prazo_fixo === 0 && ce3.prazo_turnos === null, 'entregável com pessoas 1, prazo vazio');

// ---------------------------------------------------------------- permissões
ok((await chamar('GET', 'pgt', null, 'vendas')).entregaveis.length === 81, "vendas lê o PGT");
ok(await falha('POST', 'pgt/publicar', {}, 'vendas') === 403, 'vendas não publica');
ok(await falha('PATCH', 'bases-servicos/srv_ne', { versao: 1, nome: 'X' }, 'vendas') === 403, 'vendas não edita a estrutura das Bases');
ok(await falha('PATCH', 'pgt-fases/pfa_legal', { versao: 1, nome: 'X' }, 'vendas') === 403, 'vendas não edita a estrutura das fases');
ok(await falha('POST', 'honorarios/pesos', { etapa_id: 'pet_ce', servico_id: 'srv_ne', peso: 10 }, 'projetos') === 403, 'Projetos não edita os honorários');
ok(await falha('GET', 'honorarios', null, 'marketing') === 403, 'marketing não vê os honorários');

// ---------------------------------------------------------------- honorários (0006): o custo, pelo vendas
let H = await chamar('GET', 'honorarios', null, 'vendas');
ok(H.servicos.find((s) => s.id === 'srv_ne').modificador === 1 && H.servicos.find((s) => s.id === 'srv_ne').preco_por_etapa === 1, 'honorários: preço dos serviços');
ok(H.fases.find((f) => f.id === 'pfa_conceitual').parcela === 0.2 && H.parametros.parcela_entrada === 0.3, 'honorários: parcelas da fase e de entrada');
ok(H.etapas.find((e) => e.id === 'pet_ce').servicos.srv_in.peso === 17, 'honorários: pesos das etapas');
ok(H.pendente === true && H.publicacao === null, 'honorários ainda não publicados');
await chamar('POST', 'honorarios/pesos', { etapa_id: 'pet_ce', servico_id: 'srv_in', peso: 18 }, 'vendas');
ok(await falha('POST', 'honorarios/pesos', { etapa_id: 'pet_ce', servico_id: 'srv_ev', peso: 5 }, 'vendas') === 422, 'peso onde a etapa não vale → 422');
ok(await falha('POST', 'honorarios/pesos', { etapa_id: 'pet_ce', servico_id: 'srv_in', peso: 120 }, 'vendas') === 422, 'peso acima de 100 → 422');
const srvNe = H.servicos.find((s) => s.id === 'srv_ne');
await chamar('PATCH', 'bases-servicos/srv_ne', { versao: srvNe.versao, modificador: 1.1 }, 'vendas');
const fCon = H.fases.find((f) => f.id === 'pfa_conceitual');
await chamar('PATCH', 'pgt-fases/pfa_conceitual', { versao: fCon.versao, parcela: 0.25 }, 'vendas');
await chamar('POST', 'honorarios/parametros', { chave: 'parcela_entrada', valor: 0.25 }, 'vendas');
ok(await falha('POST', 'honorarios/parametros', { chave: 'parcela_entrada', valor: 2 }, 'vendas') === 422, 'parâmetro fora da faixa → 422');
H = await chamar('GET', 'honorarios', null, 'vendas');
ok(H.etapas.find((e) => e.id === 'pet_ce').servicos.srv_in.peso === 18 && H.servicos.find((s) => s.id === 'srv_ne').modificador === 1.1
  && H.fases.find((f) => f.id === 'pfa_conceitual').parcela === 0.25 && H.parametros.parcela_entrada === 0.25, 'vendas edita peso, preço, parcela e entrada');
// a pertinência da etapa vem dos entregáveis; tirar todos de um serviço some com a célula, mas o peso fica guardado
ok(await falha('POST', 'pgt/etapas-servicos', { etapa_id: 'pet_ce', servico_id: 'srv_in', pertinencia: 'O' }) === 422, 'pertinência da etapa não se marca à mão');
const ceIn = (await chamar('GET', 'pgt')).entregaveis.filter((x) => x.etapa_id === 'pet_ce' && x.servicos.srv_in);
const pertCeIn = Object.fromEntries(ceIn.map((x) => [x.id, x.servicos.srv_in]));
await chamar('POST', 'pgt/entregaveis-servicos', { entregavel_ids: ceIn.map((x) => x.id), servico_id: 'srv_in', pertinencia: null });
H = await chamar('GET', 'honorarios', null, 'vendas');
ok(!H.etapas.find((e) => e.id === 'pet_ce').servicos.srv_in, 'sem entregáveis de IN, CE deixa de valer para IN');
ok(await falha('POST', 'honorarios/pesos', { etapa_id: 'pet_ce', servico_id: 'srv_in', peso: 5 }, 'vendas') === 422, 'peso onde a etapa não vale (calculado) → 422');
await chamar('POST', 'pgt/entregaveis-servicos', { entregavel_ids: ceIn.filter((x) => pertCeIn[x.id] === 'O').map((x) => x.id), servico_id: 'srv_in', pertinencia: 'O' });
H = await chamar('GET', 'honorarios', null, 'vendas');
ok(H.etapas.find((e) => e.id === 'pet_ce').servicos.srv_in?.peso === 18 || !ceIn.some((x) => pertCeIn[x.id] === 'O'), 'o peso volta junto com a célula');
for (const p of ['P', 'O']) {
  const ids = ceIn.filter((x) => pertCeIn[x.id] === p).map((x) => x.id);
  if (ids.length) await chamar('POST', 'pgt/entregaveis-servicos', { entregavel_ids: ids, servico_id: 'srv_in', pertinencia: p });
}
ok((await chamar('GET', 'honorarios', null, 'vendas')).etapas.find((e) => e.id === 'pet_ce').servicos.srv_in.pertinencia === 'P', 'CE volta a valer (P) para IN');
const ph = await chamar('POST', 'honorarios/publicar', { nota: 'primeira' }, 'vendas');
ok(ph.numero === 1, 'honorários publicados: versão 1');
ok(await falha('POST', 'honorarios/publicar', {}, 'vendas') === 409, 'publicar honorários sem mudança → 409');
const uh = await chamar('GET', 'publicacoes/ultima?tipo=honorarios', null, 'vendas');
ok(uh.dados.pesos.pet_ce.srv_in === 18 && uh.dados.servicos.length === 9 && 'bases_numero' in uh.dados && 'pgt_numero' in uh.dados, 'retrato dos honorários com pesos e versões de que depende');
ok(await falha('GET', 'bases', null, 'marketing') === 403, 'marketing não vê as Bases');

// ---------------------------------------------------------------- publicar
const pb = await chamar('POST', 'bases/publicar', { nota: 'primeira' });
ok(pb.numero === 1, 'Bases publicadas: versão 1');
ok((await chamar('GET', 'bases')).pendente === false, 'sem pendência depois de publicar');
ok(await falha('POST', 'bases/publicar', {}) === 409, 'publicar sem mudança → 409');
await chamar('PATCH', 'bases-servicos/srv_rt', { versao: 1, modificador: 1.3 }, 'vendas');
ok((await chamar('GET', 'bases')).pendente === false, 'mudar o preço (vendas) não mexe nas Bases');
await chamar('PATCH', 'bases-servicos/srv_rt', { versao: 2, descricao: 'Retrofit de edificações existentes' });
B = await chamar('GET', 'bases');
ok(B.pendente === true, 'editar a estrutura do serviço deixa as Bases pendentes');
ok((await chamar('POST', 'bases/publicar', {})).numero === 2, 'Bases versão 2');

// ---------------------------------------------------------------- validações das Bases
const novoSrv = (await chamar('POST', 'bases-servicos', { sigla: 'pa', nome: 'Paisagismo', modificador: 0.5 })).registro;
ok(novoSrv.sigla === 'PA' && novoSrv.ordem === 10, 'sigla vai para maiúsculas e o serviço novo entra no fim');
ok(await falha('POST', 'bases-servicos', { sigla: 'PA', nome: 'Outro' }) === 409, 'sigla repetida → 409');
ok(await falha('POST', 'bases-servicos', { sigla: 'P1', nome: 'X' }) === 422, 'sigla com número → 422');
ok(await falha('POST', 'bases-servicos', { sigla: 'XX', nome: 'X', ic_ajustes: { qualquer: 'alto' } }) === 422, 'critério do IC desconhecido → 422');
ok(await falha('POST', 'bases-servicos', { sigla: 'XY', nome: 'X', ic_ajustes: { demanda_midia: 'altissimo' } }) === 422, 'nível do IC inválido → 422');
await chamar('PATCH', 'bases-categorias/tca_saude', { versao: 1, ic_preset: { qtd_especialistas: 'alto', qtd_aprovacoes: 'alto' } });
ok(await falha('PATCH', 'pgt-fases/pfa_legal', { versao: 1, parcela: 1.5 }) === 422, 'parcela acima de 100% → 422');
const uso = (await chamar('POST', 'bases-usos', { categoria_id: 'tca_comercio', descricao: 'Quiosques', cub_codigo: 'csl-8-n', fator_adequacao: 1.2, categoria_cau: 2 })).registro;
ok(uso.cub_codigo === 'CSL-8-N' && uso.ordem === 5, 'uso novo no fim da categoria, código do CUB em maiúsculas');
ok(await falha('POST', 'bases/parametros', { chave: 'parcela_entrada', valor: 0.2 }) === 404, 'parâmetros saíram das Bases');

// ---------------------------------------------------------------- PGT: entregáveis e matrizes
const pp = await chamar('POST', 'pgt/publicar', { nota: 'pool v0.1' });
ok(pp.numero === 1, 'PGT publicado: versão 1');
const novo = (await chamar('POST', 'pgt-entregaveis', { etapa_id: 'pet_ce', texto: 'Estudo de insolação', servicos: { srv_ne: 'P', srv_rt: 'O' } })).registro;
P = await chamar('GET', 'pgt');
const n9 = P.entregaveis.find((x) => x.id === novo.id);
ok(n9.codigo === 'CE-09' && n9.servicos.srv_ne === 'P' && n9.servicos.srv_rt === 'O', 'entregável novo nasce CE-09 com a pertinência');
ok(P.pendente === true, 'PGT pendente depois de criar entregável');
ok(await falha('POST', 'pgt-entregaveis', { etapa_id: 'pet_ce', texto: 'X', servicos: { srv_zz: 'P' } }) === 422, 'serviço inexistente → 422');

const ids = P.entregaveis.filter((x) => x.etapa_id === 'pet_pl').map((x) => x.id).slice(0, 3);
const r1 = await chamar('POST', 'pgt/entregaveis-servicos', { entregavel_ids: ids, servico_id: 'srv_in', pertinencia: 'O' });
ok(r1.mudaram === 3, 'em massa: 3 entregáveis do PL passam a opcionais em Interiores');
const r2 = await chamar('POST', 'pgt/entregaveis-servicos', { entregavel_ids: ids, servico_id: 'srv_in', pertinencia: 'O' });
ok(r2.mudaram === 0, 'repetir não muda nada');
await chamar('POST', 'pgt/entregaveis-servicos', { entregavel_ids: [ids[0]], servico_id: 'srv_ne', pertinencia: null });
P = await chamar('GET', 'pgt');
ok(!P.entregaveis.find((x) => x.id === ids[0]).servicos.srv_ne, 'vazio = não se aplica (linha removida)');
ok(await falha('POST', 'pgt/entregaveis-servicos', { entregavel_ids: ids, servico_id: 'srv_in', pertinencia: 'X' }) === 422, 'pertinência inválida → 422');

await chamar('POST', 'pgt/entregaveis-categorias', { entregavel_id: novo.id, categorias: ['tca_res_unifamiliar', 'tca_hospedagem'] });
P = await chamar('GET', 'pgt');
ok(P.entregaveis.find((x) => x.id === novo.id).categorias.length === 2, 'restrição por categoria gravada');
await chamar('POST', 'pgt/entregaveis-categorias', { entregavel_id: novo.id, categorias: [] });
ok((await chamar('GET', 'pgt')).entregaveis.find((x) => x.id === novo.id).categorias.length === 0, 'sem categorias = vale para todas');

// prazo e pessoas do entregável; prazo da etapa = soma dos P do serviço
const lvNe = P.entregaveis.filter((x) => x.etapa_id === 'pet_lv' && x.servicos.srv_ne === 'P');
for (const x of lvNe) await chamar('PATCH', `pgt-entregaveis/${x.id}`, { versao: x.versao, prazo_turnos: 2, pessoas: 2 });
ok(await falha('PATCH', `pgt-entregaveis/${lvNe[0].id}`, { versao: lvNe[0].versao + 1, prazo_turnos: 80 }) === 422, 'prazo acima de 1 mês → 422');
P = await chamar('GET', 'pgt');
ok(P.etapas.find((e) => e.id === 'pet_lv').prazos.srv_ne === 2 * lvNe.length && P.entregaveis.find((x) => x.id === lvNe[0].id).pessoas === 2, 'prazo da etapa = soma dos entregáveis');
// travar não mexe na publicação
const pubAntes = (await chamar('GET', 'pgt')).pendente;
await chamar('PATCH', 'pgt-etapas/pet_lv', { versao: P.etapas.find((e) => e.id === 'pet_lv').versao, travado: 1 });
P = await chamar('GET', 'pgt');
ok(P.etapas.find((e) => e.id === 'pet_lv').travado === 1 && !('travado' in (await chamar('GET', 'publicacoes/ultima?tipo=pgt')).dados.etapas[0]), 'cadeado gravado, fora do retrato');
// reordenar etapas e mudar de fase (arrastar no PGT)
await chamar('POST', 'pgt/ordem', { tabela: 'pgt_etapas', ids: ['pet_pp', 'pet_lv', 'pet_ev', 'pet_ce', 'pet_cb'] });
P = await chamar('GET', 'pgt');
ok(P.etapas.slice(0, 2).map((e) => e.sigla).join() === 'PP,LV', 'etapas reordenadas dentro da fase');

const daCE = P.entregaveis.filter((x) => x.etapa_id === 'pet_ce').map((x) => x.id);
await chamar('POST', 'pgt/ordem', { tabela: 'pgt_entregaveis', ids: [...daCE].reverse() });
P = await chamar('GET', 'pgt');
ok(P.entregaveis.find((x) => x.id === novo.id).codigo === 'CE-01', 'reordenar muda o código (o último vira CE-01)');
ok(await falha('POST', 'pgt/ordem', { tabela: 'projetos', ids: daCE }) === 422, 'só tabelas do PGT/Bases se reordenam');

const mover = (await chamar('PATCH', 'pgt-entregaveis/' + novo.id, { versao: novo.versao, etapa_id: 'pet_cb' })).registro;
{ const Pm = await chamar('GET', 'pgt');
  const outros = [...Pm.entregaveis, ...Pm.eventos].filter((x) => x.etapa_id === 'pet_cb' && x.id !== novo.id && !x.encerramento).map((x) => x.ordem);
  ok(mover.ordem > Math.max(...outros), 'mudar de etapa leva para o fim da sequência da etapa nova (depois dos eventos)'); }
await chamar('POST', 'pgt-entregaveis/' + novo.id + '/arquivar', { versao: mover.versao });
P = await chamar('GET', 'pgt');
ok(!P.entregaveis.find((x) => x.id === novo.id) && P.arquivados.some((a) => a.id === novo.id), 'arquivado sai do PGT e aparece nos arquivados');

const mat = (await chamar('POST', 'pgt-materiais', { alvo_id: 'pet_pp', tipo: 'formulario', nome: 'Questionário de briefing', link: 'https://drive.google.com/x' })).registro;
ok(mat.ordem === 1 && (await chamar('GET', 'pgt')).materiais.length === 6, 'material ligado à etapa (além dos 5 do Encerramento)');
ok(await falha('POST', 'pgt-materiais', { alvo_id: 'prj_x', tipo: 'modelo', nome: 'X' }) === 422, 'material só em etapa ou entregável');

const pp2 = await chamar('POST', 'pgt/publicar', {});
ok(pp2.numero === 2, 'PGT versão 2');
const ult = await chamar('GET', 'publicacoes/ultima?tipo=pgt', null, 'vendas');
ok(ult.numero === 2 && ult.dados.entregaveis.length === 81 && ult.dados.eventos.length === 59 && ult.dados.bases_numero === 2, 'vendas lê o último PGT publicado (com a versão das Bases)');
ok((await chamar('GET', 'publicacoes?tipo=bases', null, 'vendas')).itens.length === 2, 'lista de publicações das Bases');

// histórico da matriz
const h = await chamar('GET', `pgt-entregaveis/${ids[0]}/historico`);
ok(h.itens.some((x) => x.mudancas && 'servico:srv_ne' in x.mudancas), 'mudança de pertinência entra no histórico do entregável');

// ---------------------------------------------------------------- códigos com o ano antes do número
await chamar('POST', 'propostas/numeracao', { minimo: 10 }, 'vendas');
const ana = (await chamar('POST', 'pessoas', { nome: 'Ana Lins' }, 'vendas')).registro;
const opo = (await chamar('POST', 'oportunidades', { titulo: 'Casa', cliente_id: ana.id }, 'vendas')).registro;
const ppt = (await chamar('POST', 'propostas', { oportunidade_id: opo.id, data: '2026-11-12' }, 'vendas')).registro;
ok(ppt.codigo === 'PC-2026-0011', 'proposta nova: PC-2026-0011 (' + ppt.codigo + ')');
const rev = (await chamar('POST', 'propostas', { oportunidade_id: opo.id, revisao_de: ppt.id }, 'vendas')).registro;
ok(rev.codigo === 'PC-2026-0011-R1', 'revisão: PC-2026-0011-R1');
const ctr = (await chamar('POST', 'contratos', { proposta_id: ppt.id }, 'vendas')).registro;
ok(/^CT-\d{4}-0001$/.test(ctr.codigo), 'contrato novo: CT-AAAA-0001 (' + ctr.codigo + ')');
const prj = (await chamar('POST', 'projetos', { nome: 'Antigo', codigo: 'oa-2026-031' })).registro;
ok(prj.codigo === 'OA-2026-031', 'cadastro manual aceita OA-AAAA-NNN');

// ---------------------------------------------------------------- a 0005 renomeia os projetos que já existiam
const db = new DatabaseSync(':memory:');
const migs = fs.readdirSync(DIR).sort();
for (const f of migs.filter((f) => f < '0005')) db.exec(fs.readFileSync(DIR + '/' + f, 'utf8'));
const t = '2026-11-11T12:00:00.000Z';
db.exec(`INSERT INTO projetos (id, criado_em, atualizado_em, codigo, ano, numero, nome) VALUES ('prj_A', '${t}', '${t}', '2026-052', 2026, 52, 'Casa');
  INSERT INTO busca (registro_id, tabela, titulo, chave, texto, atualizado_em) VALUES ('prj_A', 'projetos', '2026-052 · Casa', '2026-052 · casa', '2026-052 casa', '${t}');`);
for (const f of migs.filter((f) => f >= '0005')) db.exec(fs.readFileSync(DIR + '/' + f, 'utf8'));
const pa = db.prepare("SELECT codigo, versao FROM projetos WHERE id = 'prj_A'").get();
const ba = db.prepare("SELECT titulo, texto FROM busca WHERE registro_id = 'prj_A'").get();
const ha = db.prepare("SELECT mudancas FROM historico WHERE registro_id = 'prj_A'").get();
ok(pa.codigo === 'OA-2026-052' && pa.versao === 2, 'projeto antigo vira OA-2026-052');
ok(ba.titulo === 'OA-2026-052 · Casa' && ba.texto.startsWith('oa-2026-052'), 'busca acompanha o código novo');
ok(JSON.parse(ha.mudancas).codigo[1] === 'OA-2026-052', 'troca de código no histórico');

// ---------------------------------------------------------------- lote (a página junta as edições e salva de uma vez)
const fl = P.fases.find((f) => f.id === 'pfa_legal');
const lt = await chamar('POST', 'pgt/lote', { ops: [
  { tipo: 'campos', tabela: 'pgt_fases', id: 'pfa_legal', versao: fl.versao, campos: { nome: 'Legal e aprovação', ilha: 1 } },
  { tipo: 'campos', tabela: 'pgt_entregaveis', id: 'pen_ce_03', versao: P.entregaveis.find((x) => x.id === 'pen_ce_03').versao, campos: { prazo_turnos: 4, pessoas: 3, prazo_fixo: 1 } },
  { tipo: 'entregaveis-servicos', entregavel_ids: ['pen_ce_03'], servico_id: 'srv_am', pertinencia: 'P' },
  { tipo: 'entregaveis-categorias', entregavel_id: 'pen_ce_03', categorias: ['tca_hospedagem'] },
  { tipo: 'ordem', tabela: 'pgt_etapas', ids: ['pet_lv', 'pet_pp', 'pet_ev', 'pet_ce', 'pet_cb'] },
] });
P = await chamar('GET', 'pgt');
const c3 = P.entregaveis.find((x) => x.id === 'pen_ce_03');
ok(lt.feitas === 5 && P.fases.find((f) => f.id === 'pfa_legal').nome === 'Legal e aprovação' && P.fases.find((f) => f.id === 'pfa_legal').ilha === 1
  && c3.servicos.srv_am === 'P' && c3.prazo_turnos === 4 && c3.pessoas === 3 && c3.prazo_fixo === 1 && c3.categorias.join() === 'tca_hospedagem'
  && P.etapas[0].sigla === 'LV', 'lote: campos, pertinência, categorias e ordem numa chamada');
const lr = await pedir('POST', 'pgt/lote', { ops: [{ tipo: 'entregaveis-servicos', entregavel_ids: ['pen_ce_03'], servico_id: 'srv_am', pertinencia: null }, { tipo: 'campos', tabela: 'pgt_etapas', id: 'pet_zz', versao: 1, campos: { nome: 'X' } }] });
ok(lr.status >= 400 && lr.j.indice === 1 && lr.j.feitas === 1, 'lote: diz qual mudança falhou');
ok(await falha('POST', 'pgt/lote', { ops: [{ tipo: 'apagar' }] }) === 422, 'lote: tipo desconhecido → 422');
ok(await falha('POST', 'pgt/lote', { ops: [{ tipo: 'campos', tabela: 'pessoas', id: 'x', versao: 1, campos: {} }] }) === 422, 'lote: campos só nas tabelas do PGT');
ok(await falha('POST', 'pgt/lote', { ops: [] }, 'vendas') === 403, 'lote: vendas não edita o PGT');

// ---------------------------------------------------------------- 0008: eventos, sequência, Encerramento, faixas
{
  let Q = await chamar('GET', 'pgt');
  const evs = Q.eventos;
  ok(evs.length === 59 && evs.filter((e) => e.cliente).length === 37, `59 eventos, 37 com o cliente (${evs.length}/${evs.filter((e) => e.cliente).length})`);
  ok(['pen_pl_08', 'pen_as_01', 'pen_cr_01', 'pen_px_01', 'pen_px_02', 'pen_lr_05'].every((id) => !Q.entregaveis.find((x) => x.id === id) && Q.arquivados.some((a) => a.id === id)),
    'as seis entregas que viraram eventos estão arquivadas');
  const ce2 = evs.find((e) => e.codigo === 'CE-M02');
  ok(ce2.nome === 'Apresentação da Concepção Esquemática' && ce2.tipo === 'apresentacao' && ce2.cliente === 1 && ce2.servicos.srv_ne === 'P' && !ce2.servicos.srv_co, 'CE-M02 com tipo, cliente e pertinência');
  ok(evs.find((e) => e.codigo === 'CE-M04').clausula === 'Dupla rodada de ajuste' && evs.find((e) => e.codigo === 'CE-M04').servicos.srv_ne === 'O', 'segunda rodada de ajuste: opcional, com cláusula');
  const enc = evs.find((e) => e.encerramento);
  ok(enc.codigo === 'ENC' && enc.etapa_id === 'pet_pe' && enc.instancias.length === 9 && Object.values(enc.servicos).every((p) => p === 'S') && Object.keys(enc.servicos).length === 9,
    'Encerramento: ENC, padrão no PE, 9 instâncias, perpétuo nos 9 serviços');
  ok(Q.materiais.filter((m) => m.alvo_id === enc.id).length === 5, 'Encerramento com 5 materiais');
  // sequência: eventos de início antes das entregas
  const lv = [...Q.entregaveis.filter((x) => x.etapa_id === 'pet_lv'), ...evs.filter((x) => x.etapa_id === 'pet_lv')].sort((a, b) => a.ordem - b.ordem);
  ok(lv[0].id === 'pev_lv_m01' && lv.at(-1).id === 'pev_lv_m05', 'LV: reunião de início primeiro, revisão interna no fim');

  // Encerramento: não se arquiva, não muda de tipo, só fica nas instâncias, pertinência travada
  ok(await falha('POST', `pgt-eventos/${enc.id}/arquivar`, { versao: enc.versao }) === 422, 'Encerramento não se arquiva');
  ok(await falha('PATCH', `pgt-eventos/${enc.id}`, { versao: enc.versao, tipo: 'reuniao' }) === 422, 'Encerramento não muda de tipo');
  ok(await falha('PATCH', `pgt-eventos/${enc.id}`, { versao: enc.versao, etapa_id: 'pet_lv' }) === 422, 'Encerramento só fica numa das instâncias');
  const encDE = (await chamar('PATCH', `pgt-eventos/${enc.id}`, { versao: enc.versao, etapa_id: 'pet_de' })).registro;
  ok(encDE.etapa_id === 'pet_de', 'Encerramento ativado em outra instância (DE)');
  ok(await falha('POST', 'pgt/eventos-servicos', { evento_ids: [enc.id], servico_id: 'srv_ne', pertinencia: null }) === 422, 'perpétuo não se desmarca');
  ok(await falha('POST', 'pgt-eventos', { etapa_id: 'pet_ce', nome: 'Outro', tipo: 'encerramento' }) === 422, 'não nasce outro Encerramento');

  // evento novo: no fim da sequência, com pertinência
  const novoE = (await chamar('POST', 'pgt-eventos', { etapa_id: 'pet_ce', nome: 'Reunião extra', tipo: 'reuniao', cliente: 1, servicos: { srv_ne: 'O' } })).registro;
  Q = await chamar('GET', 'pgt');
  ok(Q.eventos.find((e) => e.id === novoE.id).codigo === 'CE-M06' && Q.eventos.find((e) => e.id === novoE.id).servicos.srv_ne === 'O', 'evento novo: CE-M06, opcional em NE');
  await chamar('POST', 'pgt/lote', { ops: [{ tipo: 'eventos-servicos', evento_ids: [novoE.id], servico_id: 'srv_rf', pertinencia: 'P' }] });
  ok((await chamar('GET', 'pgt')).eventos.find((e) => e.id === novoE.id).servicos.srv_rf === 'P', 'lote: pertinência de evento');

  // prazo pela sequência, com cluster e evento do estúdio
  const ents = Q.entregaveis.filter((x) => x.etapa_id === 'pet_ev');   // EV-01..04, todas P em EV
  const ids = ents.map((x) => x.id);
  await chamar('POST', 'pgt/lote', { ops: [
    ...ids.map((id, i) => ({ tipo: 'campos', tabela: 'pgt_entregaveis', id, versao: ents[i].versao, campos: { prazo_turnos: [2, 4, 6, 2][i], junto_anterior: i === 1 || i === 2 ? 1 : 0 } })),
    { tipo: 'campos', tabela: 'pgt_eventos', id: 'pev_ev_m01', versao: Q.eventos.find((e) => e.id === 'pev_ev_m01').versao, campos: { prazo_turnos: 1 } },
  ] });
  Q = await chamar('GET', 'pgt');
  // EV-01 (2) ‖ EV-02 (4) ‖ EV-03 (6) → 6; EV-04 → 2; revisão interna (estúdio) → 1; apresentação e decisão não contam
  ok(Q.etapas.find((e) => e.id === 'pet_ev').prazos.srv_ev === 9, `prazo do EV com cluster e evento: 9 turnos (${Q.etapas.find((e) => e.id === 'pet_ev').prazos.srv_ev})`);
  ok(Q.etapas.find((e) => e.id === 'pet_ev').prazos.srv_ne === undefined || Q.etapas.find((e) => e.id === 'pet_ev').prazos.srv_ne >= 0, 'EV em NE: só opcionais, sem prazo somado');

  // sequência: reordenar entregas e eventos juntos
  const ceIds = [...Q.eventos.filter((e) => e.etapa_id === 'pet_ce'), ...Q.entregaveis.filter((x) => x.etapa_id === 'pet_ce')].map((x) => x.id);
  await chamar('POST', 'pgt/sequencia', { etapa_id: 'pet_ce', ids: ceIds });
  Q = await chamar('GET', 'pgt');
  ok(Q.eventos.find((e) => e.id === 'pev_ce_m01').ordem === 1 && Q.entregaveis.find((x) => x.id === ceIds.at(-1)).ordem === ceIds.length, 'sequência: eventos e entregas numa ordem só');
  ok(await falha('POST', 'pgt/sequencia', { etapa_id: 'pet_ce', ids: ['pev_lv_m01'] }) === 422, 'sequência: item de outra etapa → 422');
  ok(await falha('POST', 'pgt/sequencia', { etapa_id: 'pet_de', ids: [enc.id] }) === 422, 'sequência: o Encerramento fica fora');

  // faixas de prazo nas Bases
  let Bf = await chamar('GET', 'bases');
  ok(Bf.faixas_prazo.length === 5 && Bf.faixas_prazo[0].ate === 150 && Bf.faixas_prazo[4].ate === null && Bf.faixas_prazo[4].mult === 2.4, 'Bases: 5 faixas de prazo');
  ok(await falha('POST', 'bases/faixas-prazo', { faixas: [{ ate: 300, mult: 1 }, { ate: 200, mult: 2 }, { mult: 3 }] }) === 422, 'faixas fora de ordem → 422');
  await chamar('POST', 'bases/faixas-prazo', { faixas: [{ ate: 200, mult: 1 }, { ate: 999, mult: 7 }, { mult: 1.5 }] });
  Bf = await chamar('GET', 'bases');
  ok(Bf.faixas_prazo.length === 3 && Bf.faixas_prazo[2].ate === null && Bf.pendente === true, 'faixas gravadas; Bases pendentes de publicação');
  ok(await falha('POST', 'bases/faixas-prazo', { faixas: [{ mult: 1 }] }, 'vendas') === 403, 'vendas não edita as faixas');
  ok(!('faixas_prazo' in (await chamar('GET', 'honorarios', null, 'vendas')).parametros), 'faixas fora dos honorários');
}

console.log('TUDO CERTO');
