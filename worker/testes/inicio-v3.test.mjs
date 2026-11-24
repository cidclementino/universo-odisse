// Teste da Início v3 (Cid, 24/11): calendário do escopo no servidor, projetos ativos e propostas em aberto.
// Rodar: node --no-warnings worker/testes/inicio-v3.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
import { calendario, resumoProjeto, iso } from '../dados/calendario.js';
import { projetosAtivos, propostasEmAberto } from '../inicio.js';

const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

// ---- calendário (mesma conta da tela do escopo)
const E = {
  projeto: { escopo_inicio: '2026-11-02', suspensoes: [] },
  cartoes: [
    { id: 'e1', tipo: 'etapa', sigla: 'CE', texto: 'Concepção Esquemática' },
    { id: 'a', tipo: 'entrega', etapa_id: 'e1', codigo: 'CE-01', texto: 'Estudo de massa', dias: 3, folga: 0 },
    { id: 'b', tipo: 'entrega', etapa_id: 'e1', codigo: 'CE-02', texto: 'Plantas esquemáticas', dias: 4, folga: 0, junto_anterior: 1 },
    { id: 'd', tipo: 'evento', etapa_id: 'e1', codigo: 'CE-M03', texto: 'Aprovação do cliente', dias: 3, folga: 0, cliente: 1 },
  ],
};
const M = calendario(E, '2026-11-05');
const por = Object.fromEntries(M.itens.map((x) => [x.c.id, x]));
ok(iso(por.a.ultimo) === '2026-11-04' && iso(por.b.ultimo) === '2026-11-05', 'entregas juntas começam no mesmo dia');
ok(iso(por.d.ini) === '2026-11-06' && iso(por.d.ultimo) === '2026-11-10', 'o evento vem depois da mais longa e pula o fim de semana');
let r = resumoProjeto(E, '2026-11-05');
ok(r.etapa.sigla === 'CE' && r.entregas.feitas === 1 && r.entregas.total === 2, 'etapa de hoje e entregas feitas');
ok(r.marco.codigo === 'CE-02' && r.semana.length === 1 && r.hoje.length === 0, 'próximo marco e entregas da semana');
r = resumoProjeto(E, '2026-11-09');
ok(r.hoje.length === 1 && r.hoje[0].codigo === 'CE-M03', 'evento com o cliente hoje');
const S = { ...E, projeto: { ...E.projeto, suspensoes: [{ de: '2026-11-03', ate: null }] } };
ok(resumoProjeto(S, '2026-11-05').suspenso, 'suspensão em curso');

// ---- banco: projeto com escopo e proposta emitida
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const chamar = async (m, caminho, corpo, ferr = 'projetos') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const res = await api(env, ferr, req, url, {});
  const j = await res.json();
  if (res.status >= 400) throw new Error(`${m} ${caminho} → ${res.status} ${JSON.stringify(j)}`);
  return j;
};
const prj = (await chamar('POST', 'projetos', { nome: 'Casa Teste', inicio: '2026-11-02', codigo: 'OA-2025-031' })).registro;
await chamar('POST', `escopo/${prj.id}/gerar`, { inicio: '2026-11-02', cartoes: [
  { ref: 'e1', tipo: 'etapa', origem_id: 'pet_ce', sigla: 'CE', texto: 'Concepção Esquemática', fase_id: 'pfa_conceitual', fase_nome: 'Conceitual' },
  { ref: 'a', tipo: 'entrega', etapa_ref: 'e1', origem_id: 'pen_ce_01', codigo: 'CE-01', texto: 'Estudo de massa', dias: 3 },
  { ref: 'd', tipo: 'evento', etapa_ref: 'e1', origem_id: 'pev_ce_m03', codigo: 'CE-M03', texto: 'Aprovação do cliente', tempo: 'cliente', cliente: 1, dias: 3 },
] });
const P = await projetosAtivos(env, '2026-11-03');
ok(P.itens.length === 1 && P.itens[0].codigo === 'OA-2025-031' && P.itens[0].marco.codigo === 'CE-01', 'projeto ativo com o próximo marco');

const vazio = await propostasEmAberto(env, '2026-11-24');
ok(Array.isArray(vazio.aguardando) && vazio.aguardando.length === 0 && vazio.contratos.length === 0, 'sem propostas em aberto');
