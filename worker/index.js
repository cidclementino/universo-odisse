// API do Universo (hub) — Cloudflare Worker.
//
// Duas partes:
//   1. Marca: lê e grava o odisse.json do repositório cidclementino/marca-odisse. Cada gravação
//      vira um commit e, depois que o GitHub Pages publica (1–2 min), os sites leem o dado novo.
//   2. Dados (/api/v1, em dados/): a única porta do banco D1 `universo` e do R2 `universo-arquivos`.
//      Ver dados/api.js e dados/esquema.js, e o dados/DECISOES.md na raiz do repositório.
//
// Quem chama:
//   - o próprio hub, pelo navegador: Authorization: Bearer <UNIVERSO_SENHA>     -> ferramenta 'hub'
//   - rotinas do GitHub Actions: Authorization: Bearer <MAQUINA_TOKEN>          -> ferramenta 'maquina'
//   - outras ferramentas, Worker a Worker (service binding com entrypoint = "Vendas", "Projetos",
//     "Fornecedores" ou "Marketing"): sem senha, porque esses pontos de entrada não são acessíveis
//     pela internet, só por outro Worker da mesma conta. Cada um tem as permissões da sua ferramenta.
//
// Secrets (enviados pelo GitHub Actions; nunca no código):
//   UNIVERSO_SENHA     -> senha da equipe
//   MAQUINA_TOKEN      -> token das rotinas automáticas (cópia, lotes de imagem, migrações de dados)
//   MARCA_GITHUB_TOKEN -> token "fine-grained" do GitHub com acesso SÓ ao repo marca-odisse,
//                         permissão Contents: Read and write
//
// Rotas da Marca (exigem a senha da equipe):
//   GET /api/estado  -> { ok, marca: true|false }  (confere senha e se o token existe)
//   GET /api/marca   -> { dados, sha }              (odisse.json direto do repositório, sem atraso do Pages)
//   PUT /api/marca   <- { dados, sha }              -> { dados, sha, commit }
//                       409 se alguém salvou antes (sha diferente). Se a paleta, os papéis ou as cores
//                       dos núcleos mudarem, o mesmo commit reescreve os valores do v1/marca.css.
//   POST /api/marca/logo <- { sha, nucleo, modo: 'novo'|'substituir', alvo?, nome?, svg }
//                       -> { dados, sha, commit, caminho }. O SVG é conferido (só desenho) e entra no
//                       mesmo commit que atualiza a lista de logos do núcleo no odisse.json.

import { WorkerEntrypoint } from 'cloudflare:workers';
import { api } from './dados/api.js';
import { aplicar, mudancas, gerarCss, validarSvg, incluirLogo } from './marca.js';

const REPO = 'cidclementino/marca-odisse';
const ARQUIVO = 'odisse.json';
const CSS = 'v1/marca.css';
const GHR = `https://api.github.com/repos/${REPO}`;
const GH = `${GHR}/contents/${ARQUIVO}`;

// Qualquer origem pode chamar: a proteção é a senha no cabeçalho (sem cookies), como no marketing.
// Restringir a origem só fazia o navegador descartar a resposta quando o hub era aberto por
// outro endereço (http://, www., github.io), com o erro genérico "Failed to fetch".
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function confere(dada, segredo) {
  if (!segredo || dada.length !== segredo.length) return false;
  let dif = 0;
  for (let i = 0; i < segredo.length; i++) dif |= dada.charCodeAt(i) ^ segredo.charCodeAt(i);
  return dif === 0;
}

// Devolve 'hub', 'maquina' ou null.
function quemChama(request, env) {
  const auth = request.headers.get('Authorization') || '';
  // a senha vem codificada (encodeURIComponent): aceita acentos, ç e qualquer símbolo
  let dada = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try { dada = decodeURIComponent(dada); } catch { return null; }
  if (confere(dada, env.UNIVERSO_SENHA)) return 'hub';
  if (confere(dada, env.MAQUINA_TOKEN)) return 'maquina';
  return null;
}

// /arq/<id>[-m|-s] é atalho para /api/v1/arquivos/<id>/conteudo?variante=…
function reescreverAtalho(url) {
  const m = url.pathname.match(/^\/arq\/(arq_[0-9A-Z]{26})(?:-(m|s))?$/);
  if (!m) return url;
  const nova = new URL(url);
  nova.pathname = `/api/v1/arquivos/${m[1]}/conteudo`;
  nova.searchParams.set('variante', m[2] || 'g');
  return nova;
}

// ---- GitHub ---------------------------------------------------------------

const ghHeaders = (env) => ({
  Authorization: `Bearer ${env.MARCA_GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'universo-odisse',
});

const deBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

async function lerMarca(env, ref = 'main') {
  const r = await fetch(GH + '?ref=' + ref, { headers: ghHeaders(env) });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler ${ARQUIVO}`);
  const j = await r.json();
  return { dados: JSON.parse(deBase64(j.content)), sha: j.sha };
}

async function lerTexto(env, caminho) {
  const r = await fetch(`${GHR}/contents/${caminho}?ref=main`, { headers: ghHeaders(env) });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler ${caminho}`);
  return deBase64((await r.json()).content);
}

// Vários arquivos num commit só (Git Data API): ou entra tudo, ou nada.
// arquivos: [{ caminho, texto }]. Devolve { commit (url), sha (do commit) } ou { conflito: true }.
async function gravarVarios(env, mensagem, arquivos) {
  const h = { ...ghHeaders(env), 'Content-Type': 'application/json' };
  const gh = async (caminho, opcoes = {}) => {
    const r = await fetch(`${GHR}/git/${caminho}`, { headers: h, ...opcoes });
    if (!r.ok) { const e = new Error(`GitHub respondeu ${r.status} (${caminho.split('/')[0]})`); e.status = r.status; throw e; }
    return r.json();
  };
  const ref = await gh('ref/heads/main');
  const pai = await gh('commits/' + ref.object.sha);
  const arvore = await gh('trees', { method: 'POST', body: JSON.stringify({
    base_tree: pai.tree.sha,
    tree: arquivos.map((a) => ({ path: a.caminho, mode: '100644', type: 'blob', content: a.texto })),
  }) });
  const commit = await gh('commits', { method: 'POST', body: JSON.stringify({ message: mensagem, tree: arvore.sha, parents: [ref.object.sha] }) });
  try {
    await gh('refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  } catch (e) {
    if (e.status === 422) return { conflito: true }; // alguém gravou entre a leitura e agora
    throw e;
  }
  return { commit: commit.html_url, sha: commit.sha };
}

// ---- validação: ver marca.js -----------------------------------------------

// ---- rotas ----------------------------------------------------------------

export default {
  async fetch(request, env) {
    const CORS = cors();
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
    const erro = (msg, status) => json({ error: msg }, status);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = reescreverAtalho(new URL(request.url));
    const { pathname } = url;
    const ferramenta = quemChama(request, env);
    if (!ferramenta) return erro('senha incorreta', 401);

    if (pathname.startsWith('/api/v1/') || pathname === '/api/v1') return api(env, ferramenta, request, url, CORS);
    if (ferramenta !== 'hub') return erro('rota não encontrada', 404);

    try {
      if (pathname === '/api/estado') return json({ ok: true, marca: !!env.MARCA_GITHUB_TOKEN });

      if (pathname === '/api/marca') {
        if (!env.MARCA_GITHUB_TOKEN) return erro('falta o token do GitHub (MARCA_GITHUB_TOKEN) no servidor', 503);

        if (request.method === 'GET') return json(await lerMarca(env));

        if (request.method === 'PUT') {
          const corpo = await request.json().catch(() => null);
          if (!corpo?.dados || !corpo.sha) return erro('envie { dados, sha }', 400);
          const atual = await lerMarca(env);
          if (atual.sha !== corpo.sha) return json({ error: 'conflito', ...atual }, 409);

          let novo;
          try { novo = aplicar(atual.dados, corpo.dados); } catch (e) { return erro(e.message, 422); }
          const lista = mudancas(atual.dados, novo);
          if (!lista.length) return json({ ...atual, semMudanca: true });

          const arquivos = [{ caminho: ARQUIVO, texto: JSON.stringify(novo, null, 2) + '\n' }];
          const coresMudaram = ['paleta', 'papéis das cores', 'núcleos'].some((k) => lista.includes(k));
          if (coresMudaram) {
            const css = await lerTexto(env, CSS);
            const novoCss = gerarCss(css, novo);
            if (novoCss !== css) arquivos.push({ caminho: CSS, texto: novoCss });
          }
          const g = await gravarVarios(env, `Dados: ${lista.join(', ')} (pelo Universo)`, arquivos);
          if (g.conflito) return json({ error: 'conflito', ...(await lerMarca(env)) }, 409);
          const lido = await lerMarca(env, g.sha);
          return json({ dados: lido.dados, sha: lido.sha, commit: g.commit, mudou: lista });
        }
        return erro('método não aceito', 405);
      }
      if (pathname === '/api/marca/logo') {
        if (!env.MARCA_GITHUB_TOKEN) return erro('falta o token do GitHub (MARCA_GITHUB_TOKEN) no servidor', 503);
        if (request.method !== 'POST') return erro('método não aceito', 405);
        const corpo = await request.json().catch(() => null);
        if (!corpo?.sha || !corpo.svg) return erro('envie { sha, nucleo, modo, svg }', 400);
        const atual = await lerMarca(env);
        if (atual.sha !== corpo.sha) return json({ error: 'conflito', ...atual }, 409);

        let svg, r;
        try {
          svg = validarSvg(corpo.svg);
          r = incluirLogo(atual.dados, corpo, svg);
        } catch (e) { return erro(e.message, 422); }
        const acao = corpo.modo === 'substituir' ? 'substitui' : 'acrescenta';
        const g = await gravarVarios(env, `Logo: ${acao} ${r.nome} (${r.caminho}) (pelo Universo)`, [
          { caminho: r.caminho, texto: svg },
          { caminho: ARQUIVO, texto: JSON.stringify(r.dados, null, 2) + '\n' },
        ]);
        if (g.conflito) return json({ error: 'conflito', ...(await lerMarca(env)) }, 409);
        const lido = await lerMarca(env, g.sha);
        return json({ dados: lido.dados, sha: lido.sha, commit: g.commit, caminho: r.caminho, nome: r.nome });
      }
      return erro('rota não encontrada', 404);
    } catch (e) {
      return erro(e.message || 'erro no servidor', 500);
    }
  },
};

// ---- pontos de entrada para outras ferramentas (Worker a Worker) ----------
// Na ferramenta: [[services]] binding = "UNIVERSO", service = "universo-hub", entrypoint = "Vendas"
// e então env.UNIVERSO.fetch('https://universo/api/v1/…', { … }).

function entrada(ferramenta) {
  return class extends WorkerEntrypoint {
    async fetch(request) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/v1')) return new Response('rota não encontrada', { status: 404 });
      return api(this.env, ferramenta, request, url, {});
    }
  };
}

export const Vendas = entrada('vendas');
export const Projetos = entrada('projetos');
export const Fornecedores = entrada('fornecedores');
export const Marketing = entrada('marketing');
