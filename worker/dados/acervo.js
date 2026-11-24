// Acervo (0020): o banco único de imagens de projetos, objetos e coleções.
// Gerido na Biblioteca do hub; cada imagem pertence a um ou mais alvos (tabela galeria).
// "Pública" (arquivos.publica) = disponível para o site e afins; desligada = restrita ao projeto.
//
//   GET  acervo?alvo=&publica=0|1&sem_alvo=1&q=&arquivados=1&de=0&limite=60
//                         -> imagens do acervo (só mídias sem dono: fotos da equipe e documentos ficam de fora),
//                            cada uma com os alvos a que pertence, e o total. O marketing só vê as públicas.
//   GET  acervo/alvos     -> projetos, objetos e coleções para os seletores, com a contagem de imagens.
//
// Rotas do site (ferramenta 'site'; o editor do odisse.com.br/admin, pelo Worker site-odisse):
//   GET   acervo/site/projetos                      -> projetos do Universo (para ligar a página do site)
//   GET   acervo/site/projetos/:prj                 -> as imagens PÚBLICAS do projeto
//   POST  acervo/site/projetos/:prj/imagens         -> imagem nova enviada pelo editor do site: entra no acervo
//                                                      já pública (direitos livres) e ligada ao projeto
//   PUT   acervo/site/imagens/:arq/conteudo?variante=g|m|s -> conteúdo dessa imagem
//   GET   acervo/site/imagens/:arq/conteudo?variante=g|m|s -> conteúdo, só de imagem pública
//   PATCH acervo/site/imagens/:arq { versao, texto_alternativo } -> descrição (metadescrição) da imagem pública

import { ErroApi } from './regras.js';
import { normalizar, prefixoDe } from './util.js';

const TIPO_ALVO = { prj: 'projeto', obj: 'objeto', col: 'colecao' };
// mídias do acervo: imagem/vídeo, sem dono (as fotos da equipe e os PDFs têm dono) e nunca protegidas
const MIDIA = "t.categoria IN ('imagem', 'video') AND t.dono_id IS NULL AND t.protegido = 0";

const escaparLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

// alvos (com nome e código) de uma lista de imagens
async function alvosDe(env, ids) {
  if (!ids.length) return new Map();
  const { results } = await env.DB.prepare(
    `SELECT g.id AS galeria_id, g.versao AS galeria_versao, g.arquivo_id, g.alvo_id, g.destaque,
       p.codigo, COALESCE(p.nome_publico, p.nome, o.nome_publico, o.nome, c.nome) AS nome,
       COALESCE(p.nome, o.nome, c.nome) AS nome_interno
     FROM galeria g
     LEFT JOIN projetos p ON p.id = g.alvo_id LEFT JOIN objetos o ON o.id = g.alvo_id LEFT JOIN colecoes c ON c.id = g.alvo_id
     WHERE g.arquivado_em IS NULL AND g.arquivo_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY g.criado_em`,
  ).bind(...ids).all();
  const mapa = new Map();
  for (const r of results) {
    const lista = mapa.get(r.arquivo_id) || [];
    lista.push({ ...r, tipo: TIPO_ALVO[prefixoDe(r.alvo_id)] });
    mapa.set(r.arquivo_id, lista);
  }
  return mapa;
}

async function listaAcervo(env, ferramenta, url, h) {
  h.exigir('arquivos', ferramenta, 'L');
  h.exigir('galeria', ferramenta, 'L');
  const p = url.searchParams;
  const conds = [MIDIA];
  const args = [];
  if (p.get('arquivados') !== '1') conds.push('t.arquivado_em IS NULL');
  if (ferramenta === 'marketing') conds.push('t.publica = 1');
  if (p.get('publica') === '1' || p.get('publica') === '0') { conds.push('t.publica = ?'); args.push(Number(p.get('publica'))); }
  if (p.get('alvo')) {
    conds.push('EXISTS (SELECT 1 FROM galeria g WHERE g.arquivo_id = t.id AND g.alvo_id = ? AND g.arquivado_em IS NULL)');
    args.push(p.get('alvo'));
  } else if (p.get('sem_alvo') === '1') {
    conds.push('NOT EXISTS (SELECT 1 FROM galeria g WHERE g.arquivo_id = t.id AND g.arquivado_em IS NULL)');
  }
  const q = normalizar(p.get('q'));
  if (q) {
    // nome do arquivo, descrição, legenda, crédito ou o nome/código de um alvo
    for (const termo of q.split(' ')) {
      conds.push(`(t.id IN (SELECT registro_id FROM busca WHERE tabela = 'arquivos' AND texto LIKE ? ESCAPE '\\')
        OR EXISTS (SELECT 1 FROM galeria g JOIN busca b ON b.registro_id = g.alvo_id
          WHERE g.arquivo_id = t.id AND g.arquivado_em IS NULL AND b.texto LIKE ? ESCAPE '\\'))`);
      args.push(`%${escaparLike(termo)}%`, `%${escaparLike(termo)}%`);
    }
  }
  const limite = Math.min(Math.max(parseInt(p.get('limite') || '60', 10) || 60, 1), 200);
  const de = Math.max(parseInt(p.get('de') || '0', 10) || 0, 0);
  const onde = conds.join(' AND ');
  const [lista, conta] = await env.DB.batch([
    env.DB.prepare(`SELECT t.* FROM arquivos t WHERE ${onde} ORDER BY t.criado_em DESC, t.id DESC LIMIT ? OFFSET ?`).bind(...args, limite, de),
    env.DB.prepare(`SELECT count(*) AS n, sum(t.publica) AS publicas FROM arquivos t WHERE ${onde}`).bind(...args),
  ]);
  const alvos = await alvosDe(env, lista.results.map((r) => r.id));
  return {
    itens: lista.results.map((r) => ({ ...h.visivel('arquivos', ferramenta, r), alvos: alvos.get(r.id) || [] })),
    total: conta.results[0]?.n || 0,
    publicas: conta.results[0]?.publicas || 0,
    proximo: de + lista.results.length < (conta.results[0]?.n || 0) ? de + lista.results.length : null,
  };
}

// projetos, objetos e coleções com a contagem de imagens (total e públicas), para os seletores
async function alvos(env, ferramenta, h) {
  h.exigir('galeria', ferramenta, 'L');
  h.exigir('projetos', ferramenta, 'L');
  const conta = (alias) => `(SELECT count(*) FROM galeria g JOIN arquivos a ON a.id = g.arquivo_id
      WHERE g.alvo_id = ${alias}.id AND g.arquivado_em IS NULL AND a.arquivado_em IS NULL) AS imagens,
    (SELECT count(*) FROM galeria g JOIN arquivos a ON a.id = g.arquivo_id
      WHERE g.alvo_id = ${alias}.id AND g.arquivado_em IS NULL AND a.arquivado_em IS NULL AND a.publica = 1) AS publicas`;
  const [prj, obj, col] = await env.DB.batch([
    env.DB.prepare(`SELECT x.id, x.codigo, x.nome, x.nome_publico, x.situacao, x.publicavel, x.ano, ${conta('x')}
      FROM projetos x WHERE x.arquivado_em IS NULL ORDER BY x.ano DESC, x.numero DESC`),
    env.DB.prepare(`SELECT x.id, x.nome, x.nome_publico, x.colecao_id, x.publicavel, x.versao, ${conta('x')}
      FROM objetos x WHERE x.arquivado_em IS NULL ORDER BY x.nome`),
    env.DB.prepare(`SELECT x.id, x.nome, x.versao, ${conta('x')} FROM colecoes x WHERE x.arquivado_em IS NULL ORDER BY x.nome`),
  ]);
  return { projetos: prj.results, objetos: obj.results, colecoes: col.results };
}

// ---------------------------------------------------------------- site

// o que o site recebe de uma imagem
const paraSite = (r) => ({
  id: r.id, versao: r.versao, largura: r.largura, altura: r.altura, variantes: r.variantes,
  texto_alternativo: r.texto_alternativo, legenda: r.legenda, credito: r.credito,
});

async function projetoDoSite(env, prj) {
  if (prefixoDe(prj) !== 'prj') throw new ErroApi(404, 'projeto não encontrado');
  const p = await env.DB.prepare('SELECT id FROM projetos WHERE id = ? AND arquivado_em IS NULL').bind(prj).first();
  if (!p) throw new ErroApi(404, 'projeto não encontrado');
}

async function imagemPublica(env, arq) {
  if (prefixoDe(arq) !== 'arq') throw new ErroApi(404, 'imagem não encontrada');
  const a = await env.DB.prepare(`SELECT t.* FROM arquivos t WHERE t.id = ? AND t.arquivado_em IS NULL AND t.publica = 1 AND ${MIDIA}`)
    .bind(arq).first();
  if (!a) throw new ErroApi(404, 'imagem não encontrada ou não é pública');
  return a;
}

async function projetosParaSite(env) {
  const { results } = await env.DB.prepare(
    `SELECT x.id, x.codigo, x.nome, x.nome_publico, x.situacao, x.ano,
       (SELECT count(*) FROM galeria g JOIN arquivos a ON a.id = g.arquivo_id
         WHERE g.alvo_id = x.id AND g.arquivado_em IS NULL AND a.arquivado_em IS NULL AND a.publica = 1) AS publicas
     FROM projetos x WHERE x.arquivado_em IS NULL ORDER BY x.ano DESC, x.numero DESC`,
  ).all();
  return { itens: results };
}

async function publicasDoProjeto(env, prj) {
  await projetoDoSite(env, prj);
  const { results } = await env.DB.prepare(
    `SELECT t.* FROM galeria g JOIN arquivos t ON t.id = g.arquivo_id
     WHERE g.alvo_id = ? AND g.arquivado_em IS NULL AND t.arquivado_em IS NULL AND t.publica = 1 AND ${MIDIA}
     ORDER BY g.ordem IS NULL, g.ordem, g.criado_em`,
  ).bind(prj).all();
  return { itens: results.map(paraSite) };
}

// Imagem enviada pelo editor do site: quem sobe uma imagem ali está escolhendo-a para o site, então ela entra
// pública (com direitos livres) e ligada ao projeto. Se a mesma imagem já estiver no acervo: pública, só liga
// ao projeto; restrita, recusa (quem decide liberar é o Acervo, não o site).
async function novaImagemDoSite(env, prj, corpo, h) {
  await projetoDoSite(env, prj);
  const dados = {
    nome_original: corpo?.nome_original, tipo_mime: corpo?.tipo_mime, sha256: corpo?.sha256,
    largura: corpo?.largura, altura: corpo?.altura, texto_alternativo: corpo?.texto_alternativo || null,
    categoria: 'imagem', direitos: 'livre', publica: 1,
  };
  if (!/^image\//.test(String(dados.tipo_mime || ''))) throw new ErroApi(415, 'envie uma imagem');
  let arq;
  let jaExistia = false;
  try {
    arq = (await h.criar(env, 'site', 'arquivos', dados, { semPermissao: true })).registro;
  } catch (e) {
    if (!(e instanceof ErroApi) || e.status !== 409 || !e.extra?.registro) throw e;
    const existe = await env.DB.prepare('SELECT * FROM arquivos WHERE id = ?').bind(e.extra.registro.id).first();
    if (!existe.publica) {
      throw new ErroApi(409, 'esta imagem já está no Acervo como restrita: para usá-la no site, marque-a como pública no Acervo',
        { restrita: existe.id });
    }
    arq = existe;
    jaExistia = true;
  }
  const ligada = await env.DB.prepare('SELECT 1 FROM galeria WHERE arquivo_id = ? AND alvo_id = ? AND arquivado_em IS NULL')
    .bind(arq.id, prj).first();
  if (!ligada) await h.criar(env, 'site', 'galeria', { arquivo_id: arq.id, alvo_id: prj }, { semPermissao: true });
  return { registro: paraSite(arq), ja_existia: jaExistia, criado: !jaExistia };
}

async function rotasSite(env, m, [, , tipo, id, acao], corpo, url, request, cors, h) {
  if (tipo === 'projetos' && !id && m === 'GET') return projetosParaSite(env);
  if (tipo === 'projetos' && id && !acao && m === 'GET') return publicasDoProjeto(env, id);
  if (tipo === 'projetos' && id && acao === 'imagens' && m === 'POST') return novaImagemDoSite(env, id, corpo, h);
  if (tipo === 'imagens' && id) {
    await imagemPublica(env, id);
    if (acao === 'conteudo' && m === 'PUT') return h.enviarConteudo(env, 'site', id, url, request, { semPermissao: true });
    if (acao === 'conteudo' && m === 'GET') return h.lerConteudo(env, 'site', id, url, cors, { semPermissao: true });
    if (!acao && m === 'PATCH') {
      const fora = Object.keys(corpo || {}).filter((k) => !['versao', 'texto_alternativo'].includes(k));
      if (fora.length) throw new ErroApi(403, 'o site só muda a descrição da imagem (texto_alternativo)');
      const r = await h.alterar(env, 'site', 'arquivos', id, corpo);
      return { registro: paraSite(r.registro), semMudanca: r.semMudanca };
    }
  }
  throw new ErroApi(404, 'rota não encontrada');
}

// Devolve uma Response, um objeto (vira JSON) ou undefined (não é rota do acervo).
export async function rotasAcervo(env, ferramenta, m, partes, corpo, url, request, cors, h) {
  const [rota, id] = partes;
  if (rota !== 'acervo') return undefined;
  if (id === 'site') {
    if (ferramenta !== 'site' && ferramenta !== 'maquina') throw new ErroApi(403, 'rotas do site');
    return rotasSite(env, m, partes, corpo, url, request, cors, h);
  }
  if (ferramenta === 'site') throw new ErroApi(403, 'esta ferramenta não pode ver isto');
  if (!id && m === 'GET') return listaAcervo(env, ferramenta, url, h);
  if (id === 'alvos' && m === 'GET') return alvos(env, ferramenta, h);
  throw new ErroApi(404, 'rota não encontrada');
}

