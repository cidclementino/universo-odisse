// API do Universo (hub) — Cloudflare Worker.
//
// Por enquanto serve só a página Marca: lê e grava o odisse.json do repositório
// cidclementino/marca-odisse. Cada gravação vira um commit (histórico no GitHub) e,
// depois que o GitHub Pages publica (1–2 min), todos os sites passam a ler o dado novo.
//
// Secrets (enviados pelo GitHub Actions; nunca no código):
//   UNIVERSO_SENHA     -> senha da equipe (Authorization: Bearer <senha>)
//   MARCA_GITHUB_TOKEN -> token "fine-grained" do GitHub com acesso SÓ ao repo marca-odisse,
//                         permissão Contents: Read and write
//
// Rotas (todas exigem a senha):
//   GET /api/estado  -> { ok, marca: true|false }  (confere senha e se o token existe)
//   GET /api/marca   -> { dados, sha }              (odisse.json direto do repositório, sem atraso do Pages)
//   PUT /api/marca   <- { dados, sha }              -> { dados, sha, commit }
//                       409 se alguém salvou antes (sha diferente)

const REPO = 'cidclementino/marca-odisse';
const ARQUIVO = 'odisse.json';
const GH = `https://api.github.com/repos/${REPO}/contents/${ARQUIVO}`;

// Qualquer origem pode chamar: a proteção é a senha no cabeçalho (sem cookies), como no marketing.
// Restringir a origem só fazia o navegador descartar a resposta quando o hub era aberto por
// outro endereço (http://, www., github.io), com o erro genérico "Failed to fetch".
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function autorizado(request, env) {
  const senha = env.UNIVERSO_SENHA;
  if (!senha) return false;
  const auth = request.headers.get('Authorization') || '';
  // a senha vem codificada (encodeURIComponent): aceita acentos, ç e qualquer símbolo
  let dada = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try { dada = decodeURIComponent(dada); } catch { return false; }
  if (dada.length !== senha.length) return false;
  let dif = 0;
  for (let i = 0; i < senha.length; i++) dif |= dada.charCodeAt(i) ^ senha.charCodeAt(i);
  return dif === 0;
}

// ---- GitHub ---------------------------------------------------------------

const ghHeaders = (env) => ({
  Authorization: `Bearer ${env.MARCA_GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'universo-odisse',
});

const paraBase64 = (texto) => {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const deBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

async function lerMarca(env) {
  const r = await fetch(GH + '?ref=main', { headers: ghHeaders(env) });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler ${ARQUIVO}`);
  const j = await r.json();
  return { dados: JSON.parse(deBase64(j.content)), sha: j.sha };
}

// ---- validação ------------------------------------------------------------
// O formulário só mexe nos campos conhecidos; o resto do arquivo (versao, núcleos ids…) é preservado.

const txt = (v, max, obrig = false, nome = 'campo') => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (obrig && !s) throw new Error(`${nome}: obrigatório`);
  if (s.length > max) throw new Error(`${nome}: no máximo ${max} caracteres`);
  return s;
};
const link = (v, nome) => {
  const s = txt(v, 300, false, nome);
  if (s && !/^https:\/\/[^\s/$.?#][^\s]*$/i.test(s)) throw new Error(`${nome}: precisa começar com https://`);
  return s;
};

function hojeBrasilia() {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
}

function aplicar(atual, novo) {
  const d = structuredClone(atual);
  d.nome = txt(novo.nome, 60, true, 'Nome');
  d.nome_completo = txt(novo.nome_completo, 120, true, 'Nome completo');
  d.nome_completo_en = txt(novo.nome_completo_en, 120, false, 'Nome completo (inglês)');
  d.descricao = txt(novo.descricao, 400, true, 'Descrição');
  d.descricao_en = txt(novo.descricao_en, 400, false, 'Descrição (inglês)');

  const fund = (Array.isArray(novo.fundadores) ? novo.fundadores : String(novo.fundadores || '').split(/\n|,/))
    .map((f) => txt(f, 80, false, 'Fundadores')).filter(Boolean);
  if (!fund.length) throw new Error('Fundadores: informe ao menos um nome');
  d.fundadores = fund;

  const c = novo.contato || {};
  const email = txt(c.email, 120, true, 'E-mail');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail: endereço inválido');
  const telefone = txt(c.telefone, 40, true, 'Telefone');
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) throw new Error('Telefone: número incompleto (use +55 DDD número)');
  // WhatsApp sai do telefone: um número só, sem chance de ficarem diferentes
  d.contato = { ...d.contato, email, telefone, whatsapp: digitos, whatsapp_link: 'https://wa.me/' + digitos };

  const e = novo.endereco || {};
  d.endereco = {
    ...d.endereco,
    logradouro: txt(e.logradouro, 160, true, 'Logradouro'),
    bairro: txt(e.bairro, 80, true, 'Bairro'),
    cidade: txt(e.cidade, 80, true, 'Cidade'),
    uf: txt(e.uf, 2, true, 'UF').toUpperCase(),
    cep: txt(e.cep, 12, true, 'CEP'),
    caixa_postal: txt(e.caixa_postal, 20, false, 'Caixa postal'),
  };

  for (const grupo of ['redes', 'sites']) {
    const vindo = novo[grupo] || {};
    d[grupo] = { ...d[grupo] };
    for (const k of Object.keys(d[grupo])) d[grupo][k] = link(vindo[k], `${grupo}.${k}`);
  }

  // núcleos: ids fixos (os sites dependem deles); só nome e conteúdo mudam
  const vindos = Object.fromEntries((novo.nucleos || []).map((n) => [n.id, n]));
  d.nucleos = d.nucleos.map((n) => ({
    ...n,
    nome: txt(vindos[n.id]?.nome ?? n.nome, 60, true, `Núcleo ${n.id}`),
    conteudo: txt(vindos[n.id]?.conteudo ?? n.conteudo, 120, false, `Núcleo ${n.id}`),
  }));

  d.atualizado = hojeBrasilia();
  return d;
}

function mudancas(antes, depois) {
  const out = [];
  const nomes = { nome: 'nome', nome_completo: 'nome completo', nome_completo_en: 'nome em inglês', descricao: 'descrição',
    descricao_en: 'descrição em inglês', fundadores: 'fundadores', contato: 'contato', endereco: 'endereço',
    redes: 'redes', sites: 'sites', nucleos: 'núcleos' };
  for (const [k, n] of Object.entries(nomes)) if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) out.push(n);
  return out;
}

// ---- rotas ----------------------------------------------------------------

export default {
  async fetch(request, env) {
    const CORS = cors();
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
    const erro = (msg, status) => json({ error: msg }, status);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const { pathname } = new URL(request.url);
    if (!autorizado(request, env)) return erro('senha incorreta', 401);

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

          const r = await fetch(GH, {
            method: 'PUT',
            headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Dados: ${lista.join(', ')} (pelo Universo)`,
              content: paraBase64(JSON.stringify(novo, null, 2) + '\n'),
              sha: atual.sha,
              branch: 'main',
            }),
          });
          if (r.status === 409) return json({ error: 'conflito', ...(await lerMarca(env)) }, 409);
          if (!r.ok) return erro(`GitHub respondeu ${r.status} ao gravar`, 502);
          const j = await r.json();
          return json({ dados: novo, sha: j.content.sha, commit: j.commit.html_url, mudou: lista });
        }
        return erro('método não aceito', 405);
      }
      return erro('rota não encontrada', 404);
    } catch (e) {
      return erro(e.message || 'erro no servidor', 500);
    }
  },
};
