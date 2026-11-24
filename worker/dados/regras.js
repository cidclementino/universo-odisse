// Regras de negócio por tabela, chamadas pela API ao criar e ao alterar.
// O esquema (esquema.js) diz o que cada campo aceita; aqui fica o que depende de outros registros:
// numeração, revisões, funil e o congelamento das propostas.
//
//   criar(env, ferramenta, valores, corpo)   -> pode completar `valores`; devolve comandos extras do lote
//   alterar(env, ferramenta, atual, mudancas) -> pode completar `mudancas` ou recusar (ErroApi)

import { hojeBrasilia, agoraISO, novoId } from './util.js';
import { TABELAS, SIGLAS_DOCUMENTO } from './esquema.js';

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
//   normal         -> número novo da sequência, revisão 0, código PC-AAAA-NNNN (ano da data da proposta)
//                     (até 11/2026 era PC-NNNN-AAAA; os já emitidos ficam como estão)
//   revisao_de     -> mesmo número, revisão seguinte, código <código da original>-R1; as anteriores ainda em
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
    Object.assign(valores, { numero, revisao: 0, codigo: `PC-${ano}-${quatro(numero)}`, importada_de: null });
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

// ---------------------------------------------------------------- projetos (0004)
// Código OA-AAAA-NNN (até a 0005, AAAA-NNN); a numeração recomeça a cada ano (sequência `projetos-<ano>`).
// Um projeto nasce do contrato principal assinado (contratos, abaixo) ou do cadastro manual
// na ferramenta Projetos (projetos que já existiam antes do Universo, com o código que já tinham).

const tres = (n) => String(n).padStart(3, '0');

async function numerarProjeto(env, ano, codigoDado) {
  if (codigoDado) {
    const m = String(codigoDado).trim().toUpperCase().match(/^(?:OA-)?(\d{4})-(\d{3,4})$/);
    if (!m) throw new ErroApi(422, 'Código: no formato OA-AAAA-NNN (ex.: OA-2025-031)');
    const a = Number(m[1]);
    const numero = Number(m[2]);
    if (a < 2000 || a > 2100 || numero < 1) throw new ErroApi(422, 'Código: ano ou número fora do esperado');
    // a sequência do ano vai até pelo menos este número: o próximo automático nunca repete um código antigo
    await ajustarSequencia(env, `projetos-${a}`, numero);
    return { codigo: `OA-${a}-${tres(numero)}`, ano: a, numero };
  }
  const numero = await proximoNumero(env, `projetos-${ano}`);
  return { codigo: `OA-${ano}-${tres(numero)}`, ano, numero };
}

// Soma dias a um dia AAAA-MM-DD (dias corridos, como o cronograma da proposta).
export function somarDias(dia, n) {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Prazos previstos das etapas em sequência a partir do início, como o cronograma da proposta:
// cada etapa dura `semanas` × 7 dias corridos e a seguinte começa no dia em que a anterior termina.
export function preverEtapas(inicio, etapas) {
  let cursor = inicio;
  return etapas.map((e) => {
    if (!cursor || !e.semanas) return { ...e, inicio_previsto: e.inicio_previsto ?? null, fim_previsto: e.fim_previsto ?? null };
    const fim = somarDias(cursor, Math.round(e.semanas * 7));
    const r = { ...e, inicio_previsto: cursor, fim_previsto: fim };
    cursor = fim;
    return r;
  });
}

// INSERT … SELECT com guarda: só grava se a guarda existir (o registro-pai foi gravado no mesmo lote).
function inserirGuardado(env, tabela, linha, guarda) {
  const cols = Object.keys(linha);
  return env.DB.prepare(`INSERT INTO ${tabela} (${cols.join(', ')}) SELECT ${cols.map(() => '?').join(', ')} WHERE EXISTS (${guarda[0]})`)
    .bind(...cols.map((k) => linha[k]), ...guarda[1]);
}
function historicoGuardado(env, tabela, id, acao, por, mudancas, guarda) {
  return env.DB.prepare(`INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (${guarda[0]})`)
    .bind(id, tabela, acao, por, agoraISO(), mudancas ? JSON.stringify(mudancas) : null, ...guarda[1]);
}
const comuns = (id, ferramenta, agora) => ({
  id, criado_em: agora, atualizado_em: agora, criado_por: ferramenta, atualizado_por: ferramenta, versao: 1, arquivado_em: null,
});

// Etapas, local do imóvel e co-clientes de um projeto novo. `dados.etapas` = [{ nome, fase, ref_vendas,
// semanas, percentual_pagamento }] (na ordem); `dados.local` = { logradouro, numero, complemento, cep, referencias };
// `dados.coclientes` = ids (pes_/org_). Devolve { stmts, previsao_fim }.
export async function filhosDoProjeto(env, ferramenta, prjId, inicio, dados, guarda, { validar, novoId, sqlBusca }) {
  const agora = agoraISO();
  const stmts = [];
  const lista = Array.isArray(dados.etapas) ? dados.etapas : [];
  if (lista.length > 40) throw new ErroApi(422, 'no máximo 40 etapas');
  const limpas = lista.map((e, i) => {
    const v = validar('etapas', { ...e, projeto_id: prjId, ordem: i + 1 });
    if (v.semanas !== null && (v.semanas < 0 || v.semanas > 520)) throw new ErroApi(422, `Etapa ${i + 1}: semanas fora do esperado`);
    return v;
  });
  const previstas = preverEtapas(inicio, limpas);
  for (const e of previstas) {
    const id = novoId('eta');
    const linha = { ...comuns(id, ferramenta, agora), ...e, situacao: e.situacao || 'prevista' };
    stmts.push(inserirGuardado(env, 'etapas', linha, guarda), historicoGuardado(env, 'etapas', id, 'criar', ferramenta, e, guarda));
  }
  if (dados.local && typeof dados.local === 'object') {
    const v = validar('projetos_local', dados.local);
    if (Object.values(v).some((x) => x !== null)) {
      stmts.push(inserirGuardado(env, 'projetos_local', { ...comuns(prjId, ferramenta, agora), ...v }, guarda),
        historicoGuardado(env, 'projetos_local', prjId, 'criar', ferramenta, v, guarda));
    }
  }
  const cocl = [...new Set((dados.coclientes || []).filter((x) => /^(pes|org)_/.test(x)))];
  for (const para of cocl) {
    const id = novoId('vin');
    const linha = { ...comuns(id, ferramenta, agora), de_id: prjId, para_id: para, papel: 'cliente', observacao: null };
    stmts.push(inserirGuardado(env, 'vinculos', linha, guarda),
      historicoGuardado(env, 'vinculos', id, 'criar', ferramenta, { de_id: prjId, para_id: para, papel: 'cliente' }, guarda));
  }
  const ultimo = previstas.filter((e) => e.fim_previsto).pop();
  return { stmts, previsao_fim: ultimo ? ultimo.fim_previsto : null };
}

const projetos = {
  // cadastro manual (ferramenta Projetos): aceita o código que o projeto já tinha, etapas, local e co-clientes
  async criar(env, ferramenta, valores, corpo, id, aux) {
    const ano = Number((valores.inicio || hojeBrasilia()).slice(0, 4));
    Object.assign(valores, await numerarProjeto(env, ano, corpo.codigo), { contrato_id: null });
    if (valores.cliente_id) {
      const ok = await env.DB.prepare(`SELECT 1 FROM ${valores.cliente_id.startsWith('org_') ? 'organizacoes' : 'pessoas'} WHERE id = ?`)
        .bind(valores.cliente_id).first();
      if (!ok) throw new ErroApi(422, 'Cliente: não encontrado');
    }
    const guarda = ['SELECT 1 FROM projetos WHERE id = ?', [id]];
    const f = await filhosDoProjeto(env, ferramenta, id, valores.inicio, corpo, guarda, aux);
    if (!valores.previsao_fim && f.previsao_fim) valores.previsao_fim = f.previsao_fim;
    return f.stmts;
  },
};

// ---------------------------------------------------------------- contratos
// Assinar o contrato PRINCIPAL cria o projeto (código, etapas com prazos, local do imóvel, co-clientes),
// marca a proposta como aceita e a oportunidade como ganha — tudo no mesmo lote do contrato.
// O vendas manda em `corpo.projeto` o que só ele sabe ler do cálculo (nomes das etapas, endereço do imóvel);
// cliente, núcleo e co-clientes vêm da oportunidade. `corpo.projeto_existente` liga a um projeto que já
// existe (cadastrado à mão) em vez de criar outro. Aditivo assinado precisa de projeto_id.

async function assinar(env, ferramenta, contrato, corpo, guarda, aux) {
  const valores = {};
  const extras = [];
  if (!contrato.assinado_em) valores.assinado_em = hojeBrasilia();
  const assinadoEm = contrato.assinado_em || valores.assinado_em;
  if (contrato.tipo === 'aditivo') {
    if (!contrato.projeto_id) throw new ErroApi(422, 'aditivo assinado precisa do projeto (projeto_id)');
    return { valores, extras };
  }
  if (contrato.projeto_id) return { valores, extras }; // já ligado a um projeto

  if (!contrato.proposta_id) throw new ErroApi(422, 'contrato principal: informe a proposta aceita (proposta_id)');
  const ppt = await env.DB.prepare('SELECT * FROM propostas WHERE id = ?').bind(contrato.proposta_id).first();
  if (!ppt || ppt.arquivado_em) throw new ErroApi(422, 'Proposta: não encontrada');
  if (ppt.simulacao) throw new ErroApi(422, 'simulação não vira contrato');
  const opo = await env.DB.prepare('SELECT * FROM oportunidades WHERE id = ?').bind(ppt.oportunidade_id).first();
  if (!contrato.valor_total && ppt.valor_total) valores.valor_total = ppt.valor_total;

  // ligar a um projeto já cadastrado (ex.: cadastrado à mão antes de o contrato entrar no Universo)
  if (corpo.projeto_existente) {
    const prj = await env.DB.prepare('SELECT id, arquivado_em, contrato_id FROM projetos WHERE id = ?').bind(String(corpo.projeto_existente)).first();
    if (!prj || prj.arquivado_em) throw new ErroApi(422, 'Projeto: não encontrado');
    valores.projeto_id = prj.id;
    if (!prj.contrato_id) {
      extras.push(env.DB.prepare(`UPDATE projetos SET contrato_id = ?, oportunidade_id = COALESCE(oportunidade_id, ?), versao = versao + 1,
        atualizado_em = ?, atualizado_por = ? WHERE id = ? AND contrato_id IS NULL AND EXISTS (${guarda[0]})`)
        .bind(contrato.id, opo?.id ?? null, agoraISO(), ferramenta, prj.id, ...guarda[1]));
    }
  } else {
    const p = corpo.projeto && typeof corpo.projeto === 'object' ? corpo.projeto : {};
    const coclientes = [];
    if (opo) {
      const { results } = await env.DB.prepare(
        `SELECT para_id FROM vinculos WHERE de_id = ? AND papel = 'cliente' AND arquivado_em IS NULL`).bind(opo.id).all();
      coclientes.push(...results.map((r) => r.para_id));
    }
    const base = aux.validar('projetos', {
      nome: p.nome || opo?.titulo || ppt.titulo || 'Projeto',
      nome_publico: p.nome_publico, servico: p.servico || ppt.titulo, tipologia: p.tipologia, area_m2: p.area_m2,
      bairro: p.bairro, cidade: p.cidade, uf: p.uf, inicio: p.inicio || assinadoEm,
      nucleo_id: p.nucleo_id || opo?.nucleo_id || 'arquitetos', cliente_id: opo?.cliente_id, oportunidade_id: opo?.id,
      responsavel_id: p.responsavel_id || opo?.responsavel_id, observacoes: p.observacoes,
    });
    const prjId = aux.novoId('prj');
    const num = await numerarProjeto(env, Number(assinadoEm.slice(0, 4)), null);
    const f = await filhosDoProjeto(env, ferramenta, prjId, base.inicio, { etapas: p.etapas, local: p.local, coclientes }, guarda, aux);
    const agora = agoraISO();
    const linha = {
      ...comuns(prjId, ferramenta, agora), ...base, ...num, contrato_id: contrato.id, situacao: 'ativo',
      previsao_fim: base.previsao_fim || f.previsao_fim, publicavel: base.publicavel ?? null,
    };
    // projeto primeiro (as etapas, o local e os vínculos apontam para ele)
    extras.push(inserirGuardado(env, 'projetos', linha, guarda),
      historicoGuardado(env, 'projetos', prjId, 'criar', ferramenta, { ...base, ...num, contrato_id: contrato.id }, guarda));
    const b = aux.sqlBusca('projetos', prjId, linha, false);
    if (b) extras.push(env.DB.prepare(b[0].replace(/\s+ON CONFLICT/, ` WHERE EXISTS (${guarda[0]}) ON CONFLICT`))
      .bind(...b[1], ...guarda[1]));
    extras.push(...f.stmts);
    valores.projeto_id = prjId;
  }

  // proposta aceita e oportunidade ganha (se ainda não estavam)
  const agora = agoraISO();
  const hoje = hojeBrasilia();
  extras.push(
    env.DB.prepare(`INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
      SELECT id, 'propostas', 'alterar', ?, ?, json_object('situacao', json_array(situacao, 'aceita'))
      FROM propostas WHERE id = ? AND situacao <> 'aceita' AND EXISTS (${guarda[0]})`).bind(ferramenta, agora, ppt.id, ...guarda[1]),
    env.DB.prepare(`UPDATE propostas SET situacao = 'aceita', versao = versao + 1, atualizado_em = ?, atualizado_por = ?
      WHERE id = ? AND situacao <> 'aceita' AND EXISTS (${guarda[0]})`).bind(agora, ferramenta, ppt.id, ...guarda[1]),
  );
  if (opo) {
    extras.push(
      env.DB.prepare(`INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
        SELECT id, 'oportunidades', 'alterar', ?, ?, json_object('etapa_funil', json_array(etapa_funil, 'ganha'))
        FROM oportunidades WHERE id = ? AND etapa_funil <> 'ganha' AND EXISTS (${guarda[0]})`).bind(ferramenta, agora, opo.id, ...guarda[1]),
      env.DB.prepare(`UPDATE oportunidades SET etapa_funil = 'ganha', etapa_desde = ?, fechada_em = ?, versao = versao + 1,
        atualizado_em = ?, atualizado_por = ? WHERE id = ? AND etapa_funil <> 'ganha' AND EXISTS (${guarda[0]})`)
        .bind(hoje, hoje, agora, ferramenta, opo.id, ...guarda[1]),
    );
  }
  return { valores, extras };
}

const contratos = {
  async criar(env, ferramenta, valores, corpo, id, aux) {
    const numero = await proximoNumero(env, 'contratos');
    Object.assign(valores, { numero, codigo: `CT-${hojeBrasilia().slice(0, 4)}-${quatro(numero)}` });
    if (valores.situacao !== 'assinado') return [];
    const guarda = ['SELECT 1 FROM contratos WHERE id = ? AND versao = 1', [id]];
    const r = await assinar(env, ferramenta, { ...valores, id }, corpo, guarda, aux);
    Object.assign(valores, r.valores);
    return r.extras;
  },
  async alterar(env, ferramenta, atual, mudancas, corpo, aux) {
    if (atual.situacao === 'assinado' && mudancas.projeto_id !== undefined && atual.projeto_id && mudancas.projeto_id !== atual.projeto_id) {
      throw new ErroApi(409, 'o contrato assinado já está ligado a um projeto');
    }
    if (mudancas.situacao !== 'assinado' || atual.situacao === 'assinado') return [];
    const guarda = ['SELECT 1 FROM contratos WHERE id = ? AND versao = ?', [atual.id, atual.versao + 1]];
    const r = await assinar(env, ferramenta, { ...atual, ...mudancas }, corpo, guarda, aux);
    Object.assign(mudancas, r.valores);
    return r.extras;
  },
};

// ---------------------------------------------------------------- horas
// A etapa precisa ser do mesmo projeto (o banco também confere, por gatilho).
async function conferirEtapa(env, projetoId, etapaId) {
  if (!etapaId) return;
  const e = await env.DB.prepare('SELECT projeto_id FROM etapas WHERE id = ?').bind(etapaId).first();
  if (!e || e.projeto_id !== projetoId) throw new ErroApi(422, 'Etapa: precisa ser uma etapa deste projeto');
}
const horas = {
  async criar(env, ferramenta, valores) { await conferirEtapa(env, valores.projeto_id, valores.etapa_id); return []; },
  async alterar(env, ferramenta, atual, mudancas) {
    if ('etapa_id' in mudancas || 'projeto_id' in mudancas) {
      await conferirEtapa(env, mudancas.projeto_id ?? atual.projeto_id, 'etapa_id' in mudancas ? mudancas.etapa_id : atual.etapa_id);
    }
    return [];
  },
};

// ---------------------------------------------------------------- Bases e PGT (0005)
// Sigla em maiúsculas (2 a 4 letras, única entre os ativos — o banco também confere);
// índice de complexidade: só critérios e níveis conhecidos; ordem nova = depois do último.

export const CRITERIOS_IC = ['qtd_especialistas', 'qtd_aprovacoes', 'grau_resp_civil', 'grau_intervencao_cliente',
  'expectativa_plastica', 'grau_controle_custo', 'indefinicao_escopo', 'indefinicao_prazo', 'demanda_midia'];
const NIVEIS_IC = ['baixo', 'medio', 'alto'];

function conferirSigla(o) {
  if (!('sigla' in o) || o.sigla === null) return;
  o.sigla = o.sigla.toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(o.sigla)) throw new ErroApi(422, 'Sigla: de 2 a 4 letras, sem acento');
}
function conferirIC(o, campo, rotulo) {
  if (!(campo in o) || o[campo] === null) return;
  const v = JSON.parse(o[campo]);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroApi(422, `${rotulo}: objeto { critério: nível }`);
  for (const [k, n] of Object.entries(v)) {
    if (!CRITERIOS_IC.includes(k)) throw new ErroApi(422, `${rotulo}: critério desconhecido (${k})`);
    if (!NIVEIS_IC.includes(n)) throw new ErroApi(422, `${rotulo}: nível de ${k} precisa ser baixo, medio ou alto`);
  }
}
function conferirFaixa(o, campo, rotulo, min, max) {
  if (campo in o && o[campo] !== null && (o[campo] < min || (max !== undefined && o[campo] > max))) {
    throw new ErroApi(422, `${rotulo}: ${max === undefined ? `a partir de ${min}` : `entre ${min} e ${max}`}`);
  }
}
async function ordemNoFim(env, tabela, valores, filtro) {
  if (valores.ordem !== null && valores.ordem !== undefined) return;
  const [col, v] = filtro || [];
  const r = await env.DB.prepare(`SELECT COALESCE(MAX(ordem), 0) AS m FROM ${tabela} WHERE arquivado_em IS NULL${col ? ` AND ${col} = ?` : ''}`)
    .bind(...(col ? [v] : [])).first();
  valores.ordem = (r?.m || 0) + 1;
}
const simples = (tabela, conferir, filtroOrdem) => ({
  async criar(env, ferramenta, valores) {
    conferir(valores);
    await ordemNoFim(env, tabela, valores, filtroOrdem && [filtroOrdem, valores[filtroOrdem]]);
    return [];
  },
  async alterar(env, ferramenta, atual, mudancas) { conferir(mudancas); return []; },
});

// ---------------------------------------------------------------- serviços em fluxo e em ilha (0022)
// Em fluxo: o serviço marca P/O/— nos cartões do plano comum (etapas sem dono, fases não soltas) e pede tipologia.
// Em ilha: o serviço tem etapas próprias (pgt_etapas.servico_id), na fase solta, com cartões só dele.
// Trocar não apaga nada: o que era da outra dinâmica fica guardado e volta se ela voltar.
//   * serviço novo nasce vazio: em ilha, com uma etapa vazia com a sigla dele; em fluxo, com tudo opcional (O);
//   * entrar no fluxo sem marcação guardada = tudo opcional (O);
//   * copiar_de (só na criação): nasce com as configurações do outro (dinâmica, preço, IC, marcações,
//     pesos dos honorários e os cartões da ilha, copiados como cartões novos e independentes).
const IC_MEDIO = () => JSON.stringify(Object.fromEntries(CRITERIOS_IC.map((k) => [k, 'medio'])));
const conferirServico = (o) => {
  conferirSigla(o); conferirIC(o, 'ic_ajustes', 'Ajustes do índice'); conferirIC(o, 'ic_padrao', 'Índice de complexidade do serviço');
  conferirFaixa(o, 'modificador', 'Modificador', 0);
  if (o.dinamica) o.pede_tipologia = o.dinamica === 'fluxo' ? 1 : 0;
};
const histSql = (env, registro, tabela, ferramenta, acao, mudancas) => env.DB.prepare(
  'INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas) VALUES (?, ?, ?, ?, ?, ?)',
).bind(registro, tabela, acao, ferramenta, agoraISO(), JSON.stringify(mudancas));
const etiqueta = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');   // marca dos ids copiados

async function faseSolta(env) {
  const f = await env.DB.prepare('SELECT id FROM pgt_fases WHERE solta = 1 AND arquivado_em IS NULL ORDER BY ordem LIMIT 1').first();
  if (!f) throw new ErroApi(422, 'não há o grupo das ilhas no Plano Geral de Trabalho (fase solta)');
  return f.id;
}
async function siglaDeEtapaLivre(env, sigla, ocupadas = new Set()) {
  const r = await env.DB.prepare('SELECT 1 FROM pgt_etapas WHERE sigla = ? AND arquivado_em IS NULL').bind(sigla).first();
  return !r && !ocupadas.has(sigla);
}
// etapa nova de uma ilha (+ instância do Encerramento no fim dela)
function sqlEtapaDaIlha(env, ferramenta, { id, fase, sigla, nome, servico, copiaDe = null }) {
  const agora = agoraISO();
  return [
    copiaDe
      ? env.DB.prepare(`INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, fase_id, sigla, nome, ordem,
          nbr_nome, nbr_sigla, nbr_nota, descricao, servico_id)
          SELECT ?, ?, ?, ?, ?, 1, ?, ?, nome, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM pgt_etapas), nbr_nome, nbr_sigla, nbr_nota, descricao, ?
          FROM pgt_etapas WHERE id = ?`).bind(id, agora, agora, ferramenta, ferramenta, fase, sigla, servico, copiaDe)
      : env.DB.prepare(`INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, fase_id, sigla, nome, ordem, servico_id)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM pgt_etapas), ?)`)
        .bind(id, agora, agora, ferramenta, ferramenta, fase, sigla, nome, servico),
    env.DB.prepare(`UPDATE pgt_eventos SET instancias = json_insert(COALESCE(instancias, '[]'), '$[#]', ?)
      WHERE encerramento = 1 AND arquivado_em IS NULL`).bind(id),
    histSql(env, id, 'pgt_etapas', ferramenta, 'criar', { servico_id: [null, servico], sigla: [null, sigla] }),
  ];
}
async function etapaVaziaDaIlha(env, ferramenta, servico, sigla, nome) {
  if (!(await siglaDeEtapaLivre(env, sigla))) throw new ErroApi(422, `Sigla: já há uma etapa ${sigla} no Plano Geral de Trabalho`);
  return sqlEtapaDaIlha(env, ferramenta, { id: novoId('pet'), fase: await faseSolta(env), sigla, nome, servico });
}
// cartões do fluxo (etapas sem dono, fora da fase solta)
const DO_FLUXO = `t.servico_id IS NULL AND t.arquivado_em IS NULL AND f.solta = 0 AND f.arquivado_em IS NULL`;
async function temMarcasNoFluxo(env, servico) {
  const r = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM pgt_entregaveis_servicos x JOIN pgt_entregaveis e ON e.id = x.entregavel_id
      JOIN pgt_etapas t ON t.id = e.etapa_id JOIN pgt_fases f ON f.id = t.fase_id WHERE x.servico_id = ? AND ${DO_FLUXO})
    + (SELECT COUNT(*) FROM pgt_eventos_servicos x JOIN pgt_eventos v ON v.id = x.evento_id
      JOIN pgt_etapas t ON t.id = v.etapa_id JOIN pgt_fases f ON f.id = t.fase_id WHERE x.servico_id = ? AND v.encerramento = 0 AND ${DO_FLUXO}) AS n`)
    .bind(servico, servico).first();
  return (r?.n || 0) > 0;
}
const sqlFluxoOpcional = (env, servico) => [
  env.DB.prepare(`INSERT OR IGNORE INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia)
    SELECT e.id, ?, 'O' FROM pgt_entregaveis e JOIN pgt_etapas t ON t.id = e.etapa_id JOIN pgt_fases f ON f.id = t.fase_id
    WHERE e.arquivado_em IS NULL AND ${DO_FLUXO}`).bind(servico),
  env.DB.prepare(`INSERT OR IGNORE INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
    SELECT v.id, ?, 'O' FROM pgt_eventos v JOIN pgt_etapas t ON t.id = v.etapa_id JOIN pgt_fases f ON f.id = t.fase_id
    WHERE v.arquivado_em IS NULL AND v.encerramento = 0 AND ${DO_FLUXO}`).bind(servico),
];
async function etapasDaIlha(env, servico) {
  return (await env.DB.prepare('SELECT * FROM pgt_etapas WHERE servico_id = ? AND arquivado_em IS NULL ORDER BY ordem').bind(servico).all()).results;
}
// Cópia de um serviço para o novo (id): marcações do fluxo, pesos, IC por categoria e, em ilha, os cartões.
async function sqlCopiaDoServico(env, ferramenta, origem, id, valores) {
  const agora = agoraISO();
  const s = [
    env.DB.prepare(`INSERT OR IGNORE INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia)
      SELECT x.entregavel_id, ?, x.pertinencia FROM pgt_entregaveis_servicos x JOIN pgt_entregaveis e ON e.id = x.entregavel_id
      JOIN pgt_etapas t ON t.id = e.etapa_id JOIN pgt_fases f ON f.id = t.fase_id WHERE x.servico_id = ? AND e.arquivado_em IS NULL AND ${DO_FLUXO}`).bind(id, origem.id),
    env.DB.prepare(`INSERT OR IGNORE INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
      SELECT x.evento_id, ?, x.pertinencia FROM pgt_eventos_servicos x JOIN pgt_eventos v ON v.id = x.evento_id
      JOIN pgt_etapas t ON t.id = v.etapa_id JOIN pgt_fases f ON f.id = t.fase_id WHERE x.servico_id = ? AND v.arquivado_em IS NULL AND v.encerramento = 0 AND ${DO_FLUXO}`).bind(id, origem.id),
    env.DB.prepare(`INSERT OR IGNORE INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas)
      SELECT etapa_id, ?, pertinencia, peso, semanas FROM pgt_etapas_servicos WHERE servico_id = ?`).bind(id, origem.id),
    env.DB.prepare(`INSERT OR IGNORE INTO pgt_fases_servicos (fase_id, servico_id, peso) SELECT fase_id, ?, peso FROM pgt_fases_servicos WHERE servico_id = ?`).bind(id, origem.id),
    env.DB.prepare(`INSERT OR IGNORE INTO bases_ic (servico_id, categoria_id, ic, atualizado_em, atualizado_por)
      SELECT ?, categoria_id, ic, ?, ? FROM bases_ic WHERE servico_id = ?`).bind(id, agora, ferramenta, origem.id),
  ];
  if (valores.dinamica !== 'ilha') return s;
  const fontes = await etapasDaIlha(env, origem.id);
  if (!fontes.length) return [...s, ...(await etapaVaziaDaIlha(env, ferramenta, id, valores.sigla, valores.nome))];
  const fase = await faseSolta(env);
  const ocupadas = new Set();
  for (const [i, src] of fontes.entries()) {
    // a primeira etapa leva a sigla do serviço; as outras, a sigla + uma letra (CVA, CVB…)
    let sigla = i === 0 ? valores.sigla : null;
    for (let k = 0; !sigla || !(await siglaDeEtapaLivre(env, sigla, ocupadas)); k++) {
      if (k > 25) throw new ErroApi(422, 'não achei uma sigla livre para as etapas copiadas');
      sigla = `${valores.sigla.slice(0, 3)}${String.fromCharCode(65 + k)}`;
    }
    ocupadas.add(sigla);
    const nova = novoId('pet');
    const tag = etiqueta();
    const novoDe = (col) => `CASE WHEN ${col} = '${src.id}' THEN '${nova}' ELSE substr(${col}, 1, 4) || '${tag}_' || substr(${col}, 5) END`;
    s.push(...sqlEtapaDaIlha(env, ferramenta, { id: nova, fase, sigla, nome: src.nome, servico: id, copiaDe: src.id }));
    s.push(
      env.DB.prepare(`INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, texto, ordem, observacoes,
          prazo_turnos, pessoas, prazo_fixo, travado, junto_anterior)
        SELECT ${novoDe('id')}, ?, ?, ?, ?, 1, ?, texto, ordem, observacoes, prazo_turnos, pessoas, prazo_fixo, 0, junto_anterior
        FROM pgt_entregaveis WHERE etapa_id = ? AND arquivado_em IS NULL`).bind(agora, agora, ferramenta, ferramenta, nova, src.id),
      env.DB.prepare(`INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia)
        SELECT ${novoDe('e.id')}, ?, COALESCE((SELECT x.pertinencia FROM pgt_entregaveis_servicos x WHERE x.entregavel_id = e.id AND x.servico_id = ?), 'O')
        FROM pgt_entregaveis e WHERE e.etapa_id = ? AND e.arquivado_em IS NULL`).bind(id, origem.id, src.id),
      env.DB.prepare(`INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id)
        SELECT ${novoDe('e.id')}, x.categoria_id FROM pgt_entregaveis e JOIN pgt_entregaveis_categorias x ON x.entregavel_id = e.id
        WHERE e.etapa_id = ? AND e.arquivado_em IS NULL`).bind(src.id),
      env.DB.prepare(`INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo,
          prazo_turnos, quantidade, clausula, observacoes, ordem, travado, encerramento, decisao, terceiros, clausula_marcada)
        SELECT ${novoDe('id')}, ?, ?, ?, ?, 1, ?, nome, tipo, cliente, tempo, prazo_turnos, quantidade, clausula, observacoes, ordem, 0, 0,
          CASE WHEN decisao IS NULL THEN NULL ELSE replace(replace(decisao, '"pen_', '"pen_${tag}_'), '"pev_', '"pev_${tag}_') END, terceiros, clausula_marcada
        FROM pgt_eventos WHERE etapa_id = ? AND arquivado_em IS NULL AND encerramento = 0`).bind(agora, agora, ferramenta, ferramenta, nova, src.id),
      env.DB.prepare(`INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
        SELECT ${novoDe('v.id')}, ?, COALESCE((SELECT x.pertinencia FROM pgt_eventos_servicos x WHERE x.evento_id = v.id AND x.servico_id = ?), 'O')
        FROM pgt_eventos v WHERE v.etapa_id = ? AND v.arquivado_em IS NULL AND v.encerramento = 0`).bind(id, origem.id, src.id),
      env.DB.prepare(`INSERT INTO pgt_materiais (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, alvo_id, tipo, nome, descricao, link, arquivo_id, ordem)
        SELECT 'pma_${tag}_' || substr(m.id, 5), ?, ?, ?, ?, 1, ${novoDe('m.alvo_id')}, m.tipo, m.nome, m.descricao, m.link, m.arquivo_id, m.ordem
        FROM pgt_materiais m WHERE m.arquivado_em IS NULL AND (m.alvo_id = ?
          OR m.alvo_id IN (SELECT id FROM pgt_entregaveis WHERE etapa_id = ? AND arquivado_em IS NULL)
          OR m.alvo_id IN (SELECT id FROM pgt_eventos WHERE etapa_id = ? AND arquivado_em IS NULL AND encerramento = 0))`)
        .bind(agora, agora, ferramenta, ferramenta, src.id, src.id, src.id),
    );
  }
  return s;
}
const bases_servicos = {
  async criar(env, ferramenta, valores, corpo, id) {
    let origem = null;
    if (corpo.copiar_de) {
      origem = await env.DB.prepare('SELECT * FROM bases_servicos WHERE id = ? AND arquivado_em IS NULL').bind(String(corpo.copiar_de)).first();
      if (!origem) throw new ErroApi(422, 'Copiar de: serviço não encontrado');
      // nasce com as configurações do outro, menos o que o pedido disser
      for (const k of ['dinamica', 'com_preco', 'preco_por_etapa', 'modificador', 'ic_padrao', 'ic_ajustes', 'descricao']) {
        if (!(k in corpo) || corpo[k] === undefined) valores[k] = origem[k];
      }
    }
    conferirServico(valores);
    if (!valores.ic_padrao) valores.ic_padrao = IC_MEDIO();
    await ordemNoFim(env, 'bases_servicos', valores);
    // o Encerramento vale sempre (perpétuo) em todo serviço
    const extras = [env.DB.prepare(`INSERT OR IGNORE INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
      SELECT id, ?, 'S' FROM pgt_eventos WHERE encerramento = 1`).bind(id)];
    if (origem) extras.push(...(await sqlCopiaDoServico(env, ferramenta, origem, id, valores)));
    else if (valores.dinamica === 'ilha') extras.push(...(await etapaVaziaDaIlha(env, ferramenta, id, valores.sigla, valores.nome)));
    else extras.push(...sqlFluxoOpcional(env, id));   // em fluxo, vazio: tudo opcional, para marcar o que é pertinente
    return extras;
  },
  async alterar(env, ferramenta, atual, mudancas) {
    conferirServico(mudancas);
    // "pede tipologia" segue a dinâmica: não se muda sozinho
    if (!mudancas.dinamica || mudancas.dinamica === atual.dinamica) { delete mudancas.dinamica; delete mudancas.pede_tipologia; return []; }
    if (mudancas.dinamica === 'ilha') {
      return (await etapasDaIlha(env, atual.id)).length ? [] : etapaVaziaDaIlha(env, ferramenta, atual.id, mudancas.sigla || atual.sigla, mudancas.nome || atual.nome);
    }
    return (await temMarcasNoFluxo(env, atual.id)) ? [] : sqlFluxoOpcional(env, atual.id);
  },
};
const bases_categorias = simples('bases_categorias', (o) => conferirIC(o, 'ic_preset', 'Índice de complexidade'));
const bases_usos = simples('bases_usos', (o) => {
  conferirFaixa(o, 'fator_adequacao', 'Fator de adequação', 0); conferirFaixa(o, 'cub_referencia', 'CUB de referência', 0);
  if (o.cub_codigo) o.cub_codigo = o.cub_codigo.toUpperCase();
}, 'categoria_id');
const pgt_fases = simples('pgt_fases', (o) => conferirFaixa(o, 'parcela', 'Parcela', 0, 1));
const pgt_etapas = simples('pgt_etapas', (o) => { conferirSigla(o); conferirFaixa(o, 'semanas_base', 'Semanas', 0, 520); });
const pgt_materiais = simples('pgt_materiais', () => {}, 'alvo_id');
// 0024: padrões de material — os campos são uma lista em ordem; cada um com id, tipo e rótulo
const TIPOS_CAMPO = ['secao', 'texto', 'texto_longo', 'data', 'numero', 'escolha', 'marcar', 'tabela', 'pessoas', 'assinatura', 'automatico'];
const AUTOMATICOS = ['projeto', 'cliente', 'endereco', 'etapa', 'cartao', 'data', 'responsavel'];
const conferirCamposModelo = (o) => {
  if (o.campos == null) return;
  let l = o.campos;
  if (typeof l === 'string') { try { l = JSON.parse(l); } catch (_) { throw new ErroApi(422, 'Campos: JSON inválido'); } }
  if (!Array.isArray(l) || l.length > 200) throw new ErroApi(422, 'Campos: lista de até 200');
  const ids = new Set();
  for (const [i, c] of l.entries()) {
    if (!c || typeof c !== 'object' || !TIPOS_CAMPO.includes(c.tipo)) throw new ErroApi(422, `Campo ${i + 1}: tipo desconhecido`);
    if (!c.id || ids.has(c.id)) throw new ErroApi(422, `Campo ${i + 1}: id único`);
    ids.add(c.id);
    if (c.tipo === 'automatico' && !AUTOMATICOS.includes(c.fonte)) throw new ErroApi(422, `Campo ${i + 1}: dado automático desconhecido`);
  }
  o.campos = JSON.stringify(l);
};
const pgt_modelos = simples('pgt_modelos', conferirCamposModelo);

// Sequência da etapa (0008): entregas e eventos dividem a mesma ordem. Novo item (ou item que muda de
// etapa sem dizer a ordem) vai para o fim da sequência, antes do Encerramento.
async function fimDaSequencia(env, etapaId) {
  const r = await env.DB.prepare(`SELECT MAX(m) AS m FROM (
      SELECT MAX(ordem) AS m FROM pgt_entregaveis WHERE etapa_id = ? AND arquivado_em IS NULL
      UNION ALL SELECT MAX(ordem) FROM pgt_eventos WHERE etapa_id = ? AND arquivado_em IS NULL AND encerramento = 0)`)
    .bind(etapaId, etapaId).first();
  return (r?.m || 0) + 1;
}
// pertinência ao nascer ({ servicos: { srv_ne: 'P', … } }); 'S' (perpétuo) só em eventos
async function pertinenciaAoNascer(env, corpo, id, tabela, coluna, aceitas) {
  const servs = corpo.servicos && typeof corpo.servicos === 'object' ? corpo.servicos : {};
  const extras = [];
  for (const [srv, p] of Object.entries(servs)) {
    if (!p) continue;
    if (!aceitas.includes(p)) throw new ErroApi(422, `Pertinência: ${aceitas.join(' ou ')}`);
    const ok = await env.DB.prepare('SELECT 1 FROM bases_servicos WHERE id = ? AND arquivado_em IS NULL').bind(srv).first();
    if (!ok) throw new ErroApi(422, `Serviço ${srv}: não encontrado`);
    extras.push(env.DB.prepare(`INSERT INTO ${tabela} (${coluna}, servico_id, pertinencia) VALUES (?, ?, ?)`).bind(id, srv, p));
  }
  return extras;
}

// Entrega nova: pode já nascer com a pertinência por serviço.
const pgt_entregaveis = {
  async criar(env, ferramenta, valores, corpo, id) {
    if (valores.ordem === null || valores.ordem === undefined) valores.ordem = await fimDaSequencia(env, valores.etapa_id);
    return pertinenciaAoNascer(env, corpo, id, 'pgt_entregaveis_servicos', 'entregavel_id', ['P', 'O']);
  },
  async alterar(env, ferramenta, atual, mudancas) {
    // mudou de etapa sem dizer a ordem: vai para o fim da etapa nova
    if (mudancas.etapa_id && !('ordem' in mudancas)) mudancas.ordem = await fimDaSequencia(env, mudancas.etapa_id);
    return [];
  },
};

// Evento: o Encerramento (único, criado pela migração 0008) não muda de tipo, não se arquiva e só fica numa
// das suas instâncias; os demais não viram encerramento nem têm instâncias.
async function conferirInstancias(env, texto) {
  const l = JSON.parse(texto);
  if (!Array.isArray(l) || !l.length || l.some((x) => typeof x !== 'string' || !x.startsWith('pet_'))) {
    throw new ErroApi(422, 'Instâncias: lista de etapas (pet_…), ao menos uma');
  }
  for (const id of l) {
    const ok = await env.DB.prepare('SELECT 1 FROM pgt_etapas WHERE id = ? AND arquivado_em IS NULL').bind(id).first();
    if (!ok) throw new ErroApi(422, `Instâncias: etapa ${id} não encontrada`);
  }
  return l;
}
// Decisão (0009): 2 a 4 resultados, o primeiro é o caminho esperado; cada um libera (tira de suspensão)
// entregas ou eventos ativos, sem o próprio evento nem o Encerramento, e um cartão só é liberado por um resultado.
async function conferirDecisao(env, texto, proprioId) {
  if (texto === null || texto === undefined) return;
  let l;
  try { l = JSON.parse(texto); } catch (_) { throw new ErroApi(422, 'Decisão: JSON inválido'); }
  if (!Array.isArray(l) || l.length < 2 || l.length > 4) throw new ErroApi(422, 'Decisão: de 2 a 4 resultados');
  const ids = new Set(); const liberados = new Set();
  for (const r of l) {
    if (!r || typeof r.id !== 'string' || !/^[a-z0-9_-]{1,24}$/.test(r.id) || ids.has(r.id)) throw new ErroApi(422, 'Decisão: cada resultado precisa de um id curto e único');
    if (typeof r.nome !== 'string' || !r.nome.trim() || r.nome.length > 60) throw new ErroApi(422, 'Decisão: nome do resultado (até 60 caracteres)');
    if (!Array.isArray(r.libera)) throw new ErroApi(422, 'Decisão: "libera" é uma lista');
    ids.add(r.id);
    for (const x of r.libera) {
      if (typeof x !== 'string' || !/^pe[nv]_/.test(x) || x === proprioId) throw new ErroApi(422, 'Decisão: relacionados são outras entregas ou eventos');
      if (liberados.has(x)) throw new ErroApi(422, `Decisão: ${x} aparece em mais de um resultado`);
      liberados.add(x);
      const tab = x.startsWith('pen_') ? 'pgt_entregaveis' : 'pgt_eventos';
      const ok = await env.DB.prepare(`SELECT 1 FROM ${tab} WHERE id = ? AND arquivado_em IS NULL${tab === 'pgt_eventos' ? ' AND encerramento = 0' : ''}`).bind(x).first();
      if (!ok) throw new ErroApi(422, `Decisão: ${x} não encontrado`);
    }
  }
}
const pgt_eventos = {
  async criar(env, ferramenta, valores, corpo, id) {
    if (valores.tipo === 'encerramento') throw new ErroApi(422, 'Tipo: o Encerramento já existe (é um só)');
    if (valores.instancias) throw new ErroApi(422, 'Instâncias: só o Encerramento tem');
    await conferirDecisao(env, valores.decisao, id);
    if (valores.ordem === null || valores.ordem === undefined) valores.ordem = await fimDaSequencia(env, valores.etapa_id);
    return pertinenciaAoNascer(env, corpo, id, 'pgt_eventos_servicos', 'evento_id', ['P', 'O', 'S']);
  },
  async alterar(env, ferramenta, atual, mudancas) {
    if (atual.encerramento && 'decisao' in mudancas && mudancas.decisao !== null) throw new ErroApi(422, 'Decisão: o Encerramento não é evento de decisão');
    if ('decisao' in mudancas) await conferirDecisao(env, mudancas.decisao, atual.id);
    if (atual.encerramento) {
      if ('tipo' in mudancas && mudancas.tipo !== 'encerramento') throw new ErroApi(422, 'Tipo: o Encerramento não muda de tipo');
      const inst = 'instancias' in mudancas ? await conferirInstancias(env, mudancas.instancias) : JSON.parse(atual.instancias || '[]');
      const etapa = mudancas.etapa_id || atual.etapa_id;
      if (!inst.includes(etapa)) throw new ErroApi(422, 'Etapa: o Encerramento só fica numa das suas instâncias');
      return [];
    }
    if (mudancas.tipo === 'encerramento') throw new ErroApi(422, 'Tipo: o Encerramento já existe (é um só)');
    if ('instancias' in mudancas && mudancas.instancias !== null) throw new ErroApi(422, 'Instâncias: só o Encerramento tem');
    if (mudancas.etapa_id && !('ordem' in mudancas)) mudancas.ordem = await fimDaSequencia(env, mudancas.etapa_id);
    return [];
  },
  arquivar(atual, arquivando) {
    if (arquivando && atual.encerramento) throw new ErroApi(422, 'o Encerramento não se arquiva (vale para todos os serviços)');
  },
};

// ---------------------------------------------------------------- documentos (0010)
// Número por sigla e por ano (CA-2026-0001): o ano é o da data do documento (sem data = hoje, que fica gravado).
const documentos = {
  async criar(env, ferramenta, valores) {
    if (!valores.data) valores.data = hojeBrasilia();
    const ano = Number(valores.data.slice(0, 4));
    const sigla = SIGLAS_DOCUMENTO[valores.tipo];
    const numero = await proximoNumero(env, `documentos-${sigla}-${ano}`);
    Object.assign(valores, { numero, ano, codigo: `${sigla}-${ano}-${quatro(numero)}` });
    if (valores.tipo !== 'carta') valores.oficio = 0;
    return [];
  },
  async alterar(env, ferramenta, atual, mudancas) {
    if ('data' in mudancas) {
      if (!mudancas.data) throw new ErroApi(422, 'Data: o documento numerado precisa de data');
      if (Number(mudancas.data.slice(0, 4)) !== atual.ano) {
        throw new ErroApi(409, 'a data mudaria o ano do número; crie um documento novo', { codigo: atual.codigo });
      }
    }
    if (atual.tipo !== 'carta' && mudancas.oficio) mudancas.oficio = 0;
    return [];
  },
};

// ---------------------------------------------------------------- equipe (0011)
// `socio` é o estado; `papel` (antigo, ainda lido pelo Projetos) acompanha: sócio → 'socio'; os outros pelo
// cargo (arquiteto, estagiário; o resto, colaborador). Se uma tela antiga mandar só `papel`, o `socio` segue.
// Quem assina: RRT exige conselho e registro; contrato (representante legal) exige ser sócio.
const PAPEL_DO_CARGO = { crg_arquiteto: 'arquiteto', crg_estagiario: 'estagiario' };
const CARGO_DO_PAPEL = { arquiteto: 'crg_arquiteto', estagiario: 'crg_estagiario', colaborador: 'crg_colaborador' };
const papelDe = (socio, cargoId) => (socio ? 'socio' : PAPEL_DO_CARGO[cargoId] || 'colaborador');
// tela antiga (só papel): papel vira sócio + cargo
function dePapel(alvo, papel) {
  alvo.socio = papel === 'socio' ? 1 : 0;
  if (CARGO_DO_PAPEL[papel]) alvo.cargo_id = CARGO_DO_PAPEL[papel];
}

function conferirAssina(r) {
  const usos = (r.assina || '').split(',').filter(Boolean);
  if (usos.includes('rrt') && !(r.conselho && r.registro)) {
    throw new ErroApi(422, 'Pode assinar: RRT exige conselho e número de registro');
  }
  if (usos.includes('contrato') && !r.socio) {
    throw new ErroApi(422, 'Pode assinar: contrato só com sócio (representante legal)');
  }
}

// a foto precisa ser uma imagem comum (nunca o arquivo protegido de uma assinatura: a foto é pública no site)
async function conferirFoto(env, fotoId) {
  if (!fotoId) return;
  const a = await env.DB.prepare('SELECT categoria, protegido FROM arquivos WHERE id = ? AND arquivado_em IS NULL').bind(fotoId).first();
  if (!a || a.categoria !== 'imagem' || a.protegido) throw new ErroApi(422, 'Foto: precisa ser uma imagem do acervo');
}

const equipe = {
  async criar(env, ferramenta, valores, corpo) {
    await conferirFoto(env, valores.foto_id);
    if (corpo.socio === undefined && corpo.cargo_id === undefined && valores.papel) dePapel(valores, valores.papel);
    valores.papel = papelDe(valores.socio, valores.cargo_id);
    conferirAssina(valores);
    return [];
  },
  async alterar(env, ferramenta, atual, mudancas) {
    if ('foto_id' in mudancas) await conferirFoto(env, mudancas.foto_id);
    if ('papel' in mudancas && !('socio' in mudancas) && !('cargo_id' in mudancas)) {
      if (mudancas.papel) dePapel(mudancas, mudancas.papel);
    }
    const r = { ...atual, ...mudancas };
    const papel = papelDe(r.socio, r.cargo_id);
    if (papel !== atual.papel) mudancas.papel = papel;
    else delete mudancas.papel;
    for (const k of ['socio', 'cargo_id']) if (k in mudancas && mudancas[k] === atual[k]) delete mudancas[k];
    conferirAssina(r);
    return [];
  },
};

// ---------------------------------------------------------------- acervo (0020)
// "Pública": só com direitos livres. Mudar os direitos para outra coisa desliga o marcador.
function conferirPublica(r) {
  if (!r.publica) return;
  if (r.protegido) throw new ErroApi(422, 'Pública: arquivo protegido não vai para fora');
  if (!['imagem', 'video'].includes(r.categoria)) throw new ErroApi(422, 'Pública: só imagens e vídeos do acervo');
  if (r.direitos !== 'livre') throw new ErroApi(422, 'Pública: marque os direitos como livres antes');
}

const arquivos = {
  async criar(env, ferramenta, valores) {
    conferirPublica(valores);
    return [];
  },
  async alterar(env, ferramenta, atual, mudancas) {
    if ('direitos' in mudancas && mudancas.direitos !== 'livre' && atual.publica && !('publica' in mudancas)) mudancas.publica = 0;
    conferirPublica({ ...atual, ...mudancas });
    return [];
  },
};

const galeria = {
  async criar(env, ferramenta, valores) {
    const a = await env.DB.prepare('SELECT categoria, protegido, arquivado_em FROM arquivos WHERE id = ?').bind(valores.arquivo_id).first();
    if (!a || a.arquivado_em) throw new ErroApi(422, 'Imagem: não encontrada no acervo');
    if (a.protegido || !['imagem', 'video'].includes(a.categoria)) throw new ErroApi(422, 'Imagem: só imagens e vídeos entram na galeria');
    const alvo = await env.DB.prepare(
      `SELECT arquivado_em FROM ${{ prj: 'projetos', obj: 'objetos', col: 'colecoes' }[valores.alvo_id.slice(0, 3)]} WHERE id = ?`,
    ).bind(valores.alvo_id).first();
    if (!alvo || alvo.arquivado_em) throw new ErroApi(422, 'Projeto, objeto ou coleção: não encontrado');
    return [];
  },
};

export const REGRAS = {
  arquivos, galeria,
  documentos, equipe,
  oportunidades, propostas, contratos, projetos, horas,
  bases_servicos, bases_categorias, bases_usos, pgt_fases, pgt_etapas, pgt_entregaveis, pgt_eventos, pgt_materiais, pgt_modelos,
};

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
       (SELECT count(*) FROM propostas p WHERE p.oportunidade_id = o.id AND p.arquivado_em IS NULL) AS n_propostas,
       (SELECT json_object('id', j.id, 'codigo', j.codigo, 'nome', j.nome, 'situacao', j.situacao)
          FROM projetos j WHERE j.oportunidade_id = o.id AND j.arquivado_em IS NULL ORDER BY j.criado_em DESC LIMIT 1) AS projeto,
       (SELECT json_group_array(COALESCE(o2.nome, p2.nome))
          FROM vinculos v LEFT JOIN organizacoes o2 ON o2.id = v.para_id LEFT JOIN pessoas p2 ON p2.id = v.para_id
          WHERE v.de_id = o.id AND v.papel = 'cliente' AND v.arquivado_em IS NULL) AS coclientes
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
      projeto: r.projeto ? JSON.parse(r.projeto) : null,
      coclientes: r.coclientes ? JSON.parse(r.coclientes).filter(Boolean) : [],
    })),
    fechadas_desde: corte,
  };
}

// ---------------------------------------------------------------- propostas (página Propostas do vendas)
// Lista leve, de 10 em 10 (como no e-mail): sem o cálculo, com a oportunidade e o cliente já juntados e o
// total para a navegação. `q` procura no código, no título, na oportunidade e no nome do cliente;
// `simulacoes=0` tira as simulações; `simulacoes=so` traz só elas.
export async function listaPropostas(env, url) {
  const p = url.searchParams;
  const limite = Math.min(Math.max(parseInt(p.get('limite') || '10', 10) || 10, 1), 50);
  const de = Math.max(parseInt(p.get('de') || '0', 10) || 0, 0);
  const conds = ['p.arquivado_em IS NULL'];
  const args = [];
  if (p.get('simulacoes') === '0') conds.push('p.simulacao = 0');
  if (p.get('simulacoes') === 'so') conds.push('p.simulacao = 1');
  const q = String(p.get('q') || '').trim().toLowerCase();
  for (const termo of q.split(/\s+/).filter(Boolean).slice(0, 5)) {
    conds.push(`lower(p.codigo || ' ' || COALESCE(p.titulo, '') || ' ' || COALESCE(o.titulo, '') || ' ' || COALESCE(org.nome, pc.nome, '')
      || CASE WHEN p.simulacao = 1 THEN ' simulação simulacao' ELSE '' END) LIKE ? ESCAPE '\\'`);
    args.push(`%${termo.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
  }
  const de_ = `FROM propostas p LEFT JOIN oportunidades o ON o.id = p.oportunidade_id
      LEFT JOIN organizacoes org ON org.id = o.cliente_id LEFT JOIN pessoas pc ON pc.id = o.cliente_id
    WHERE ${conds.join(' AND ')}`;
  const [lin, tot] = await env.DB.batch([
    env.DB.prepare(`SELECT p.id, p.codigo, p.numero, p.revisao, p.titulo, p.data, p.valor_total, p.situacao, p.simulacao,
        p.arquivo_pdf_id, p.importada_de, p.oportunidade_id, p.criado_em,
        o.titulo AS oportunidade_titulo, o.etapa_funil, COALESCE(org.nome, pc.nome) AS cliente_nome
      ${de_} ORDER BY p.numero DESC, p.revisao DESC LIMIT ? OFFSET ?`).bind(...args, limite, de),
    env.DB.prepare(`SELECT count(*) AS n ${de_}`).bind(...args),
  ]);
  return { itens: lin.results, total: tot.results[0].n, de, limite };
}

// ---------------------------------------------------------------- contatos do comercial
// Lista e ficha de contatos (pessoas e organizações) para a tela de Contatos do vendas,
// montadas em poucas consultas. "Oportunidades de um contato" = as em que ele é titular,
// co-cliente (vínculo papel 'cliente') ou pessoa de contato.

const OPOS_DE = `(o.cliente_id = ?1 OR o.contato_pessoa_id = ?1 OR o.id IN
  (SELECT v.de_id FROM vinculos v WHERE v.para_id = ?1 AND v.papel = 'cliente' AND v.arquivado_em IS NULL))`;

const contagemOpos = (col) => `
  (SELECT count(*) FROM oportunidades o WHERE o.arquivado_em IS NULL AND (o.cliente_id = ${col} OR o.contato_pessoa_id = ${col}
     OR o.id IN (SELECT v.de_id FROM vinculos v WHERE v.para_id = ${col} AND v.papel = 'cliente' AND v.arquivado_em IS NULL))) AS n_oportunidades,
  (SELECT count(*) FROM oportunidades o WHERE o.arquivado_em IS NULL AND o.etapa_funil NOT IN ('ganha', 'perdida')
     AND (o.cliente_id = ${col} OR o.contato_pessoa_id = ${col}
     OR o.id IN (SELECT v.de_id FROM vinculos v WHERE v.para_id = ${col} AND v.papel = 'cliente' AND v.arquivado_em IS NULL))) AS n_abertas`;

export async function listaContatos(env, url) {
  const comArquivados = url.searchParams.get('arquivados') === '1';
  const filtro = (t) => (comArquivados ? '' : `WHERE ${t}.arquivado_em IS NULL`);
  // o próprio Odisse (org_odisse, semente do banco) não é contato do comercial
  const semOdisse = comArquivados ? "WHERE g.id <> 'org_odisse'" : "AND g.id <> 'org_odisse'";
  const [pes, org] = await env.DB.batch([
    env.DB.prepare(`SELECT p.id, p.nome, p.apelido, p.email, p.telefone, p.whatsapp, p.instagram, p.arquivado_em, p.atualizado_em,
        (SELECT json_group_array(json_object('id', g.id, 'nome', g.nome, 'papel', a.papel))
           FROM atuacoes a JOIN organizacoes g ON g.id = a.organizacao_id
           WHERE a.pessoa_id = p.id AND a.arquivado_em IS NULL AND a.ate IS NULL AND g.arquivado_em IS NULL) AS ligacoes,
        ${contagemOpos('p.id')}
      FROM pessoas p ${filtro('p')} ORDER BY p.nome LIMIT 3000`),
    env.DB.prepare(`SELECT g.id, g.nome, g.razao_social, g.cnpj, g.tipo, g.email, g.telefone, g.site, g.instagram, g.cidade, g.uf,
        g.arquivado_em, g.atualizado_em,
        (SELECT json_group_array(json_object('id', p.id, 'nome', p.nome, 'papel', a.papel))
           FROM atuacoes a JOIN pessoas p ON p.id = a.pessoa_id
           WHERE a.organizacao_id = g.id AND a.arquivado_em IS NULL AND a.ate IS NULL AND p.arquivado_em IS NULL) AS ligacoes,
        ${contagemOpos('g.id')}
      FROM organizacoes g ${filtro('g')} ${semOdisse} ORDER BY g.nome LIMIT 3000`),
  ]);
  const ler = (tipo) => (r) => ({ ...r, tipo_contato: tipo, ligacoes: r.ligacoes ? JSON.parse(r.ligacoes) : [] });
  return { pessoas: pes.results.map(ler('pessoa')), organizacoes: org.results.map(ler('organizacao')) };
}

export async function fichaContato(env, id, tabela, registro) {
  const pessoa = tabela === 'pessoas';
  const [atu, opos, ints] = await env.DB.batch([
    pessoa
      ? env.DB.prepare(`SELECT a.*, g.nome AS organizacao_nome, g.arquivado_em AS organizacao_arquivada
          FROM atuacoes a JOIN organizacoes g ON g.id = a.organizacao_id
          WHERE a.pessoa_id = ? AND a.arquivado_em IS NULL
          ORDER BY (a.ate IS NOT NULL), a.principal DESC, a.criado_em`).bind(id)
      : env.DB.prepare(`SELECT a.*, p.nome AS pessoa_nome, p.email AS pessoa_email, p.whatsapp AS pessoa_whatsapp,
            p.telefone AS pessoa_telefone, p.arquivado_em AS pessoa_arquivada
          FROM atuacoes a JOIN pessoas p ON p.id = a.pessoa_id
          WHERE a.organizacao_id = ? AND a.arquivado_em IS NULL
          ORDER BY (a.ate IS NOT NULL), a.principal DESC, p.nome`).bind(id),
    env.DB.prepare(`SELECT o.id, o.titulo, o.etapa_funil, o.nucleo_id, o.valor_estimado, o.cliente_id, o.contato_pessoa_id,
        o.atualizado_em, o.fechada_em,
        CASE WHEN o.cliente_id = ?1 THEN 'titular'
             WHEN EXISTS (SELECT 1 FROM vinculos v WHERE v.de_id = o.id AND v.para_id = ?1 AND v.papel = 'cliente' AND v.arquivado_em IS NULL) THEN 'cocliente'
             ELSE 'contato' END AS papel,
        (SELECT json_object('id', p.id, 'codigo', p.codigo, 'valor_total', p.valor_total, 'situacao', p.situacao, 'data', p.data)
           FROM propostas p WHERE p.oportunidade_id = o.id AND p.arquivado_em IS NULL
           ORDER BY p.numero DESC, p.revisao DESC LIMIT 1) AS ultima_proposta
      FROM oportunidades o WHERE o.arquivado_em IS NULL AND ${OPOS_DE}
      ORDER BY (o.etapa_funil IN ('ganha', 'perdida')), o.atualizado_em DESC LIMIT 200`).bind(id),
    env.DB.prepare(`SELECT i.id, i.sobre_id, i.pessoa_id, i.tipo, i.data, i.resumo, i.proxima_acao, i.proxima_acao_em,
        o.titulo AS oportunidade_titulo
      FROM interacoes i LEFT JOIN oportunidades o ON o.id = i.sobre_id
      WHERE i.arquivado_em IS NULL AND (i.sobre_id = ?1 OR i.pessoa_id = ?1)
      ORDER BY i.data DESC, i.criado_em DESC LIMIT 50`).bind(id),
  ]);
  return {
    registro,
    atuacoes: atu.results,
    oportunidades: opos.results.map((r) => ({ ...r, ultima_proposta: r.ultima_proposta ? JSON.parse(r.ultima_proposta) : null })),
    interacoes: ints.results,
  };
}
