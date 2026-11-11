// Regras de negócio por tabela, chamadas pela API ao criar e ao alterar.
// O esquema (esquema.js) diz o que cada campo aceita; aqui fica o que depende de outros registros:
// numeração, revisões, funil e o congelamento das propostas.
//
//   criar(env, ferramenta, valores, corpo)   -> pode completar `valores`; devolve comandos extras do lote
//   alterar(env, ferramenta, atual, mudancas) -> pode completar `mudancas` ou recusar (ErroApi)

import { hojeBrasilia, agoraISO } from './util.js';
import { TABELAS } from './esquema.js';

export class ErroApi extends Error {
  constructor(status, erro, extra = {}) {
    super(erro);
    this.status = status;
    this.extra = extra;
  }
}

const quatro = (n) => String(n).padStart(4, '0');
const FECHADAS = ['ganha', 'perdida'];

// Próximo número de uma sequência (propostas, contratos, projetos por ano). Seguro contra
// duas pessoas pedindo ao mesmo tempo: o incremento acontece dentro do próprio banco.
export async function proximoNumero(env, nome, inicial = 0) {
  const [, r] = await env.DB.batch([
    env.DB.prepare('INSERT INTO sequencias (nome, valor) VALUES (?, ?) ON CONFLICT (nome) DO NOTHING').bind(nome, inicial),
    env.DB.prepare('UPDATE sequencias SET valor = valor + 1 WHERE nome = ? RETURNING valor').bind(nome),
  ]);
  return r.results[0].valor;
}

// Leva a sequência até pelo menos `minimo` (nunca volta). Devolve o valor atual.
export async function ajustarSequencia(env, nome, minimo) {
  const [, r] = await env.DB.batch([
    env.DB.prepare('INSERT INTO sequencias (nome, valor) VALUES (?, 0) ON CONFLICT (nome) DO NOTHING').bind(nome),
    env.DB.prepare('UPDATE sequencias SET valor = max(valor, ?) WHERE nome = ? RETURNING valor').bind(minimo, nome),
  ]);
  return r.results[0].valor;
}

export async function valorSequencia(env, nome) {
  const r = await env.DB.prepare('SELECT valor FROM sequencias WHERE nome = ?').bind(nome).first();
  return r ? r.valor : null;
}

// ---------------------------------------------------------------- oportunidades

const oportunidades = {
  async criar(env, ferramenta, valores) {
    valores.etapa_desde = hojeBrasilia();
    valores.fechada_em = FECHADAS.includes(valores.etapa_funil) ? hojeBrasilia() : null;
    return [];
  },
  async alterar(env, ferramenta, atual, mudancas) {
    if ('etapa_funil' in mudancas) {
      mudancas.etapa_desde = hojeBrasilia();
      mudancas.fechada_em = FECHADAS.includes(mudancas.etapa_funil) ? hojeBrasilia() : null;
    }
  },
};

// ---------------------------------------------------------------- propostas
// Três jeitos de criar:
//   normal         -> número novo da sequência, revisão 0, código PC-NNNN-AAAA (ano da data da proposta)
//   revisao_de     -> mesmo número, revisão seguinte, código PC-NNNN-AAAA-R1; as anteriores ainda em
//                     rascunho ou enviadas viram "substituida"
//   importada_de   -> traz uma proposta antiga com número e código originais e leva a sequência até ele

const propostas = {
  async criar(env, ferramenta, valores, corpo) {
    const extras = [];
    // simulação: sem oportunidade (não entra no funil); proposta de verdade: oportunidade obrigatória
    if (valores.simulacao && valores.oportunidade_id) throw new ErroApi(422, 'simulação não tem oportunidade');
    if (!valores.simulacao && !valores.oportunidade_id) throw new ErroApi(422, 'Oportunidade: obrigatório');
    if (corpo.importada_de) {
      if (!['vendas', 'maquina'].includes(ferramenta)) throw new ErroApi(403, 'só o vendas importa propostas');
      const origem = String(corpo.importada_de);
      if (!/^[a-z]+:[\w\-\/.]{1,60}$/.test(origem)) throw new ErroApi(422, 'importada_de: formato origem:codigo');
      const numero = Number(corpo.numero);
      const revisao = Number(corpo.revisao ?? 0);
      const codigo = String(corpo.codigo || '').trim();
      if (!Number.isInteger(numero) || numero < 1) throw new ErroApi(422, 'numero: inteiro positivo');
      if (!Number.isInteger(revisao) || revisao < 0) throw new ErroApi(422, 'revisao: inteiro, zero ou mais');
      if (!codigo || codigo.length > 40) throw new ErroApi(422, 'codigo: obrigatório (até 40 caracteres)');
      Object.assign(valores, { numero, revisao, codigo, importada_de: origem });
      extras.push(
        env.DB.prepare('INSERT INTO sequencias (nome, valor) VALUES (?, 0) ON CONFLICT (nome) DO NOTHING').bind('propostas'),
        env.DB.prepare('UPDATE sequencias SET valor = max(valor, ?) WHERE nome = ?').bind(numero, 'propostas'),
      );
      return extras;
    }

    if (corpo.revisao_de) {
      const base = await env.DB.prepare('SELECT * FROM propostas WHERE id = ?').bind(String(corpo.revisao_de)).first();
      if (!base) throw new ErroApi(422, 'revisao_de: proposta não encontrada');
      if (valores.oportunidade_id !== base.oportunidade_id || valores.simulacao !== base.simulacao) {
        throw new ErroApi(422, 'a revisão precisa ficar na mesma oportunidade da proposta original (e simulação continua simulação)');
      }
      const m = await env.DB.prepare('SELECT MAX(revisao) AS r FROM propostas WHERE numero = ?').bind(base.numero).first();
      const revisao = (m?.r ?? 0) + 1;
      const raiz = base.codigo.replace(/-R\d+$/, '');
      Object.assign(valores, { numero: base.numero, revisao, codigo: `${raiz}-R${revisao}`, importada_de: null });
      const agora = agoraISO();
      const filtro = `numero = ? AND revisao < ? AND situacao IN ('rascunho', 'enviada') AND arquivado_em IS NULL`;
      extras.push(
        env.DB.prepare(
          `INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
           SELECT id, 'propostas', 'alterar', ?, ?, json_object('situacao', json_array(situacao, 'substituida'))
           FROM propostas WHERE ${filtro}`,
        ).bind(ferramenta, agora, base.numero, revisao),
        env.DB.prepare(
          `UPDATE propostas SET situacao = 'substituida', versao = versao + 1, atualizado_em = ?, atualizado_por = ?
           WHERE ${filtro}`,
        ).bind(agora, ferramenta, base.numero, revisao),
      );
      return extras;
    }

    // A numeração precisa continuar do vendas antigo: sem a sequência ajustada, recusa
    // (senão o Universo começaria do 1 e repetiria números que já foram para clientes).
    if ((await valorSequencia(env, 'propostas')) === null) {
      throw new ErroApi(409, 'numeracao_nao_ajustada', {
        detalhe: 'a numeração das propostas ainda não foi ajustada ao vendas antigo (rode a migração das propostas)',
      });
    }
    const numero = await proximoNumero(env, 'propostas');
    const ano = (valores.data || hojeBrasilia()).slice(0, 4);
    Object.assign(valores, { numero, revisao: 0, codigo: `PC-${quatro(numero)}-${ano}`, importada_de: null });
    return extras;
  },

  async alterar(env, ferramenta, atual, mudancas) {
    if (atual.arquivo_pdf_id) {
      const travados = Object.keys(mudancas).filter((k) => CONGELADOS.includes(k));
      if (travados.length) {
        throw new ErroApi(409, 'proposta_congelada', {
          detalhe: `o PDF desta proposta já foi gerado; para mudar ${travados.join(', ')}, crie uma revisão`,
          campos: travados,
        });
      }
    }
    if (mudancas.arquivo_pdf_id) {
      const a = await env.DB.prepare('SELECT * FROM arquivos WHERE id = ?').bind(mudancas.arquivo_pdf_id).first();
      if (!a || a.arquivado_em) throw new ErroApi(422, 'PDF: arquivo não encontrado');
      if (a.categoria !== 'pdf_proposta') throw new ErroApi(422, 'PDF: o arquivo precisa ser da categoria pdf_proposta');
      if (a.dono_id !== atual.id) throw new ErroApi(422, 'PDF: o arquivo precisa pertencer a esta proposta (dono_id)');
      if (!(a.variantes || '').split(',').includes('g')) throw new ErroApi(422, 'PDF: o conteúdo do arquivo ainda não foi enviado');
    }
    if (mudancas.situacao === 'enviada' && !atual.enviada_em && !('enviada_em' in mudancas)) {
      mudancas.enviada_em = hojeBrasilia();
    }
  },
};

const CONGELADOS = TABELAS.propostas.congelado.campos;

// ---------------------------------------------------------------- contratos

const contratos = {
  async criar(env, ferramenta, valores) {
    const numero = await proximoNumero(env, 'contratos');
    Object.assign(valores, { numero, codigo: `CT-${quatro(numero)}-${hojeBrasilia().slice(0, 4)}` });
    return [];
  },
};

export const REGRAS = { oportunidades, propostas, contratos };

// ---------------------------------------------------------------- painel do comercial
// Uma chamada só para a tela do funil: oportunidades abertas (e as fechadas nos últimos 90 dias)
// com nome do cliente, contato, última proposta e a próxima ação (da interação mais recente).

export async function painelComercial(env) {
  const corte = new Date(Date.now() - 90 * 86400e3 - 3 * 3600e3).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(
    `SELECT o.*,
       COALESCE(org.nome, pc.nome) AS cliente_nome,
       pe.nome AS contato_nome, pe.whatsapp AS contato_whatsapp, pe.telefone AS contato_telefone, pe.email AS contato_email,
       (SELECT json_object('id', p.id, 'codigo', p.codigo, 'valor_total', p.valor_total, 'situacao', p.situacao,
                           'arquivo_pdf_id', p.arquivo_pdf_id, 'data', p.data)
          FROM propostas p WHERE p.oportunidade_id = o.id AND p.arquivado_em IS NULL
          ORDER BY p.numero DESC, p.revisao DESC LIMIT 1) AS ultima_proposta,
       (SELECT json_object('id', i.id, 'data', i.data, 'tipo', i.tipo, 'proxima_acao', i.proxima_acao,
                           'proxima_acao_em', i.proxima_acao_em)
          FROM interacoes i WHERE i.sobre_id = o.id AND i.arquivado_em IS NULL
          ORDER BY i.data DESC, i.criado_em DESC LIMIT 1) AS ultima_interacao,
       (SELECT count(*) FROM propostas p WHERE p.oportunidade_id = o.id AND p.arquivado_em IS NULL) AS n_propostas
     FROM oportunidades o
       LEFT JOIN organizacoes org ON org.id = o.cliente_id
       LEFT JOIN pessoas pc ON pc.id = o.cliente_id
       LEFT JOIN pessoas pe ON pe.id = o.contato_pessoa_id
     WHERE o.arquivado_em IS NULL AND (o.etapa_funil NOT IN ('ganha', 'perdida') OR o.fechada_em >= ?)
     ORDER BY o.atualizado_em DESC LIMIT 500`,
  ).bind(corte).all();
  return {
    itens: results.map((r) => ({
      ...r,
      ultima_proposta: r.ultima_proposta ? JSON.parse(r.ultima_proposta) : null,
      ultima_interacao: r.ultima_interacao ? JSON.parse(r.ultima_interacao) : null,
    })),
    fechadas_desde: corte,
  };
}
