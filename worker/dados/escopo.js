// Universo — Escopo do Projeto (0023; Cid, 20/11/2026).
//
// O escopo é a lista de etapas, entregas e eventos contratados de um projeto (cópia do PGT), cada cartão com a sua
// duração em dias úteis. O calendário é calculado na tela (projetos.odisse, escopo.js): início + durações em
// sequência; aqui só se guarda o que define o calendário e o registro das alterações.
//
//   GET  escopo/:prj                -> { projeto, cartoes, alteracoes }
//   POST escopo/:prj/gerar          { inicio, origem, cartoes: [{ ref, tipo, etapa_ref, origem_id, codigo, sigla, texto,
//                                     fase_id, fase_nome, evento_tipo, tempo, cliente, terceiros, encerramento,
//                                     junto_anterior, dias, sem_prazo, decisao: [{ id, nome, libera: [ref] }], liberado_por_ref }] }
//                                   (409 se o projeto já tem escopo; as horas lançadas nas etapas antigas passam a apontar
//                                   para a etapa correspondente do escopo)
//   POST escopo/:prj/acao           { acao, … } — duracao { cartao_id, dias (±) | para } · mover { cartao_id, dias (±) }
//                                   · suprimir / restaurar { cartao_id, motivo? } · acrescentar { depois_de, tipo, texto, dias,
//                                   tempo?, motivo?, origem_id?, codigo?, cliente?, terceiros?, evento_tipo?, sem_prazo? }
//                                   (com origem_id: um cartão do PGT que não foi contratado entra com o código e a origem dele) · decisao { cartao_id, resultado } · suspender { de } · retomar { ate }
//                                   · inicio { dia } · motivo { alteracao_id, motivo }
//   Cliques seguidos no mesmo cartão (duração ou mover, até 10 s entre um e outro, sem mexer em outro cartão no meio)
//   viram uma alteração só, com a soma dos dias.

import { ErroApi } from './regras.js';
import { agoraISO, novoId, hojeBrasilia } from './util.js';

const JANELA_MS = 10 * 1000;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const lerJson = (s, padrao = null) => { try { return s ? JSON.parse(s) : padrao; } catch (_) { return padrao; } };
const texto = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const inteiro = (v, min, max, rot) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroApi(422, `${rot}: inteiro de ${min} a ${max}`);
  return n;
};

// dias úteis (seg–sex) entre dois dias AAAA-MM-DD, [de, ate)
function uteisEntre(de, ate) {
  let n = 0;
  const d = new Date(de + 'T12:00:00Z');
  const fim = new Date(ate + 'T12:00:00Z');
  while (d < fim) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}

async function projeto(env, id) {
  const p = await env.DB.prepare('SELECT id, codigo, nome, situacao, inicio, escopo_inicio, suspensoes, versao, arquivado_em FROM projetos WHERE id = ?').bind(id).first();
  if (!p || p.arquivado_em) throw new ErroApi(404, 'projeto não encontrado');
  return { ...p, suspensoes: lerJson(p.suspensoes, []) };
}

export async function lerEscopo(env, prjId) {
  const p = await projeto(env, prjId);
  const [c, a] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM escopo_cartoes WHERE projeto_id = ? AND arquivado_em IS NULL ORDER BY ordem').bind(prjId),
    env.DB.prepare(`SELECT a.*, c.codigo AS cartao_codigo, c.texto AS cartao_texto, c.tipo AS cartao_tipo
      FROM escopo_alteracoes a LEFT JOIN escopo_cartoes c ON c.id = a.cartao_id WHERE a.projeto_id = ? ORDER BY a.em DESC, a.atualizado_em DESC`).bind(prjId),
  ]);
  return {
    projeto: p,
    cartoes: c.results.map((x) => ({ ...x, decisao: lerJson(x.decisao) })),
    alteracoes: a.results.map((x) => ({ ...x, antes: lerJson(x.antes, x.antes), depois: lerJson(x.depois, x.depois) })),
  };
}

// ---------------------------------------------------------------- gerar
const COLS = ['id', 'criado_em', 'atualizado_em', 'criado_por', 'atualizado_por', 'versao', 'projeto_id', 'tipo', 'etapa_id', 'origem_id', 'ordem',
  'codigo', 'sigla', 'texto', 'fase_id', 'fase_nome', 'evento_tipo', 'tempo', 'cliente', 'terceiros', 'encerramento', 'junto_anterior',
  'dias', 'dias_contratados', 'folga', 'sem_prazo', 'decisao', 'liberado_por', 'adicionado'];

async function gerar(env, ferramenta, prjId, c) {
  const p = await projeto(env, prjId);
  const ja = await env.DB.prepare('SELECT 1 FROM escopo_cartoes WHERE projeto_id = ? LIMIT 1').bind(prjId).first();
  if (ja) throw new ErroApi(409, 'o projeto já tem escopo');
  const inicio = String(c.inicio || '');
  if (!DIA.test(inicio)) throw new ErroApi(422, 'Início: dia no formato AAAA-MM-DD');
  const lista = Array.isArray(c.cartoes) ? c.cartoes : [];
  if (!lista.length) throw new ErroApi(422, 'o escopo precisa de ao menos uma etapa');
  if (lista.length > 600) throw new ErroApi(422, 'escopo grande demais (até 600 cartões)');
  const agora = agoraISO();
  const ids = {};
  for (const x of lista) {
    if (!x.ref || ids[x.ref]) throw new ErroApi(422, 'cada cartão precisa de uma referência única (ref)');
    ids[x.ref] = novoId('esc');
  }
  const linhas = lista.map((x, i) => {
    const tipo = ['etapa', 'entrega', 'evento'].includes(x.tipo) ? x.tipo : null;
    if (!tipo) throw new ErroApi(422, `Cartão ${i + 1}: tipo etapa, entrega ou evento`);
    if (tipo !== 'etapa' && !ids[x.etapa_ref]) throw new ErroApi(422, `Cartão ${i + 1}: etapa não encontrada`);
    const t = texto(x.texto, 400);
    if (!t) throw new ErroApi(422, `Cartão ${i + 1}: texto`);
    const dias = tipo === 'etapa' ? 1 : inteiro(x.dias ?? 1, 1, 400, `Cartão ${i + 1}: dias`);
    const decisao = Array.isArray(x.decisao) && x.decisao.length
      ? JSON.stringify(x.decisao.map((r) => ({ id: String(r.id).slice(0, 40), nome: String(r.nome || r.id).slice(0, 80),
        libera: (r.libera || []).map((ref) => ids[ref]).filter(Boolean) })))
      : null;
    return {
      id: ids[x.ref], criado_em: agora, atualizado_em: agora, criado_por: ferramenta, atualizado_por: ferramenta, versao: 1,
      projeto_id: prjId, tipo, etapa_id: tipo === 'etapa' ? null : ids[x.etapa_ref], origem_id: texto(x.origem_id, 60), ordem: i + 1,
      codigo: texto(x.codigo, 20), sigla: texto(x.sigla, 8), texto: t, fase_id: texto(x.fase_id, 60), fase_nome: texto(x.fase_nome, 120),
      evento_tipo: texto(x.evento_tipo, 40), tempo: ['estudio', 'cliente', 'terceiros', 'pontual'].includes(x.tempo) ? x.tempo : null,
      cliente: x.cliente ? 1 : 0, terceiros: x.terceiros ? 1 : 0, encerramento: x.encerramento ? 1 : 0, junto_anterior: x.junto_anterior ? 1 : 0,
      dias, dias_contratados: dias, folga: 0, sem_prazo: x.sem_prazo ? 1 : 0, decisao,
      liberado_por: x.liberado_por_ref ? ids[x.liberado_por_ref] || null : null, adicionado: 0,
    };
  });
  const origem = c.origem && typeof c.origem === 'object' ? c.origem : {};
  const ext = COLS.map((k) => `json_extract(value, '$.${k}')`).join(', ');
  await env.DB.batch([
    // uma consulta só para todos os cartões (a etapa vem antes das suas entregas na lista)
    env.DB.prepare(`INSERT INTO escopo_cartoes (${COLS.join(', ')}) SELECT ${ext} FROM json_each(?)`)
      .bind(JSON.stringify(linhas)),
    env.DB.prepare(`UPDATE projetos SET escopo_inicio = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
      .bind(inicio, agora, ferramenta, prjId),
    // horas já lançadas nas etapas antigas → a etapa do escopo com a mesma origem (ou o mesmo nome)
    env.DB.prepare(`UPDATE horas SET cartao_id = (
        SELECT c.id FROM escopo_cartoes c JOIN etapas e ON e.id = horas.etapa_id
        WHERE c.projeto_id = horas.projeto_id AND c.tipo = 'etapa' AND (c.origem_id = e.ref_vendas OR c.sigla = e.ref_vendas OR c.texto = e.nome)
        ORDER BY c.ordem LIMIT 1)
      WHERE projeto_id = ? AND cartao_id IS NULL AND etapa_id IS NOT NULL`).bind(prjId),
    env.DB.prepare(`INSERT INTO escopo_alteracoes (id, projeto_id, cartao_id, tipo, natureza, dias, antes, depois, descricao, motivo, por, em, atualizado_em)
      VALUES (?, ?, NULL, 'inicio', 'prazo', NULL, NULL, ?, ?, NULL, ?, ?, ?)`)
      .bind(novoId('eal'), prjId, JSON.stringify(inicio),
        `Escopo gerado ${origem.proposta_codigo ? `pela proposta ${origem.proposta_codigo}` : 'pelo PGT'}${origem.pgt_versao ? ` (PGT v${origem.pgt_versao})` : ''}, começando em ${inicio.split('-').reverse().join('/')}`,
        ferramenta, agora, agora),
  ]);
  return lerEscopo(env, p.id);
}

// ---------------------------------------------------------------- ações
async function cartao(env, prjId, id) {
  const c = await env.DB.prepare('SELECT * FROM escopo_cartoes WHERE id = ? AND projeto_id = ? AND arquivado_em IS NULL').bind(String(id || ''), prjId).first();
  if (!c) throw new ErroApi(404, 'cartão não encontrado');
  return c;
}
const descrever = (c) => `${c.codigo ? c.codigo + ' · ' : ''}${c.texto}`;

// registro com a janela de 10 s: soma na última alteração se ela é deste cartão, deste tipo, de quem fez e recente
async function registrarSomando(env, prjId, c, tipo, delta, antes, depois, ferramenta, agora) {
  const ult = await env.DB.prepare('SELECT * FROM escopo_alteracoes WHERE projeto_id = ? ORDER BY atualizado_em DESC, em DESC LIMIT 1').bind(prjId).first();
  if (ult && ult.cartao_id === c.id && ult.tipo === tipo && ult.por === ferramenta && Date.parse(agora) - Date.parse(ult.atualizado_em) <= JANELA_MS) {
    return env.DB.prepare('UPDATE escopo_alteracoes SET dias = COALESCE(dias, 0) + ?, depois = ?, atualizado_em = ? WHERE id = ?')
      .bind(delta, JSON.stringify(depois), agora, ult.id);
  }
  return env.DB.prepare(`INSERT INTO escopo_alteracoes (id, projeto_id, cartao_id, tipo, natureza, dias, antes, depois, descricao, motivo, por, em, atualizado_em)
    VALUES (?, ?, ?, ?, 'prazo', ?, ?, ?, ?, NULL, ?, ?, ?)`)
    .bind(novoId('eal'), prjId, c.id, tipo, delta, JSON.stringify(antes), JSON.stringify(depois), descrever(c), ferramenta, agora, agora);
}
const registrar = (env, prjId, cartaoId, tipo, natureza, { dias = null, antes = null, depois = null, descricao = null, motivo = null }, ferramenta, agora) =>
  env.DB.prepare(`INSERT INTO escopo_alteracoes (id, projeto_id, cartao_id, tipo, natureza, dias, antes, depois, descricao, motivo, por, em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(novoId('eal'), prjId, cartaoId, tipo, natureza, dias, antes == null ? null : JSON.stringify(antes), depois == null ? null : JSON.stringify(depois),
      descricao, motivo, ferramenta, agora, agora);
const mudarCartao = (env, c, campos, ferramenta, agora) => {
  const ks = Object.keys(campos);
  return env.DB.prepare(`UPDATE escopo_cartoes SET ${ks.map((k) => `${k} = ?`).join(', ')}, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
    .bind(...ks.map((k) => campos[k]), agora, ferramenta, c.id);
};

async function acao(env, ferramenta, prjId, a) {
  const p = await projeto(env, prjId);
  const agora = agoraISO();
  const motivo = texto(a.motivo, 2000);
  const s = [];
  switch (a.acao) {
    case 'duracao': {
      const c = await cartao(env, prjId, a.cartao_id);
      if (c.tipo === 'etapa') throw new ErroApi(422, 'a duração é das entregas e dos eventos');
      const novo = a.para !== undefined ? inteiro(a.para, 1, 400, 'Dias') : Math.min(400, Math.max(1, c.dias + inteiro(a.dias, -400, 400, 'Dias')));
      if (novo === c.dias) return lerEscopo(env, prjId);
      s.push(mudarCartao(env, c, { dias: novo }, ferramenta, agora), await registrarSomando(env, prjId, c, 'duracao', novo - c.dias, c.dias, novo, ferramenta, agora));
      break;
    }
    case 'mover': {
      const c = await cartao(env, prjId, a.cartao_id);
      if (c.tipo === 'etapa') throw new ErroApi(422, 'mova as entregas e os eventos');
      const novo = a.para !== undefined ? inteiro(a.para, -400, 400, 'Folga') : Math.min(400, Math.max(-400, c.folga + inteiro(a.dias, -400, 400, 'Dias')));
      if (novo === c.folga) return lerEscopo(env, prjId);
      s.push(mudarCartao(env, c, { folga: novo }, ferramenta, agora), await registrarSomando(env, prjId, c, 'mover', novo - c.folga, c.folga, novo, ferramenta, agora));
      break;
    }
    case 'suprimir':
    case 'restaurar': {
      const c = await cartao(env, prjId, a.cartao_id);
      if (c.encerramento) throw new ErroApi(422, 'o Encerramento não se suprime');
      const sup = a.acao === 'suprimir';
      if (!!c.suprimido_em === sup) return lerEscopo(env, prjId);
      s.push(mudarCartao(env, c, { suprimido_em: sup ? hojeBrasilia() : null }, ferramenta, agora),
        registrar(env, prjId, c.id, a.acao, 'aditivo', { descricao: descrever(c), motivo, dias: sup ? -c.dias : c.dias }, ferramenta, agora));
      break;
    }
    case 'acrescentar': {
      const ref = await cartao(env, prjId, a.depois_de);
      const tipo = a.tipo === 'evento' ? 'evento' : 'entrega';
      const t = texto(a.texto, 400);
      if (!t) throw new ErroApi(422, 'Texto: diga o que é a entrega ou o evento');
      const dias = inteiro(a.dias ?? 1, 1, 400, 'Dias');
      const etapa = ref.tipo === 'etapa' ? ref : await cartao(env, prjId, ref.etapa_id);
      const prox = await env.DB.prepare('SELECT MIN(ordem) AS o FROM escopo_cartoes WHERE projeto_id = ? AND ordem > ?').bind(prjId, ref.ordem).first();
      const ordem = prox?.o != null ? (ref.ordem + prox.o) / 2 : ref.ordem + 1;
      const id = novoId('esc');
      const tempo = tipo === 'evento' && ['estudio', 'cliente', 'terceiros', 'pontual'].includes(a.tempo) ? a.tempo : (tipo === 'evento' ? 'estudio' : null);
      // cartão do PGT não contratado: entra com a origem e o código dele (não pode já estar no escopo)
      const origem = texto(a.origem_id, 60);
      if (origem) {
        const ja = await env.DB.prepare('SELECT 1 FROM escopo_cartoes WHERE projeto_id = ? AND origem_id = ? AND arquivado_em IS NULL').bind(prjId, origem).first();
        if (ja) throw new ErroApi(409, 'este cartão do PGT já está no escopo');
      }
      const codigo = origem ? texto(a.codigo, 20) : null;
      const cliente = tipo === 'evento' && (a.cliente || tempo === 'cliente') ? 1 : 0;
      const terceiros = tipo === 'evento' && (a.terceiros || tempo === 'terceiros') ? 1 : 0;
      s.push(env.DB.prepare(`INSERT INTO escopo_cartoes (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, projeto_id, tipo, etapa_id, ordem,
          origem_id, codigo, sigla, texto, fase_id, fase_nome, evento_tipo, tempo, cliente, terceiros, dias, dias_contratados, folga, sem_prazo, adicionado, observacoes)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, 1, ?)`)
        .bind(id, agora, agora, ferramenta, ferramenta, prjId, tipo, etapa.id, ordem, origem, codigo, etapa.sigla, t, etapa.fase_id, etapa.fase_nome,
          tipo === 'evento' ? texto(a.evento_tipo, 40) : null, tempo, cliente, terceiros, dias, a.sem_prazo ? 1 : 0, texto(a.observacoes, 4000)),
      registrar(env, prjId, id, 'acrescentar', 'aditivo', { descricao: `${codigo ? codigo + ' · ' : etapa.sigla ? etapa.sigla + ' · ' : ''}${t}`, motivo, dias }, ferramenta, agora));
      break;
    }
    case 'decisao': {
      const c = await cartao(env, prjId, a.cartao_id);
      const res = lerJson(c.decisao, []);
      const r = a.resultado === null ? null : res.find((x) => x.id === a.resultado);
      if (a.resultado !== null && !r) throw new ErroApi(422, 'Resultado: não é um dos desta decisão');
      if ((c.decisao_resultado || null) === (r ? r.id : null)) return lerEscopo(env, prjId);
      s.push(mudarCartao(env, c, { decisao_resultado: r ? r.id : null }, ferramenta, agora));
      // a rodada que a decisão libera é um extra previsto (não aditivo); o caminho esperado não muda nada
      if (r && r.libera.length) {
        const { results } = await env.DB.prepare(`SELECT codigo, texto, dias FROM escopo_cartoes WHERE id IN (SELECT value FROM json_each(?))`)
          .bind(JSON.stringify(r.libera)).all();
        s.push(registrar(env, prjId, c.id, 'decisao', 'extra', { depois: r.nome, descricao: `${descrever(c)}: ${r.nome} — libera ${results.map(descrever).join('; ')}`,
          dias: results.reduce((n, x) => n + x.dias, 0), motivo }, ferramenta, agora));
      } else if (c.decisao_resultado) {
        const antes = res.find((x) => x.id === c.decisao_resultado);
        if (antes?.libera.length) s.push(registrar(env, prjId, c.id, 'decisao', 'extra', { antes: antes.nome, depois: r ? r.nome : null,
          descricao: `${descrever(c)}: ${r ? r.nome : 'sem resultado'} (desfaz ${antes.nome})`, motivo }, ferramenta, agora));
      }
      break;
    }
    case 'suspender': {
      const de = String(a.de || hojeBrasilia());
      if (!DIA.test(de)) throw new ErroApi(422, 'Suspender a partir de: dia AAAA-MM-DD');
      if (p.suspensoes.some((x) => !x.ate)) throw new ErroApi(409, 'o projeto já está suspenso');
      const sus = [...p.suspensoes, { de, ate: null }];
      s.push(env.DB.prepare(`UPDATE projetos SET suspensoes = ?, situacao = 'pausado', versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
          .bind(JSON.stringify(sus), agora, ferramenta, prjId),
        registrar(env, prjId, null, 'suspender', 'prazo', { depois: de, descricao: `Projeto suspenso a partir de ${de.split('-').reverse().join('/')}`, motivo }, ferramenta, agora));
      break;
    }
    case 'retomar': {
      const ate = String(a.ate || hojeBrasilia());
      if (!DIA.test(ate)) throw new ErroApi(422, 'Retomar em: dia AAAA-MM-DD');
      const sus = [...p.suspensoes];
      const aberta = sus.find((x) => !x.ate);
      if (!aberta) throw new ErroApi(409, 'o projeto não está suspenso');
      if (ate < aberta.de) throw new ErroApi(422, 'a retomada vem depois do começo da suspensão');
      aberta.ate = ate;
      const dias = uteisEntre(aberta.de, ate);
      s.push(env.DB.prepare(`UPDATE projetos SET suspensoes = ?, situacao = 'ativo', versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
          .bind(JSON.stringify(sus), agora, ferramenta, prjId),
        registrar(env, prjId, null, 'retomar', 'prazo', { antes: aberta.de, depois: ate, dias,
          descricao: `Projeto retomado em ${ate.split('-').reverse().join('/')} (${dias} dia${dias === 1 ? '' : 's'} úteis suspenso)`, motivo }, ferramenta, agora));
      break;
    }
    case 'inicio': {
      const dia = String(a.dia || '');
      if (!DIA.test(dia)) throw new ErroApi(422, 'Início: dia AAAA-MM-DD');
      if (dia === p.escopo_inicio) return lerEscopo(env, prjId);
      const dias = p.escopo_inicio ? (dia > p.escopo_inicio ? uteisEntre(p.escopo_inicio, dia) : -uteisEntre(dia, p.escopo_inicio)) : null;
      s.push(env.DB.prepare('UPDATE projetos SET escopo_inicio = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?')
          .bind(dia, agora, ferramenta, prjId),
        registrar(env, prjId, null, 'inicio', 'prazo', { antes: p.escopo_inicio, depois: dia, dias,
          descricao: `Início do escopo em ${dia.split('-').reverse().join('/')}`, motivo }, ferramenta, agora));
      break;
    }
    case 'motivo': {
      const al = await env.DB.prepare('SELECT id FROM escopo_alteracoes WHERE id = ? AND projeto_id = ?').bind(String(a.alteracao_id || ''), prjId).first();
      if (!al) throw new ErroApi(404, 'alteração não encontrada');
      // o motivo pode ser preenchido depois; não conta como mexida (não mexe em atualizado_em, que é a janela de 10 s)
      s.push(env.DB.prepare('UPDATE escopo_alteracoes SET motivo = ? WHERE id = ?').bind(motivo, al.id));
      break;
    }
    case 'observacoes': {
      const c = await cartao(env, prjId, a.cartao_id);
      s.push(mudarCartao(env, c, { observacoes: texto(a.observacoes, 4000) }, ferramenta, agora));
      break;
    }
    default:
      throw new ErroApi(422, 'ação desconhecida');
  }
  await env.DB.batch(s);
  return lerEscopo(env, prjId);
}

export async function rotasEscopo(env, ferramenta, m, partes, corpo, { exigir }) {
  const [rota, prj, sub] = partes;
  if (rota !== 'escopo') return undefined;
  if (!/^prj_/.test(prj || '')) throw new ErroApi(404, 'rota não encontrada');
  if (m === 'GET' && !sub) { exigir('escopo_cartoes', ferramenta, 'L'); return lerEscopo(env, prj); }
  if (m === 'POST' && sub === 'gerar') { exigir('escopo_cartoes', ferramenta, 'E'); return gerar(env, ferramenta, prj, corpo || {}); }
  if (m === 'POST' && sub === 'acao') { exigir('escopo_cartoes', ferramenta, 'E'); return acao(env, ferramenta, prj, corpo || {}); }
  throw new ErroApi(404, 'rota não encontrada');
}
