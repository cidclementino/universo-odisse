// Teste do Início (panorama do dia): junta as partes e cada uma falha sozinha.
// Rodar: node --no-warnings worker/testes/inicio.test.mjs
import { inicio, publicar, diaBR } from '../inicio.js';

const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const agora = new Date('2026-11-20T01:30:00Z'); // 22h30 do dia 19 em Brasília
ok(diaBR(agora) === '2026-11-19', 'dia de Brasília (não o UTC)');

const chamadas = [];
const env = {
  RADAR: { novidades: async (d) => { chamadas.push(['radar', d]); return { dia: d, concursos: 0, terrenos: 2, licitacoes: 1, contratos: 0 }; } },
  MARKETING: {
    resumo: async (d) => { chamadas.push(['mkt', d]); return { hoje: d, linhas: [{ tipo: 'item', id: 'pl-a', confirma: true }], publicadas: 1, atrasadas: 3, instagram: { dia: '2026-11-18', atual: { alcance: 10 } } }; },
    publicar: async (alvo, d) => { chamadas.push(['pub', alvo, d]); return alvo.id === 'pl-a' ? { ok: true } : { ok: false, erro: 'publicação não encontrada no pool' }; },
  },
  SITE_ODISSE: { metricasDoDia: async () => { throw new Error('fora do ar'); } },
};
const r = await inicio(env, agora);
ok(r.hoje === '2026-11-19' && r.ontem === '2026-11-18', 'hoje e ontem');
ok(chamadas.some((c) => c[0] === 'radar' && c[1] === '2026-11-19') && chamadas.some((c) => c[0] === 'mkt' && c[1] === '2026-11-19'), 'Radar e marketing pedidos com o dia de hoje');
ok(r.radar.terrenos === 2 && r.publicacoes.atrasadas === 3 && r.publicacoes.linhas.length === 1 && r.instagram.atual.alcance === 10, 'partes juntadas');
ok(r.site.erro && r.site.erro.includes('fora do ar'), 'o site falhou sozinho, sem derrubar o resto');

const r2 = await inicio({}, agora);
ok(r2.radar.erro && r2.publicacoes.erro && r2.instagram.erro && r2.site.erro, 'sem ligações: cada parte avisa');

ok((await publicar(env, { tipo: 'item', id: 'pl-a' }, agora)).ok, 'confirma item do pool');
ok(chamadas.at(-1)[2] === '2026-11-19', 'confirmação leva o dia de Brasília');
ok((await publicar(env, { tipo: 'x', id: 'pl-a' }, agora)).status === 400, 'tipo inválido');
ok((await publicar(env, { tipo: 'item', id: 'pl-zz' }, agora)).status === 404, 'item que não existe');
