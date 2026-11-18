// Teste da equipe como cadastro comum (0011), sobre SQLite em memória e um R2 de mentira.
// Rodar: node --no-warnings worker/testes/equipe.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';

const r2 = new Map();
const ARQUIVOS = {
  put: async (k, corpo, o) => { r2.set(k, { corpo: new Uint8Array(corpo instanceof ArrayBuffer ? corpo : corpo.buffer ? corpo : corpo), tipo: o?.httpMetadata?.contentType }); },
  get: async (k) => (r2.has(k) ? { body: r2.get(k).corpo, httpMetadata: { contentType: r2.get(k).tipo } } : null),
};
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)), ARQUIVOS };
const pedir = async (m, caminho, corpo, ferr = 'hub', bruto = null) => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: bruto || (corpo ? JSON.stringify(corpo) : undefined),
    headers: { 'Content-Type': bruto ? 'image/png' : 'application/json' } });
  const r = await api(env, ferr, req, url, {});
  const tipo = r.headers.get('Content-Type') || '';
  return { status: r.status, j: tipo.includes('json') ? await r.json() : null, r };
};
const chamar = async (m, caminho, corpo, ferr) => {
  const { status, j } = await pedir(m, caminho, corpo, ferr);
  if (status >= 400) throw new Error(`${m} ${caminho} → ${status} ${JSON.stringify(j)}`);
  return j;
};
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };

// ---- migração: Cid e Nathalia entram com os dados do site
let q = await chamar('GET', 'equipe/quadro');
const cid = q.itens.find((p) => p.nome === 'Cid Clementino');
const nat = q.itens.find((p) => p.nome === 'Nathalia Linhares');
ok(cid && nat, 'Cid e Nathalia entram na equipe pela migração');
ok(cid.socio === 1 && cid.cargo === 'Coordenador criativo' && cid.titulo === 'Arquiteto e urbanista', 'Cid: sócio, Coordenador criativo, Arquiteto e urbanista');
ok(nat.cargo === 'Coordenadora executiva' && nat.titulo === 'Arquiteta e urbanista', 'Nathalia: formas femininas do cargo e do título');
ok(cid.bio_pt.startsWith('Formado em Arquitetura') && cid.publico === 1 && !cid.bio_en, 'bio do site em português; inglês vazio');
ok(cid.assina.join() === 'proposta,contrato,documento' && !cid.registro_formatado, 'sem registro ainda, e por isso sem RRT');
ok(q.cargos.length === 5 && q.titulos.length === 3, 'listas de cargos e títulos semeadas');
ok(q.itens[0].nome === 'Cid Clementino', 'ordem: Cid primeiro');

// ---- registro e RRT
let r = await pedir('PATCH', 'equipe/' + cid.id, { versao: cid.versao, assina: ['proposta', 'rrt'] });
ok(r.status === 422 && /RRT/.test(r.j.erro), 'RRT sem registro é recusado');
let c = (await chamar('PATCH', 'equipe/' + cid.id, { versao: cid.versao, registro: 'CAU A123456-7', assina: 'rrt,proposta,contrato,documento' })).registro;
ok(c.registro === 'A123456-7' && c.assina === 'proposta,contrato,documento,rrt', 'registro sem a sigla; usos na ordem da lista');
q = await chamar('GET', 'equipe/quadro');
ok(q.itens[0].registro_formatado === 'CAU A123456-7', 'registro formatado com o conselho');

// ---- sócio x cargo x papel antigo
const nova = (await chamar('POST', 'producao/equipe', { nome: 'Ana Souza', papel: 'estagiario' })).registro;
ok(nova.socio === 0 && nova.cargo_id === 'crg_estagiario' && nova.papel === 'estagiario', 'tela antiga (só papel) vira cargo; sócio = não');
ok((await pedir('POST', 'producao/equipe', { nome: 'Beto' }, 'projetos')).status === 403, 'o Projetos não cadastra mais na equipe');
ok((await pedir('PATCH', 'equipe/' + nova.id, { versao: nova.versao, bio_pt: 'x' }, 'projetos')).status === 403, 'o Projetos só muda o custo por hora');
const custo = (await chamar('PATCH', 'equipe/' + nova.id, { versao: nova.versao, custo_hora: 8000 }, 'projetos')).registro;
ok(custo.custo_hora === 8000, 'o Projetos muda o custo por hora');
nova.versao = custo.versao;
let a = (await chamar('PATCH', 'equipe/' + nova.id, { versao: nova.versao, cargo_id: 'crg_arquiteto', tratamento: 'f', titulo_id: 'tit_arq_urb' })).registro;
ok(a.papel === 'arquiteto', 'papel antigo acompanha o cargo');
r = await pedir('PATCH', 'equipe/' + nova.id, { versao: a.versao, assina: ['contrato'] });
ok(r.status === 422 && /sócio/.test(r.j.erro), 'contrato só com sócio');
a = (await chamar('PATCH', 'equipe/' + nova.id, { versao: a.versao, assina: ['documento'] })).registro;
q = await chamar('GET', 'equipe/quadro');
ok(q.itens.find((p) => p.id === nova.id).cargo === 'Arquiteta', 'cargo na forma do tratamento');

// ---- seletor
let s = await chamar('GET', 'equipe/assinantes?para=contrato', null, 'vendas');
ok(s.itens.length === 2 && s.itens.every((p) => p.socio === 1) && !('bio_pt' in s.itens[0]), 'contrato: só os sócios, sem bio');
s = await chamar('GET', 'equipe/assinantes?para=documento', null, 'vendas');
ok(s.itens.length === 3, 'documento: os três');
s = await chamar('GET', 'equipe/assinantes?para=rrt', null, 'projetos');
ok(s.itens.length === 1 && s.itens[0].registro_formatado === 'CAU A123456-7', 'RRT: só quem tem registro');
a = (await chamar('PATCH', 'equipe/' + nova.id, { versao: a.versao, ativo: 0 })).registro;
s = await chamar('GET', 'equipe/assinantes?para=documento', null, 'vendas');
ok(s.itens.length === 2, 'quem não está ativo some do seletor');

// ---- permissões
const lv = await chamar('GET', 'equipe', null, 'vendas');
ok(lv.itens.length && !('custo_hora' in lv.itens[0]), 'o vendas lê a equipe, sem custo por hora');
ok((await pedir('PATCH', 'equipe/' + cid.id, { versao: c.versao, bio_pt: 'x' }, 'vendas')).status === 403, 'o vendas não edita');
ok((await pedir('POST', 'cargos', { nome_m: 'Gerente', nome_f: 'Gerente' }, 'vendas')).status === 403, 'só o hub mexe nos cargos');
const cg = (await chamar('POST', 'cargos', { nome_m: 'Gerente de obras', nome_f: 'Gerente de obras', nome_en: 'Site manager', ordem: 60 })).registro;
ok(cg.id.startsWith('crg_'), 'o hub cria cargo novo');

// ---- site: só a parte pública
const pub = await chamar('GET', 'equipe/publica', null, 'site');
ok(pub.itens.length === 2 && pub.itens[0].cargo_en === 'Creative Director' && !('email' in pub.itens[0]), 'site vê só quem é público, com cargo em inglês');
ok((await pedir('GET', 'equipe', null, 'site')).status === 403, 'site não lista a equipe inteira');
ok((await pedir('GET', 'equipe/quadro', null, 'site')).status === 403, 'site não vê o quadro');
ok((await pedir('GET', 'pessoas', null, 'site')).status === 403, 'site não vê contatos');

// ---- assinatura manuscrita
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 2, 0, 0, 0, 0, 200, 8, 6, 0, 0, 0]);
c = (await chamar('GET', 'equipe/' + cid.id)).registro;
ok((await pedir('PUT', `equipe/${cid.id}/assinatura?versao=${c.versao}`, null, 'vendas', png)).status === 403, 'só o hub sobe assinatura');
ok((await pedir('PUT', `equipe/${cid.id}/assinatura?versao=${c.versao}`, null, 'hub', new Uint8Array([1, 2, 3]))).status === 415, 'só PNG');
let up = await pedir('PUT', `equipe/${cid.id}/assinatura?versao=${c.versao}`, null, 'hub', png);
ok(up.status === 200 && up.j.registro.assinatura_id === up.j.arquivo_id, 'hub sobe a assinatura');
const arq1 = up.j.arquivo_id;
const meta = (await chamar('GET', 'arquivos/' + arq1)).registro;
ok(meta.protegido === 1 && meta.largura === 512 && meta.altura === 200, 'arquivo marcado como protegido, com o tamanho do PNG');
ok((await pedir('GET', `arquivos/${arq1}/conteudo`)).status === 403, 'a rota comum de arquivos não entrega a assinatura');
ok((await pedir('PATCH', 'equipe/' + cid.id, { versao: up.j.registro.versao, foto_id: arq1 })).status === 422, 'assinatura não pode virar foto');

q = await chamar('GET', 'equipe/quadro');
ok(q.itens[0].tem_assinatura === true && !('assinatura_id' in q.itens[0]), 'o quadro diz que há assinatura sem dar o id');
ok((await pedir('GET', `equipe/${cid.id}/assinatura?uso=documento`, null, 'marketing')).status === 403, 'o marketing não lê assinaturas');
ok((await pedir('GET', `equipe/${nat.id}/assinatura?uso=documento`, null, 'vendas')).status === 404, 'sem assinatura enviada: 404');
const lida = await pedir('GET', `equipe/${cid.id}/assinatura?uso=contrato&registro=ctr_TESTE`, null, 'vendas');
ok(lida.status === 200 && lida.r.headers.get('Cache-Control') === 'no-store', 'o vendas lê a assinatura na emissão, sem cache');
const h = await chamar('GET', `equipe/${cid.id}/historico`);
ok(h.itens.some((x) => x.acao === 'ler_sensivel' && x.mudancas.uso === 'contrato' && x.mudancas.registro === 'ctr_TESTE'), 'leitura registrada no histórico com uso e documento');

ok((await pedir('GET', `equipe/${cid.id}/assinatura?uso=conferencia`)).status === 200, 'o hub confere a assinatura guardada');
ok((await pedir('GET', `equipe/${cid.id}/assinatura?uso=conferencia`, null, 'vendas')).status === 403, 'só o hub usa a conferência');

// trocar: o arquivo anterior é arquivado; remover
c = (await chamar('GET', 'equipe/' + cid.id)).registro;
ok((await pedir('PUT', `equipe/${cid.id}/assinatura?versao=${c.versao - 1}`, null, 'hub', png)).status === 409, 'versão velha: conflito');
const orfa = (await chamar('GET', 'arquivos?dono_id=' + cid.id + '&arquivados=1')).itens.filter((x) => x.id !== arq1);
ok(orfa.length === 0, 'versão velha é recusada antes de gravar o arquivo');
up = await pedir('PUT', `equipe/${cid.id}/assinatura?versao=${c.versao}`, null, 'hub', png);
ok(up.status === 200 && up.j.arquivo_id !== arq1, 'troca a assinatura');
ok((await chamar('GET', 'arquivos/' + arq1)).registro.arquivado_em, 'a anterior fica arquivada (nada se apaga)');
const rm = await chamar('POST', `equipe/${cid.id}/assinatura/remover`, { versao: up.j.registro.versao });
ok(rm.registro.assinatura_id === null, 'remove a assinatura');
ok((await chamar('GET', 'arquivos/' + up.j.arquivo_id)).registro.arquivado_em, 'o arquivo removido fica arquivado');

// ---- foto e site
const foto = (await chamar('POST', 'arquivos', { nome_original: 'cid.jpg', tipo_mime: 'image/jpeg', categoria: 'imagem', dono_id: cid.id })).registro;
await pedir('PUT', `arquivos/${foto.id}/conteudo?variante=g`, null, 'hub', new Uint8Array([0xff, 0xd8, 0xff]));
c = (await chamar('GET', 'equipe/' + cid.id)).registro;
c = (await chamar('PATCH', 'equipe/' + cid.id, { versao: c.versao, foto_id: foto.id })).registro;
const fs = await pedir('GET', `equipe/${cid.id}/foto?variante=s`, null, 'site');
ok(fs.status === 200 && fs.r.headers.get('Cache-Control').startsWith('public'), 'o site pega a foto de quem é público (cai na maior que houver)');
ok((await pedir('GET', `equipe/${nova.id}/foto`, null, 'site')).status === 404, 'o site não vê quem não é público');

console.log('equipe: tudo certo');
