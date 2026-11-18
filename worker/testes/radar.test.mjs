// Teste do ponto de entrada do Radar (0014): corretor nos Contatos e oportunidade de terreno.
// Rodar: node --no-warnings worker/testes/radar.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)) };
const chamar = async (m, caminho, corpo, ferr = 'radar') => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: corpo ? JSON.stringify(corpo) : undefined, headers: { 'Content-Type': 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  return { status: r.status, corpo: await r.json() };
};
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

// corretor + imobiliária + atuação com o papel novo
const pes = await chamar('POST', 'pessoas', { nome: 'Ricardo Vieira', whatsapp: '83999887766', instagram: 'ricardo.imoveis' });
ok(pes.status === 201, 'Radar cria pessoa');
const org = await chamar('POST', 'organizacoes', { nome: 'Escorel Corretora de Imóveis', tipo: 'empresa' });
ok(org.status === 201, 'Radar cria organização');
const atu = await chamar('POST', 'atuacoes', { pessoa_id: pes.corpo.registro.id, organizacao_id: org.corpo.registro.id, papel: 'corretor' });
ok(atu.status === 201 && atu.corpo.registro.papel === 'corretor', 'papel corretor aceito');

// mesmo WhatsApp de novo: o Radar recebe "já existe" em vez de duplicar
const dup = await chamar('POST', 'pessoas', { nome: 'Ricardo Vieira', whatsapp: '83999887766' });
ok(dup.status === 409 && dup.corpo.erro === 'possivel_duplicado' && dup.corpo.candidatos.length === 1, 'duplicado devolve 409 com o candidato');

// oportunidade de terreno: titular = o corretor
const opo = await chamar('POST', 'oportunidades', {
  titulo: 'Terreno Bessa 600m² — Ricardo Vieira', cliente_id: pes.corpo.registro.id, contato_pessoa_id: pes.corpo.registro.id,
  nucleo_id: 'arquitetos', origem: 'radar', origem_detalhe: 'yout-2026-eb4b3684 · youtube.com · nível 2',
});
ok(opo.status === 201 && opo.corpo.registro.etapa_funil === 'lead', 'Radar abre oportunidade (lead) com o corretor como titular');

// o que o Radar não vê
ok((await chamar('GET', 'propostas')).status === 403, 'Radar não lê propostas');
ok((await chamar('GET', `pessoas_sensiveis/${pes.corpo.registro.id}`)).status >= 403, 'Radar não lê dados sensíveis');
ok((await chamar('GET', 'interacoes')).status === 403, 'Radar não lê interações');

// sucesso da conversa: o vendas abre a oportunidade do cliente, derivada da do corretor
const cli = await chamar('POST', 'pessoas', { nome: 'Joana Dono do Terreno', whatsapp: '83988776655' }, 'vendas');
const nova = await chamar('POST', 'oportunidades', { titulo: 'Edifício Bessa — Joana', cliente_id: cli.corpo.registro.id, origem: 'radar' }, 'vendas');
const vin = await chamar('POST', 'vinculos', { de_id: nova.corpo.registro.id, para_id: opo.corpo.registro.id, papel: 'derivada_de' }, 'vendas');
ok(vin.status === 201, 'oportunidade do cliente ligada à do corretor (derivada_de)');
console.log('radar: tudo certo');
