// Início do Universo — o panorama do dia numa leitura só (Cid, 19/11).
//
//   GET  /api/inicio            -> { hoje, em, radar, publicacoes, balanco }
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
// Dias sempre de Brasília: "do dia" = hoje, 00:00 até agora; "último dia" = ontem, 00:00–23:59.

import { avisoBalanco } from './kpis.js';

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
  const [radar, marketing, balanco] = await Promise.all([
    parte('Radar', env.RADAR, (r) => r.novidades(hoje)),
    parte('marketing', env.MARKETING, (m) => m.resumo(hoje)),
    env.ARQUIVOS ? avisoBalanco(env, agora).catch(() => null) : null,
  ]);
  const mErro = marketing?.erro ? { erro: marketing.erro } : null;
  return {
    hoje,
    ontem,
    em: agora.toISOString(),
    radar,
    publicacoes: mErro || { linhas: marketing.linhas || [], publicadas: marketing.publicadas || 0, atrasadas: marketing.atrasadas || 0 },
    balanco,
  };
}

export async function publicar(env, corpo, agora = new Date()) {
  if (!env.MARKETING) return { ok: false, status: 503, erro: 'marketing: ligação não configurada' };
  const tipo = corpo?.tipo === 'pauta' ? 'pauta' : corpo?.tipo === 'item' ? 'item' : null;
  const id = String(corpo?.id || '');
  if (!tipo || !/^[a-z0-9_-]{4,64}$/i.test(id)) return { ok: false, status: 400, erro: 'envie { tipo: "item" | "pauta", id }' };
  const r = await env.MARKETING.publicar({ tipo, id }, diaBR(agora));
  return r?.ok ? { ok: true } : { ok: false, status: 404, erro: r?.erro || 'não foi possível confirmar' };
}
