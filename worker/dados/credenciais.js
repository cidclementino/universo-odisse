// Credenciais (0021; Cid, 19/11): os documentos que editais, termos de referência e concursos pedem ao estúdio.
//
// Cada documento mora com o seu dono e aparece numa página só:
//   Empresa      constituição e registros, sede                     (dono emp_odisse)
//   Equipe       registro no conselho, CATs, diploma, currículo…     (dono eqp_…, na ficha da pessoa)
//   Credenciais  regularidade fiscal, social e trabalhista; econômico-financeira; cadastros e acessos
//                (dono emp_odisse) e, por ora, atestados e RRTs dos projetos (dono prj_…)
// A página Credenciais também reúne o estado de tudo (vencidos, a vencer, faltando).
//
//   GET  credenciais/quadro    -> { hoje, catalogo, lugares, itens, equipe, projetos } numa leitura só
//   GET  credenciais/vencidas  -> { itens } documentos vencidos e não substituídos (aviso da Início)
//   POST credenciais { dono_id, tipo, …, substitui_id? }  -> registra; com substitui_id, arquiva o anterior no mesmo lote
//   PATCH / arquivar / restaurar: rotas comuns da API.
//
// Regras (Cid, 19/11): documento com validade indica quando vence; vencido gera aviso na Início, que só sai quando
// o documento é substituído (ou arquivado, se deixou de ser preciso). A validade de um documento vencido não se
// edita: substitui-se.

import { ErroApi } from './regras.js';
import { hojeBrasilia, prefixoDe } from './util.js';

// onde cada grupo aparece (página do hub) e em que ordem
export const LUGARES = {
  constituicao: { nome: 'Constituição e registros', pagina: 'empresa', ordem: 10 },
  sede: { nome: 'Sede', pagina: 'empresa', ordem: 20 },
  regularidade: { nome: 'Regularidade fiscal, social e trabalhista', pagina: 'credenciais', ordem: 30 },
  economico: { nome: 'Econômico-financeira', pagina: 'credenciais', ordem: 40 },
  cadastros: { nome: 'Cadastros e acessos', pagina: 'credenciais', ordem: 50 },
  equipe: { nome: 'Documentos', pagina: 'equipe', ordem: 60 },
  projeto: { nome: 'Atestados e RRTs', pagina: 'credenciais', ordem: 70 },
};

// vence: 'sim' (validade obrigatória) · 'opcional' · 'nao'
// varios: pode haver mais de um ativo do mesmo tipo (um por exercício, por portal, por obra…)
// exigido: entra na conta do que falta (na equipe, só para quem tem registro no conselho)
// detalhe: rótulo do campo `titulo` na Gaveta
const C = (tipo, nome, lugar, o = {}) => ({
  tipo, nome, lugar, dono: { equipe: 'eqp', projeto: 'prj' }[lugar] || 'emp',
  vence: o.vence || 'nao', varios: !!o.varios, exigido: !!o.exigido, detalhe: o.detalhe || null, dica: o.dica || null,
});

export const CATALOGO = [
  // Empresa › Constituição e registros
  C('contrato_social', 'Contrato social (consolidação mais recente)', 'constituicao', { exigido: true }),
  C('alteracao_contratual', 'Alteração contratual', 'constituicao', { varios: true, detalhe: 'Qual alteração', dica: 'Só as posteriores à consolidação.' }),
  C('registro_junta', 'Registro na Junta Comercial ou no cartório (RCPJ)', 'constituicao', { exigido: true }),
  C('me_epp', 'Certidão simplificada / enquadramento ME-EPP', 'constituicao', { vence: 'opcional', dica: 'Dá preferência em licitação. Muitos editais aceitam só a emitida nos últimos 90 dias.' }),
  C('cartao_cnpj', 'Cartão CNPJ (situação cadastral)', 'constituicao', { exigido: true }),
  C('inscricao_municipal', 'Comprovante de inscrição municipal', 'constituicao', { exigido: true }),
  C('inscricao_estadual', 'Comprovante de inscrição estadual', 'constituicao', { dica: 'Só se o Odisse Objetos vender com o mesmo CNPJ.' }),
  C('cau_pj', 'Certidão de registro e quitação da PJ no CAU', 'constituicao', { vence: 'sim', exigido: true }),
  // Empresa › Sede
  C('alvara', 'Alvará de funcionamento', 'sede', { vence: 'sim', exigido: true }),
  C('comprovante_endereco', 'Comprovante de endereço da sede', 'sede', { exigido: true }),
  // Credenciais › Regularidade fiscal, social e trabalhista
  C('cnd_federal', 'CND federal conjunta (Receita e PGFN)', 'regularidade', { vence: 'sim', exigido: true, dica: 'Inclui as contribuições previdenciárias.' }),
  C('cnd_estadual', 'Certidão negativa estadual (PB)', 'regularidade', { vence: 'sim', exigido: true }),
  C('cnd_municipal', 'Certidão negativa municipal (João Pessoa)', 'regularidade', { vence: 'sim', exigido: true }),
  C('crf_fgts', 'Certificado de regularidade do FGTS (CRF)', 'regularidade', { vence: 'sim', exigido: true }),
  C('cndt', 'Certidão negativa de débitos trabalhistas (CNDT)', 'regularidade', { vence: 'sim', exigido: true }),
  // Credenciais › Econômico-financeira
  C('balanco', 'Balanço patrimonial e DRE', 'economico', { vence: 'opcional', varios: true, exigido: true, detalhe: 'Exercício', dica: 'Um por exercício. A validade é até o prazo do balanço seguinte.' }),
  C('indices', 'Índices contábeis assinados pelo contador', 'economico', { vence: 'opcional', exigido: true, dica: 'Liquidez geral, liquidez corrente e solvência geral.' }),
  C('falencia', 'Certidão negativa de falência e recuperação judicial', 'economico', { vence: 'sim', exigido: true }),
  // Credenciais › Cadastros e acessos
  C('sicaf', 'SICAF (cadastro federal de fornecedores)', 'cadastros', { vence: 'opcional', exigido: true }),
  C('cadastro_fornecedor', 'Cadastro de fornecedor (estado ou município)', 'cadastros', { vence: 'opcional', varios: true, detalhe: 'Órgão' }),
  C('portal', 'Conta em portal de compras', 'cadastros', { varios: true, detalhe: 'Portal', dica: 'Só o registro de que a conta existe. Senhas nunca entram no Universo.' }),
  C('ecnpj', 'Certificado digital e-CNPJ', 'cadastros', { vence: 'sim', exigido: true, dica: 'Sem ele não se assina proposta em vários portais.' }),
  // Equipe (por pessoa)
  C('cau_pf', 'Certidão de registro e quitação no CAU', 'equipe', { vence: 'sim', exigido: true }),
  C('cat', 'Certidão de Acervo Técnico (CAT)', 'equipe', { varios: true, detalhe: 'Obra ou serviço', dica: 'Com os atestados averbados.' }),
  C('diploma', 'Diploma de graduação', 'equipe', { exigido: true }),
  C('pos', 'Título de pós-graduação', 'equipe', { varios: true, detalhe: 'Curso' }),
  C('curriculo', 'Currículo para edital', 'equipe', { exigido: true }),
  C('vinculo', 'Comprovante de vínculo com a empresa', 'equipe', { exigido: true, detalhe: 'Tipo de vínculo', dica: 'Sócio: contrato social. CLT: carteira. Prestador: contrato de serviço.' }),
  C('procuracao', 'Procuração para licitações', 'equipe', { vence: 'opcional', dica: 'Quando não for sócio: representa a empresa.' }),
  C('identidade', 'Documento de identidade', 'equipe', { vence: 'opcional' }),
  // Projetos (por projeto; por ora registrados na página Credenciais)
  C('atestado', 'Atestado de capacidade técnica', 'projeto', { varios: true, detalhe: 'Emitido por' }),
  C('rrt', 'RRT', 'projeto', { varios: true, detalhe: 'Atividade' }),
];
export const POR_TIPO = Object.fromEntries(CATALOGO.map((c) => [c.tipo, c]));

const EMPRESA = 'emp_odisse';
// dias antes do vencimento em que o documento passa a "vence em breve" na página
export const AVISO_DIAS = 30;

// ---------------------------------------------------------------- regras (criar e alterar)

const hist = (env, AUX, id, acao, ferramenta, mudancas) => {
  const [sql, args] = AUX.sqlHistorico('credenciais', id, acao, ferramenta, mudancas, true);
  return env.DB.prepare(sql).bind(...args);
};
// o arquivo enviado passa a ser do documento (só se ainda não tiver dono)
const donoDoArquivo = (env, arqId, creId) =>
  env.DB.prepare('UPDATE arquivos SET dono_id = ? WHERE id = ? AND dono_id IS NULL').bind(creId, arqId);

function conferirDatas(cat, v) {
  if (cat.vence === 'nao') v.vence_em = null;
  if (cat.vence === 'sim' && !v.vence_em) throw new ErroApi(422, 'Vence em: obrigatório para este documento');
  if (v.emitido_em && v.vence_em && v.vence_em < v.emitido_em) throw new ErroApi(422, 'Vence em: antes da data de emissão');
}

export const regraCredenciais = {
  async criar(env, ferramenta, valores, corpo, id, AUX) {
    const cat = POR_TIPO[valores.tipo];
    if (!cat) throw new ErroApi(422, 'Documento: tipo desconhecido');
    if (prefixoDe(valores.dono_id) !== cat.dono) throw new ErroApi(422, `Documento: ${cat.nome} não é deste dono`);
    if (cat.dono === 'emp' && valores.dono_id !== EMPRESA) throw new ErroApi(422, 'Documento: empresa desconhecida');
    conferirDatas(cat, valores);
    const extras = [];
    if (valores.substitui_id) {
      const ant = await env.DB.prepare('SELECT * FROM credenciais WHERE id = ?').bind(valores.substitui_id).first();
      if (!ant || ant.arquivado_em) throw new ErroApi(409, 'o documento a substituir não está mais ativo');
      if (ant.dono_id !== valores.dono_id || ant.tipo !== valores.tipo) throw new ErroApi(422, 'só se substitui por um documento do mesmo tipo e dono');
      if (cat.vence !== 'nao' && ant.vence_em) {
        if (!valores.vence_em) throw new ErroApi(422, 'Vence em: informe a validade do documento novo');
        if (valores.vence_em <= hojeBrasilia()) throw new ErroApi(422, 'Vence em: o documento novo já está vencido');
      }
      // detalhe e número passam para o novo quando não vieram
      if (valores.titulo == null) valores.titulo = ant.titulo;
      const agora = new Date().toISOString();
      extras.push(
        env.DB.prepare(`UPDATE credenciais SET arquivado_em = ?, atualizado_em = ?, atualizado_por = ?, versao = versao + 1
          WHERE id = ? AND arquivado_em IS NULL`).bind(agora, agora, ferramenta, ant.id),
        hist(env, AUX, ant.id, 'arquivar', ferramenta, { substituida_por: [null, id] }),
      );
    } else if (!cat.varios) {
      const ja = await env.DB.prepare('SELECT id FROM credenciais WHERE dono_id = ? AND tipo = ? AND arquivado_em IS NULL')
        .bind(valores.dono_id, valores.tipo).first();
      if (ja) throw new ErroApi(409, `${cat.nome} já está registrado: edite ou substitua`, { existente: ja.id });
    }
    if (valores.arquivo_id) extras.push(donoDoArquivo(env, valores.arquivo_id, id));
    return extras;
  },
  async alterar(env, ferramenta, atual, mudancas) {
    const cat = POR_TIPO[atual.tipo];
    if (!cat) throw new ErroApi(422, 'Documento: tipo desconhecido');
    if ('vence_em' in mudancas && atual.vence_em && atual.vence_em < hojeBrasilia()) {
      throw new ErroApi(422, 'documento vencido: registre o novo pelo Substituir');
    }
    const v = { emitido_em: atual.emitido_em, vence_em: atual.vence_em, ...mudancas };
    conferirDatas(cat, v);
    if (cat.vence === 'nao' && 'vence_em' in mudancas) mudancas.vence_em = null;
    return mudancas.arquivo_id ? [donoDoArquivo(env, mudancas.arquivo_id, atual.id)] : [];
  },
};

// ---------------------------------------------------------------- leituras

const SEL_ITEM = `SELECT c.*, a.nome_original AS arquivo_nome, a.tipo_mime AS arquivo_tipo,
    pe.nome AS dono_nome, pr.codigo AS projeto_codigo, pr.nome AS projeto_nome
  FROM credenciais c
  LEFT JOIN arquivos a ON a.id = c.arquivo_id
  LEFT JOIN equipe eq ON eq.id = c.dono_id LEFT JOIN pessoas pe ON pe.id = eq.pessoa_id
  LEFT JOIN projetos pr ON pr.id = c.dono_id`;

// estado de um documento: vencido · vence (em breve) · ok · sem_validade
export function estadoDe(item, hoje = hojeBrasilia()) {
  if (!item.vence_em) return 'sem_validade';
  if (item.vence_em < hoje) return 'vencido';
  const dias = Math.round((Date.parse(item.vence_em) - Date.parse(hoje)) / 864e5);
  return dias <= AVISO_DIAS ? 'vence' : 'ok';
}

export async function quadro(env) {
  const hoje = hojeBrasilia();
  const [itens, eq, pr] = await env.DB.batch([
    env.DB.prepare(`${SEL_ITEM} WHERE c.arquivado_em IS NULL ORDER BY c.vence_em IS NULL, c.vence_em, c.criado_em`),
    env.DB.prepare(`SELECT e.id, p.nome, e.registro, e.conselho, e.ativo, e.socio FROM equipe e JOIN pessoas p ON p.id = e.pessoa_id
      WHERE e.arquivado_em IS NULL AND e.ativo = 1 ORDER BY e.ordem, p.nome`),
    env.DB.prepare(`SELECT id, codigo, nome, situacao FROM projetos WHERE arquivado_em IS NULL ORDER BY codigo DESC LIMIT 500`),
  ]);
  return {
    hoje,
    aviso_dias: AVISO_DIAS,
    lugares: LUGARES,
    catalogo: CATALOGO,
    itens: itens.results.map((i) => ({ ...i, estado: estadoDe(i, hoje) })),
    equipe: eq.results,
    projetos: pr.results,
  };
}

// vencidos e não substituídos (o substituído foi arquivado), para a Início
export async function vencidas(env, hoje = hojeBrasilia()) {
  const { results } = await env.DB.prepare(
    `${SEL_ITEM} WHERE c.arquivado_em IS NULL AND c.vence_em IS NOT NULL AND c.vence_em < ?
       AND (eq.id IS NULL OR eq.ativo = 1) ORDER BY c.vence_em`,
  ).bind(hoje).all();
  return results.map((i) => {
    const cat = POR_TIPO[i.tipo] || { nome: i.tipo, lugar: 'regularidade' };
    const lugar = LUGARES[cat.lugar];
    return {
      id: i.id, tipo: i.tipo, nome: cat.nome, titulo: i.titulo, vence_em: i.vence_em, dono_id: i.dono_id,
      lugar: cat.lugar, lugar_nome: lugar?.nome, pagina: lugar?.pagina,
      dono_nome: i.dono_nome || (i.projeto_codigo ? `${i.projeto_codigo} ${i.projeto_nome || ''}`.trim() : null),
    };
  });
}

export async function rotasCredenciais(env, ferramenta, m, partes, h) {
  const [rota, id] = partes;
  if (rota !== 'credenciais' || !['quadro', 'vencidas'].includes(id) || m !== 'GET') return undefined;
  h.exigir('credenciais', ferramenta, 'L');
  if (id === 'quadro') return quadro(env);
  return { itens: await vencidas(env) };
}
