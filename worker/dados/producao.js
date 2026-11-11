// Leituras juntadas da produção (ferramenta Projetos, projetos.odisse.com.br): cada tela numa chamada só.
//   GET producao/painel[?todos=1]        -> projetos (ativos e pausados; todos com ?todos=1) + equipe
//   GET producao/projetos/:id            -> ficha: projeto, cliente e co-clientes, etapas com horas, horas recentes,
//                                           contratos, proposta aceita, local (se a ferramenta puder ver)
//   GET producao/horas?de=&ate=[&equipe_id=][&projeto_id=] -> horas do período com nomes
//   POST producao/equipe { nome, email, papel } -> cadastra alguém na equipe (cria a pessoa, ou usa a que já existe)

import { ErroApi } from './regras.js';

const CLIENTE_NOME = (col) => `(SELECT COALESCE((SELECT nome FROM organizacoes WHERE id = ${col}), (SELECT nome FROM pessoas WHERE id = ${col})))`;
const COCLIENTES = (col) => `(SELECT json_group_array(COALESCE(o2.nome, p2.nome))
  FROM vinculos v LEFT JOIN organizacoes o2 ON o2.id = v.para_id LEFT JOIN pessoas p2 ON p2.id = v.para_id
  WHERE v.de_id = ${col} AND v.papel = 'cliente' AND v.arquivado_em IS NULL)`;
const lerJson = (s, vazio = null) => (s ? JSON.parse(s) : vazio);

async function equipe(env) {
  const { results } = await env.DB.prepare(`SELECT e.id, e.pessoa_id, e.papel, e.ativo, p.nome, p.apelido, p.email
    FROM equipe e JOIN pessoas p ON p.id = e.pessoa_id WHERE e.arquivado_em IS NULL ORDER BY e.ativo DESC, p.nome`).all();
  return results;
}

export async function painelProducao(env, url) {
  const todos = url.searchParams.get('todos') === '1';
  const filtro = todos ? '' : `AND p.situacao IN ('ativo', 'pausado')`;
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.codigo, p.ano, p.numero, p.nome, p.nome_publico, p.nucleo_id, p.cliente_id, p.servico, p.tipologia, p.area_m2,
       p.bairro, p.cidade, p.uf, p.situacao, p.inicio, p.previsao_fim, p.fim, p.responsavel_id, p.publicavel, p.contrato_id,
       p.atualizado_em, p.versao,
       ${CLIENTE_NOME('p.cliente_id')} AS cliente_nome,
       ${COCLIENTES('p.id')} AS coclientes,
       (SELECT count(*) FROM etapas e WHERE e.projeto_id = p.id AND e.arquivado_em IS NULL) AS n_etapas,
       (SELECT count(*) FROM etapas e WHERE e.projeto_id = p.id AND e.arquivado_em IS NULL AND e.situacao = 'concluida') AS n_concluidas,
       (SELECT json_object('id', e.id, 'nome', e.nome, 'situacao', e.situacao, 'fim_previsto', e.fim_previsto, 'ordem', e.ordem)
          FROM etapas e WHERE e.projeto_id = p.id AND e.arquivado_em IS NULL AND e.situacao <> 'concluida'
          ORDER BY (e.situacao = 'prevista'), e.ordem LIMIT 1) AS etapa_atual,
       (SELECT COALESCE(sum(h.minutos), 0) FROM horas h WHERE h.projeto_id = p.id AND h.arquivado_em IS NULL) AS minutos,
       (SELECT COALESCE(sum(h.minutos), 0) FROM horas h WHERE h.projeto_id = p.id AND h.arquivado_em IS NULL
          AND h.data >= date('now', '-3 hours', '-30 days')) AS minutos_30d
     FROM projetos p WHERE p.arquivado_em IS NULL ${filtro}
     ORDER BY p.ano DESC, p.numero DESC LIMIT 500`,
  ).all();
  return {
    itens: results.map((r) => ({ ...r, coclientes: lerJson(r.coclientes, []).filter(Boolean), etapa_atual: lerJson(r.etapa_atual) })),
    equipe: await equipe(env),
  };
}

export async function fichaProjeto(env, id, { verLocal }) {
  const p = await env.DB.prepare(`SELECT p.*, ${CLIENTE_NOME('p.cliente_id')} AS cliente_nome FROM projetos p WHERE p.id = ?`).bind(id).first();
  if (!p) throw new ErroApi(404, 'projeto não encontrado');
  const lotes = [
    env.DB.prepare(`SELECT e.*, (SELECT COALESCE(sum(h.minutos), 0) FROM horas h WHERE h.etapa_id = e.id AND h.arquivado_em IS NULL) AS minutos
      FROM etapas e WHERE e.projeto_id = ? AND e.arquivado_em IS NULL ORDER BY e.ordem, e.criado_em`).bind(id),
    env.DB.prepare(`SELECT h.*, pe.nome AS pessoa_nome, e.nome AS etapa_nome
      FROM horas h JOIN equipe q ON q.id = h.equipe_id JOIN pessoas pe ON pe.id = q.pessoa_id LEFT JOIN etapas e ON e.id = h.etapa_id
      WHERE h.projeto_id = ? AND h.arquivado_em IS NULL ORDER BY h.data DESC, h.criado_em DESC LIMIT 300`).bind(id),
    env.DB.prepare(`SELECT c.id, c.codigo, c.tipo, c.situacao, c.valor_total, c.assinado_em, c.arquivo_assinado_id, c.proposta_id,
        pp.codigo AS proposta_codigo, pp.arquivo_pdf_id AS proposta_pdf_id
      FROM contratos c LEFT JOIN propostas pp ON pp.id = c.proposta_id
      WHERE c.arquivado_em IS NULL AND (c.projeto_id = ?1 OR c.id = (SELECT contrato_id FROM projetos WHERE id = ?1))
      ORDER BY c.numero`).bind(id),
    env.DB.prepare(`SELECT v.para_id AS id, COALESCE(o.nome, pe.nome) AS nome
      FROM vinculos v LEFT JOIN organizacoes o ON o.id = v.para_id LEFT JOIN pessoas pe ON pe.id = v.para_id
      WHERE v.de_id = ? AND v.papel = 'cliente' AND v.arquivado_em IS NULL`).bind(id),
    env.DB.prepare(`SELECT h.equipe_id, pe.nome, sum(h.minutos) AS minutos
      FROM horas h JOIN equipe q ON q.id = h.equipe_id JOIN pessoas pe ON pe.id = q.pessoa_id
      WHERE h.projeto_id = ? AND h.arquivado_em IS NULL GROUP BY h.equipe_id ORDER BY minutos DESC`).bind(id),
  ];
  if (verLocal) lotes.push(env.DB.prepare('SELECT * FROM projetos_local WHERE id = ?').bind(id));
  const [et, hs, ct, cc, porPessoa, loc] = await env.DB.batch(lotes);
  let oportunidade = null;
  if (p.oportunidade_id) {
    oportunidade = await env.DB.prepare('SELECT id, titulo, etapa_funil, contato_pessoa_id FROM oportunidades WHERE id = ?').bind(p.oportunidade_id).first();
  }
  return {
    registro: p,
    etapas: et.results,
    horas: hs.results,
    horas_por_pessoa: porPessoa.results,
    contratos: ct.results,
    coclientes: cc.results,
    oportunidade,
    local: verLocal ? (loc.results[0] || null) : undefined,
    equipe: await equipe(env),
  };
}

export async function horasPeriodo(env, url) {
  const q = url.searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  const de = q.get('de');
  const ate = q.get('ate');
  if (!dia.test(de || '') || !dia.test(ate || '')) throw new ErroApi(422, 'de e ate: dias no formato AAAA-MM-DD');
  const conds = ['h.arquivado_em IS NULL', 'h.data >= ?', 'h.data <= ?'];
  const args = [de, ate];
  for (const f of ['equipe_id', 'projeto_id']) if (q.get(f)) { conds.push(`h.${f} = ?`); args.push(q.get(f)); }
  const { results } = await env.DB.prepare(`SELECT h.*, pe.nome AS pessoa_nome, e.nome AS etapa_nome, p.codigo AS projeto_codigo, p.nome AS projeto_nome
    FROM horas h JOIN equipe qq ON qq.id = h.equipe_id JOIN pessoas pe ON pe.id = qq.pessoa_id
      JOIN projetos p ON p.id = h.projeto_id LEFT JOIN etapas e ON e.id = h.etapa_id
    WHERE ${conds.join(' AND ')} ORDER BY h.data DESC, h.criado_em DESC LIMIT 1000`).bind(...args).all();
  return { itens: results };
}
