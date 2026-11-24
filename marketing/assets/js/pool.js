// Pool de mídias: o que saiu do editor pronto para publicar (pins do Pinterest, carrosséis do Instagram),
// com o dia no calendário, a situação e a origem. Cada item guarda as imagens exportadas (JPG, em img:<ref>)
// e as fotos de origem (hash + recorte), para avisar quando a mesma imagem volta.
//
// Item: { id, rede, formato, pub, card, nucleo, projeto, titulo, imagens: [{ ref, nome }], miniatura,
//         pin: { titulo, descricao, alt, pasta, pastaNome, link, idioma, tipo } | null, avisos: [],
//         fontes: [{ hash, x, y, z }], repete: [{ id, exata }], origem, status, dia, publicadoEm, criado, atualizado }

import * as local from './store.js';
import * as nuvem from './nuvem.js';

export const STATUS = [['pronto', 'No pool'], ['agendado', 'Agendado'], ['publicado', 'Publicado']];
export const ORIGENS = [['acervo', 'Acervo'], ['fluxo', 'Fluxo contínuo'], ['imprensa', 'Imprensa']];
export const REDES = [['pinterest', 'Pinterest'], ['instagram', 'Instagram']];
/** Ritmo do Pinterest (estratégia, seção 06): de 1 a 3 pins por dia. */
export const RITMO_MAX = 3;

const CHAVE = 'pool';
const INTERVALO = 60 * 1000;
let itens = null, lidoEm = 0;

export const lista = () => itens || [];
/** Cópia do navegador, sem esperar a nuvem. */
export async function abrirLocal() { if (!itens) itens = (await local.lerMeta(CHAVE)) || []; }
export const item = (id) => lista().find((x) => x.id === id) || null;

/** Lê o pool: na hora a cópia do navegador; a da nuvem no máximo 1×/min (ou já, com `forcar`). Devolve true se mudou. */
export async function carregar(forcar = false) {
  if (!itens) itens = (await local.lerMeta(CHAVE)) || [];
  if (!forcar && lidoEm && Date.now() - lidoEm < INTERVALO) return false;
  const remoto = await nuvem.poolListar();
  lidoEm = Date.now();
  const mudou = JSON.stringify(remoto) !== JSON.stringify(itens);
  itens = remoto;
  await local.gravarMeta(CHAVE, itens);
  return mudou;
}

export async function gravar(it) {
  it.atualizado = new Date().toISOString();
  const i = lista().findIndex((x) => x.id === it.id);
  if (!itens) itens = [];
  if (i >= 0) itens[i] = it; else itens.push(it);
  local.gravarMeta(CHAVE, itens);
  await nuvem.poolGravar(it);
  return it;
}

export async function apagar(id) {
  itens = lista().filter((x) => x.id !== id);
  local.gravarMeta(CHAVE, itens);
  await nuvem.poolApagar(id);
}

/** Muda o dia (e o encaixe da grade, `pos`): com dia, agendado; sem dia, de volta ao pool. Publicado continua publicado. */
export function definirDia(it, dia, pos = null) {
  it.dia = dia || '';
  it.pos = dia && pos != null ? pos : null;
  if (it.status !== 'publicado') it.status = dia ? 'agendado' : 'pronto';
  return it;
}

// ---------------------------------------------------------------------------
// Repetição: a mesma imagem não volta a ser publicada; um novo recorte ou ângulo da mesma obra, sim.

const hashes = new Map(); // dataURL da imagem original → hash
export async function hashDe(src) {
  if (!src) return '';
  if (hashes.has(src)) return hashes.get(src);
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(src));
  const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  hashes.set(src, h);
  return h;
}
/** Hash já calculado (sem esperar), para avisos síncronos no editor. */
export const hashPronto = (src) => hashes.get(src) || '';

const mesmoRecorte = (a, b) => Math.abs((a.x ?? 50) - (b.x ?? 50)) < 2 && Math.abs((a.y ?? 50) - (b.y ?? 50)) < 2 && Math.abs((a.z ?? 1) - (b.z ?? 1)) < 0.03;

/** Outros itens que usam a mesma foto: exata = mesma foto e mesmo recorte. `ignorar`: o próprio item e o seu par em outro idioma. */
export function repeticoes(fontes, ignorar = []) {
  const out = [];
  for (const o of lista()) {
    if (ignorar.includes(o.id)) continue;
    let achou = null;
    for (const f of fontes || []) {
      for (const g of o.fontes || []) {
        if (f.hash && f.hash === g.hash) achou = achou === true ? true : mesmoRecorte(f, g);
      }
    }
    if (achou !== null) out.push({ id: o.id, exata: achou });
  }
  return out;
}

/** Itens do pool que usam esta foto (qualquer recorte), exceto os dos cards informados (o pin e o seu par). */
export function usosDaFoto(hash, cards = []) {
  if (!hash) return [];
  return lista().filter((o) => !cards.includes(o.card) && (o.fontes || []).some((g) => g.hash === hash));
}

// ---------------------------------------------------------------------------
// Datas (dia local, AAAA-MM-DD)

export const hoje = () => isoDia(new Date());
export function isoDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const dataDe = (iso) => new Date(`${iso}T12:00:00`);
export function somarDias(iso, n) {
  const d = dataDe(iso);
  d.setDate(d.getDate() + n);
  return isoDia(d);
}
/** Segunda-feira da semana do dia. */
export function segundaDe(iso) {
  const d = dataDe(iso);
  return somarDias(iso, -((d.getDay() + 6) % 7));
}
export const dataCurta = (iso) => (iso ? dataDe(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
export const dataLonga = (iso) => (iso ? dataDe(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

// ---------------------------------------------------------------------------
// Distribuição dos pins prontos no calendário: um projeto por dia (um projeto se publica aos poucos),
// alternando as pastas dentro de cada projeto, até `ritmo` pins por dia. `ritmo` é um número ou uma função
// (dia) → número: a cota do dia que vem da Estratégia. `opc.umProjeto` e `opc.pastas` seguem as regras da plataforma.

export function planejarDistribuicao(prontos, inicio, ritmo, opc = {}) {
  const umProjeto = opc.umProjeto !== false, alternar = opc.pastas !== false;
  const cotaDe = typeof ritmo === 'function' ? ritmo : () => ritmo;
  const porProjeto = new Map();
  for (const it of [...prontos].sort((a, b) => (a.criado || '').localeCompare(b.criado || ''))) {
    if (!porProjeto.has(it.pub)) porProjeto.set(it.pub, []);
    porProjeto.get(it.pub).push(it);
  }
  // dentro do projeto, alterna as pastas
  const filas = [...porProjeto.values()].map((l) => {
    const porPasta = new Map();
    for (const it of l) {
      const k = alternar ? it.pin?.pasta || '' : '';
      if (!porPasta.has(k)) porPasta.set(k, []);
      porPasta.get(k).push(it);
    }
    const grupos = [...porPasta.values()], out = [];
    while (grupos.some((g) => g.length)) for (const g of grupos) if (g.length) out.push(g.shift());
    return out;
  });
  const plano = [];
  let dia = inicio, giro = 0, guarda = 366;
  while (filas.some((f) => f.length) && guarda--) {
    const ocupados = lista().filter((x) => x.rede === 'pinterest' && x.dia === dia).concat(plano.filter((p) => p.dia === dia).map((p) => p.item));
    let vagas = cotaDe(dia) - ocupados.length;
    const projetos = new Set(ocupados.map((x) => x.pub));
    for (let k = 0; k < filas.length && vagas > 0; k++) {
      const f = filas[(k + giro) % filas.length];
      if (!f.length || (umProjeto && projetos.has(f[0].pub))) continue;
      const it = f.shift();
      plano.push({ item: it, dia });
      projetos.add(it.pub);
      vagas--;
    }
    giro++;
    dia = somarDias(dia, 1);
  }
  return plano;
}
