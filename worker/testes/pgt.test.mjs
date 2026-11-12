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
ok(P.fases.length === 5 && P.etapas.length === 13 && P.entregaveis.length === 87, `PGT: 5 fases, 13 etapas, 87 entregáveis (${P.entregaveis.length})`);
ok(P.etapas.map((e) => e.sigla).join(',') === 'LV,PP,EV,CE,CB,PL,PX,PE,DE,AS,AB,CR,LR', 'etapas na ordem');
const ce = P.etapas.find((e) => e.sigla === 'CE');
ok(ce.nbr_nome === 'Estudo Preliminar' && ce.nbr_sigla === 'EP-ARQ', 'CE ↔ Estudo Preliminar (EP-ARQ)');
ok(ce.servicos.srv_ne.pertinencia === 'P' && !('peso' in ce.servicos.srv_ne) && !ce.servicos.srv_ev, 'matriz etapa × serviço sem pesos');
ok(P.fases.every((f) => !('parcela' in f)), 'fases sem parcela no PGT');
const ce3 = P.entregaveis.find((x) => x.codigo === 'CE-03');
ok(ce3.texto === 'Diagramas de zoneamento' && ce3.servicos.srv_am === 'O' && !ce3.servicos.srv_ev, 'CE-03 com pertinência por serviço');
ok(P.entregaveis.find((x) => x.codigo === 'DE-03').categorias.length === 5, 'DE-03 restrito a 5 categorias');
ok(P.entregaveis.filter((x) => x.etapa_id === 'pet_cr').every((x) => Object.keys(x.servicos).join() === 'srv_cr'), 'etapa-ilha CR só no serviço CR');
ok(P.fases.find((f) => f.id === 'pfa_ilhas').ilha === 1, 'fase Ilhas marcada como ilha');

// ---------------------------------------------------------------- permissões
ok((await chamar('GET', 'pgt', null, 'vendas')).entregaveis.length === 87, 'vendas lê o PGT');
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
// mexer na pertinência pelo Projetos não apaga o peso
await chamar('POST', 'pgt/etapas-servicos', { etapa_id: 'pet_ce', servico_id: 'srv_in', pertinencia: 'O', semanas: null });
H = await chamar('GET', 'honorarios', null, 'vendas');
ok(H.etapas.find((e) => e.id === 'pet_ce').servicos.srv_in.peso === 18 && H.etapas.find((e) => e.id === 'pet_ce').servicos.srv_in.pertinencia === 'O', 'alternar a pertinência mantém o peso');
await chamar('POST', 'pgt/etapas-servicos', { etapa_id: 'pet_ce', servico_id: 'srv_in', pertinencia: 'P', semanas: null });
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

await chamar('POST', 'pgt/etapas-servicos', { etapa_id: 'pet_lv', servico_id: 'srv_ne', pertinencia: 'O', semanas: 2 });
await chamar('POST', 'pgt/etapas-servicos', { etapa_id: 'pet_ev', servico_id: 'srv_rf', pertinencia: null });
P = await chamar('GET', 'pgt');
ok(P.etapas.find((e) => e.id === 'pet_lv').servicos.srv_ne.semanas === 2 && !P.etapas.find((e) => e.id === 'pet_ev').servicos.srv_rf, 'matriz etapa × serviço: semanas e remoção');
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
ok(mover.ordem === 16, 'mudar de etapa leva para o fim da etapa nova (CB-16)');
await chamar('POST', 'pgt-entregaveis/' + novo.id + '/arquivar', { versao: mover.versao });
P = await chamar('GET', 'pgt');
ok(!P.entregaveis.find((x) => x.id === novo.id) && P.arquivados.some((a) => a.id === novo.id), 'arquivado sai do PGT e aparece nos arquivados');

const mat = (await chamar('POST', 'pgt-materiais', { alvo_id: 'pet_pp', tipo: 'formulario', nome: 'Questionário de briefing', link: 'https://drive.google.com/x' })).registro;
ok(mat.ordem === 1 && (await chamar('GET', 'pgt')).materiais.length === 1, 'material ligado à etapa');
ok(await falha('POST', 'pgt-materiais', { alvo_id: 'prj_x', tipo: 'modelo', nome: 'X' }) === 422, 'material só em etapa ou entregável');

const pp2 = await chamar('POST', 'pgt/publicar', {});
ok(pp2.numero === 2, 'PGT versão 2');
const ult = await chamar('GET', 'publicacoes/ultima?tipo=pgt', null, 'vendas');
ok(ult.numero === 2 && ult.dados.entregaveis.length === 87 && ult.dados.bases_numero === 2, 'vendas lê o último PGT publicado (com a versão das Bases)');
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

console.log('TUDO CERTO');
