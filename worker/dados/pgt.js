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
//   POST pgt/eventos-servicos      { evento_ids: [...], servico_id, pertinencia: 'P'|'O'|'S'|null }   (0008)
//   POST pgt/ordem                 { tabela: 'pgt_entregaveis'|'pgt_etapas'|…, ids: [...] }  (ordem = posição)
//   POST pgt/sequencia             { etapa_id, ids: [pen_…/pev_…] }  (entregas e eventos na mesma ordem; 0008)
//   POST pgt/lote                  { ops: [{ tipo: 'campos'|'entregaveis-servicos'|'eventos-servicos'|'entregaveis-categorias'|'ordem'|'sequencia', … }] }  (até 500)
//   POST bases/faixas-prazo        { faixas: [{ ate: 150, mult: 1 }, …, { ate: null, mult: 2.4 }] }  (0008)
//   POST bases/ic                  { servico_id, categoria_id, ic: { critério: nível } | null }  (0022: IC próprio do par; null = volta ao padrão)
//
// 0022 — serviços em fluxo e em ilha: nos retratos (e nas páginas), a marcação de um cartão só vale para o serviço
// se ele estiver na dinâmica do cartão: cartão do fluxo (etapa sem dono) → serviço em fluxo; cartão de ilha
// (etapa com dono) → o próprio dono, se estiver em ilha. Etapa de ilha cujo dono saiu da ilha fica fora (guardada).
//   POST bases/publicar | pgt/publicar  { nota }  -> retrato numerado (409 nada_mudou se igual ao último)
//   GET  honorarios                          -> preço dos serviços, fases com parcela, etapas com pesos, parâmetros
//   POST honorarios/pesos       { etapa_id, servico_id, peso }   fator 1 ou 2 da etapa na fase (só onde a etapa vale)
//   POST honorarios/fases       { fase_id, servico_id, peso }    % da fase no honorário do serviço (0 a 100)
//   POST honorarios/parametros  { chave, valor }
//   POST honorarios/publicar    { nota }   (0019: o retrato leva também os textos das cláusulas — eventos e vendas_clausulas)
//   (preço dos serviços e parcela das fases: PATCH bases-servicos / pgt-fases, campos liberados ao vendas)
//   GET  publicacoes?tipo=bases|pgt|honorarios         -> lista (sem os dados)
//   GET  publicacoes/ultima?tipo=bases|pgt|honorarios  -> último retrato com os dados (o vendas vai ler este)
//
// "Pendente" = o rascunho (as tabelas vivas) difere do último retrato publicado (assinatura SHA-256).

import { ErroApi } from './regras.js';
import { agoraISO } from './util.js';

const lerJson = (s) => (s ? JSON.parse(s) : null);
const PARAMETROS = {
  parcela_entrada: { rotulo: 'Parcela de entrada (na assinatura)', min: 0, max: 1 },
  // 0016: fração do peso das fases do fluxo não contratadas que vêm antes de uma contratada ("só tal fase")
  acrescimo_lacuna: { rotulo: 'Acréscimo sobre fase anterior não contratada', min: 0, max: 1 },
};
// campos de custo: fora dos retratos de estrutura, dentro do retrato de honorários
const PRECO_SERVICO = ['modificador', 'com_preco', 'preco_por_etapa'];
// quem edita os honorários (o Projetos só lê)
const HONORARIOS = { hub: 'E', vendas: 'E', maquina: 'E', projetos: 'L' };
const ORDENAVEIS = ['bases_servicos', 'bases_categorias', 'bases_usos', 'pgt_fases', 'pgt_etapas', 'pgt_entregaveis', 'pgt_eventos', 'pgt_materiais', 'pgt_modelos'];

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

// Faixas de prazo por área (0008): o vendas multiplica o prazo das entregas pela faixa da área do projeto.
// Entregas de prazo fixo e eventos não escalam. A última faixa não tem teto (ate: null).
function conferirFaixas(l) {
  if (!Array.isArray(l) || l.length < 1 || l.length > 10) throw new ErroApi(422, 'Faixas: de 1 a 10');
  let antes = 0;
  return l.map((f, i) => {
    const ult = i === l.length - 1;
    const ate = ult ? null : Number(f?.ate);
    const mult = Number(f?.mult);
    if (!ult && (!Number.isFinite(ate) || ate <= antes)) throw new ErroApi(422, `Faixa ${i + 1}: área máxima maior que a da faixa anterior`);
    if (!Number.isFinite(mult) || mult <= 0 || mult > 10) throw new ErroApi(422, `Faixa ${i + 1}: multiplicador entre 0 e 10`);
    if (!ult) antes = ate;
    return { ate, mult };
  });
}

export async function retratoBases(env) {
  const [srv, cat, uso, ic] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM bases_servicos WHERE arquivado_em IS NULL ORDER BY ordem, nome'),
    env.DB.prepare('SELECT * FROM bases_categorias WHERE arquivado_em IS NULL ORDER BY ordem, nome'),
    env.DB.prepare(`SELECT u.* FROM bases_usos u JOIN bases_categorias c ON c.id = u.categoria_id
      WHERE u.arquivado_em IS NULL AND c.arquivado_em IS NULL ORDER BY c.ordem, u.ordem`),
    env.DB.prepare(`SELECT x.servico_id, x.categoria_id, x.ic FROM bases_ic x JOIN bases_categorias c ON c.id = x.categoria_id
      WHERE c.arquivado_em IS NULL ORDER BY x.servico_id, c.ordem`),
  ]);
  // 0022: IC = padrão do serviço; em fluxo, o da categoria passa por cima (ic_preset e ic_ajustes ficam sem uso)
  const icCat = {};
  for (const x of ic.results) (icCat[x.servico_id] ||= {})[x.categoria_id] = lerJson(x.ic) || {};
  return {
    servicos: srv.results.map((r) => ({ ...sem(r, ...PRECO_SERVICO, 'ic_ajustes'), ic_padrao: lerJson(r.ic_padrao) || {},
      ic_categorias: r.dinamica === 'fluxo' ? icCat[r.id] || {} : {} })),
    categorias: cat.results.map((r) => sem(r, 'ic_preset')),
    usos: uso.results.map((r) => sem(r)),
    faixas_prazo: lerJson((await env.DB.prepare("SELECT valor FROM bases_parametros WHERE chave = 'faixas_prazo'").first())?.valor) || [],
  };
}

// Pertinência da etapa × serviço, calculada dos entregáveis (0007): P se algum entregável é P; O se só há O.
// 0022: só conta a marcação do serviço na dinâmica do cartão (ver vale(), abaixo).
const SQL_PERT_DERIVADA = `SELECT e.etapa_id, x.servico_id, MAX(CASE x.pertinencia WHEN 'P' THEN 2 ELSE 1 END) AS n
  FROM pgt_entregaveis e JOIN pgt_entregaveis_servicos x ON x.entregavel_id = e.id JOIN bases_servicos s ON s.id = x.servico_id
  JOIN pgt_etapas t ON t.id = e.etapa_id
  WHERE e.arquivado_em IS NULL AND s.arquivado_em IS NULL
    AND ((t.servico_id IS NULL AND s.dinamica = 'fluxo') OR (t.servico_id = s.id AND s.dinamica = 'ilha'))
  GROUP BY e.etapa_id, x.servico_id`;
// A marcação do cartão (de uma etapa com dono ou sem) vale para este serviço?
//   din = { srv: 'fluxo'|'ilha' } dos serviços ativos; dono = servico_id da etapa (ou nulo).
const vale = (din, dono, srv) => (dono ? srv === dono && din[srv] === 'ilha' : din[srv] === 'fluxo');
// etapa de ilha cujo dono saiu da ilha (ou foi arquivado): fica guardada, fora dos retratos e das telas
const etapaVisivel = (din, e) => !e.servico_id || din[e.servico_id] === 'ilha';
const mapaDerivado = (rows) => {
  const m = {};
  for (const r of rows) (m[r.etapa_id] ||= {})[r.servico_id] = r.n === 2 ? 'P' : 'O';
  return m;
};
async function pertinenciaDerivada(env) { return mapaDerivado((await env.DB.prepare(SQL_PERT_DERIVADA).all()).results); }

// campos só da tela (fora dos retratos e da assinatura)
const SO_TELA = ['travado'];

// Prazo da etapa por serviço (0008), em turnos: a sequência de entregas e eventos.
//   * entrega marcada (P) soma o seu prazo; com junto_anterior, corre junto com a entrega válida anterior
//     (cluster): conta só a mais longa do grupo;
//   * evento que vale (P ou perpétuo) e é tempo do estúdio soma a sua duração; tempo do cliente, de
//     terceiros e pontual não contam; opcionais (O) também não;
//   * o Encerramento fica de fora (pontual, no fim).
export function prazosDaEtapa(passos, servicos) {
  const prazos = {}; const semPrazo = {};
  for (const srv of servicos) {
    let total = 0; let grupo = 0; let antesEntrega = false; let vale = false;
    for (const x of passos) {
      const p = x.servicos[srv];
      if (x.tipo_passo === 'entrega') {
        if (p !== 'P') continue;
        vale = true;
        const t = x.prazo_turnos || 0;
        if (!x.prazo_turnos) semPrazo[srv] = (semPrazo[srv] || 0) + 1;
        if (x.junto_anterior && antesEntrega) grupo = Math.max(grupo, t);
        else { total += grupo; grupo = t; }
        antesEntrega = true;
      } else {
        if (x.encerramento || (p !== 'P' && p !== 'S')) continue;
        total += grupo; grupo = 0; antesEntrega = false;
        if (x.tempo === 'estudio') total += x.prazo_turnos || 0;
      }
    }
    total += grupo;
    if (vale) prazos[srv] = total;
  }
  return { prazos, semPrazo };
}
// entregas e eventos da etapa na ordem (desempate: entrega antes, depois a data de criação)
export const ordemDaSequencia = (a, b) => (a.ordem - b.ordem) || ((a.tipo_passo === 'entrega' ? 0 : 1) - (b.tipo_passo === 'entrega' ? 0 : 1))
  || String(a.criado_em || '').localeCompare(String(b.criado_em || '')) || a.id.localeCompare(b.id);

export async function retratoPgt(env) {
  const [fas, eta, es, ent, ens, enc, mat, evt, evs, srvs, mod] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM pgt_fases WHERE arquivado_em IS NULL ORDER BY ordem'),
    env.DB.prepare(`SELECT e.* FROM pgt_etapas e JOIN pgt_fases f ON f.id = e.fase_id
      WHERE e.arquivado_em IS NULL AND f.arquivado_em IS NULL ORDER BY f.ordem, e.ordem`),
    env.DB.prepare(SQL_PERT_DERIVADA),
    env.DB.prepare('SELECT * FROM pgt_entregaveis WHERE arquivado_em IS NULL ORDER BY etapa_id, ordem, criado_em'),
    env.DB.prepare(`SELECT x.* FROM pgt_entregaveis_servicos x JOIN bases_servicos s ON s.id = x.servico_id
      WHERE s.arquivado_em IS NULL ORDER BY x.entregavel_id, s.ordem`),
    env.DB.prepare(`SELECT x.* FROM pgt_entregaveis_categorias x JOIN bases_categorias c ON c.id = x.categoria_id
      WHERE c.arquivado_em IS NULL ORDER BY x.entregavel_id, c.ordem`),
    // 0024: a ligação a um padrão arquivado sai junto com ele
    env.DB.prepare(`SELECT m.* FROM pgt_materiais m LEFT JOIN pgt_modelos o ON o.id = m.modelo_id
      WHERE m.arquivado_em IS NULL AND (m.modelo_id IS NULL OR o.arquivado_em IS NULL) ORDER BY m.alvo_id, m.ordem`),
    env.DB.prepare('SELECT * FROM pgt_eventos WHERE arquivado_em IS NULL ORDER BY etapa_id, ordem, criado_em'),
    env.DB.prepare(`SELECT x.* FROM pgt_eventos_servicos x JOIN bases_servicos s ON s.id = x.servico_id
      WHERE s.arquivado_em IS NULL ORDER BY x.evento_id, s.ordem`),
    env.DB.prepare('SELECT id, dinamica FROM bases_servicos WHERE arquivado_em IS NULL ORDER BY ordem'),
    env.DB.prepare('SELECT * FROM pgt_modelos WHERE arquivado_em IS NULL ORDER BY ordem, nome'),
  ]);
  const derivada = mapaDerivado(es.results);
  const din = Object.fromEntries(srvs.results.map((x) => [x.id, x.dinamica]));
  const etapasVivas = eta.results.filter((e) => etapaVisivel(din, e));
  const donoDe = Object.fromEntries(etapasVivas.map((e) => [e.id, e.servico_id || null]));
  const porEnt = {};
  for (const x of ens.results) (porEnt[x.entregavel_id] ||= {})[x.servico_id] = x.pertinencia;
  const catEnt = {};
  for (const x of enc.results) (catEnt[x.entregavel_id] ||= []).push(x.categoria_id);
  // só as marcações que valem (serviço na dinâmica do cartão); o Encerramento vale para todos
  const filtrar = (etapaId, m, perpetuo = false) => Object.fromEntries(Object.entries(m || {})
    .filter(([srv]) => (perpetuo ? din[srv] : vale(din, donoDe[etapaId], srv))));
  const etapas = etapasVivas.map((e) => ({ ...sem(e, ...SO_TELA, 'semanas_base'),
    servicos: Object.fromEntries(Object.entries(derivada[e.id] || {}).map(([k, p]) => [k, { pertinencia: p }])) }));
  const sigla = Object.fromEntries(etapas.map((e) => [e.id, e.sigla]));
  // código = sigla da etapa + posição (CE-03); entregáveis de etapa arquivada ficam fora do retrato
  const pos = {};
  const entregaveis = ent.results.filter((r) => sigla[r.etapa_id]).map((r) => {
    pos[r.etapa_id] = (pos[r.etapa_id] || 0) + 1;
    return { ...sem(r, ...SO_TELA), codigo: `${sigla[r.etapa_id]}-${String(pos[r.etapa_id]).padStart(2, '0')}`,
      servicos: filtrar(r.etapa_id, porEnt[r.id]), categorias: catEnt[r.id] || [] };
  });
  // eventos: código = sigla da etapa + M + posição (CE-M02); o Encerramento é ENC
  const porEvt = {};
  for (const x of evs.results) (porEvt[x.evento_id] ||= {})[x.servico_id] = x.pertinencia;
  const posM = {};
  const eventos = evt.results.filter((r) => sigla[r.etapa_id] || r.encerramento).map((r) => {
    let codigo = 'ENC';
    if (!r.encerramento) { posM[r.etapa_id] = (posM[r.etapa_id] || 0) + 1; codigo = `${sigla[r.etapa_id]}-M${String(posM[r.etapa_id]).padStart(2, '0')}`; }
    // 0019: o texto da cláusula é do vendas (vai no retrato dos Honorários); aqui fica só a marca
    const instancias = lerJson(r.instancias);
    return { ...sem(r, ...SO_TELA, 'clausula'), codigo, instancias: Array.isArray(instancias) ? instancias.filter((x) => sigla[x]) : instancias,
      decisao: lerJson(r.decisao), servicos: filtrar(r.etapa_id, porEvt[r.id], !!r.encerramento) };
  });
  // prazo da etapa por serviço, em turnos, pela sequência (ver prazosDaEtapa)
  const servicos = srvs.results.map((x) => x.id);
  for (const e of etapas) {
    const passos = [...entregaveis.filter((x) => x.etapa_id === e.id).map((x) => ({ ...x, tipo_passo: 'entrega' })),
      ...eventos.filter((x) => x.etapa_id === e.id && !x.encerramento).map((x) => ({ ...x, tipo_passo: 'evento' }))].sort(ordemDaSequencia);
    e.prazos = prazosDaEtapa(passos, servicos).prazos;
  }
  return { fases: fas.results.map((r) => sem(r, 'parcela', 'acrescimo', ...SO_TELA)), etapas, entregaveis, eventos, materiais: mat.results.map((r) => sem(r)),
    // 0024: padrões de material (os campos vão no retrato: o projeto preenche o padrão da versão publicada)
    modelos: mod.results.map((r) => ({ ...sem(r), campos: lerJson(r.campos) || [] })) };
}

// Honorários: o custo sobre a estrutura (0015):
//   fases_pesos[fase][serviço] = % do honorário do projeto (as fases do fluxo somam 100; fase de acréscimo, à parte);
//   pesos[etapa][serviço] = fator 1 ou 2 da etapa dentro da fase (nulo = 1), só onde a etapa vale (P ou O).
// A % de cada etapa é fórmula: fator ÷ soma dos fatores das etapas CONTRATADAS da fase (calculada no vendas).
export async function retratoHonorarios(env) {
  const [srv, fas, es, par, der, fs, ev, vc] = await env.DB.batch([
    env.DB.prepare(`SELECT id, sigla, nome, ${PRECO_SERVICO.join(', ')} FROM bases_servicos WHERE arquivado_em IS NULL ORDER BY ordem, nome`),
    env.DB.prepare('SELECT id, nome, ilha, acrescimo FROM pgt_fases WHERE arquivado_em IS NULL ORDER BY ordem'),
    env.DB.prepare(`SELECT x.etapa_id, x.servico_id, x.peso FROM pgt_etapas_servicos x
      JOIN bases_servicos s ON s.id = x.servico_id JOIN pgt_etapas e ON e.id = x.etapa_id JOIN pgt_fases f ON f.id = e.fase_id
      WHERE s.arquivado_em IS NULL AND e.arquivado_em IS NULL AND f.arquivado_em IS NULL AND x.peso IS NOT NULL
      ORDER BY f.ordem, e.ordem, s.ordem`),
    env.DB.prepare('SELECT chave, valor FROM bases_parametros ORDER BY chave'),
    env.DB.prepare(SQL_PERT_DERIVADA),
    env.DB.prepare(`SELECT x.fase_id, x.servico_id, x.peso FROM pgt_fases_servicos x
      JOIN bases_servicos s ON s.id = x.servico_id JOIN pgt_fases f ON f.id = x.fase_id
      WHERE s.arquivado_em IS NULL AND f.arquivado_em IS NULL AND x.peso IS NOT NULL ORDER BY f.ordem, s.ordem`),
    // 0019: textos das cláusulas (dos eventos e do vendas), editados em Contratos › Gestor de cláusulas
    env.DB.prepare(`SELECT id, clausula FROM pgt_eventos WHERE arquivado_em IS NULL AND clausula_marcada = 1 AND clausula IS NOT NULL AND trim(clausula) <> '' ORDER BY id`),
    env.DB.prepare('SELECT id, grupo, texto, padrao, ordem FROM vendas_clausulas WHERE arquivado_em IS NULL ORDER BY grupo, ordem, id'),
  ]);
  const vale = mapaDerivado(der.results);
  const pesos = {};
  for (const x of es.results) if (vale[x.etapa_id]?.[x.servico_id]) (pesos[x.etapa_id] ||= {})[x.servico_id] = x.peso;
  const fases_pesos = {};
  for (const x of fs.results) (fases_pesos[x.fase_id] ||= {})[x.servico_id] = x.peso;
  return {
    servicos: srv.results, fases: fas.results, fases_pesos, pesos,
    parametros: Object.fromEntries(par.results.filter((p) => PARAMETROS[p.chave]).map((p) => [p.chave, lerJson(p.valor)])),
    clausulas_eventos: Object.fromEntries(ev.results.map((x) => [x.id, x.clausula])),
    clausulas: vc.results,
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
    env.DB.prepare(`SELECT id, versao, arquivado_em, ${PRECO_SERVICO.join(', ')} FROM bases_servicos`),
    env.DB.prepare('SELECT id, versao, arquivado_em FROM bases_categorias'),
    env.DB.prepare('SELECT id, versao, arquivado_em FROM bases_usos'),
  ]);
  const vers = Object.fromEntries([...srv.results, ...cat.results, ...uso.results].map((x) => [x.id, x.versao]));
  const marcar = (l) => l.map((x) => ({ ...x, versao: vers[x.id] }));
  // o preço é do vendas: aqui só para mostrar (e o "com preço", que o Projetos também muda)
  const preco = Object.fromEntries(srv.results.map((x) => [x.id, Object.fromEntries(PRECO_SERVICO.map((k) => [k, x[k]]))]));
  const { results: arq } = await env.DB.prepare(`SELECT id, 'servico' AS tipo, nome AS nome, versao, arquivado_em FROM bases_servicos WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'categoria', nome, versao, arquivado_em FROM bases_categorias WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'uso', descricao, versao, arquivado_em FROM bases_usos WHERE arquivado_em IS NOT NULL`).all();
  return {
    servicos: marcar(r.servicos).map((x) => ({ ...x, ...preco[x.id] })), categorias: marcar(r.categorias), usos: marcar(r.usos), faixas_prazo: r.faixas_prazo,
    arquivados: arq, ...(await situacao(env, 'bases', r)),
  };
}

async function paginaPgt(env) {
  const r = await retratoPgt(env);
  const b = await retratoBases(env);
  const tabelas = ['pgt_fases', 'pgt_etapas', 'pgt_entregaveis', 'pgt_eventos', 'pgt_materiais', 'pgt_modelos'];
  const res = await env.DB.batch(tabelas.map((t) => env.DB.prepare(`SELECT id, versao${['pgt_materiais', 'pgt_modelos'].includes(t) ? '' : ', travado'} FROM ${t}`)));
  const vers = Object.fromEntries(res.flatMap((x) => x.results).map((x) => [x.id, x]));
  const marcar = (l) => l.map((x) => ({ ...x, versao: vers[x.id].versao, ...('travado' in vers[x.id] ? { travado: vers[x.id].travado } : {}) }));
  const { results: arq } = await env.DB.prepare(`SELECT id, 'etapa' AS tipo, sigla || ' · ' || nome AS nome, versao, arquivado_em FROM pgt_etapas WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'entregavel', texto, versao, arquivado_em FROM pgt_entregaveis WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'evento', nome, versao, arquivado_em FROM pgt_eventos WHERE arquivado_em IS NOT NULL
    UNION ALL SELECT id, 'material', nome, versao, arquivado_em FROM pgt_materiais WHERE arquivado_em IS NOT NULL AND modelo_id IS NULL
    UNION ALL SELECT id, 'padrao', nome, versao, arquivado_em FROM pgt_modelos WHERE arquivado_em IS NOT NULL
    ORDER BY arquivado_em DESC LIMIT 200`).all();
  return {
    fases: marcar(r.fases), etapas: marcar(r.etapas), entregaveis: marcar(r.entregaveis), eventos: marcar(r.eventos), materiais: marcar(r.materiais), modelos: marcar(r.modelos),
    servicos: b.servicos.map((s) => ({ id: s.id, sigla: s.sigla, nome: s.nome, ordem: s.ordem, dinamica: s.dinamica })),
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
    fases: r.fases.map((f) => ({ ...f, versao: vers[f.id], pesos: r.fases_pesos[f.id] || {} })),
    etapas: eta.results.map((e) => ({ ...e, servicos: porEtapa[e.id] || {} })),
    parametros: r.parametros,
    parametros_rotulos: Object.fromEntries(Object.entries(PARAMETROS).map(([k, v]) => [k, v.rotulo])),
    clausulas_eventos: r.clausulas_eventos,
    ...(await situacao(env, 'honorarios', r)),
  };
}

async function pesoEtapa(env, ferramenta, c) {
  await ativo(env, 'pgt_etapas', c.etapa_id, 'Etapa');
  await ativo(env, 'bases_servicos', c.servico_id, 'Serviço');
  const peso = numOuNulo(c.peso, 'Peso');
  if (peso !== null && peso !== 1 && peso !== 2) throw new ErroApi(422, 'Peso da etapa: 1 ou 2');
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

// Peso da fase no honorário do serviço (% do projeto; 0 a 100). Fase-ilha não tem peso.
async function pesoFase(env, ferramenta, c) {
  await ativo(env, 'pgt_fases', c.fase_id, 'Fase');
  await ativo(env, 'bases_servicos', c.servico_id, 'Serviço');
  const fase = await env.DB.prepare('SELECT ilha FROM pgt_fases WHERE id = ?').bind(c.fase_id).first();
  if (fase.ilha) throw new ErroApi(422, 'fase-ilha não tem peso no honorário');
  const peso = numOuNulo(c.peso, 'Peso');
  if (peso !== null && peso > 100) throw new ErroApi(422, 'Peso da fase: de 0 a 100');
  const antes = (await env.DB.prepare('SELECT peso FROM pgt_fases_servicos WHERE fase_id = ? AND servico_id = ?')
    .bind(c.fase_id, c.servico_id).first()) || {};
  if ((antes.peso ?? null) === peso) return { ok: true, semMudanca: true };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO pgt_fases_servicos (fase_id, servico_id, peso) VALUES (?, ?, ?)
      ON CONFLICT (fase_id, servico_id) DO UPDATE SET peso = excluded.peso`).bind(c.fase_id, c.servico_id, peso),
    hist(env, c.fase_id, 'pgt_fases', ferramenta, { [`peso:${c.servico_id}`]: [antes.peso ?? null, peso] }),
  ]);
  return { ok: true, fase_id: c.fase_id, servico_id: c.servico_id, peso };
}

// Lista curta dos serviços (0022): para o servicos.odisse ligar cada produto do catálogo a um serviço do PGT.
export async function listaDeServicos(env) {
  const { results } = await env.DB.prepare(`SELECT id, sigla, nome, dinamica, com_preco FROM bases_servicos
    WHERE arquivado_em IS NULL ORDER BY ordem, nome`).all();
  return { servicos: results };
}

// ---------------------------------------------------------------- IC por serviço × categoria (0022)
// Só para serviço em fluxo. ic = { critério: nível } (parcial: o que faltar vem do padrão do serviço); null = sem valor próprio.
const CRITERIOS = ['qtd_especialistas', 'qtd_aprovacoes', 'grau_resp_civil', 'grau_intervencao_cliente', 'expectativa_plastica',
  'grau_controle_custo', 'indefinicao_escopo', 'indefinicao_prazo', 'demanda_midia'];
async function icDoPar(env, ferramenta, c) {
  const s = await env.DB.prepare('SELECT id, dinamica FROM bases_servicos WHERE id = ? AND arquivado_em IS NULL').bind(String(c.servico_id || '')).first();
  if (!s) throw new ErroApi(422, 'Serviço: não encontrado');
  if (s.dinamica !== 'fluxo') throw new ErroApi(422, 'serviço em ilha não tem índice por categoria (vale o do serviço)');
  await ativo(env, 'bases_categorias', c.categoria_id, 'Categoria');
  let ic = null;
  if (c.ic !== null && c.ic !== undefined) {
    if (typeof c.ic !== 'object' || Array.isArray(c.ic)) throw new ErroApi(422, 'Índice: objeto { critério: nível }');
    ic = {};
    for (const [k, n] of Object.entries(c.ic)) {
      if (!CRITERIOS.includes(k)) throw new ErroApi(422, `Índice: critério desconhecido (${k})`);
      if (!['baixo', 'medio', 'alto'].includes(n)) throw new ErroApi(422, `Índice: nível de ${k} precisa ser baixo, medio ou alto`);
      ic[k] = n;
    }
    if (!Object.keys(ic).length) ic = null;
  }
  const antes = await env.DB.prepare('SELECT ic FROM bases_ic WHERE servico_id = ? AND categoria_id = ?').bind(s.id, c.categoria_id).first();
  if ((antes?.ic ?? null) === (ic ? JSON.stringify(ic) : null)) return { ok: true, semMudanca: true };
  await env.DB.batch([
    ic
      ? env.DB.prepare(`INSERT INTO bases_ic (servico_id, categoria_id, ic, atualizado_em, atualizado_por) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (servico_id, categoria_id) DO UPDATE SET ic = excluded.ic, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
        .bind(s.id, c.categoria_id, JSON.stringify(ic), agoraISO(), ferramenta)
      : env.DB.prepare('DELETE FROM bases_ic WHERE servico_id = ? AND categoria_id = ?').bind(s.id, c.categoria_id),
    hist(env, s.id, 'bases_servicos', ferramenta, { [`ic:${c.categoria_id}`]: [lerJson(antes?.ic), ic] }),
  ]);
  return { ok: true, servico_id: s.id, categoria_id: c.categoria_id, ic };
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

// Pertinência dos eventos (0008). O Encerramento é perpétuo em todos os serviços e não se muda aqui.
async function eventosServico(env, ferramenta, c) {
  const ids = [...new Set(Array.isArray(c.evento_ids) ? c.evento_ids.map(String) : [])];
  if (!ids.length || ids.length > 200) throw new ErroApi(422, 'evento_ids: de 1 a 200 eventos');
  await ativo(env, 'bases_servicos', c.servico_id, 'Serviço');
  const p = c.pertinencia === null || c.pertinencia === undefined || c.pertinencia === '' ? null : c.pertinencia;
  if (p !== null && !['P', 'O', 'S'].includes(p)) throw new ErroApi(422, 'Pertinência: P (vem marcado), O (opcional), S (perpétuo) ou vazio');
  const marcas = ids.map(() => '?').join(', ');
  const { results: existem } = await env.DB.prepare(`SELECT id, encerramento FROM pgt_eventos WHERE id IN (${marcas}) AND arquivado_em IS NULL`).bind(...ids).all();
  if (existem.length !== ids.length) throw new ErroApi(422, 'algum evento não foi encontrado (ou está arquivado)');
  if (existem.some((x) => x.encerramento)) throw new ErroApi(422, 'o Encerramento é perpétuo: vale para todos os serviços');
  const { results: antes } = await env.DB.prepare(
    `SELECT evento_id, pertinencia FROM pgt_eventos_servicos WHERE servico_id = ? AND evento_id IN (${marcas})`,
  ).bind(c.servico_id, ...ids).all();
  const eraDe = Object.fromEntries(antes.map((a) => [a.evento_id, a.pertinencia]));
  const stmts = [];
  let mudaram = 0;
  for (const id of ids) {
    const era = eraDe[id] || null;
    if (era === p) continue;
    mudaram++;
    stmts.push(p
      ? env.DB.prepare(`INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES (?, ?, ?)
          ON CONFLICT (evento_id, servico_id) DO UPDATE SET pertinencia = excluded.pertinencia`).bind(id, c.servico_id, p)
      : env.DB.prepare('DELETE FROM pgt_eventos_servicos WHERE evento_id = ? AND servico_id = ?').bind(id, c.servico_id),
    hist(env, id, 'pgt_eventos', ferramenta, { [`servico:${c.servico_id}`]: [era, p] }));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { ok: true, mudaram };
}

// Sequência da etapa (0008): entregas e eventos recebem a posição na lista (1, 2, 3…). Todos precisam ser
// da etapa; o Encerramento fica fora (é sempre o último). Não mexe na versão; fica no histórico.
async function sequencia(env, ferramenta, c) {
  await ativo(env, 'pgt_etapas', c.etapa_id, 'Etapa');
  const ids = Array.isArray(c.ids) ? c.ids.map(String) : [];
  if (!ids.length || ids.length > 300 || new Set(ids).size !== ids.length) throw new ErroApi(422, 'ids: lista sem repetição (até 300)');
  if (ids.some((id) => !/^pe[nv]_/.test(id))) throw new ErroApi(422, 'ids: só entregas (pen_) e eventos (pev_)');
  const agora = agoraISO();
  const stmts = ids.map((id, i) => env.DB.prepare(`UPDATE ${id.startsWith('pen_') ? 'pgt_entregaveis' : 'pgt_eventos'}
    SET ordem = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND etapa_id = ?${id.startsWith('pev_') ? ' AND encerramento = 0' : ''}`)
    .bind(i + 1, agora, ferramenta, id, c.etapa_id));
  stmts.push(...ids.map((id, i) => hist(env, id, id.startsWith('pen_') ? 'pgt_entregaveis' : 'pgt_eventos', ferramenta, { ordem: [null, i + 1] })));
  const res = await env.DB.batch(stmts);
  if (res.slice(0, ids.length).some((r) => r.meta.changes !== 1)) throw new ErroApi(422, 'algum item da lista não é desta etapa (ou é o Encerramento)');
  return { ok: true };
}

async function faixasPrazo(env, ferramenta, c) {
  const faixas = conferirFaixas(c.faixas);
  const antes = await env.DB.prepare("SELECT valor FROM bases_parametros WHERE chave = 'faixas_prazo'").first();
  const agora = agoraISO();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO bases_parametros (chave, valor, rotulo, atualizado_em, atualizado_por) VALUES ('faixas_prazo', ?, 'Faixas de prazo por área', ?, ?)
      ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .bind(JSON.stringify(faixas), agora, ferramenta),
    hist(env, 'parametro:faixas_prazo', 'bases_parametros', ferramenta, { valor: [lerJson(antes?.valor), faixas] }),
  ]);
  return { ok: true, faixas };
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
const TABELAS_LOTE = ['pgt_fases', 'pgt_etapas', 'pgt_entregaveis', 'pgt_eventos', 'pgt_materiais'];
const OPS_LOTE = {
  'entregaveis-servicos': entregaveisServico, 'eventos-servicos': eventosServico, 'entregaveis-categorias': entregavelCategorias,
  ordem: reordenar, sequencia,
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
    if (id === 'faixas-prazo' && m === 'POST') { exigir('bases_servicos', ferramenta, 'E'); return faixasPrazo(env, ferramenta, corpo || {}); }
    if (id === 'lista' && m === 'GET') { exigir('bases_servicos', ferramenta, 'L'); return listaDeServicos(env); }
    if (id === 'ic' && m === 'POST') { exigir('bases_servicos', ferramenta, 'E'); return icDoPar(env, ferramenta, corpo || {}); }
    throw new ErroApi(404, 'rota não encontrada');
  }
  if (rota === 'pgt') {
    if (!id && m === 'GET') { exigir('pgt_etapas', ferramenta, 'L'); return paginaPgt(env); }
    if (m !== 'POST') throw new ErroApi(405, 'método não aceito');
    exigir('pgt_etapas', ferramenta, 'E');
    const c = corpo || {};
    if (id === 'etapas-servicos') throw new ErroApi(422, 'a pertinência da etapa vem dos entregáveis (marque os entregáveis)');
    if (id === 'entregaveis-servicos') return entregaveisServico(env, ferramenta, c);
    if (id === 'eventos-servicos') return eventosServico(env, ferramenta, c);
    if (id === 'entregaveis-categorias') return entregavelCategorias(env, ferramenta, c);
    if (id === 'sequencia') return sequencia(env, ferramenta, c);
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
    if (id === 'fases') return pesoFase(env, ferramenta, c);
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
