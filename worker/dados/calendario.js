// Calendário do Escopo do Projeto, no servidor (para a Início).
//
// Mesma conta da tela do escopo (projetos-odisse/escopo.js, escCalendario): início + durações em sequência, em dias
// úteis (seg–sex), os que correm juntos no mesmo intervalo, `folga` como hiato (ou paralelo, se negativa), suspensões
// congelando o calendário, cartões suprimidos e decisões não liberadas fora. Aqui serve para a Início saber a etapa
// atual, o próximo marco e as entregas da semana de cada projeto ativo.
// ATENÇÃO: se a regra mudar lá, mudar aqui também (as duas devem dar as mesmas datas).

const DIA = 864e5;
const dia = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const iso = (t) => new Date(t).toISOString().slice(0, 10);

// E = { projeto: { escopo_inicio, inicio, suspensoes: [{ de, ate }] }, cartoes: [...] } · hoje = 'AAAA-MM-DD'
export function calendario(E, hojeIso) {
  const hoje = dia(hojeIso);
  const sus = (E.projeto.suspensoes || []).map((s) => ({ de: dia(s.de), ate: s.ate ? dia(s.ate) : hoje + DIA }));
  const util = (t) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6 && !sus.some((s) => t >= s.de && t < s.ate); };
  const prox = (t) => { let n = 0; while (!util(t) && n++ < 4000) t += DIA; return t; };
  const somar = (t, n) => { for (let i = 0; i < n; i++) t = prox(t + DIA); return t; };
  const voltar = (t, n) => { for (let i = 0; i < n; i++) { t -= DIA; let k = 0; while (!util(t) && k++ < 4000) t -= DIA; } return t; };
  const inicio = prox(dia(E.projeto.escopo_inicio || E.projeto.inicio || hojeIso));
  const porId = Object.fromEntries(E.cartoes.map((c) => [c.id, c]));
  const ativo = (c) => {
    if (c.suprimido_em) return false;
    if (c.etapa_id && porId[c.etapa_id]?.suprimido_em) return false;
    if (!c.liberado_por) return true;
    const d = porId[c.liberado_por];
    const r = d && (d.decisao || []).find((x) => x.id === d.decisao_resultado);
    return !!(r && r.libera.includes(c.id));
  };
  const itens = []; const etapas = [];
  let cursor = inicio;
  for (const et of E.cartoes.filter((c) => c.tipo === 'etapa')) {
    let grupo = null;
    const doEtapa = [];
    for (const c of E.cartoes.filter((x) => x.etapa_id === et.id)) {
      if (!ativo(c)) continue;
      const base = c.junto_anterior && grupo ? grupo.ini : cursor;
      const ini = c.folga > 0 ? somar(base, c.folga) : c.folga < 0 ? voltar(base, -c.folga) : base;
      const fim = somar(ini, c.dias);
      const it = { c, ini, fim, ultimo: voltar(fim, 1), estado: fim <= hoje ? 'feito' : ini <= hoje ? 'hoje' : 'adiante' };
      itens.push(it); doEtapa.push(it);
      if (c.junto_anterior && grupo) { grupo.fim = Math.max(grupo.fim, fim); cursor = grupo.fim; }
      else { cursor = fim; grupo = { ini, fim }; }
    }
    if (doEtapa.length && !et.suprimido_em) etapas.push({ c: et, ini: Math.min(...doEtapa.map((x) => x.ini)), fim: Math.max(...doEtapa.map((x) => x.fim)) });
  }
  return { itens, etapas, inicio, hoje, suspenso: sus.some((s) => hoje >= s.de && hoje < s.ate) };
}

// Resumo de um projeto para a Início: etapa de hoje, próximo marco, entregas feitas/total e as da semana.
export function resumoProjeto(E, hojeIso) {
  const M = calendario(E, hojeIso);
  const etapa = M.etapas.find((e) => e.ini <= M.hoje && M.hoje < e.fim) || M.etapas.find((e) => e.ini > M.hoje) || null;
  // marco = evento com o cliente ou de terceiros, ou o fim de uma entrega; o primeiro que ainda não passou
  const marcos = M.itens.filter((x) => x.estado !== 'feito' && (x.c.tipo === 'entrega' || x.c.cliente || x.c.terceiros || x.c.encerramento))
    .sort((a, b) => a.ultimo - b.ultimo);
  const entregas = M.itens.filter((x) => x.c.tipo === 'entrega');
  const semana = M.hoje + 7 * DIA;
  return {
    etapa: etapa ? { sigla: etapa.c.sigla || '', nome: etapa.c.texto } : null,
    marco: marcos[0] ? { texto: marcos[0].c.texto, codigo: marcos[0].c.codigo || '', dia: iso(marcos[0].ultimo), cliente: !!marcos[0].c.cliente, tipo: marcos[0].c.tipo } : null,
    entregas: { feitas: entregas.filter((x) => x.estado === 'feito').length, total: entregas.length },
    semana: entregas.filter((x) => x.estado !== 'feito' && x.ultimo < semana)
      .map((x) => ({ texto: x.c.texto, codigo: x.c.codigo || '', dia: iso(x.ultimo) })),
    hoje: M.itens.filter((x) => x.estado === 'hoje' && x.c.tipo === 'evento' && x.c.cliente)
      .map((x) => ({ texto: x.c.texto, codigo: x.c.codigo || '' })),
    suspenso: M.suspenso,
  };
}
