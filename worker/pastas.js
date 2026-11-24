// Biblioteca › Estrutura de pastas: a norma de cada estrutura de pastas do Drive (template de
// projeto, [Imagem], [Administração]) e o retrato do Drive tirado num dia, para conferir uma contra a outra.
//
// Os repositórios são públicos e há nomes de clientes nas pastas: o arquivo fica no R2 privado
// (ARQUIVOS, chave universo/pastas.json), entregue só com a senha do hub. Sem tabela nem migração.
//   GET /api/pastas  → o arquivo guardado (404 se ainda não há)
//   PUT /api/pastas  → troca o arquivo inteiro (validado aqui)
//
// Formato (versao 1):
//   { versao: 1, retrato_em: 'AAAA-MM-DD', estruturas: [ { id, nome, caminho, fonte, regras[], nomes_sem_acento,
//     norma: { previstos?, f: [ { n, nota?, previstos?, f[] } ] } | null,
//     retrato: { a, f: [ { n, a, f[] } ] } } ] }
//   n = nome da pasta · a = arquivos soltos nela (sem contar subpastas) · previstos = quantos arquivos a norma
//   admite soltos ali · nota = o que vai na pasta.

export const CHAVE = 'universo/pastas.json';
const MAX_BYTES = 1024 * 1024;
const MAX_PASTAS = 5000;
const MAX_NIVEL = 12;

const texto = (v, max) => typeof v === 'string' && v.trim() !== '' && v.length <= max;

function conferirNo(no, tipo, nivel, conta) {
  if (!no || typeof no !== 'object' || Array.isArray(no)) throw new Error(`${tipo}: pasta inválida`);
  if (nivel > MAX_NIVEL) throw new Error(`${tipo}: mais de ${MAX_NIVEL} níveis`);
  if (nivel > 0 && !texto(no.n, 200)) throw new Error(`${tipo}: pasta sem nome`);
  if (tipo === 'retrato' && !(Number.isInteger(no.a) && no.a >= 0)) throw new Error(`retrato: "${no.n || 'raiz'}" sem contagem de arquivos`);
  if (no.nota != null && !texto(no.nota, 600)) throw new Error(`${tipo}: nota de "${no.n}" inválida`);
  if (no.previstos != null && !(Number.isInteger(no.previstos) && no.previstos >= 0)) throw new Error(`${tipo}: "previstos" de "${no.n || 'raiz'}" inválido`);
  if (!Array.isArray(no.f)) throw new Error(`${tipo}: "${no.n || 'raiz'}" sem a lista de subpastas`);
  const nomes = new Set();
  for (const filho of no.f) {
    if (++conta.n > MAX_PASTAS) throw new Error(`mais de ${MAX_PASTAS} pastas`);
    conferirNo(filho, tipo, nivel + 1, conta);
    if (nomes.has(filho.n)) throw new Error(`${tipo}: "${filho.n}" repetida em "${no.n || 'raiz'}"`);
    nomes.add(filho.n);
  }
}

export function validarPastas(d) {
  if (!d || typeof d !== 'object' || d.versao !== 1) throw new Error('envie { versao: 1, retrato_em, estruturas }');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.retrato_em || '')) throw new Error('retrato_em deve ser AAAA-MM-DD');
  if (!Array.isArray(d.estruturas) || !d.estruturas.length || d.estruturas.length > 12) throw new Error('estruturas: de 1 a 12');
  const ids = new Set();
  const conta = { n: 0 };
  for (const e of d.estruturas) {
    if (!e || !/^[a-z0-9-]{1,40}$/.test(e.id || '')) throw new Error('estrutura com id inválido');
    if (ids.has(e.id)) throw new Error(`estrutura "${e.id}" repetida`);
    ids.add(e.id);
    if (!texto(e.nome, 80) || !texto(e.caminho, 300)) throw new Error(`"${e.id}": falta nome ou caminho`);
    if (e.fonte != null && !texto(e.fonte, 200)) throw new Error(`"${e.id}": fonte inválida`);
    if (!Array.isArray(e.regras) || e.regras.some((r) => !texto(r, 400))) throw new Error(`"${e.id}": regras inválidas`);
    if (e.norma != null) conferirNo(e.norma, 'norma', 0, conta);
    conferirNo(e.retrato, 'retrato', 0, conta);
  }
  return d;
}

export async function lerPastas(env) {
  if (!env.ARQUIVOS) return { status: 503, erro: 'R2 não configurado' };
  const obj = await env.ARQUIVOS.get(CHAVE);
  if (!obj) return { status: 404, erro: 'ainda não há estrutura guardada' };
  const dados = JSON.parse(await obj.text());
  return { status: 200, dados: { ...dados, guardado_em: obj.uploaded?.toISOString?.() || null } };
}

export async function gravarPastas(env, corpoTexto) {
  if (!env.ARQUIVOS) return { status: 503, erro: 'R2 não configurado' };
  if (!corpoTexto || corpoTexto.length > MAX_BYTES) return { status: 413, erro: 'arquivo vazio ou maior que 1 MB' };
  let d;
  try { d = JSON.parse(corpoTexto); } catch { return { status: 400, erro: 'o arquivo não é JSON' }; }
  try { validarPastas(d); } catch (e) { return { status: 422, erro: e.message }; }
  delete d.guardado_em;
  await env.ARQUIVOS.put(CHAVE, JSON.stringify(d), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return lerPastas(env);
}
