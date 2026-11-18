// Equipe (0011): cadastro comum, editado na página Equipe do hub e lido por todas as ferramentas.
//
//   GET  equipe/quadro[?todos=1]        -> pessoas (ativas; todas com ?todos=1) com nome, cargo e título na forma
//                                          do tratamento, registro formatado, foto, se tem assinatura, bios
//                                          + as listas de cargos e títulos. Uma chamada só para a página Equipe.
//   GET  equipe/assinantes?para=<uso>   -> quem está ativo e pode assinar aquele uso (proposta, contrato,
//                                          documento, rrt): o seletor de todas as ferramentas.
//   GET  equipe/publica                 -> só quem "aparece no site" (nome, cargo PT/EN, bios, foto). Única rota
//                                          da equipe aberta ao site.
//   GET  equipe/:id/foto?variante=g|m|s -> a foto (o site só vê a de quem é público).
//   PUT  equipe/:id/assinatura?versao=N -> (só o hub) PNG da assinatura manuscrita, até 2 MB. Vira um arquivo
//                                          `protegido` no R2; o anterior é arquivado (nada se apaga).
//   POST equipe/:id/assinatura/remover { versao } -> (só o hub) tira a assinatura da pessoa.
//   GET  equipe/:id/assinatura?uso=<uso>&registro=<doc_|ppt_|ctr_…>
//                                       -> o PNG, só na emissão: hub, vendas e Projetos; só para um uso que a
//                                          pessoa pode assinar; cada leitura vai para o histórico (ler_sensivel).
//                                          Na prévia, as telas mostram só a caixa do lugar da assinatura.
//                                          uso=conferencia: só o hub, para a página Equipe mostrar a assinatura
//                                          guardada (também vai para o histórico, como conferência).

import { ErroApi } from './regras.js';
import { CONSELHOS, USOS_ASSINATURA } from './esquema.js';
import { novoId, agoraISO } from './util.js';

const MAX_ASSINATURA = 2 * 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const LEEM_ASSINATURA = ['hub', 'vendas', 'projetos'];
const VARIANTES = { g: '', m: '-m', s: '-s' };

const forma = (t) => `CASE WHEN e.tratamento = 'f' THEN ${t}.nome_f ELSE ${t}.nome_m END`;

const SELECT = `SELECT e.id, e.pessoa_id, e.versao, e.ativo, e.socio, e.papel, e.tratamento, e.cargo_id, e.titulo_id,
    COALESCE(e.nome_assinatura, p.nome) AS nome_assinatura, p.nome, p.apelido, p.email,
    ${forma('c')} AS cargo, c.nome_en AS cargo_en, ${forma('t')} AS titulo, t.nome_en AS titulo_en,
    e.conselho, e.registro, e.registro_uf, e.foto_id, (e.assinatura_id IS NOT NULL) AS tem_assinatura, e.assina,
    e.bio_pt, e.bio_en, e.publico, e.ordem, e.desde, e.ate,
    max(e.atualizado_em, p.atualizado_em, COALESCE(c.atualizado_em, ''), COALESCE(t.atualizado_em, '')) AS atualizado_em
  FROM equipe e JOIN pessoas p ON p.id = e.pessoa_id
  LEFT JOIN cargos c ON c.id = e.cargo_id LEFT JOIN titulos t ON t.id = e.titulo_id`;
const ORDEM = 'ORDER BY e.ativo DESC, e.socio DESC, e.ordem IS NULL, e.ordem, p.nome';

// "CAU/PB A123456-7"; sem UF, "CAU A123456-7"
export const registroFormatado = (conselho, registro, uf) =>
  registro ? [CONSELHOS[conselho] && (uf ? `${CONSELHOS[conselho]}/${uf}` : CONSELHOS[conselho]), registro].filter(Boolean).join(' ') : null;

function montar(r) {
  return {
    ...r,
    tem_assinatura: !!r.tem_assinatura,
    assina: (r.assina || '').split(',').filter(Boolean),
    registro_formatado: registroFormatado(r.conselho, r.registro, r.registro_uf),
  };
}

export async function quadroEquipe(env, { todos = false } = {}) {
  const [pessoas, cargos, titulos] = await env.DB.batch([
    env.DB.prepare(`${SELECT} WHERE e.arquivado_em IS NULL ${todos ? '' : 'AND e.ativo = 1'} ${ORDEM}`),
    env.DB.prepare('SELECT id, nome_m, nome_f, nome_en, ordem, versao FROM cargos WHERE arquivado_em IS NULL ORDER BY ordem, nome_m'),
    env.DB.prepare('SELECT id, nome_m, nome_f, nome_en, ordem, versao FROM titulos WHERE arquivado_em IS NULL ORDER BY ordem, nome_m'),
  ]);
  return { itens: pessoas.results.map(montar), cargos: cargos.results, titulos: titulos.results };
}

export async function assinantes(env, uso) {
  if (!USOS_ASSINATURA.includes(uso)) throw new ErroApi(422, `para: ${USOS_ASSINATURA.join(', ')}`);
  const { results } = await env.DB.prepare(
    `${SELECT} WHERE e.arquivado_em IS NULL AND e.ativo = 1 AND instr(',' || COALESCE(e.assina, '') || ',', ?) > 0 ${ORDEM}`,
  ).bind(`,${uso},`).all();
  // o seletor não precisa de bios nem de e-mail
  return {
    itens: results.map(montar).map(({ bio_pt, bio_en, email, apelido, ...r }) => r),
  };
}

export async function equipePublica(env) {
  const { results } = await env.DB.prepare(
    `${SELECT} WHERE e.arquivado_em IS NULL AND e.ativo = 1 AND e.publico = 1 ${ORDEM}`,
  ).all();
  return {
    itens: results.map((r) => ({
      id: r.id, nome: r.nome, cargo: r.cargo, cargo_en: r.cargo_en, titulo: r.titulo, titulo_en: r.titulo_en,
      bio_pt: r.bio_pt, bio_en: r.bio_en, foto_id: r.foto_id, ordem: r.ordem, atualizado_em: r.atualizado_em,
    })),
  };
}

// Foto: só arquivo de imagem comum (nunca um protegido), como na leitura de arquivos (a menor que houver).
async function foto(env, ferramenta, id, url, cors, h) {
  const e = await env.DB.prepare('SELECT * FROM equipe WHERE id = ?').bind(id).first();
  if (!e || e.arquivado_em) throw new ErroApi(404, 'pessoa não encontrada');
  if (ferramenta === 'site') {
    if (!(e.publico && e.ativo)) throw new ErroApi(404, 'pessoa não encontrada');
  } else h.exigir('equipe', ferramenta, 'L');
  if (!e.foto_id) throw new ErroApi(404, 'sem foto');
  const arq = await env.DB.prepare('SELECT protegido FROM arquivos WHERE id = ?').bind(e.foto_id).first();
  if (!arq || arq.protegido) throw new ErroApi(404, 'sem foto');
  if (!env.ARQUIVOS) throw new ErroApi(503, 'armazenamento de arquivos (R2) ainda não ligado');
  const pedida = url.searchParams.get('variante') || 'g';
  if (!(pedida in VARIANTES)) throw new ErroApi(400, 'variante: g, m ou s');
  for (const v of { s: ['s', 'm', 'g'], m: ['m', 'g'], g: ['g'] }[pedida]) {
    const obj = await env.ARQUIVOS.get(`arq/${e.foto_id}${VARIANTES[v]}`);
    if (!obj) continue;
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
        // o id da foto entra no cache: trocar a foto = id novo; por isso pode durar
        'Cache-Control': ferramenta === 'site' ? 'public, max-age=86400' : 'private, max-age=3600',
        ...cors,
      },
    });
  }
  throw new ErroApi(404, 'conteúdo ainda não enviado');
}

async function carregar(env, id, versao) {
  const e = await env.DB.prepare('SELECT * FROM equipe WHERE id = ?').bind(id).first();
  if (!e) throw new ErroApi(404, 'pessoa não encontrada');
  if (e.arquivado_em) throw new ErroApi(409, 'registro arquivado: restaure antes de editar');
  if (!Number.isInteger(versao)) throw new ErroApi(400, 'informe a versão que você está editando (versao)');
  if (versao !== e.versao) throw new ErroApi(409, 'conflito', { registro: e });
  return e;
}

// Só o hub sobe ou tira assinaturas. Até o login único, "só os sócios" = só quem tem a senha do Universo.
async function enviarAssinatura(env, ferramenta, id, url, request, h) {
  if (ferramenta !== 'hub') throw new ErroApi(403, 'só o Universo muda assinaturas');
  if (!env.ARQUIVOS) throw new ErroApi(503, 'armazenamento de arquivos (R2) ainda não ligado');
  const e = await carregar(env, id, Number(url.searchParams.get('versao')));
  if (Number(request.headers.get('Content-Length') || 0) > MAX_ASSINATURA) throw new ErroApi(413, 'assinatura grande demais (máximo 2 MB)');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_ASSINATURA) throw new ErroApi(413, 'assinatura grande demais (máximo 2 MB)');
  if (!PNG.every((b, i) => bytes[i] === b)) throw new ErroApi(415, 'envie a assinatura em PNG (fundo transparente)');
  // largura e altura do cabeçalho do PNG (IHDR)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const largura = bytes.byteLength >= 24 ? dv.getUint32(16) : null;
  const altura = bytes.byteLength >= 24 ? dv.getUint32(20) : null;
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

  const arqId = novoId('arq');
  await env.ARQUIVOS.put(`arq/${arqId}`, bytes, { httpMetadata: { contentType: 'image/png' } });
  const agora = agoraISO();
  const p = await env.DB.prepare('SELECT nome FROM pessoas WHERE id = ?').bind(e.pessoa_id).first();
  const registro = {
    id: arqId, criado_em: agora, atualizado_em: agora, criado_por: ferramenta, atualizado_por: ferramenta, versao: 1,
    arquivado_em: null, dono_id: id, nome_original: `assinatura-${(p?.nome || id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
    tipo_mime: 'image/png', tamanho: bytes.byteLength, sha256: sha, variantes: 'g', categoria: 'outro', visivel_cliente: 0,
    largura, altura, direitos: 'uso_interno', protegido: 1,
  };
  // o arquivo entra antes da pessoa apontar para ele (chave estrangeira); se a pessoa mudou nesse meio-tempo,
  // o arquivo novo é arquivado e a tela recebe o conflito
  const cols = Object.keys(registro);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO arquivos (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .bind(...cols.map((k) => registro[k])),
    env.DB.prepare(`INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas) VALUES (?, 'arquivos', 'criar', ?, ?, ?)`)
      .bind(arqId, ferramenta, agora, JSON.stringify({ dono_id: id, categoria: 'outro', protegido: 1, nome_original: registro.nome_original })),
  ]);
  let nova;
  try {
    nova = await h.gravar(env, ferramenta, 'equipe', e, { assinatura_id: arqId }, 'alterar',
      { extras: arquivarAnterior(env, e, ferramenta, agora) });
  } catch (err) {
    await env.DB.batch(arquivarAnterior(env, { id, assinatura_id: arqId }, ferramenta, agoraISO()));
    throw err;
  }
  return { ok: true, registro: nova, arquivo_id: arqId };
}

// Arquiva o arquivo da assinatura que a pessoa deixou de usar. Guardado: só age se a pessoa já não aponta
// para ele (se a gravação da pessoa não pegou, nada muda).
function arquivarAnterior(env, e, ferramenta, agora) {
  if (!e.assinatura_id) return [];
  const solta = `(SELECT assinatura_id FROM equipe WHERE id = ?) IS NOT ?`;
  return [
    env.DB.prepare(`INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
      SELECT ?, 'arquivos', 'arquivar', ?, ?, ? WHERE ${solta}
        AND EXISTS (SELECT 1 FROM arquivos WHERE id = ? AND arquivado_em IS NULL)`)
      .bind(e.assinatura_id, ferramenta, agora, JSON.stringify({ motivo: 'assinatura trocada ou removida' }),
        e.id, e.assinatura_id, e.assinatura_id),
    env.DB.prepare(`UPDATE arquivos SET arquivado_em = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ?
      WHERE id = ? AND arquivado_em IS NULL AND ${solta}`)
      .bind(agora, agora, ferramenta, e.assinatura_id, e.id, e.assinatura_id),
  ];
}

async function removerAssinatura(env, ferramenta, id, corpo, h) {
  if (ferramenta !== 'hub') throw new ErroApi(403, 'só o Universo muda assinaturas');
  const e = await carregar(env, id, Number(corpo?.versao));
  if (!e.assinatura_id) return { registro: e, semMudanca: true };
  const nova = await h.gravar(env, ferramenta, 'equipe', e, { assinatura_id: null }, 'alterar',
    { extras: arquivarAnterior(env, e, ferramenta, agoraISO()) });
  return { ok: true, registro: nova };
}

async function lerAssinatura(env, ferramenta, id, url) {
  if (!LEEM_ASSINATURA.includes(ferramenta)) throw new ErroApi(403, 'esta ferramenta não pode ver isto');
  const uso = url.searchParams.get('uso');
  const conferencia = uso === 'conferencia';
  if (conferencia && ferramenta !== 'hub') throw new ErroApi(403, 'só o Universo confere assinaturas');
  if (!conferencia && !USOS_ASSINATURA.includes(uso)) throw new ErroApi(422, `uso: ${USOS_ASSINATURA.join(', ')}`);
  const registro = url.searchParams.get('registro') || null;
  if (registro && !/^(doc|ppt|ctr|prj)_[0-9A-Za-z_]{1,40}$/.test(registro)) throw new ErroApi(422, 'registro: id do documento emitido');
  const e = await env.DB.prepare('SELECT * FROM equipe WHERE id = ?').bind(id).first();
  if (!e || e.arquivado_em) throw new ErroApi(404, 'pessoa não encontrada');
  if (!conferencia && !e.ativo) throw new ErroApi(409, 'esta pessoa não está ativa na equipe');
  if (!conferencia && !(e.assina || '').split(',').includes(uso)) throw new ErroApi(403, 'esta pessoa não assina isto');
  if (!e.assinatura_id) throw new ErroApi(404, 'assinatura ainda não enviada');
  if (!env.ARQUIVOS) throw new ErroApi(503, 'armazenamento de arquivos (R2) ainda não ligado');
  const obj = await env.ARQUIVOS.get(`arq/${e.assinatura_id}`);
  if (!obj) throw new ErroApi(404, 'assinatura ainda não enviada');
  await env.DB.prepare(`INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas) VALUES (?, 'equipe', 'ler_sensivel', ?, ?, ?)`)
    .bind(id, ferramenta, agoraISO(), JSON.stringify({ assinatura: e.assinatura_id, uso, registro })).run();
  return new Response(obj.body, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}

// Devolve uma Response, um objeto (vira JSON) ou undefined (não é rota da equipe).
export async function rotasEquipe(env, ferramenta, m, [rota, id, acao, n], corpo, url, request, cors, h) {
  if (rota !== 'equipe' || !id) return undefined;
  if (id === 'publica' && m === 'GET') {
    if (ferramenta !== 'site') h.exigir('equipe', ferramenta, 'L');
    return equipePublica(env);
  }
  if (ferramenta === 'site') {
    if (acao === 'foto' && m === 'GET') return foto(env, ferramenta, id, url, cors, h);
    throw new ErroApi(403, 'esta ferramenta não pode ver isto');
  }
  if (id === 'quadro' && m === 'GET') {
    h.exigir('equipe', ferramenta, 'L');
    return quadroEquipe(env, { todos: url.searchParams.get('todos') === '1' });
  }
  if (id === 'assinantes' && m === 'GET') {
    h.exigir('equipe', ferramenta, 'L');
    return assinantes(env, url.searchParams.get('para'));
  }
  if (acao === 'foto' && m === 'GET') return foto(env, ferramenta, id, url, cors, h);
  if (acao === 'assinatura') {
    if (!n && m === 'PUT') return enviarAssinatura(env, ferramenta, id, url, request, h);
    if (!n && m === 'GET') return lerAssinatura(env, ferramenta, id, url);
    if (n === 'remover' && m === 'POST') return removerAssinatura(env, ferramenta, id, corpo, h);
    throw new ErroApi(405, 'método não aceito');
  }
  return undefined;
}
