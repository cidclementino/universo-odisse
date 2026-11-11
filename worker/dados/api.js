// API de dados do Universo (/api/v1): a única porta do D1 e do R2.
//
// Quem chama é sempre uma "ferramenta" (hub, vendas, projetos, fornecedores, marketing, maquina);
// o index.js descobre qual pela senha/token ou pelo ponto de entrada da ligação entre Workers.
// As regras de cada tabela (campos, permissões, busca, duplicados) ficam em esquema.js.
//
// Rotas (todas sob /api/v1):
//   GET    estado                          -> { ok, ferramenta, banco, arquivos, migracao }
//   GET    busca?q=…[&tabela=…]            -> registros que a ferramenta pode ver
//   GET    registros/:id                   -> qualquer registro pelo id (o prefixo diz a tabela)
//   GET    nucleos
//   GET    <rota>?filtro=…&q=…&arquivados=1&limite=50&de=0
//   POST   <rota>                          -> cria (409 possivel_duplicado: reenviar com confirmar_novo: true)
//   GET    <rota>/:id
//   PATCH  <rota>/:id      { versao, …campos }   -> 409 conflito se a versão for velha
//   POST   <rota>/:id/arquivar   { versao }
//   POST   <rota>/:id/restaurar  { versao }
//   GET    <rota>/:id/historico
//   GET    <rota>/:id/versoes                 (só tabelas com versões)
//   POST   <rota>/:id/versoes/:n/restaurar { versao }
//   PUT    arquivos/:id/conteudo?variante=g|m|s  (corpo binário; cada variante sobe uma vez só)
//   GET    arquivos/:id/conteudo?variante=g|m|s
//   GET    comercial/painel                   -> oportunidades abertas com cliente, última proposta e próxima ação
//   GET    propostas/numeracao                -> { valor } último número usado (null = ainda não ajustada)
//   POST   propostas/numeracao  { minimo }    -> leva a numeração até pelo menos `minimo` (nunca volta)
// propostas: POST normal numera sozinho; { revisao_de } cria a revisão seguinte; { importada_de, numero,
//   codigo, revisao } traz uma proposta antiga. Com o PDF congelado (arquivo_pdf_id), cálculo e valores travam.
// pessoas-sensiveis: só por id (o mesmo da pessoa); só o vendas; cada leitura vai para o histórico.

import { TABELAS, ROTAS, PREFIXOS, COMUNS } from './esquema.js';
import { novoId, prefixoDe, agoraISO, normalizar, limpar } from './util.js';
import { ErroApi, REGRAS, proximoNumero, ajustarSequencia, valorSequencia, painelComercial } from './regras.js';

export { proximoNumero };

const SESSAO_VERSOES_MS = 10 * 60 * 1000; // edições dentro de 10 min viram uma versão só
const MAX_VERSOES = 10;
const MAX_IMAGEM = 20 * 1024 * 1024;
const MAX_ARQUIVO = 95 * 1024 * 1024; // acima disso, envio em partes (ainda não implementado)
const VARIANTES = { g: '', m: '-m', s: '-s' };

// ---------------------------------------------------------------- acesso

const permissao = (tabela, ferramenta) => TABELAS[tabela]?.permissoes?.[ferramenta] || null;

function exigir(tabela, ferramenta, nivel) {
  const p = permissao(tabela, ferramenta);
  if (!p || (nivel === 'E' && p !== 'E')) {
    throw new ErroApi(403, nivel === 'E' ? 'esta ferramenta não pode editar isto' : 'esta ferramenta não pode ver isto');
  }
}

// Campos que a ferramenta enxerga (comuns + restritos, quando houver restrição).
function visivel(tabela, ferramenta, linha) {
  if (!linha) return linha;
  const restritos = TABELAS[tabela].campos_restritos?.[ferramenta];
  if (!restritos) return linha;
  const out = {};
  for (const k of [...COMUNS, ...restritos]) if (k in linha) out[k] = linha[k];
  return out;
}

// ---------------------------------------------------------------- SQL auxiliar

function sqlBusca(tabela, id, linha, guardado) {
  const def = TABELAS[tabela];
  if (!def.busca || def.sensivel) return null;
  const { titulo, partes } = def.busca(linha);
  const texto = normalizar(partes.filter((p) => p !== null && p !== undefined && p !== '').join(' '));
  const sql = `INSERT INTO busca (registro_id, tabela, titulo, chave, texto, arquivado, atualizado_em)
    SELECT ?, ?, ?, ?, ?, ?, ? ${guardado ? 'WHERE changes() = 1' : ''}
    ON CONFLICT (registro_id) DO UPDATE SET titulo = excluded.titulo, chave = excluded.chave,
      texto = excluded.texto, arquivado = excluded.arquivado, atualizado_em = excluded.atualizado_em`;
  return [sql, [id, tabela, String(titulo || ''), normalizar(titulo), texto, linha.arquivado_em ? 1 : 0, agoraISO()]];
}

// Histórico: tabelas sensíveis registram só o nome dos campos mudados, nunca o valor.
function sqlHistorico(tabela, id, acao, por, mudancas, guardado) {
  const def = TABELAS[tabela];
  let registro = mudancas;
  if (def.sensivel && mudancas) registro = { campos: Object.keys(mudancas) };
  const sql = `INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
    SELECT ?, ?, ?, ?, ?, ? ${guardado ? 'WHERE changes() = 1' : ''}`;
  return [sql, [id, tabela, acao, por, agoraISO(), registro ? JSON.stringify(registro) : null]];
}

const prep = (env, [sql, args]) => env.DB.prepare(sql).bind(...args);

// Traduz erros do SQLite para mensagens que fazem sentido na tela.
function traduzirErro(e) {
  const m = String(e?.message || e);
  if (/UNIQUE constraint failed/.test(m)) {
    const campos = [...m.matchAll(/\b[a-z_]+\.([a-z_0-9]+)/g)].map((x) => x[1]).filter((c) => c !== 'id');
    return new ErroApi(409, campos.length
      ? `já existe um registro ativo com o mesmo ${campos.join(' + ')}`
      : 'já existe um registro ativo com estes dados', { campos });
  }
  if (/FOREIGN KEY constraint failed/.test(m)) return new ErroApi(422, 'um dos registros ligados não existe');
  if (/CHECK constraint failed/.test(m)) return new ErroApi(422, 'valor fora do permitido', { detalhe: m });
  return e;
}

async function buscarLinha(env, tabela, id) {
  return env.DB.prepare(`SELECT * FROM ${tabela} WHERE id = ?`).bind(id).first();
}

// Confere referências "a qualquer tipo" (sem chave estrangeira no banco).
async function conferirReferencias(env, tabela, valores) {
  const campos = TABELAS[tabela].campos;
  for (const [k, def] of Object.entries(campos)) {
    const v = valores[k];
    if (def.tipo !== 'ref' || !v) continue;
    const alvo = PREFIXOS[prefixoDe(v)];
    if (!alvo) throw new ErroApi(422, `${def.rotulo || k}: esse tipo de registro ainda não existe no banco`);
    const ok = await env.DB.prepare(`SELECT 1 FROM ${alvo} WHERE id = ?`).bind(v).first();
    if (!ok) throw new ErroApi(422, `${def.rotulo || k}: registro ${v} não encontrado`);
  }
}

// ---------------------------------------------------------------- validação

function validar(tabela, corpo, { parcial = false, atual = null } = {}) {
  const def = TABELAS[tabela];
  const out = {};
  const erros = [];
  for (const [k, c] of Object.entries(def.campos)) {
    if (parcial && !(k in corpo)) continue;
    if (atual && def.imutaveis?.includes(k)) {
      if (k in corpo && corpo[k] !== atual[k]) erros.push(`${c.rotulo || k}: não pode mudar depois de criado`);
      continue;
    }
    try {
      out[k] = limpar(k, corpo[k], c);
    } catch (e) {
      erros.push(e.message);
    }
  }
  if (erros.length) throw new ErroApi(422, erros.join(' · '), { erros });
  return out;
}

// ---------------------------------------------------------------- duplicados (regra do Radar)
// Cada campo do par é: bate (iguais), ausente (falta em um dos dois) ou conflito (diferentes).

function classificar(campos, a, b) {
  const r = {};
  for (const k of campos) {
    const x = k === 'nome' ? normalizar(a[k]) : a[k];
    const y = k === 'nome' ? normalizar(b[k]) : b[k];
    r[k] = !x || !y ? 'ausente' : x === y ? 'bate' : 'conflito';
  }
  return r;
}

async function procurarDuplicados(env, tabela, valores) {
  const def = TABELAS[tabela];
  const fortes = def.duplicados.filter((k) => valores[k]);
  const conds = fortes.map((k) => `${k} = ?`);
  const args = fortes.map((k) => valores[k]);
  const sql = `SELECT * FROM ${tabela} WHERE arquivado_em IS NULL AND (${[
    ...conds,
    `id IN (SELECT registro_id FROM busca WHERE tabela = ? AND chave = ? AND arquivado = 0)`,
  ].join(' OR ')}) LIMIT 10`;
  const { results } = await env.DB.prepare(sql).bind(...args, tabela, normalizar(valores.nome)).all();
  return results.map((r) => ({ registro: r, campos: classificar(['nome', ...def.duplicados], valores, r) }));
}

// ---------------------------------------------------------------- operações

async function listar(env, ferramenta, tabela, url) {
  exigir(tabela, ferramenta, 'L');
  const def = TABELAS[tabela];
  if (def.sensivel) throw new ErroApi(400, 'dados sensíveis só podem ser lidos um a um, pelo id');
  const p = url.searchParams;
  const conds = [];
  const args = [];
  if (p.get('arquivados') !== '1') conds.push('t.arquivado_em IS NULL');
  for (const f of def.filtros) {
    if (p.has(f)) { conds.push(`t.${f} = ?`); args.push(p.get(f)); }
  }
  if (tabela === 'vinculos' && p.has('id')) {
    conds.push('(t.de_id = ? OR t.para_id = ?)');
    args.push(p.get('id'), p.get('id'));
  }
  const q = normalizar(p.get('q'));
  let junta = '';
  if (q && def.busca) {
    junta = 'JOIN busca b ON b.registro_id = t.id';
    for (const termo of q.split(' ')) {
      conds.push(`b.texto LIKE ? ESCAPE '\\'`);
      args.push(`%${termo.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
    }
  }
  const limite = Math.min(Math.max(parseInt(p.get('limite') || '50', 10) || 50, 1), 200);
  const de = Math.max(parseInt(p.get('de') || '0', 10) || 0, 0);
  const ordem = def.ordem.split(',').map((o) => `t.${o.trim()}`).join(', ');
  const sql = `SELECT t.* FROM ${tabela} t ${junta} ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
    ORDER BY ${ordem} LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...args, limite, de).all();
  return { itens: results.map((r) => visivel(tabela, ferramenta, r)), proximo: results.length === limite ? de + limite : null };
}

async function ler(env, ferramenta, tabela, id) {
  exigir(tabela, ferramenta, 'L');
  const linha = await buscarLinha(env, tabela, id);
  if (!linha) throw new ErroApi(404, 'não encontrado');
  if (TABELAS[tabela].sensivel) {
    await prep(env, sqlHistorico(tabela, id, 'ler_sensivel', ferramenta, null, false)).run();
  }
  return visivel(tabela, ferramenta, linha);
}

async function criar(env, ferramenta, tabela, corpo) {
  exigir(tabela, ferramenta, 'E');
  const def = TABELAS[tabela];
  if (def.so_leitura_na_criacao) throw new ErroApi(405, 'estes registros são criados pelo próprio Universo');
  const valores = { ...(def.padroes || {}), ...validar(tabela, corpo) };
  for (const [k, v] of Object.entries(def.padroes || {})) if (valores[k] === null) valores[k] = v;

  let id;
  if (def.id_da_tabela) {
    // mesma chave de outro registro (pessoas_sensiveis usa o id da pessoa)
    id = String(corpo.id || '');
    if (prefixoDe(id) !== def.prefixo) throw new ErroApi(422, `informe o id da ${def.id_da_tabela.replace(/s$/, '')}`);
  } else {
    id = novoId(def.prefixo);
  }
  await conferirReferencias(env, tabela, valores);

  // arquivos de mídia: o mesmo arquivo não entra duas vezes no acervo
  if (tabela === 'arquivos' && valores.sha256 && ['imagem', 'video'].includes(valores.categoria)) {
    const existe = await env.DB.prepare(
      `SELECT * FROM arquivos WHERE sha256 = ? AND categoria IN ('imagem','video') AND arquivado_em IS NULL`,
    ).bind(valores.sha256).first();
    if (existe) throw new ErroApi(409, 'esta mídia já está no acervo', { registro: visivel(tabela, ferramenta, existe) });
  }

  // duplicados de contatos
  const revisoes = [];
  if (def.duplicados) {
    const candidatos = await procurarDuplicados(env, tabela, valores);
    const comAlgoQueBate = candidatos.filter((c) => Object.values(c.campos).includes('bate'));
    const semConflito = comAlgoQueBate.filter((c) => !Object.values(c.campos).includes('conflito'));
    if (semConflito.length && !corpo.confirmar_novo) {
      throw new ErroApi(409, 'possivel_duplicado', {
        candidatos: semConflito.map((c) => ({ registro: visivel(tabela, ferramenta, c.registro), campos: c.campos })),
      });
    }
    for (const c of comAlgoQueBate) {
      if (Object.values(c.campos).includes('conflito')) revisoes.push(c);
    }
  }

  // regras da tabela (numeração, funil…): podem completar os valores e acrescentar comandos ao lote
  const extras = REGRAS[tabela]?.criar ? await REGRAS[tabela].criar(env, ferramenta, valores, corpo) : [];

  const agora = agoraISO();
  const linha = {
    id, criado_em: agora, atualizado_em: agora, criado_por: ferramenta, atualizado_por: ferramenta,
    versao: 1, arquivado_em: null, ...valores,
  };
  if (tabela === 'arquivos') linha.variantes = null;
  const cols = Object.keys(linha);
  const stmts = [
    env.DB.prepare(`INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .bind(...cols.map((k) => linha[k])),
    prep(env, sqlHistorico(tabela, id, 'criar', ferramenta, valores, false)),
  ];
  const b = sqlBusca(tabela, id, linha, false);
  if (b) stmts.push(prep(env, b));
  stmts.push(...extras);
  for (const c of revisoes) {
    stmts.push(env.DB.prepare(
      `INSERT INTO revisoes (id, criado_em, atualizado_em, criado_por, atualizado_por, tipo, registros, campos)
       VALUES (?, ?, ?, ?, ?, 'duplicado_contato', ?, ?)`,
    ).bind(novoId('rev'), agora, agora, ferramenta, ferramenta, JSON.stringify([id, c.registro.id]), JSON.stringify(c.campos)));
  }
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    throw traduzirErro(e);
  }
  return { registro: visivel(tabela, ferramenta, linha), revisoes: revisoes.length };
}

// Monta e executa um UPDATE com trava de versão. `mudancas` = { campo: novoValor }.
// Tudo num lote só (transação): histórico, versão e busca só entram se o UPDATE pegou.
async function gravar(env, ferramenta, tabela, atual, mudancas, acao, { versaoForcada = false } = {}) {
  const def = TABELAS[tabela];
  const agora = agoraISO();
  const nova = { ...atual, ...mudancas, versao: atual.versao + 1, atualizado_em: agora, atualizado_por: ferramenta };
  const sets = [...Object.keys(mudancas), 'versao', 'atualizado_em', 'atualizado_por'];
  const stmts = [
    env.DB.prepare(`UPDATE ${tabela} SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND versao = ?`)
      .bind(...sets.map((k) => nova[k]), atual.id, atual.versao),
  ];
  const diff = {};
  for (const k of Object.keys(mudancas)) diff[k] = [atual[k], mudancas[k]];
  stmts.push(prep(env, sqlHistorico(tabela, atual.id, acao, ferramenta, diff, true)));

  if (def.versoes) {
    const ultima = await env.DB.prepare('SELECT em FROM versoes WHERE registro_id = ? ORDER BY id DESC LIMIT 1').bind(atual.id).first();
    const precisa = versaoForcada || !ultima || Date.now() - Date.parse(ultima.em) > SESSAO_VERSOES_MS;
    if (precisa) {
      stmts.push(env.DB.prepare(
        `INSERT INTO versoes (registro_id, tabela, em, motivo, dados) SELECT ?, ?, ?, ?, ? WHERE changes() = 1`,
      ).bind(atual.id, tabela, agora, acao === 'restaurar' ? 'restauracao' : 'edicao', JSON.stringify(atual)));
    }
  }
  const b = sqlBusca(tabela, atual.id, nova, true);
  if (b) stmts.push(prep(env, b));
  if (def.versoes) {
    stmts.push(env.DB.prepare(
      `DELETE FROM versoes WHERE registro_id = ? AND id NOT IN
        (SELECT id FROM versoes WHERE registro_id = ? ORDER BY id DESC LIMIT ${MAX_VERSOES})`,
    ).bind(atual.id, atual.id));
  }
  let res;
  try {
    res = await env.DB.batch(stmts);
  } catch (e) {
    throw traduzirErro(e);
  }
  if (res[0].meta.changes !== 1) {
    const agoraNoBanco = await buscarLinha(env, tabela, atual.id);
    throw new ErroApi(409, 'conflito', { registro: visivel(tabela, ferramenta, agoraNoBanco) });
  }
  return nova;
}

async function carregarParaEditar(env, ferramenta, tabela, id, corpo) {
  exigir(tabela, ferramenta, 'E');
  const atual = await buscarLinha(env, tabela, id);
  if (!atual) throw new ErroApi(404, 'não encontrado');
  const versao = Number(corpo?.versao);
  if (!Number.isInteger(versao)) throw new ErroApi(400, 'informe a versão que você está editando (versao)');
  if (versao !== atual.versao) throw new ErroApi(409, 'conflito', { registro: visivel(tabela, ferramenta, atual) });
  return atual;
}

async function alterar(env, ferramenta, tabela, id, corpo) {
  const atual = await carregarParaEditar(env, ferramenta, tabela, id, corpo);
  if (atual.arquivado_em) throw new ErroApi(409, 'registro arquivado: restaure antes de editar');
  const valores = validar(tabela, corpo, { parcial: true, atual });
  // campos obrigatórios não podem ser esvaziados
  for (const [k, c] of Object.entries(TABELAS[tabela].campos)) {
    if (k in valores && valores[k] === null && c.obrig) throw new ErroApi(422, `${c.rotulo || k}: obrigatório`);
  }
  const mudancas = {};
  for (const [k, v] of Object.entries(valores)) if (v !== atual[k]) mudancas[k] = v;
  if (tabela === 'revisoes' && 'situacao' in mudancas) mudancas.decidido_em = mudancas.situacao === 'pendente' ? null : agoraISO();
  if (!Object.keys(mudancas).length) return { registro: visivel(tabela, ferramenta, atual), semMudanca: true };
  if (REGRAS[tabela]?.alterar) await REGRAS[tabela].alterar(env, ferramenta, atual, mudancas);
  await conferirReferencias(env, tabela, mudancas);
  const nova = await gravar(env, ferramenta, tabela, atual, mudancas, 'alterar');
  return { registro: visivel(tabela, ferramenta, nova) };
}

async function arquivar(env, ferramenta, tabela, id, corpo, arquivando) {
  const atual = await carregarParaEditar(env, ferramenta, tabela, id, corpo);
  if (!!atual.arquivado_em === arquivando) return { registro: visivel(tabela, ferramenta, atual), semMudanca: true };
  const nova = await gravar(env, ferramenta, tabela, atual, { arquivado_em: arquivando ? agoraISO() : null },
    arquivando ? 'arquivar' : 'restaurar');
  return { registro: visivel(tabela, ferramenta, nova) };
}

async function historico(env, ferramenta, tabela, id) {
  exigir(tabela, ferramenta, 'L');
  const { results } = await env.DB.prepare(
    'SELECT id, acao, por, em, mudancas FROM historico WHERE registro_id = ? AND tabela = ? ORDER BY id DESC LIMIT 200',
  ).bind(id, tabela).all();
  const restritos = TABELAS[tabela].campos_restritos?.[ferramenta];
  return {
    itens: results.map((h) => {
      let m = h.mudancas ? JSON.parse(h.mudancas) : null;
      if (m && restritos) m = Object.fromEntries(Object.entries(m).filter(([k]) => restritos.includes(k)));
      return { ...h, mudancas: m };
    }),
  };
}

async function listarVersoes(env, ferramenta, tabela, id) {
  exigir(tabela, ferramenta, 'L');
  if (!TABELAS[tabela].versoes) throw new ErroApi(404, 'este tipo de registro não guarda versões');
  const { results } = await env.DB.prepare(
    'SELECT id, em, motivo, dados FROM versoes WHERE registro_id = ? ORDER BY id DESC',
  ).bind(id).all();
  return { itens: results.map((v) => ({ ...v, dados: JSON.parse(v.dados) })) };
}

async function restaurarVersao(env, ferramenta, tabela, id, n, corpo) {
  const atual = await carregarParaEditar(env, ferramenta, tabela, id, corpo);
  if (!TABELAS[tabela].versoes) throw new ErroApi(404, 'este tipo de registro não guarda versões');
  const cong = TABELAS[tabela].congelado;
  if (cong && atual[cong.quando]) throw new ErroApi(409, 'proposta_congelada', { detalhe: 'registro congelado: crie uma revisão' });
  const v = await env.DB.prepare('SELECT dados FROM versoes WHERE registro_id = ? AND id = ?').bind(id, n).first();
  if (!v) throw new ErroApi(404, 'versão não encontrada');
  const dados = JSON.parse(v.dados);
  const mudancas = {};
  for (const k of Object.keys(TABELAS[tabela].campos)) {
    if (TABELAS[tabela].imutaveis?.includes(k)) continue;
    if (dados[k] !== atual[k]) mudancas[k] = dados[k];
  }
  if (!Object.keys(mudancas).length) return { registro: visivel(tabela, ferramenta, atual), semMudanca: true };
  const nova = await gravar(env, ferramenta, tabela, atual, mudancas, 'restaurar', { versaoForcada: true });
  return { registro: visivel(tabela, ferramenta, nova) };
}

// ---------------------------------------------------------------- arquivos (conteúdo no R2)

const chaveR2 = (id, variante) => `arq/${id}${VARIANTES[variante]}`;

async function enviarConteudo(env, ferramenta, id, url, request) {
  exigir('arquivos', ferramenta, 'E');
  if (!env.ARQUIVOS) throw new ErroApi(503, 'armazenamento de arquivos (R2) ainda não ligado');
  const variante = url.searchParams.get('variante') || 'g';
  if (!(variante in VARIANTES)) throw new ErroApi(400, 'variante: g, m ou s');
  const reg = await buscarLinha(env, 'arquivos', id);
  if (!reg || reg.arquivado_em) throw new ErroApi(404, 'arquivo não encontrado');
  const ja = (reg.variantes || '').split(',').filter(Boolean);
  // o conteúdo de um id nunca muda (é isso que permite cache longo): trocar = arquivo novo
  if (ja.includes(variante)) throw new ErroApi(409, 'esta versão do arquivo já foi enviada; para trocar, envie um arquivo novo');
  const tipo = request.headers.get('Content-Type') || reg.tipo_mime;
  const imagem = reg.categoria === 'imagem';
  if (variante !== 'g' && !imagem) throw new ErroApi(400, 'só imagens têm versões média e pequena');
  if (imagem && !tipo.startsWith('image/')) throw new ErroApi(415, 'envie uma imagem');
  const tamanho = Number(request.headers.get('Content-Length') || 0);
  const max = imagem ? MAX_IMAGEM : MAX_ARQUIVO;
  if (tamanho > max) throw new ErroApi(413, `arquivo grande demais (máximo ${Math.round(max / 1048576)} MB)`);
  const corpo = await request.arrayBuffer();
  if (corpo.byteLength > max) throw new ErroApi(413, `arquivo grande demais (máximo ${Math.round(max / 1048576)} MB)`);
  await env.ARQUIVOS.put(chaveR2(id, variante), corpo, { httpMetadata: { contentType: tipo } });
  const variantes = ['g', 'm', 's'].filter((v) => v === variante || ja.includes(v)).join(',');
  await env.DB.batch([
    env.DB.prepare(`UPDATE arquivos SET variantes = ?, tamanho = COALESCE(?, tamanho), atualizado_em = ? WHERE id = ?`)
      .bind(variantes, variante === 'g' ? corpo.byteLength : null, agoraISO(), id),
    prep(env, sqlHistorico('arquivos', id, 'alterar', ferramenta, { variantes: [reg.variantes, variantes] }, false)),
  ]);
  return { ok: true, variantes };
}

async function lerConteudo(env, ferramenta, id, url, cors) {
  exigir('arquivos', ferramenta, 'L');
  if (!env.ARQUIVOS) throw new ErroApi(503, 'armazenamento de arquivos (R2) ainda não ligado');
  const pedida = url.searchParams.get('variante') || 'g';
  if (!(pedida in VARIANTES)) throw new ErroApi(400, 'variante: g, m ou s');
  // como no site: se faltar a pequena, entrega a média; se faltar a média, a grande
  const ordem = { s: ['s', 'm', 'g'], m: ['m', 'g'], g: ['g'] }[pedida];
  for (const v of ordem) {
    const obj = await env.ARQUIVOS.get(chaveR2(id, v));
    if (!obj) continue;
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        // privado: cache só no navegador; imutável porque o conteúdo de um id nunca muda
        'Cache-Control': v === pedida ? 'private, max-age=31536000, immutable' : 'private, max-age=300',
        ...cors,
      },
    });
  }
  throw new ErroApi(404, 'conteúdo ainda não enviado');
}

// ---------------------------------------------------------------- busca e registros

async function buscar(env, ferramenta, url) {
  const q = normalizar(url.searchParams.get('q'));
  if (q.length < 2) return { itens: [] };
  const visiveis = Object.keys(TABELAS).filter((t) => permissao(t, ferramenta) && !TABELAS[t].sensivel && TABELAS[t].busca);
  const filtro = url.searchParams.get('tabela');
  const tabelas = filtro ? visiveis.filter((t) => t === filtro) : visiveis;
  if (!tabelas.length) return { itens: [] };
  const conds = [`tabela IN (${tabelas.map(() => '?').join(', ')})`, 'arquivado = 0'];
  const args = [...tabelas];
  for (const termo of q.split(' ')) {
    conds.push(`texto LIKE ? ESCAPE '\\'`);
    args.push(`%${termo.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
  }
  const { results } = await env.DB.prepare(
    `SELECT registro_id AS id, tabela, titulo FROM busca WHERE ${conds.join(' AND ')}
     ORDER BY (chave LIKE ?) DESC, titulo LIMIT 30`,
  ).bind(...args, `${q}%`).all();
  return { itens: results };
}

async function resolver(env, ferramenta, id) {
  const tabela = PREFIXOS[prefixoDe(id)];
  if (!tabela) throw new ErroApi(404, 'tipo de registro desconhecido');
  return { tabela, registro: await ler(env, ferramenta, tabela, id) };
}

async function estado(env, ferramenta) {
  let migracao = null;
  let banco = false;
  if (env.DB) {
    try {
      const m = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1').first();
      migracao = m?.name || null;
      banco = true;
    } catch {
      banco = true; // banco ligado, mas sem a tabela de migrações (ex.: teste local)
    }
  }
  return { ok: true, ferramenta, banco, arquivos: !!env.ARQUIVOS, migracao };
}

// ---------------------------------------------------------------- roteador

export async function api(env, ferramenta, request, url, cors) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
  try {
    const partes = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [rota, id, acao, n, acao2] = partes;
    const m = request.method;
    const corpo = ['POST', 'PATCH'].includes(m) ? await request.json().catch(() => ({})) : null;

    if (!rota || rota === 'estado') return json(await estado(env, ferramenta));
    if (!env.DB) throw new ErroApi(503, 'banco de dados (D1) ainda não ligado');

    if (rota === 'busca' && m === 'GET') return json(await buscar(env, ferramenta, url));
    if (rota === 'registros' && id && m === 'GET') return json(await resolver(env, ferramenta, id));
    if (rota === 'nucleos' && m === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM nucleos ORDER BY ordem').all();
      return json({ itens: results });
    }

    // comercial: painel do funil e numeração das propostas
    if (rota === 'comercial' && id === 'painel' && m === 'GET') {
      exigir('oportunidades', ferramenta, 'L');
      return json(await painelComercial(env));
    }
    if (rota === 'propostas' && id === 'numeracao') {
      if (m === 'GET') {
        exigir('propostas', ferramenta, 'L');
        return json({ valor: await valorSequencia(env, 'propostas') });
      }
      if (m === 'POST') {
        exigir('propostas', ferramenta, 'E');
        const minimo = Number(corpo?.minimo);
        if (!Number.isInteger(minimo) || minimo < 0) throw new ErroApi(422, 'minimo: inteiro, zero ou mais');
        return json({ valor: await ajustarSequencia(env, 'propostas', minimo) });
      }
    }

    const tabela = ROTAS[rota];
    if (!tabela) throw new ErroApi(404, 'rota não encontrada');

    if (!id) {
      if (m === 'GET') return json(await listar(env, ferramenta, tabela, url));
      if (m === 'POST') return json(await criar(env, ferramenta, tabela, corpo), 201);
      throw new ErroApi(405, 'método não aceito');
    }
    if (TABELAS[tabela].prefixo !== prefixoDe(id)) throw new ErroApi(404, 'id não é deste tipo de registro');

    if (!acao) {
      if (m === 'GET') return json({ registro: await ler(env, ferramenta, tabela, id) });
      if (m === 'PATCH') return json(await alterar(env, ferramenta, tabela, id, corpo));
      throw new ErroApi(405, 'método não aceito');
    }
    if (acao === 'arquivar' && m === 'POST') return json(await arquivar(env, ferramenta, tabela, id, corpo, true));
    if (acao === 'restaurar' && m === 'POST') return json(await arquivar(env, ferramenta, tabela, id, corpo, false));
    if (acao === 'historico' && m === 'GET') return json(await historico(env, ferramenta, tabela, id));
    if (acao === 'versoes' && !n && m === 'GET') return json(await listarVersoes(env, ferramenta, tabela, id));
    if (acao === 'versoes' && n && acao2 === 'restaurar' && m === 'POST') {
      return json(await restaurarVersao(env, ferramenta, tabela, id, Number(n), corpo));
    }
    if (tabela === 'arquivos' && acao === 'conteudo') {
      if (m === 'PUT') return json(await enviarConteudo(env, ferramenta, id, url, request));
      if (m === 'GET') return await lerConteudo(env, ferramenta, id, url, cors);
    }
    throw new ErroApi(404, 'rota não encontrada');
  } catch (e) {
    if (e instanceof ErroApi) return json({ erro: e.message, ...e.extra }, e.status);
    console.error(e);
    return json({ erro: 'erro no servidor', detalhe: String(e?.message || e) }, 500);
  }
}
