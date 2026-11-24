// Armazenamento local (IndexedDB): publicações, imagens e preferências.
// É sempre a primeira camada; a nuvem (nuvem.js) sincroniza por cima quando configurada.

const BANCO = 'universo-odisse';
const LOJAS = ['estado', 'pubs', 'imgs', 'meta'];
let conexao;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, 2);
    req.onupgradeneeded = () => {
      for (const l of LOJAS) if (!req.result.objectStoreNames.contains(l)) req.result.createObjectStore(l);
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
  return conexao;
}

async function op(loja, modo, fn) {
  try {
    const db = await abrir();
    return await new Promise((ok, erro) => {
      const tx = db.transaction(loja, modo);
      const r = fn(tx.objectStore(loja));
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => erro(tx.error);
    });
  } catch (e) {
    console.warn('[universo] armazenamento local falhou', e);
    return undefined;
  }
}

export const ler = (chave, loja = 'estado') => op(loja, 'readonly', (s) => s.get(chave));
export const gravar = (chave, valor, loja = 'estado') => op(loja, 'readwrite', (s) => s.put(valor, chave));

export async function listarPubs() {
  const todos = (await op('pubs', 'readonly', (s) => s.getAll())) || [];
  return todos.map(resumo);
}
export const lerPub = (id) => ler(id, 'pubs');
export const gravarPub = (pub) => gravar(pub.id, pub, 'pubs');
export const lerImg = (ref) => ler(ref, 'imgs');
export const gravarImg = (ref, src) => gravar(ref, src, 'imgs');
export const lerMeta = (k) => ler(k, 'meta');
export const gravarMeta = (k, v) => gravar(k, v, 'meta');

/** Resumo usado no arquivo (lista de publicações). */
export function resumo(pub) {
  return {
    id: pub.id,
    nucleo: pub.nucleo,
    formato: pub.formato || '3x4',
    titulo: pub.titulo || pub.globais?.projeto || '',
    ncards: pub.cards?.length || 0,
    criado: pub.criado,
    atualizado: pub.atualizado,
    salvoEm: pub.salvoEm || '',
    enviadoEm: pub.enviadoEm || '',
    arquivado: !!pub.arquivado,
    capa: pub.capa || '',
  };
}

/** Todas as referências de imagem usadas numa publicação. */
export function refsDe(pub) {
  const refs = new Set();
  for (const c of pub.cards || []) for (const im of Object.values(c.imgs || {})) if (im?.ref) refs.add(im.ref);
  return [...refs];
}
