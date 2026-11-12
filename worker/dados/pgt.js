// Bases e Plano Geral de Trabalho (PGT) — migração 0005. Casa: páginas Bases e PGT da ferramenta Projetos.
// Honorários (0006): o custo (preço dos serviços, pesos das etapas, parcelas) mora nas mesmas tabelas, mas
// é editado e publicado pela página Honorários do vendas. Projetos = estrutura; vendas = custo.
//
// Os registros (serviços, categorias, usos, fases, etapas, entregáveis, materiais) usam as rotas comuns
// da API (bases-servicos, pgt-etapas…). Aqui ficam as leituras juntadas, as matrizes de pertinência e a
// publicação:
//
//   GET  bases                               -> serviços, categorias, usos + publicação e pendência
//   GET  pgt                                 -> fases, etapas (com serviços), entregáveis (com código, serviços e
//                                               categorias), materiais, serviços e categorias das Bases
//   (desde a 0007 a pertinência da etapa é calculada dos entregáveis; POST pgt/etapas-servicos responde 422)
//   POST pgt/entregaveis-servicos  { entregavel_ids: [...], servico_id, pertinencia: 'P'|'O'|null }   (em massa)
//   POST pgt/entregaveis-categorias { entregavel_id, categorias: [tca_…] }   (substitui; vazio = todas)
//   POST pgt/ordem                 { tabela: 'pgt_entregaveis'|'pgt_etapas'|…, ids: [...] }  (ordem = posição)
//   POST pgt/lote                  { ops: [{ tipo: 'campos'|'entregaveis-servicos'|'entregaveis-categorias'|'ordem', … }] }  (até 500)
//   POST bases/publicar | pgt/publicar  { nota }  -> retrato numerado (409 nada_mudou se igual ao último)
//   GET  honorarios                          -> preço dos serviços, fases com parcela, etapas com pesos, parâmetros
//   POST honorarios/pesos       { etapa_id, servico_id, peso }   (só onde a etapa vale para o serviço)
//   POST honorarios/parametros  { chave, valor }
//   POST honorarios/publicar    { nota }
//   (preço dos serviços e parcela das fases: PATCH bases-servicos / pgt-fases, campos liberados ao vendas)
//   GET  publicacoes?tipo=bases|pgt|honorarios         -> lista (sem os dados)
//   GET  publicacoes/ultima?tipo=bases|pgt|honorarios  -> último retrato com os dados (o vendas vai ler este)
//
// "Pendente" = o rascunho (as tabelas vivas) difere do último retrato publicado (assinatura SHA-256).

import { ErroApi } from './regras.js';
import { agoraISO } from './util.js';

const lerJson = (s) => (s ? JSON.parse(s) : null);
const PARAMETROS = { parcela_entrada: { rotulo: 'Parcela de entrada (na assinatura)', min: 0, max: 1 } };
// campos de custo: fora dos retratos de estrutura, dentro do retrato de honorários
const PRECO_SERVICO = ['modificador', 'com_preco', 'preco_por_etapa'];
// quem edita os honorários (o Projetos só lê)
const HONORARIOS = { hub: 'E', vendas: 'E', maquina: 'E', projetos: 'L' };
const ORDENAVEIS = ['bases_servicos', 'bases_categorias', 'bases_usos', 'pgt_fases', 'pgt_etapas', 'pgt_entregaveis', 'pgt_materiais'];

async function sha256(texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- retratos (só ativos, sem carimbos)

const sem = (r, ...fora) => {
  const o = { ...r };
  for (const k of ['criado_em', 'atualizado_em', 'criado_por', 'atualizado_por', 'versao', 'arquivado_em', ...fora]) delete o[k];
  return o;
};

export async function retratoBases(env) {
  const [srv, cat, uso] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM bases_servicos WHERE arquivado_em IS NULL ORDER BY ordem, nome'),
    env.DB.prepare('SELECT * FROM bases_categorias WHERE arquivado_em IS NULL ORDER BY ordem, nome'),
    env.DB.prepare(`SELECT u.* FROM bases_usos u JOIN bases_categorias c ON c.id = u.categoria_id
      WHERE u.arquivado_em IS NULL AND c.arquivado_em IS NULL ORDER BY c.ordem, u.ordem`),
  ]);
  return {
    servicos: srv.results.map((r) => ({ ...sem(r, ...PRECO_SERVICO), ic_ajustes: lerJson(r.ic_ajustes) || {} })),
    categorias: cat.results.map((r) => ({ ...sem(r), ic_preset: lerJson(r.ic_preset) || {} })),
    usos: uso.results.map((r) => sem(r)),
  };
}

// Pertinência da etapa × serviço, calculada dos entregáveis (0007): P se algum entregável é P; O se só há O.
const SQL_PERT_DERIVADA = `SELECT e.etapa_id, x.servico_id, MAX(CASE x.pertinencia WHEN 'P' THEN 2 ELSE 1 END) AS n
  FROM pgt_entregaveis e JOIN pgt_entregaveis_servicos x ON x.entregavel_id = e.id JOIN bases_servicos s ON s.id = x.servico_id
  WHERE e.arquivado_em IS NULL AND s.arquivado_em IS NULL GROUP BY e.etapa_id, x.servico_id`;
const mapaDerivado = (rows) => {
  const m = {};
  for (const r of rows) (m[r.etapa_id] ||= {})[r.servico_id] = r.n === 2 ? 'P' : 'O';
  return m;
};
async function pertinenciaDerivada(env) { return mapaDerivado((await env.DB.prepare(SQL_PERT_DERIVADA).all()).results); }

// campos só da tela (fora dos retratos e da assinatura)
const SO_TELA = ['travado'];

export async function retratoPgt(env) {
  const [fas, eta, es, ent, ens, enc, mat] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM pgt_fases WHERE arquivado_em IS NULL ORDER BY ordem'),
    env.DB.prepare(`SELECT e.* FROM pgt_etapas e JOIN pgt_fases f ON f.id = e.fase_id
      WHERE e.arquivado_em IS NULL AND f.arquivado_em IS NULL ORDER BY f.ordem, e.ordem`),
    env.DB.prepare(SQL_PERT_DERIVADA),
    env.DB.prepare('SELECT * FROM pgt_entregaveis WHERE arquivado_em IS NULL ORDER BY etapa_id, ordem, criado_em'),
    env.DB.prepare(`SELECT x.* FROM pgt_entregaveis_servicos x JOIN bases_servicos s ON s.id = x.servico_id
      WHERE s.arquivado_em IS NULL ORDER BY x.entregavel_id, s.ordem`),
    env.DB.prepare(`SELECT x.* FROM pgt_entregaveis_categorias x JOIN bases_categorias c ON c.id = x.categoria_id
      WHERE c.arquivado_em IS NULL ORDER BY x.entregavel_id, c.ordem`),
    env.DB.prepare('SELECT * FROM pgt_materiais WHERE arquivado_em IS NULL ORDER BY alvo_id, ordem'),
  ]);
  const derivada = mapaDerivado(es.results);
  const porEnt = {};
  for (const x of ens.results) (porEnt[x.entregavel_id] ||= {})[x.servico_id] = x.pertinencia;
  const catEnt = {};
  for (const x of enc.results) (catEnt[x.entregavel_id] ||= []).push(x.categoria_id);
  const etapas = eta.results.map((e) => ({ ...sem(e, ...SO_TELA, 'semanas_base'),
    servicos: Object.fromEntries(Object.entries(derivada[e.id] || {}).map(([k, p]) => [k, { pertinencia: p }])) }));
  const sigla = Object.fromEntries(etapas.map((e) => [e.id, e.sigla]));
  // código = sigla da etapa + posição (CE-03); entregáveis de etapa arquivada ficam fora do retrato
  const pos = {};
  const entregaveis = ent.results.filter((r) => sigla[r.etapa_id]).map((r) => {
    pos[r.etapa_id] = (pos[r.etapa_id] || 0) + 1;
    return { ...sem(r, ...SO_TELA), codigo: `${sigla[r.etapa_id]}-${String(pos[r.etapa_id]).padStart(2, '0')}`,
      servicos: porEnt[r.id] || {}, categorias: catEnt[r.id] || [] };
  });
  // prazo da etapa por serviço = soma dos entregáveis que vêm marcados (P) para ele, em turnos
  for (const e of etapas) {
    e.prazos = {};
    for (const x of entregaveis) {
      if (x.etapa_id !== e.id) continue;
      for (const [srv, p] of Object.entries(x.servicos)) if (p === 'P') e.prazos[srv] = (e.prazos[srv] || 0) + (x.prazo_turnos || 0);
    }
  }
  return { fases: fas.results.map((r) => sem(r, 'parcela', ...SO_TELA)), etapas, entregaveis, materiais: mat.results.map((r) => sem(r)) };
}

// Honorários: o custo sobre a estrutura. Pesos só onde a etapa vale para o serviço (P ou O).
export async function retratoHonorarios(env) {
  const [srv, fas, es, par, der] = await env.DB.batch([
    env.DB.prepare(`SELECT id, sigla, nome, ${PRECO_SERVICO.join(', ')} FROM bases_servicos WHERE arquivado_em IS NULL ORDER BY ordem, nome`),
    env.DB.prepare('SELECT id, nome, ilha, parcela FROM pgt_fases WHERE arquivado_em IS NULL ORDER BY ordem'),
    env.DB.prepare(`SELECT x.etapa_id, x.servico_id, x.peso FROM pgt_etapas_servicos x
      JOIN bases_servicos s ON s.id = x.servico_id JOIN pgt_etapas e ON e.id = x.etapa_id JOIN pgt_fases f ON f.id = e.fase_id
      WHERE s.arquivado_em IS NULL AND e.arquivado_em IS NULL AND f.arquivado_em IS NULL AND x.peso IS NOT NULL
      ORDER BY f.ordem, e.ordem, s.ordem`),
    env.DB.prepare('SELECT chave, valor FROM bases_parametros ORDER BY chave'),
    env.DB.prepare(SQL_PERT_DERIVADA),
  ]);
  const vale = mapaDerivado(der.results);
  const pesos = {};
  for (const x of es.results) if (vale[x.etapa_id]?.[x.servico_id]) (pesos[x.etapa_id] ||= {})[x.servico_id] = x.peso;
  return {
    servicos: srv.results, fases: fas.results, pesos,
    parametros: Object.fromEntries(par.results.map((p) => [p.chave, lerJson(p.valor)])),
  };
}

const RETRATOS = { bases: retratoBases, pgt: retratoPgt, honorarios: retratoHonorarios };

async function ultima(env, tipo, comDados = false) {
  return env.DB.prepare(`SELECT id, tipo, numero, publicado_em, por, nota, assinatura${comDados ? ', dados' : ''}
    FROM pgt_publicacoes WHERE tipo = ? ORDER BY numero DESC LIMIT 1`).bind(tipo).first();
}

async function situacao(env, tipo, retrato) {
  const u = await ultima(env, tipo);
  const assinatura = await sha256(JSON.stringify(retrato));
  return { publicacao: u ? { numero: u.numero, publicado_em: u.publicado_em, por: u.por, nota: u.nota } : null,
    pendente: !u || u.assinatura !== assinatura };
}

async function publicar(env, ferramenta, tipo, corpo) {
  const retrato = await RETRATOS[tipo](env);
  const assinatura = await sha256(JSON.stringify(retrato));
  // versões de que este retrato depende (não entram na assinatura)
  if (tipo !== 'bases') retrato.bases_numero = (await ultima(env, 'bases'))?.numero ?? null;
  if (tipo === 'honorarios') retrato.pgt_numero = (await ultima(env, 'pgt'))?.numero ?? null;
  const u = await ultima(env, tipo);
  if (u && u.assinatura === assinatura) throw new ErroApi(409, 'nada_mudou', { detalhe: `nada mudou desde a versão ${u.numero}` });
  const nota = corpo?.nota ? String(corpo.nota).trim().slice(0, 500) : null;
  const numero = (u?.numero || 0) + 1;
  const agora = agoraISO();
  try {
    await env.DB.prepare(`INSERT INTO pgt_publicacoes (tipo, numero, publicado_em, por, nota, assinatura, dados)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(tipo, numero, agora, ferramenta, nota, assinatura, JSON.stringify(retrato)).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e?.message))) throw new ErroApi(409, 'conflito', { detalhe: 'outra publicação aconteceu ao mesmo tempo; recarregue' });
    throw e;
  }
  return { tipo, numero, publicado_em: agora, nota };
}

// ---------------------------------------------------------------- leituras para as páginas

async function paginaBases(env) {
  const r = await retratoBases(env);
  // a página mostra também os arquivados (para restaurar) e as versões dos registros (para editar)
  const [srv, cat, uso] = await env.DB.batch([
    env.DB.prepare('SELECT id, versao, arquivado_em FROM bases_servicos'),
    env.DB.prepare('SELECT id, versao, arquivado_em FROM bases_categorias'),
    env.DB.prepare('SELECT id, versao, arquivado_em FROM bases_usos'),
  ]);
  const vers = Object.fromEntries([...srv.results, ...cat.results, ...uso.results].map((x) => [x.id, x.versao]));
  const marcar = (l) => l.map((x) => ({ ...x, versao: vers[x.id] }));
  const { results: arq } = await env.DB.prepare(`SELECT id, 'servico' AS tipo, nome AS nome, versao, arquivado_em FROM bases_servicos WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'categoria', nome, versao, arquivado_em FROM bases_categorias WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'uso', descricao, versao, arquivado_em FROM bases_usos WHERE arquivado_em IS NOT NULL`).all();
  return {
    servicos: marcar(r.servicos), categorias: marcar(r.categorias), usos: marcar(r.usos),
    arquivados: arq, ...(await situacao(env, 'bases', r)),
  };
}

async function paginaPgt(env) {
  const r = await retratoPgt(env);
  const b = await retratoBases(env);
  const tabelas = ['pgt_fases', 'pgt_etapas', 'pgt_entregaveis', 'pgt_materiais'];
  const res = await env.DB.batch(tabelas.map((t) => env.DB.prepare(`SELECT id, versao${t === 'pgt_materiais' ? '' : ', travado'} FROM ${t}`)));
  const vers = Object.fromEntries(res.flatMap((x) => x.results).map((x) => [x.id, x]));
  const marcar = (l) => l.map((x) => ({ ...x, versao: vers[x.id].versao, ...('travado' in vers[x.id] ? { travado: vers[x.id].travado } : {}) }));
  const { results: arq } = await env.DB.prepare(`SELECT id, 'etapa' AS tipo, sigla || ' · ' || nome AS nome, versao, arquivado_em FROM pgt_etapas WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'entregavel', texto, versao, arquivado_em FROM pgt_entregaveis WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'material', nome, versao, arquivado_em FROM pgt_materiais WHERE arquivado_em IS NOT NULL
    ORDER BY arquivado_em DESC LIMIT 200`).all();
  return {
    fases: marcar(r.fases), etapas: marcar(r.etapas), entregaveis: marcar(r.entregaveis), materiais: marcar(r.materiais),
    servicos: b.servicos.map((s) => ({ id: s.id, sigla: s.sigla, nome: s.nome, ordem: s.ordem })),
    categorias: b.categorias.map((c) => ({ id: c.id, nome: c.nome, grupo: c.grupo })),
    arquivados: arq, ...(await situacao(env, 'pgt', r)),
  };
}

async function paginaHonorarios(env) {
  const r = await retratoHonorarios(env);
  const [srv, fas, eta, es] = await env.DB.batch([
    env.DB.prepare('SELECT id, versao FROM bases_servicos WHERE arquivado_em IS NULL'),
    env.DB.prepare('SELECT id, versao FROM pgt_fases WHERE arquivado_em IS NULL'),
    env.DB.prepare(`SELECT e.id, e.fase_id, e.sigla, e.nome FROM pgt_etapas e JOIN pgt_fases f ON f.id = e.fase_id
      WHERE e.arquivado_em IS NULL AND f.arquivado_em IS NULL ORDER BY f.ordem, e.ordem`),
    env.DB.prepare('SELECT etapa_id, servico_id, peso FROM pgt_etapas_servicos'),
  ]);
  const vers = Object.fromEntries([...srv.results, ...fas.results].map((x) => [x.id, x.versao]));
  const vale = await pertinenciaDerivada(env);
  const peso = {};
  for (const x of es.results) peso[`${x.etapa_id}|${x.servico_id}`] = x.peso;
  const porEtapa = {};
  for (const [eta, m] of Object.entries(vale)) for (const [sv, p] of Object.entries(m)) (porEtapa[eta] ||= {})[sv] = { pertinencia: p, peso: peso[`${eta}|${sv}`] ?? null };
  return {
    servicos: r.servicos.map((s) => ({ ...s, versao: vers[s.id] })),
    fases: r.fases.map((f) => ({ ...f, versao: vers[f.id] })),
    etapas: eta.results.map((e) => ({ ...e, servicos: porEtapa[e.id] || {} })),
    parametros: r.parametros,
    parametros_rotulos: Object.fromEntries(Object.entries(PARAMETROS).map(([k, v]) => [k, v.rotulo])),
    ...(await situacao(env, 'honorarios', r)),
  };
}

async function pesoEtapa(env, ferramenta, c) {
  await ativo(env, 'pgt_etapas', c.etapa_id, 'Etapa');
  await ativo(env, 'bases_servicos', c.servico_id, 'Serviço');
  const peso = numOuNulo(c.peso, 'Peso');
  if (peso !== null && peso > 100) throw new ErroApi(422, 'Peso: de 0 a 100');
  if (!(await pertinenciaDerivada(env))[c.etapa_id]?.[c.servico_id]) {
    throw new ErroApi(422, 'esta etapa não vale para este serviço (nenhum entregável dela está marcado para ele no Plano Geral de Trabalho)');
  }
  const antes = (await env.DB.prepare('SELECT peso FROM pgt_etapas_servicos WHERE etapa_id = ? AND servico_id = ?')
    .bind(c.etapa_id, c.servico_id).first()) || {};
  if ((antes.peso ?? null) === peso) return { ok: true, semMudanca: true };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, peso) VALUES (?, ?, ?)
      ON CONFLICT (etapa_id, servico_id) DO UPDATE SET peso = excluded.peso`).bind(c.etapa_id, c.servico_id, peso),
    hist(env, c.etapa_id, 'pgt_etapas', ferramenta, { [`peso:${c.servico_id}`]: [antes.peso ?? null, peso] }),
  ]);
  return { ok: true, etapa_id: c.etapa_id, servico_id: c.servico_id, peso };
}

// ---------------------------------------------------------------- matrizes de pertinência

const PERT = (p) => {
  if (p === null || p === undefined || p === '') return null;
  if (!['P', 'O'].includes(p)) throw new ErroApi(422, 'Pertinência: P (vem marcado), O (opcional) ou vazio (não se aplica)');
  return p;
};
const numOuNulo = (v, rotulo) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErroApi(422, `${rotulo}: número, zero ou mais`);
  return n;
};
async function ativo(env, tabela, id, rotulo) {
  const r = await env.DB.prepare(`SELECT id FROM ${tabela} WHERE id = ? AND arquivado_em IS NULL`).bind(String(id || '')).first();
  if (!r) throw new ErroApi(422, `${rotulo}: não encontrado`);
}
const hist = (env, registro, tabela, ferramenta, mudancas) => env.DB.prepare(
  `INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas) VALUES (?, ?, 'alterar', ?, ?, ?)`,
).bind(registro, tabela, ferramenta, agoraISO(), JSON.stringify(mudancas));


async function entregaveisServico(env, ferramenta, c) {
  const ids = [...new Set(Array.isArray(c.entregavel_ids) ? c.entregavel_ids.map(String) : [])];
  if (!ids.length) throw new ErroApi(422, 'entregavel_ids: informe ao menos um entregável');
  if (ids.length > 200) throw new ErroApi(422, 'no máximo 200 entregáveis por vez');
  await ativo(env, 'bases_servicos', c.servico_id, 'Serviço');
  const p = PERT(c.pertinencia);
  const marcas = ids.map(() => '?').join(', ');
  const { results: existem } = await env.DB.prepare(`SELECT id FROM pgt_entregaveis WHERE id IN (${marcas}) AND arquivado_em IS NULL`).bind(...ids).all();
  if (existem.length !== ids.length) throw new ErroApi(422, 'algum entregável não foi encontrado (ou está arquivado)');
  const { results: antes } = await env.DB.prepare(
    `SELECT entregavel_id, pertinencia FROM pgt_entregaveis_servicos WHERE servico_id = ? AND entregavel_id IN (${marcas})`,
  ).bind(c.servico_id, ...ids).all();
  const eraDe = Object.fromEntries(antes.map((a) => [a.entregavel_id, a.pertinencia]));
  const stmts = [];
  let mudaram = 0;
  for (const id of ids) {
    const era = eraDe[id] || null;
    if (era === p) continue;
    mudaram++;
    stmts.push(p
      ? env.DB.prepare(`INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES (?, ?, ?)
          ON CONFLICT (entregavel_id, servico_id) DO UPDATE SET pertinencia = excluded.pertinencia`).bind(id, c.servico_id, p)
      : env.DB.prepare('DELETE FROM pgt_entregaveis_servicos WHERE entregavel_id = ? AND servico_id = ?').bind(id, c.servico_id),
    hist(env, id, 'pgt_entregaveis', ferramenta, { [`servico:${c.servico_id}`]: [era, p] }));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { ok: true, mudaram };
}

async function entregavelCategorias(env, ferramenta, c) {
  await ativo(env, 'pgt_entregaveis', c.entregavel_id, 'Entregável');
  const cats = [...new Set(Array.isArray(c.categorias) ? c.categorias.map(String) : [])];
  for (const cat of cats) await ativo(env, 'bases_categorias', cat, `Categoria ${cat}`);
  const { results } = await env.DB.prepare('SELECT categoria_id FROM pgt_entregaveis_categorias WHERE entregavel_id = ? ORDER BY categoria_id')
    .bind(c.entregavel_id).all();
  const antes = results.map((r) => r.categoria_id);
  if (JSON.stringify(antes) === JSON.stringify([...cats].sort())) return { ok: true, semMudanca: true };
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pgt_entregaveis_categorias WHERE entregavel_id = ?').bind(c.entregavel_id),
    ...cats.map((cat) => env.DB.prepare('INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id) VALUES (?, ?)').bind(c.entregavel_id, cat)),
    hist(env, c.entregavel_id, 'pgt_entregaveis', ferramenta, { categorias: [antes, cats] }),
  ]);
  return { ok: true, categorias: cats };
}

// Reordena: cada id recebe a posição na lista (1, 2, 3…). Não mexe na versão dos registros
// (a ordem não é edição de conteúdo), mas fica no histórico.
async function reordenar(env, ferramenta, c) {
  if (!ORDENAVEIS.includes(c.tabela)) throw new ErroApi(422, 'tabela: não ordenável');
  const ids = Array.isArray(c.ids) ? c.ids.map(String) : [];
  if (!ids.length || ids.length > 300 || new Set(ids).size !== ids.length) throw new ErroApi(422, 'ids: lista sem repetição (até 300)');
  const agora = agoraISO();
  const stmts = ids.map((id, i) => env.DB.prepare(`UPDATE ${c.tabela} SET ordem = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
    .bind(i + 1, agora, ferramenta, id));
  stmts.push(...ids.map((id, i) => hist(env, id, c.tabela, ferramenta, { ordem: [null, i + 1] })));
  const res = await env.DB.batch(stmts);
  const achados = res.slice(0, ids.length).filter((r) => r.meta.changes === 1).length;
  if (achados !== ids.length) throw new ErroApi(422, 'algum registro da lista não foi encontrado');
  return { ok: true };
}

// Várias mudanças de uma vez (a página do PGT junta as edições e salva tudo de uma vez):
//   { ops: [{ tipo: 'campos' | 'entregaveis-servicos' | 'entregaveis-categorias' | 'ordem', ...corpo da rota }] }
//   campos: { tabela: 'pgt_fases'|'pgt_etapas'|'pgt_entregaveis'|'pgt_materiais', id, versao, campos: {...} } (= PATCH)
// Executa em ordem; se uma falhar, as anteriores ficam e a resposta diz qual falhou (422 com `indice`).
const TABELAS_LOTE = ['pgt_fases', 'pgt_etapas', 'pgt_entregaveis', 'pgt_materiais'];
const OPS_LOTE = {
  'entregaveis-servicos': entregaveisServico, 'entregaveis-categorias': entregavelCategorias, ordem: reordenar,
  campos: (env, ferramenta, op, alterar) => {
    if (!TABELAS_LOTE.includes(op.tabela)) throw new ErroApi(422, 'tabela: não aceita no lote');
    return alterar(env, ferramenta, op.tabela, String(op.id || ''), { ...(op.campos || {}), versao: op.versao });
  },
};
async function lote(env, ferramenta, c, alterar) {
  const ops = Array.isArray(c.ops) ? c.ops : [];
  if (!ops.length || ops.length > 500) throw new ErroApi(422, 'ops: de 1 a 500 mudanças');
  for (const [i, op] of ops.entries()) if (!OPS_LOTE[op?.tipo]) throw new ErroApi(422, `ops[${i}]: tipo desconhecido`);
  let feitas = 0;
  for (const [i, op] of ops.entries()) {
    try { await OPS_LOTE[op.tipo](env, ferramenta, op, alterar); feitas++; }
    catch (e) {
      if (e instanceof ErroApi) throw new ErroApi(e.status, `mudança ${i + 1} de ${ops.length}: ${e.message}`, { indice: i, feitas });
      throw e;
    }
  }
  return { ok: true, feitas };
}

async function parametro(env, ferramenta, c) {
  const def = PARAMETROS[c.chave];
  if (!def) throw new ErroApi(422, 'parâmetro desconhecido');
  const n = Number(c.valor);
  if (!Number.isFinite(n) || n < def.min || n > def.max) throw new ErroApi(422, `${def.rotulo}: entre ${def.min} e ${def.max}`);
  const antes = await env.DB.prepare('SELECT valor FROM bases_parametros WHERE chave = ?').bind(c.chave).first();
  const agora = agoraISO();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO bases_parametros (chave, valor, rotulo, atualizado_em, atualizado_por) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .bind(c.chave, JSON.stringify(n), def.rotulo, agora, ferramenta),
    hist(env, `parametro:${c.chave}`, 'bases_parametros', ferramenta, { valor: [lerJson(antes?.valor), n] }),
  ]);
  return { ok: true, chave: c.chave, valor: n };
}

// ---------------------------------------------------------------- roteador
// Devolve a resposta (objeto) ou undefined se a rota não for daqui.
export async function rotasPgt(env, ferramenta, m, [rota, id, acao], corpo, url, exigir, alterar) {
  if (rota === 'bases') {
    if (!id && m === 'GET') { exigir('bases_servicos', ferramenta, 'L'); return paginaBases(env); }
    if (id === 'publicar' && m === 'POST') { exigir('bases_servicos', ferramenta, 'E'); return publicar(env, ferramenta, 'bases', corpo); }
    throw new ErroApi(404, 'rota não encontrada');
  }
  if (rota === 'pgt') {
    if (!id && m === 'GET') { exigir('pgt_etapas', ferramenta, 'L'); return paginaPgt(env); }
    if (m !== 'POST') throw new ErroApi(405, 'método não aceito');
    exigir('pgt_etapas', ferramenta, 'E');
    const c = corpo || {};
    if (id === 'etapas-servicos') throw new ErroApi(422, 'a pertinência da etapa vem dos entregáveis (marque os entregáveis)');
    if (id === 'entregaveis-servicos') return entregaveisServico(env, ferramenta, c);
    if (id === 'entregaveis-categorias') return entregavelCategorias(env, ferramenta, c);
    if (id === 'ordem') return reordenar(env, ferramenta, c);
    if (id === 'lote') return lote(env, ferramenta, c, alterar);
    if (id === 'publicar') return publicar(env, ferramenta, 'pgt', c);
    throw new ErroApi(404, 'rota não encontrada');
  }
  if (rota === 'honorarios') {
    const pode = HONORARIOS[ferramenta];
    if (!pode) throw new ErroApi(403, 'esta ferramenta não pode ver isto');
    if (!id && m === 'GET') return paginaHonorarios(env);
    if (m !== 'POST') throw new ErroApi(405, 'método não aceito');
    if (pode !== 'E') throw new ErroApi(403, 'esta ferramenta não pode editar isto');
    const c = corpo || {};
    if (id === 'pesos') return pesoEtapa(env, ferramenta, c);
    if (id === 'parametros') return parametro(env, ferramenta, c);
    if (id === 'publicar') return publicar(env, ferramenta, 'honorarios', c);
    throw new ErroApi(404, 'rota não encontrada');
  }
  if (rota === 'publicacoes' && m === 'GET') {
    const tipo = url.searchParams.get('tipo');
    if (!['bases', 'pgt', 'honorarios'].includes(tipo)) throw new ErroApi(422, 'tipo: bases, pgt ou honorarios');
    if (tipo === 'honorarios') { if (!HONORARIOS[ferramenta]) throw new ErroApi(403, 'esta ferramenta não pode ver isto'); }
    else exigir(tipo === 'bases' ? 'bases_servicos' : 'pgt_etapas', ferramenta, 'L');
    if (id === 'ultima') {
      const u = await ultima(env, tipo, true);
      if (!u) throw new ErroApi(404, 'ainda não houve publicação');
      return { ...u, dados: JSON.parse(u.dados) };
    }
    if (!id) {
      const { results } = await env.DB.prepare(`SELECT numero, publicado_em, por, nota FROM pgt_publicacoes WHERE tipo = ?
        ORDER BY numero DESC LIMIT 100`).bind(tipo).all();
      return { itens: results };
    }
    throw new ErroApi(404, 'rota não encontrada');
  }
  return undefined;
}
