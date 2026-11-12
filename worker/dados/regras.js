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

const bases_servicos = simples('bases_servicos', (o) => {
  conferirSigla(o); conferirIC(o, 'ic_ajustes', 'Ajustes do índice'); conferirFaixa(o, 'modificador', 'Modificador', 0);
});
const bases_categorias = simples('bases_categorias', (o) => conferirIC(o, 'ic_preset', 'Índice de complexidade'));
const bases_usos = simples('bases_usos', (o) => {
  conferirFaixa(o, 'fator_adequacao', 'Fator de adequação', 0); conferirFaixa(o, 'cub_referencia', 'CUB de referência', 0);
  if (o.cub_codigo) o.cub_codigo = o.cub_codigo.toUpperCase();
}, 'categoria_id');
const pgt_fases = simples('pgt_fases', (o) => conferirFaixa(o, 'parcela', 'Parcela', 0, 1));
const pgt_etapas = simples('pgt_etapas', (o) => { conferirSigla(o); conferirFaixa(o, 'semanas_base', 'Semanas', 0, 520); });
const pgt_materiais = simples('pgt_materiais', () => {}, 'alvo_id');

// Entregável novo: pode já nascer com a pertinência por serviço ({ servicos: { srv_ne: 'P', … } }).
const pgt_entregaveis = {
  async criar(env, ferramenta, valores, corpo, id) {
    await ordemNoFim(env, 'pgt_entregaveis', valores, ['etapa_id', valores.etapa_id]);
    const servs = corpo.servicos && typeof corpo.servicos === 'object' ? corpo.servicos : {};
    const extras = [];
    for (const [srv, p] of Object.entries(servs)) {
      if (!p) continue;
      if (!['P', 'O'].includes(p)) throw new ErroApi(422, 'Pertinência: P ou O');
      const ok = await env.DB.prepare('SELECT 1 FROM bases_servicos WHERE id = ? AND arquivado_em IS NULL').bind(srv).first();
      if (!ok) throw new ErroApi(422, `Serviço ${srv}: não encontrado`);
      extras.push(env.DB.prepare('INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES (?, ?, ?)')
        .bind(id, srv, p));
    }
    return extras;
  },
  async alterar(env, ferramenta, atual, mudancas) {
    // mudou de etapa sem dizer a ordem: vai para o fim da etapa nova
    if (mudancas.etapa_id && !('ordem' in mudancas)) {
      const v = { ordem: null };
      await ordemNoFim(env, 'pgt_entregaveis', v, ['etapa_id', mudancas.etapa_id]);
      mudancas.ordem = v.ordem;
    }
    return [];
  },
};

export const REGRAS = {
  oportunidades, propostas, contratos, projetos, horas,
  bases_servicos, bases_categorias, bases_usos, pgt_fases, pgt_etapas, pgt_entregaveis, pgt_materiais,
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
