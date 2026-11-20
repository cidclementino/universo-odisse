// Teste dos KPIs: comercial pelo D1, canais dia a dia no R2, faixas, frases, fechamento do mês e rotina.
// Rodar: node --no-warnings worker/testes/kpis.test.mjs
import { criarD1 } from './d1.mjs';
import {
  comercialPorMes, completarDias, montarMes, faixaDe, frase, fecharMes, rotina, lerKpis, lerBalanco,
  gravarMetas, avisoBalanco, somarMeses, historico, trimestreDe, trimestresAte, comercialPorMes as cpm,
} from '../kpis.js';

const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const perto = (a, b) => Math.abs(a - b) < 1e-9;

// R2 de mentira
const r2 = new Map();
const ARQUIVOS = {
  get: async (k) => (r2.has(k) ? { text: async () => r2.get(k) } : null),
  head: async (k) => (r2.has(k) ? {} : null),
  put: async (k, v) => { r2.set(k, v); },
  list: async ({ prefix }) => ({ objects: [...r2.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
};

// D1 com oportunidades, propostas e contratos de outubro e novembro
const DB = criarD1(new URL('../../dados/migracoes', import.meta.url).pathname);
const t = (iso) => iso; // carimbos em UTC
async function x(sql, ...a) { await DB.prepare(sql).bind(...a).run(); }
const opo = async (id, criado, origem = 'instagram', arquivado = null) => x(
  `INSERT INTO oportunidades (id, criado_em, atualizado_em, titulo, origem, arquivado_em) VALUES (?, ?, ?, ?, ?, ?)`, id, criado, criado, id, origem, arquivado);
await opo('opo_1', t('2026-10-03T13:00:00Z'));
await opo('opo_2', t('2026-10-10T13:00:00Z'), 'indicacao');
await opo('opo_3', t('2026-11-01T02:00:00Z'), 'site'); // 23h do dia 31/10 em Brasília: conta em outubro
await opo('opo_4', t('2026-11-05T13:00:00Z'));
await opo('opo_5', t('2026-10-12T13:00:00Z'), 'outro', '2026-10-13'); // arquivada: não conta
await x(`INSERT INTO arquivos (id, criado_em, atualizado_em, nome_original, tipo_mime, categoria) VALUES ('arq_p1', 'x', 'x', 'p.pdf', 'application/pdf', 'pdf_proposta')`).catch(() => {});
const arqOk = !!(await DB.prepare(`SELECT id FROM arquivos WHERE id = 'arq_p1'`).first());
const ppt = (id, num, rev, opoId, data, valor, situacao = 'enviada', sim = 0, pdf = 'arq_p1') => x(
  `INSERT INTO propostas (id, criado_em, atualizado_em, numero, revisao, codigo, simulacao, oportunidade_id, data, valor_total, situacao, arquivo_pdf_id)
   VALUES (?, 'x', 'x', ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, num, rev, `PC-${num}-${rev}`, sim, sim ? null : opoId, data, valor, situacao, arqOk ? pdf : null);
if (arqOk) {
  await ppt('ppt_1', 1, 0, 'opo_1', '2026-10-05', 3000000, 'aceita');
  await ppt('ppt_2', 2, 0, 'opo_2', '2026-10-20', 1000000);
  await ppt('ppt_3', 2, 1, 'opo_2', '2026-10-25', 1100000); // revisão: não conta
  await ppt('ppt_4', 3, 0, null, '2026-10-26', 500000, 'rascunho', 1); // simulação: não conta
  await x(`INSERT INTO contratos (id, criado_em, atualizado_em, numero, codigo, proposta_id, situacao, valor_total, assinado_em)
    VALUES ('ctr_1', 'x', 'x', 1, 'CT-1', 'ppt_1', 'assinado', 3000000, '2026-10-15')`);
}

// Marketing e site de mentira, dia a dia
const chamadas = { mkt: 0, site: 0 };
const MARKETING = { resumo: async (hoje) => { chamadas.mkt++; const d = new Date(Date.parse(hoje + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  return { instagram: { dia: d, atual: { alcance: 100, interacoes: 10, visitas: 5, toques: 1, novos: 2 }, seguidores: 1000 + +d.slice(8) } }; } };
// periodo: o ponto de entrada novo do marketing (Instagram de um período e publicações por mês)
let comPeriodo = false;
MARKETING.periodo = async (de, ate) => { if (!comPeriodo) throw new Error('marketing antigo'); chamadas.periodo = (chamadas.periodo || 0) + 1;
  const dias = {}; for (let d = de; d <= ate; d = new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10)) dias[d] = { alcance: 50, interacoes: 5, visitas: 2, toques: 0, novos: 1, seguidores: 2000 };
  return { de, ate, dias, publicacoes: { '2026-10': { instagram: 9, feed: 6, reels: 3, pinterest: 4 } } }; };
const SITE_ODISSE = { metricasDoDia: async () => { chamadas.site++; return { total: { visitantes: 20, projetos: 3, contatos: 1 } }; } };
const env = { DB, ARQUIVOS, MARKETING, SITE_ODISSE };

// ---- comercial
const c = await comercialPorMes(env);
ok(c['2026-10'].leads === 3 && c['2026-11'].leads === 1, 'leads por mês de Brasília, sem as arquivadas');
ok(c['2026-10'].origens.indicacao === 1 && c['2026-10'].origens.site === 1, 'origem dos leads');
if (arqOk) {
  ok(c['2026-10'].propostas === 2, 'propostas emitidas: sem revisões nem simulações');
  ok(c['2026-10'].contratos === 1 && c['2026-10'].contratado === 30000 && c['2026-10'].decisoes[0] === 10, 'contrato, valor em reais e dias de decisão');
}

// ---- canais
const hoje = '2026-11-20';
const r1 = await completarDias(env, '2026-10', hoje, 8);
ok(r1.novos === 8 && chamadas.mkt === 8 && chamadas.site === 8, 'completa no máximo 8 dias por vez');
for (let i = 0; i < 3; i++) await completarDias(env, '2026-10', hoje, 8);
const out = await montarMes(env, '2026-10');
ok(out.cobertura.instagram === 31 && out.valores.alcance === 3100 && out.valores.visitas_site === 620, 'outubro inteiro somado');
ok(out.valores.seguidores === 1031 && perto(out.valores.engajamento, 0.1), 'seguidores no fim do mês e taxa de resposta');
if (arqOk) ok(out.valores.ticket === 30000 && out.valores.decisao === 10 && perto(out.valores.ief, 0.4 * (2 / 3) + 0.6 * (1 / 2)), 'ticket, decisão e IEF');
const antes = chamadas.mkt;
await completarDias(env, '2026-10', hoje, 8);
ok(chamadas.mkt === antes, 'mês completo não chama de novo');

// ---- metas e faixas
ok((await gravarMetas(env, { versao: 1, faixas: { leads: { minimo: 1, adequado: 3, excelente: 2 } } })).status === 422, 'faixas fora de ordem: recusa');
ok((await gravarMetas(env, { versao: 1, faixas: { decisao: { minimo: 30, adequado: 14, excelente: 7 } } })).status === 200, 'tempo de decisão: menos é melhor');
const m = await gravarMetas(env, { versao: 1, faixas: { leads: { minimo: 2, adequado: 3, excelente: 5 }, decisao: { minimo: 30, adequado: 14, excelente: 7 }, ticket: { minimo: '', adequado: '', excelente: '' } } });
ok(m.status === 200 && !m.dados.faixas.ticket, 'linha em branco não grava meta');
ok(faixaDe('leads', 3, m.dados) === 'adequado' && faixaDe('leads', 1, m.dados) === 'abaixo' && faixaDe('leads', 9, m.dados) === 'excelente', 'faixas, mais é melhor');
ok(faixaDe('decisao', 10, m.dados) === 'adequado' && faixaDe('decisao', 40, m.dados) === 'abaixo' && faixaDe('decisao', 5, m.dados) === 'excelente', 'faixas, menos é melhor');
ok(faixaDe('alcance', 10, m.dados) === null, 'sem meta, sem faixa');

// ---- frases
const hist = await historico(env, '2026-10', 3);
const f = frase('leads', '2026-10', hist.at(-1).valores, hist, m.dados);
ok(f.startsWith('Leads: 3') && f.includes('na faixa adequada'), 'frase com valor e faixa: ' + f);

// ---- fechamento
let erro = null;
try { await fecharMes(env, '2026-11', new Date('2026-11-20T12:00:00Z')); } catch (e) { erro = e; }
ok(erro, 'não fecha o mês corrente');
const b = await fecharMes(env, '2026-10', new Date('2026-11-20T12:00:00Z'));
ok(b.mes === '2026-10' && b.historico.length === 12 && b.frases.length > 5 && b.expectativa.mes === '2026-11', 'balanço com histórico, frases e expectativa');
ok((await lerBalanco(env, '2026-10')).dados.feito_em === b.feito_em, 'balanço congelado lido de volta');
ok((await avisoBalanco(env, new Date('2026-11-25T12:00:00Z')))?.mes === '2026-10', 'aviso na Início nos dias seguintes');
ok((await avisoBalanco(env, new Date('2026-12-15T12:00:00Z'))) === null, 'aviso some depois de 10 dias');

// ---- rotina: dia 1º fecha o mês anterior uma vez só
r2.delete('kpis/balancos/2026-10.json');
const rot = await rotina(env, new Date('2026-11-01T09:47:00Z'));
ok(rot.balanco === '2026-10', 'dia 1º: fecha outubro');
const rot2 = await rotina(env, new Date('2026-11-02T09:47:00Z'));
ok(!rot2.balanco, 'dia 2: já fechado, não refaz');
const rot3 = await rotina(env, new Date('2026-11-12T09:47:00Z'));
ok(!rot3.balanco, 'fora dos primeiros dias: não fecha');

// ---- leitura da página
const k = await lerKpis(env, null, new Date('2026-11-20T12:00:00Z'));
ok(k.status === 200 && k.dados.mes.mes === '2026-11' && k.dados.mes.parcial, 'página abre no mês corrente, parcial');
ok(k.dados.meses[0].mes === '2026-11' && k.dados.meses.some((x) => x.mes === '2026-10' && x.fechado), 'lista de meses com os fechados');
ok(k.dados.ontem.instagram.atual && k.dados.ontem.site.total, 'ontem (o Placar que saiu da Início)');
ok(k.dados.expectativa && k.dados.historico.length === 12, 'expectativa e 12 meses');
const k2 = await lerKpis(env, '2026-10', new Date('2026-11-20T12:00:00Z'));
ok(k2.dados.balanco?.mes === '2026-10' && !k2.dados.mes.parcial, 'mês fechado traz o balanço');
ok(somarMeses('2026-01', -1) === '2025-12' && somarMeses('2026-12', 1) === '2027-01', 'virada de ano');

// ---- marketing com periodo: Instagram do mês numa chamada só, e publicações por mês
comPeriodo = true;
const antesMkt = chamadas.mkt;
const r9 = await completarDias(env, '2026-09', hoje, 8);
ok(chamadas.periodo === 1 && chamadas.mkt === antesMkt, 'Instagram de setembro inteiro numa chamada só, sem o resumo dia a dia');
ok(r9.novos >= 30, 'setembro: 30 dias de Instagram + 8 do site');
const set = await montarMes(env, '2026-09');
ok(set.valores.alcance === 1500 && set.cobertura.instagram === 30, 'setembro somado pelo periodo');
const h2 = await historico(env, '2026-10', 3, undefined, hoje);
ok(h2.at(-1).valores.publicacoes === 9 && h2.at(-1).valores.pins === 4 && h2.at(-2).valores.publicacoes === 0, 'publicações e pins por mês');
comPeriodo = false;
const h3 = await historico(env, '2026-10', 3, undefined, hoje);
ok(h3.at(-1).valores.publicacoes === null, 'marketing sem periodo: publicações ficam sem número, o resto segue');

// ---- metas trimestrais
ok(trimestreDe('2026-11').de === '2026-10' && trimestreDe('2026-11').meses.length === 2 && trimestreDe('2026-01').meses.length === 1, 'trimestre do calendário até o mês');
const mt = await montarMes(env, '2026-11');
ok(mt.trimestre.numero === 4 && 'ief' in mt.trimestre.valores && 'decisao' in mt.trimestre.valores, 'valores do trimestre no mês');
if (arqOk) {
  const out2 = await montarMes(env, '2026-10');
  ok(out2.trimestre.valores.decisao === 10, 'tempo de decisão pelo trimestre');
  const ft = frase('decisao', '2026-10', out2.valores, [], m.dados, out2.trimestre);
  ok(ft.startsWith('Tempo de decisão no 4º trimestre (outubro): 10 dias') && ft.includes('faixa adequada'), 'frase trimestral: ' + ft);
}

const hT = await historico(env, '2026-11', 12);
const tr = trimestresAte(await cpm(env), hT, '2026-11');
ok(tr.length === 4 && tr[3].numero === 4 && tr[3].parcial && tr[2].numero === 3 && tr[2].ate === '2026-09' && !tr[2].parcial && tr[0].ano === '2026', 'quatro trimestres, o último até o mês');
