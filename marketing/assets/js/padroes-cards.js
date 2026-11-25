// Padrões dos cards editados na página Padrões (#/padroes). Guardados na nuvem do marketing (`cfg:padroes-cards`),
// com cópia neste navegador (IndexedDB `meta/padroes-cards`): a página e o editor abrem com a cópia e atualizam por baixo.
//
// O que se grava é só a diferença para o código (os valores de templates.js e padroes.js):
//   { versao: 1,
//     nomes:   { <chave do modelo>: 'Nome' },
//     opcoes:  { <chave do modelo>: { <opção>: <valor> } },          padrão das opções de cada modelo
//     textos:  { <chave do modelo>: { <texto>: { estilo, ativo } } }, estilo e liga/desliga padrão de cada texto
//     veu:     { leve, padrao, forte },                              fator de cada nível do véu
//     veuPadrao, veuMescla, carimbo,                                 nível e mesclagem do véu e carimbo dos cards novos
//     texto:   { <estilo>: { tamanho, peso, entrelinha, tracking } } } estilos de texto
//
// Valem na hora: nomes, fatores do véu e estilos de texto (mudam o desenho de todos os cards). Valem só para os
// cards novos: os padrões de opção e de texto, o véu e o carimbo — o editor copia esses valores para o card quando
// ele é criado ou troca de modelo (`padraoInicial`), e as publicações que já existem continuam como estão.

import * as local from './store.js';
import * as nuvem from './nuvem.js';
import { TEXTO, cssDosPadroes } from './padroes.js';
import { ORDEM_NUCLEOS } from './nucleos.js';
import { CATALOGO, modelosDo, FATOR_VEU, OP_VEU, OP_CARIMBO, VEU_PADRAO } from './templates.js';

const CHAVE = 'padroes-cards';

/** Chave de um modelo: o id dos universais e do pin; núcleo:id dos específicos (os ids se repetem entre núcleos). */
const UNIVERSAIS = new Set(CATALOGO.estudio.filter((m) => /^O-/.test(m.cod || '')).map((m) => m.id));
const PINS = new Set(modelosDo('estudio', 'pin').map((m) => m.id));
export const chaveDe = (nucleoId, modeloId) => (UNIVERSAIS.has(modeloId) || PINS.has(modeloId) ? modeloId : `${nucleoId}:${modeloId}`);

/** Todos os modelos, cada um uma vez: [{ chave, m, dono (núcleo dos específicos), formato }]. */
export const ENTRADAS = [
  ...CATALOGO.estudio.filter((m) => UNIVERSAIS.has(m.id)).map((m) => ({ chave: m.id, m, dono: null, formato: '3x4' })),
  ...ORDEM_NUCLEOS.flatMap((nid) => CATALOGO[nid].filter((m) => !UNIVERSAIS.has(m.id)).map((m) => ({ chave: `${nid}:${m.id}`, m, dono: nid, formato: '3x4' }))),
  ...modelosDo('estudio', 'pin').map((m) => ({ chave: m.id, m, dono: null, formato: 'pin' })),
];
export const ENTRADA = Object.fromEntries(ENTRADAS.map((e) => [e.chave, e]));

// Valores do código, guardados antes de qualquer padrão editado
export const ORIGINAL = {
  nomes: Object.fromEntries(ENTRADAS.map((e) => [e.chave, e.m.nome])),
  veu: { leve: FATOR_VEU.leve, padrao: FATOR_VEU.padrao, forte: FATOR_VEU.forte },
  veuPadrao: OP_VEU.padrao,
  veuMescla: VEU_PADRAO.mescla,
  carimbo: OP_CARIMBO.padrao,
  texto: Object.fromEntries(TEXTO.map((t) => [t.id, { tamanho: structuredClone(t.tamanho), peso: t.peso, entrelinha: t.entrelinha, tracking: t.tracking }])),
};

export const vazio = () => ({ versao: 1, nomes: {}, opcoes: {}, textos: {}, veu: {}, veuPadrao: null, veuMescla: null, carimbo: null, texto: {} });
let cfg = vazio();
export const atual = () => cfg;

/** Completa e limpa: só fica o que difere do código. */
export function normalizar(c) {
  const n = { ...vazio(), ...(c || {}) };
  for (const k of ['nomes', 'opcoes', 'textos', 'veu', 'texto']) n[k] = { ...(n[k] || {}) };
  for (const [k, v] of Object.entries(n.nomes)) if (!ENTRADA[k] || !String(v || '').trim() || v === ORIGINAL.nomes[k]) delete n.nomes[k];
  for (const k of ['opcoes', 'textos']) for (const [ch, v] of Object.entries(n[k])) if (!ENTRADA[ch] || !v || !Object.keys(v).length) delete n[k][ch];
  for (const [k, v] of Object.entries(n.veu)) if (!(k in ORIGINAL.veu) || typeof v !== 'number' || v === ORIGINAL.veu[k]) delete n.veu[k];
  if (n.veuPadrao === ORIGINAL.veuPadrao) n.veuPadrao = null;
  if (n.veuMescla === ORIGINAL.veuMescla) n.veuMescla = null;
  if (n.carimbo === ORIGINAL.carimbo) n.carimbo = null;
  for (const [k, v] of Object.entries(n.texto)) if (!ORIGINAL.texto[k] || JSON.stringify({ ...ORIGINAL.texto[k], ...v }) === JSON.stringify(ORIGINAL.texto[k])) delete n.texto[k];
  return n;
}

/** Põe nos módulos o que vale na hora: nomes, fatores do véu e estilos de texto (com o CSS dos estilos). */
function aplicarAosModulos(c) {
  for (const e of ENTRADAS) e.m.nome = c.nomes[e.chave] ?? ORIGINAL.nomes[e.chave];
  Object.assign(FATOR_VEU, ORIGINAL.veu, c.veu);
  for (const t of TEXTO) Object.assign(t, structuredClone(ORIGINAL.texto[t.id]), structuredClone(c.texto[t.id] || {}));
  const st = document.getElementById('padroes-css');
  if (st) st.textContent = cssDosPadroes();
}
/** Passa a valer (é o que o editor usa). */
export function aplicar(c) {
  cfg = normalizar(c);
  aplicarAosModulos(cfg);
  return cfg;
}
/** Só para a página Padrões: mostra um rascunho sem que ele passe a valer; restaurar() volta ao gravado. */
export const previsualizar = (c) => aplicarAosModulos(normalizar(c));
export const restaurar = () => aplicarAosModulos(cfg);

/** Opções e textos com que um card novo nasce (ou com que fica ao trocar de modelo). */
export function padraoInicial(nucleoId, modeloId) {
  const opcoes = {};
  if (cfg.carimbo) opcoes.carimbo = cfg.carimbo;
  if (cfg.veuPadrao) Object.assign(opcoes, { veu: cfg.veuPadrao, veuBase: cfg.veuPadrao });
  if (cfg.veuMescla) Object.assign(opcoes, { veuMescla: cfg.veuMescla, veuBaseMescla: cfg.veuMescla });
  Object.assign(opcoes, cfg.opcoes[chaveDe(nucleoId, modeloId)] || {});
  const textos = structuredClone(cfg.textos[chaveDe(nucleoId, modeloId)] || {});
  return { opcoes, textos };
}

/** Cópia deste navegador, aplicada antes de desenhar qualquer card. */
export async function carregarLocal() {
  const l = await local.lerMeta(CHAVE).catch(() => null);
  if (l) aplicar(l);
}
/** Confere a nuvem por baixo. Devolve true quando ela trouxe algo diferente da cópia. */
export async function atualizarDaNuvem() {
  try {
    const r = await nuvem.lerConfig(CHAVE);
    if (r && JSON.stringify(normalizar(r)) !== JSON.stringify(cfg)) {
      aplicar(r);
      await local.gravarMeta(CHAVE, cfg);
      return true;
    }
  } catch (e) { console.warn('[padrões] nuvem', e); }
  return false;
}

/** Grava (cópia local + nuvem). Lança erro se a nuvem recusar; a cópia local fica. */
export async function gravar(novo) {
  aplicar(novo);
  await local.gravarMeta(CHAVE, cfg);
  await nuvem.gravarConfig(CHAVE, cfg);
}
