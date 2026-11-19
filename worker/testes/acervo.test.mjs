// Teste do Acervo (0020): banco único de imagens, marcador "pública" e as rotas do site.
// Rodar: node --no-warnings worker/testes/acervo.test.mjs
import { criarD1 } from './d1.mjs';
import { api } from '../dados/api.js';

const r2 = new Map();
const ARQUIVOS = {
  put: async (k, corpo, o) => { r2.set(k, { corpo: new Uint8Array(corpo), tipo: o?.httpMetadata?.contentType }); },
  get: async (k) => (r2.has(k) ? { body: r2.get(k).corpo, httpMetadata: { contentType: r2.get(k).tipo } } : null),
};
const env = { DB: criarD1(decodeURIComponent(new URL('../../dados/migracoes', import.meta.url).pathname)), ARQUIVOS };
const pedir = async (m, caminho, corpo, ferr = 'hub', bruto = null) => {
  const url = new URL('https://x/api/v1/' + caminho);
  const req = new Request(url, { method: m, body: bruto || (corpo ? JSON.stringify(corpo) : undefined),
    headers: { 'Content-Type': bruto ? 'image/webp' : 'application/json' } });
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
const imagem = (n, extra = {}) => ({ nome_original: `foto-${n}.webp`, tipo_mime: 'image/webp', categoria: 'imagem',
  sha256: String(n).padStart(64, '0'), largura: 2400, altura: 1600, ...extra });

// ---- projeto antigo (cadastro manual, concluído, só a ficha) e um objeto
const prj = (await chamar('POST', 'projetos', { codigo: 'OA-2024-012', nome: 'Residência Kama', nome_publico: 'Residência Kama',
  situacao: 'concluido' }, 'projetos')).registro;
ok(prj.codigo === 'OA-2024-012' && prj.situacao === 'concluido', 'projeto antigo entra concluído, sem contrato e sem etapas');
const prj2 = (await chamar('POST', 'projetos', { nome: 'Retrofit AVS' }, 'projetos')).registro;
const obj = (await chamar('POST', 'objetos', { nome: 'Luminária Aro' })).registro;
ok(obj.nucleo_id === 'objetos' && obj.id.startsWith('obj_'), 'objeto nasce no núcleo Objetos');

// ---- imagem pelo Acervo: nasce restrita
const a1 = (await chamar('POST', 'arquivos', imagem(1))).registro;
ok(a1.publica === 0, 'toda imagem nasce restrita (pública desligada)');
let r = await pedir('PATCH', 'arquivos/' + a1.id, { versao: a1.versao, publica: true });
ok(r.status === 422 && /direitos/.test(r.j.erro), 'pública exige direitos livres');
const a1b = (await chamar('PATCH', 'arquivos/' + a1.id, { versao: a1.versao, direitos: 'livre', publica: true })).registro;
ok(a1b.publica === 1, 'com direitos livres, pode ser pública');
const a1c = (await chamar('PATCH', 'arquivos/' + a1.id, { versao: a1b.versao, direitos: 'uso_interno' })).registro;
ok(a1c.publica === 0, 'mudar os direitos para uso interno desliga a pública');
const a1d = (await chamar('PATCH', 'arquivos/' + a1.id, { versao: a1c.versao, direitos: 'livre', publica: 1 })).registro;

// ---- galeria: imagem em mais de um alvo
const g1 = (await chamar('POST', 'galeria', { arquivo_id: a1.id, alvo_id: prj.id })).registro;
await chamar('POST', 'galeria', { arquivo_id: a1.id, alvo_id: obj.id });
r = await pedir('POST', 'galeria', { arquivo_id: a1.id, alvo_id: prj.id });
ok(r.status === 409, 'a mesma imagem não entra duas vezes no mesmo projeto');
const a2 = (await chamar('POST', 'arquivos', imagem(2, { legenda: 'Fachada' }))).registro;
await chamar('POST', 'galeria', { arquivo_id: a2.id, alvo_id: prj.id });
const a3 = (await chamar('POST', 'arquivos', imagem(3))).registro; // sem alvo
r = await pedir('POST', 'galeria', { arquivo_id: a3.id, alvo_id: 'prj_01ZZZZZZZZZZZZZZZZZZZZZZZZ' });
ok(r.status === 422, 'galeria recusa projeto que não existe');

// foto da equipe (tem dono) fica fora do acervo
const eqp = (await chamar('GET', 'equipe/quadro')).itens[0];
await chamar('POST', 'arquivos', imagem(9, { dono_id: eqp.id, direitos: 'livre' }));

let lista = await chamar('GET', 'acervo');
ok(lista.total === 3 && lista.publicas === 1, 'acervo lista as três imagens (sem a foto da equipe), uma pública');
const item1 = lista.itens.find((i) => i.id === a1.id);
ok(item1.alvos.length === 2 && item1.alvos.some((x) => x.tipo === 'projeto' && x.codigo === 'OA-2024-012')
  && item1.alvos.some((x) => x.tipo === 'objeto'), 'cada imagem traz os alvos (projeto e objeto)');
lista = await chamar('GET', 'acervo?alvo=' + prj.id);
ok(lista.total === 2, 'filtro por projeto');
lista = await chamar('GET', 'acervo?sem_alvo=1');
ok(lista.total === 1 && lista.itens[0].id === a3.id, 'filtro "sem projeto"');
lista = await chamar('GET', 'acervo?q=kama');
ok(lista.total === 2, 'busca pelo nome do projeto');
lista = await chamar('GET', 'acervo?q=fachada');
ok(lista.total === 1 && lista.itens[0].id === a2.id, 'busca pela legenda');
lista = await chamar('GET', 'acervo', null, 'marketing');
ok(lista.total === 1 && lista.itens[0].id === a1.id, 'o marketing só vê as públicas');
ok((await pedir('GET', 'arquivos/' + a2.id, null, 'marketing')).status === 404, 'o marketing não abre uma restrita pela rota comum');
ok((await chamar('GET', 'arquivos?categoria=imagem', null, 'marketing')).itens.every((i) => i.publica === 1), 'nem na lista comum');

const al = await chamar('GET', 'acervo/alvos');
const alPrj = al.projetos.find((x) => x.id === prj.id);
ok(alPrj.imagens === 2 && alPrj.publicas === 1 && al.objetos[0].imagens === 1, 'alvos com a contagem de imagens');

// ---- tirar a imagem do projeto = arquivar a ligação
await chamar('POST', `galeria/${g1.id}/arquivar`, { versao: g1.versao });
ok((await chamar('GET', 'acervo?alvo=' + prj.id)).total === 1, 'arquivar a ligação tira a imagem do projeto');
await chamar('POST', `galeria/${g1.id}/restaurar`, { versao: g1.versao + 1 });

// ---- site: só as públicas do projeto
ok((await pedir('GET', 'acervo', null, 'site')).status === 403, 'o site não lê o acervo inteiro');
ok((await pedir('GET', 'arquivos', null, 'site')).status === 403, 'nem a rota comum de arquivos');
const proj = await chamar('GET', 'acervo/site/projetos', null, 'site');
ok(proj.itens.find((x) => x.id === prj.id).publicas === 1, 'site: lista de projetos do Universo com as públicas');
let pub = await chamar('GET', 'acervo/site/projetos/' + prj.id, null, 'site');
ok(pub.itens.length === 1 && pub.itens[0].id === a1.id && pub.itens[0].largura === 2400, 'site: só a imagem pública do projeto');

// conteúdo: pública sai, restrita não
r = await pedir('PUT', `arquivos/${a1.id}/conteudo?variante=m`, null, 'hub', new Uint8Array([1, 2, 3]));
ok(r.status === 200, 'hub envia a média');
r = await pedir('GET', `acervo/site/imagens/${a1.id}/conteudo?variante=m`, null, 'site');
ok(r.status === 200 && (await r.r.arrayBuffer()).byteLength === 3, 'site lê o conteúdo da pública');
r = await pedir('PUT', `arquivos/${a2.id}/conteudo?variante=g`, null, 'hub', new Uint8Array([4, 5]));
r = await pedir('GET', `acervo/site/imagens/${a2.id}/conteudo?variante=g`, null, 'site');
ok(r.status === 404, 'site não lê a restrita');

// metadescrição pelo editor do site: só da pública, só o texto alternativo
const d = (await chamar('PATCH', 'acervo/site/imagens/' + a1.id, { versao: a1d.versao, texto_alternativo: 'Sala com pé-direito duplo' }, 'site')).registro;
ok(d.texto_alternativo === 'Sala com pé-direito duplo', 'site descreve a imagem pública (fica na imagem do acervo)');
ok((await pedir('PATCH', 'acervo/site/imagens/' + a1.id, { versao: d.versao, legenda: 'x' }, 'site')).status === 403, 'site não muda outros campos');
ok((await pedir('PATCH', 'acervo/site/imagens/' + a2.id, { versao: a2.versao, texto_alternativo: 'x' }, 'site')).status === 404, 'nem descreve a restrita');

// imagem nova pelo editor do site: pública, livre e ligada ao projeto
const n = await chamar('POST', `acervo/site/projetos/${prj.id}/imagens`, { nome_original: 'nova.webp', tipo_mime: 'image/webp',
  sha256: 'a'.repeat(64), largura: 1800, altura: 1200, texto_alternativo: 'Varanda' }, 'site');
ok(n.criado && n.registro.texto_alternativo === 'Varanda', 'site sobe imagem nova');
const reg = (await chamar('GET', 'arquivos/' + n.registro.id)).registro;
ok(reg.publica === 1 && reg.direitos === 'livre' && reg.criado_por === 'site', 'entra pública e com direitos livres');
r = await pedir('PUT', `acervo/site/imagens/${n.registro.id}/conteudo?variante=g`, null, 'site', new Uint8Array([7, 7, 7, 7]));
ok(r.status === 200, 'site envia o conteúdo');
pub = await chamar('GET', 'acervo/site/projetos/' + prj.id, null, 'site');
ok(pub.itens.length === 2, 'a nova aparece entre as públicas do projeto');
// mesma imagem, já pública, em outro projeto: só liga
const n2 = await chamar('POST', `acervo/site/projetos/${prj2.id}/imagens`, { nome_original: 'nova.webp', tipo_mime: 'image/webp',
  sha256: 'a'.repeat(64), largura: 1800, altura: 1200 }, 'site');
ok(n2.ja_existia && n2.registro.id === n.registro.id, 'a mesma imagem pública só ganha a ligação ao outro projeto');
// mesma imagem de uma restrita: recusa
r = await pedir('POST', `acervo/site/projetos/${prj.id}/imagens`, { nome_original: 'x.webp', tipo_mime: 'image/webp', sha256: imagem(2).sha256 }, 'site');
ok(r.status === 409 && r.j.restrita === a2.id, 'imagem restrita no Acervo não vira pública pelo site');

console.log('acervo: tudo certo');
