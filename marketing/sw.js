// Service worker do Marketing (universo.odisse.com.br/marketing/, escopo só desta pasta): guarda os arquivos do site que têm número de versão (?v=…).
// Arquivo versionado não muda nunca: vem do cache na hora; quando sai uma versão nova, o endereço muda
// (tools/versionar.py) e a anterior é descartada. A página (index.html) sempre confere se há versão nova.
// A API (Cloudflare) e a Marca não passam por aqui.

const CACHE = 'marketing-estatico';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(paginaNova(req)); return; }
  if (url.searchParams.has('v')) e.respondWith(primeiroCache(req, url));
});

/** A página: sempre pergunta ao servidor (resposta curta quando nada mudou); sem rede, a última guardada. */
async function paginaNova(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req)) || Response.error();
  }
}

async function primeiroCache(req, url) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(req);
  if (guardado) return guardado;
  const res = await fetch(req);
  if (res.ok) {
    // descarta as versões anteriores do mesmo arquivo
    for (const k of await c.keys()) {
      const u = new URL(k.url);
      if (u.pathname === url.pathname && u.search !== url.search) c.delete(k);
    }
    c.put(req, res.clone());
  }
  return res;
}
