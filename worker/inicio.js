// Início do Universo — o panorama do dia numa leitura só (Cid, 19/11).
//
//   GET  /api/inicio            -> { hoje, em, credenciais, radar, publicacoes, balanco }
// Desde 19/11 (Cid) a Início traz só ações: as métricas de canal (Instagram e site de ontem) foram para a
// seção KPIs (worker/kpis.js); aqui fica só o aviso de que o balanço do mês foi feito.
//   POST /api/inicio/publicar   <- { tipo: 'item' | 'pauta', id }  -> confirma a publicação no marketing
//
// O hub busca nas outras ferramentas Worker a Worker (service bindings com entrypoint "Universo"; ver
// wrangler.toml), sem as senhas delas. Cada parte vem ou falha sozinha: { erro } no lugar dos dados.
//   radar       (RADAR → radar-odisse)        novidades(hoje): concursos, terrenos, licitações e contratos
//                                              que entraram hoje (primeira coleta, Brasília)
//   marketing   (MARKETING → universo-odisse)  resumo(hoje): publicações de hoje e atrasadas
//   balanco     (R2, kpis/ultimo.json)         último balanço mensal, nos 10 dias seguintes ao fechamento
//   credenciais (D1)                           documentos vencidos e não substituídos (Cid, 19/11): o aviso
//                                              fica até a substituição
// Desde 24/11 (Cid: Início v3, uma coluna, lista "Hoje" e quatro números), também:
//   propostas   (D1)   emitidas e ainda sem resposta (enviadas, sem contrato, oportunidade em aberto), com os dias desde
//                      o envio; contratos enviados aguardando assinatura
//   projetos    (D1)   projetos ativos com escopo: etapa de hoje, próximo marco, entregas feitas/total, as da semana e os
//                      eventos com o cliente hoje (calendário em dados/calendario.js, a mesma conta da tela do escopo)
//   metas       (D1+R2) indicadores do mês abaixo do mínimo (somas lidas pela projeção do mês, como no Painel dos KPIs)
// Dias sempre de Brasília: "do dia" = hoje, 00:00 até agora; "último dia" = ontem, 00:00–23:59.

import { avisoBalanco, INDICADORES, faixaDe, montarMes, mesDe } from './kpis.js';
import { resumoProjeto } from './dados/calendario.js';
import { vencidas } from './dados/credenciais.js';

const TZ = 'America/Sao_Paulo';
export const diaBR = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const somarDias = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);

const LIMITE_MS = 8000;
async function parte(nome, ligacao, chamar) {
  if (!ligacao) return { erro: `${nome}: ligação não configurada` };
  let t;
  try {
    return await Promise.race([
      chamar(ligacao),
      new Promise((_, nao) => { t = setTimeout(() => nao(new Error('sem resposta')), LIMITE_MS); }),
    ]);
  } catch (e) {
    console.warn(`inicio: ${nome}`, e);
    return { erro: `${nome}: ${e?.message || 'falhou'}` };
  } finally { clearTimeout(t); }
}

export async function inicio(env, agora = new Date()) {
  const hoje = diaBR(agora);
  const ontem = somarDias(hoje, -1);
  const [credenciais, radar, marketing, balanco, propostas, projetos, metas] = await Promise.all([
    env.DB ? vencidas(env, hoje).then((itens) => ({ itens })).catch((e) => ({ erro: `credenciais: ${e?.message || 'falhou'}` })) : null,
    parte('Radar', env.RADAR, (r) => r.novidades(hoje)),
    parte('marketing', env.MARKETING, (m) => m.resumo(hoje)),
    env.ARQUIVOS ? avisoBalanco(env, agora).catch(() => null) : null,
    env.DB ? propostasEmAberto(env, hoje).catch((e) => ({ erro: `propostas: ${e?.message || 'falhou'}` })) : null,
    env.DB ? projetosAtivos(env, hoje).catch((e) => ({ erro: `projetos: ${e?.message || 'falhou'}` })) : null,
    env.DB && env.ARQUIVOS ? foraDaMeta(env, hoje).catch((e) => ({ erro: `metas: ${e?.message || 'falhou'}` })) : null,
  ]);
  const mErro = marketing?.erro ? { erro: marketing.erro } : null;
  return {
    hoje,
    ontem,
    em: agora.toISOString(),
    credenciais,
    radar,
    publicacoes: mErro || { linhas: marketing.linhas || [], publicadas: marketing.publicadas || 0, atrasadas: marketing.atrasadas || 0 },
    balanco,
    propostas,
    projetos,
    metas,
  };
}

const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(String(a).slice(0, 10) + 'T12:00:00Z')) / 864e5);

// Propostas emitidas que esperam resposta: a última revisão de cada número, enviada (ou emitida e ainda em rascunho),
// sem contrato e com a oportunidade em aberto. Contratos enviados que esperam a assinatura.
export async function propostasEmAberto(env, hoje) {
  const [p, c] = await env.DB.batch([
    env.DB.prepare(`SELECT p.id, p.codigo, p.titulo, p.data, p.enviada_em, p.valor_total, p.situacao, o.titulo AS oportunidade
      FROM propostas p LEFT JOIN oportunidades o ON o.id = p.oportunidade_id
      WHERE p.simulacao = 0 AND p.arquivo_pdf_id IS NOT NULL AND p.arquivado_em IS NULL AND p.situacao IN ('rascunho', 'enviada')
        AND p.revisao = (SELECT MAX(q.revisao) FROM propostas q WHERE q.numero = p.numero AND q.arquivado_em IS NULL)
        AND NOT EXISTS (SELECT 1 FROM contratos k WHERE k.proposta_id = p.id AND k.arquivado_em IS NULL)
        AND (o.id IS NULL OR o.etapa_funil NOT IN ('ganha', 'perdida'))
        AND (p.validade IS NULL OR p.validade >= ?)
      ORDER BY COALESCE(p.enviada_em, p.data)`).bind(hoje),
    env.DB.prepare(`SELECT k.id, k.codigo, k.valor_total, k.atualizado_em, p.titulo, o.titulo AS oportunidade
      FROM contratos k LEFT JOIN propostas p ON p.id = k.proposta_id LEFT JOIN oportunidades o ON o.id = p.oportunidade_id
      WHERE k.situacao = 'enviado' AND k.arquivado_em IS NULL ORDER BY k.atualizado_em`),
  ]);
  const aguardando = p.results.map((x) => {
    const desde = x.enviada_em || x.data;
    return { id: x.id, codigo: x.codigo, titulo: x.titulo || x.oportunidade || '', oportunidade: x.oportunidade || '',
      valor: (x.valor_total || 0) / 100, desde, dias: desde ? diasEntre(desde, hoje) : null };
  });
  return {
    aguardando,
    valor: aguardando.reduce((t, x) => t + x.valor, 0),
    contratos: c.results.map((x) => ({ id: x.id, codigo: x.codigo, titulo: x.titulo || x.oportunidade || '', valor: (x.valor_total || 0) / 100,
      dias: diasEntre(x.atualizado_em, hoje) })),
  };
}

const lerJsonCampo = (s, padrao) => { try { return s ? JSON.parse(s) : padrao; } catch { return padrao; } };

// Projetos ativos que já têm escopo, com o resumo do calendário (dados/calendario.js).
export async function projetosAtivos(env, hoje) {
  const [pr, ca] = await env.DB.batch([
    env.DB.prepare(`SELECT id, codigo, nome, servico, inicio, escopo_inicio, suspensoes FROM projetos
      WHERE arquivado_em IS NULL AND situacao IN ('ativo', 'pausado') ORDER BY codigo`),
    env.DB.prepare(`SELECT c.id, c.projeto_id, c.tipo, c.etapa_id, c.ordem, c.codigo, c.sigla, c.texto, c.cliente, c.terceiros, c.encerramento,
        c.junto_anterior, c.dias, c.folga, c.decisao, c.decisao_resultado, c.liberado_por, c.suprimido_em
      FROM escopo_cartoes c JOIN projetos p ON p.id = c.projeto_id
      WHERE c.arquivado_em IS NULL AND p.arquivado_em IS NULL AND p.situacao IN ('ativo', 'pausado') ORDER BY c.projeto_id, c.ordem`),
  ]);
  const porProjeto = {};
  for (const c of ca.results) (porProjeto[c.projeto_id] ||= []).push({ ...c, decisao: lerJsonCampo(c.decisao, null) });
  const itens = [];
  for (const p of pr.results) {
    const cartoes = porProjeto[p.id];
    if (!cartoes?.length) continue;
    const r = resumoProjeto({ projeto: { ...p, suspensoes: lerJsonCampo(p.suspensoes, []) }, cartoes }, hoje);
    itens.push({ id: p.id, codigo: p.codigo, nome: p.nome, servico: p.servico || '', ...r });
  }
  return { itens };
}

// Indicadores do mês abaixo do mínimo. Somas pela projeção (o que entrou, no mesmo passo, levado ao mês inteiro); as
// outras pelo valor. Os trimestrais e as publicações (que pedem o marketing) ficam de fora: estão no Painel dos KPIs.
const SOMA = new Set(['leads', 'propostas', 'contratos', 'contratado', 'alcance', 'interacoes', 'visitas_perfil', 'toques_link',
  'novos_seguidores', 'visitas_site', 'projetos_site', 'contatos_site']);
export async function foraDaMeta(env, hoje) {
  const o = await env.ARQUIVOS.get('kpis/metas.json');
  const metas = o ? JSON.parse(await o.text()) : null;
  if (!metas?.faixas) return { itens: [], total: 0 };
  const mes = mesDe(hoje);
  const m = await montarMes(env, mes, { hoje });
  const dias = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();
  const fr = Math.max(1, +hoje.slice(8, 10) - 1) / dias;
  const comMeta = INDICADORES.filter((i) => !i.medicao && metas.faixas[i.id] && i.id !== 'publicacoes' && i.id !== 'pins');
  const itens = [];
  for (const i of comMeta) {
    const v = m.valores[i.id];
    if (v == null) continue;
    const projecao = SOMA.has(i.id) && fr < 1 ? v / fr : null;
    if (faixaDe(i.id, projecao ?? v, metas) === 'abaixo') {
      itens.push({ id: i.id, nome: i.nome, formato: i.formato, valor: v, projecao, minimo: metas.faixas[i.id].minimo });
    }
  }
  return { mes, itens, total: comMeta.length };
}

export async function publicar(env, corpo, agora = new Date()) {
  if (!env.MARKETING) return { ok: false, status: 503, erro: 'marketing: ligação não configurada' };
  const tipo = corpo?.tipo === 'pauta' ? 'pauta' : corpo?.tipo === 'item' ? 'item' : null;
  const id = String(corpo?.id || '');
  if (!tipo || !/^[a-z0-9_-]{4,64}$/i.test(id)) return { ok: false, status: 400, erro: 'envie { tipo: "item" | "pauta", id }' };
  const r = await env.MARKETING.publicar({ tipo, id }, diaBR(agora));
  return r?.ok ? { ok: true } : { ok: false, status: 404, erro: r?.erro || 'não foi possível confirmar' };
}
