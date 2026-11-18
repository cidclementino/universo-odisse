// Cópias locais das leituras do hub: a página aparece na hora com a última cópia e a resposta nova chega
// por baixo (só redesenha se mudou). Regra para todas as páginas do Universo: nada de recarregar tudo do zero.
//
//   lerCopia(chave) / gravarCopia(chave, valor) / apagarCopia(chave)  → localStorage (JSON pequeno: listas, fichas)
//   imagemGuardada(chave, buscar)                                      → Cache Storage, para imagens imutáveis
//                                                                        (a chave leva o id do arquivo: trocou a foto,
//                                                                        muda a chave). Devolve um objectURL.
// A rubrica (arquivo protegido) não passa por aqui: fica só na memória da sessão.

const P = 'universo:copia:';
const VERSAO = 1; // sobe quando o formato das cópias mudar

export function lerCopia(chave) {
  try {
    const x = JSON.parse(localStorage.getItem(P + chave) || 'null');
    return x && x.v === VERSAO ? x.d : null;
  } catch { return null; }
}
export function gravarCopia(chave, d) {
  try { localStorage.setItem(P + chave, JSON.stringify({ v: VERSAO, em: Date.now(), d })); } catch { /* cheio ou bloqueado: segue sem cópia */ }
}
export function apagarCopia(chave) { try { localStorage.removeItem(P + chave); } catch {} }
export const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- imagens imutáveis
const urls = new Map(); // chave → objectURL (nesta aba)
const pendentes = new Map();
const CACHE = 'universo-imagens-v1';
const endereco = (chave) => `https://universo.local/img/${encodeURIComponent(chave)}`;

export function imagemGuardada(chave, buscar) {
  if (urls.has(chave)) return Promise.resolve(urls.get(chave));
  if (pendentes.has(chave)) return pendentes.get(chave);
  const p = (async () => {
    let cache = null;
    try { cache = await caches.open(CACHE); } catch { /* sem Cache Storage (http, modo privado) */ }
    let blob = null;
    if (cache) { const r = await cache.match(endereco(chave)); if (r) blob = await r.blob(); }
    if (!blob) {
      const r = await buscar();
      if (!r || !r.ok) return null;
      blob = await r.blob();
      if (cache) cache.put(endereco(chave), new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(() => {});
    }
    const u = URL.createObjectURL(blob);
    urls.set(chave, u);
    return u;
  })().finally(() => pendentes.delete(chave));
  pendentes.set(chave, p);
  return p;
}
