// ==========================================================================
// Histórico antigo (KV do Worker do vendas). Desde a migração ao Universo
// (nov/2026) as propostas são numeradas e guardadas no Universo; o KV fica
// só para leitura, usado pela página de migração (migrar.html).
// ==========================================================================

const OdisseStore = (() => {
  async function chamar(caminho, opcoes = {}) {
    const res = await fetch(`${CONFIG.workerUrl}${caminho}`, { ...opcoes, headers: cabecalhosAuth(opcoes.headers) });
    if (res.status === 401) {
      senhaRecusada();
      throw new Error('senha recusada');
    }
    return res;
  }

  async function listarPropostas() {
    const res = await chamar('/listar-propostas');
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  }

  async function buscarProposta(numero) {
    const res = await chamar(`/proposta?numero=${encodeURIComponent(numero)}`);
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    const dados = await res.json();
    return dados.snapshot;
  }

  return { listarPropostas, buscarProposta };
})();

// ==========================================================================
// Universo — banco de dados comum (contatos, oportunidades, propostas, PDFs).
// O navegador fala só com o Worker do vendas (/u/v1/…, com a senha do vendas),
// que repassa à API de dados do Universo. Erros vêm como { erro, ... } e viram
// UniversoErro com .status e .dados (ex.: 409 possivel_duplicado traz .dados.candidatos).
// ==========================================================================

class UniversoErro extends Error {
  constructor(status, dados) {
    super((dados && (dados.detalhe && dados.erro !== 'erro no servidor' ? dados.detalhe : dados.erro)) || `erro ${status}`);
    this.status = status;
    this.dados = dados || {};
  }
}

const Universo = (() => {
  async function chamar(metodo, caminho, corpo, extra = {}) {
    const opcoes = { method: metodo, headers: cabecalhosAuth(extra.headers || {}) };
    if (corpo !== undefined && corpo !== null) {
      if (corpo instanceof Blob || corpo instanceof ArrayBuffer) {
        opcoes.body = corpo;
      } else {
        opcoes.body = JSON.stringify(corpo);
        opcoes.headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(`${CONFIG.workerUrl}/u/v1/${caminho}`, opcoes);
    if (res.status === 401) { senhaRecusada(); throw new UniversoErro(401, { erro: 'senha recusada' }); }
    if (extra.bruto) {
      if (!res.ok) throw new UniversoErro(res.status, await res.json().catch(() => null));
      return res;
    }
    const dados = await res.json().catch(() => null);
    if (!res.ok) throw new UniversoErro(res.status, dados);
    return dados;
  }

  const qs = (o) => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  return {
    get: (caminho, params) => chamar('GET', params ? `${caminho}?${qs(params)}` : caminho),
    post: (caminho, corpo) => chamar('POST', caminho, corpo || {}),
    patch: (caminho, corpo) => chamar('PATCH', caminho, corpo),
    listar: (rota, params) => chamar('GET', `${rota}?${qs(params)}`),
    ler: async (rota, id) => (await chamar('GET', `${rota}/${encodeURIComponent(id)}`)).registro,
    // registro ou null (404)
    talvez: async (rota, id) => {
      try { return (await chamar('GET', `${rota}/${encodeURIComponent(id)}`)).registro; }
      catch (e) { if (e.status === 404) return null; throw e; }
    },
    criar: async (rota, corpo) => (await chamar('POST', rota, corpo)).registro,
    alterar: async (rota, id, corpo) => (await chamar('PATCH', `${rota}/${encodeURIComponent(id)}`, corpo)).registro,
    buscar: (q, tabela) => chamar('GET', `busca?${qs({ q, tabela })}`),
    painel: () => chamar('GET', 'comercial/painel'),
    // lista leve das propostas (página Propostas), de 10 em 10, com o total
    propostas: (params) => chamar('GET', `comercial/propostas?${qs(params)}`),
    // resposta crua (imagens: foto e rubrica da Equipe)
    bruto: (caminho) => chamar('GET', caminho, null, { bruto: true }),

    // Sobe um arquivo (PDF da proposta, contrato…) e devolve o registro já com o conteúdo enviado.
    async enviarArquivo(blob, campos) {
      const reg = (await chamar('POST', 'arquivos', { tipo_mime: blob.type || 'application/octet-stream', tamanho: blob.size, ...campos })).registro;
      await chamar('PUT', `arquivos/${reg.id}/conteudo?variante=g`, blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
      return reg;
    },
    async baixarArquivo(id) {
      const res = await chamar('GET', `arquivos/${encodeURIComponent(id)}/conteudo`, null, { bruto: true });
      return await res.blob();
    }
  };
})();

// ==========================================================================
// Cópias locais (regra de todas as páginas do Universo): a página abre na hora com a última
// cópia e a resposta nova chega por baixo; só redesenha se mudou. Nunca guarda dados sensíveis
// (CPF, rubricas) — só listas e painéis.
//   const r = await comCopia('painel', () => Universo.painel(), (novo) => { …redesenha… });
//   comCopia(chave, buscar, aoMudar, { fresco: true })  → depois de gravar algo: espera o servidor
// ==========================================================================
const COPIA_P = 'vendas:copia:';
function lerCopia(chave) {
  try { const x = JSON.parse(localStorage.getItem(COPIA_P + chave) || 'null'); return x ? x.d : null; } catch (_) { return null; }
}
function gravarCopia(chave, d) {
  try { localStorage.setItem(COPIA_P + chave, JSON.stringify({ em: Date.now(), d })); } catch (_) { /* cheio: segue sem cópia */ }
}
const igualJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function comCopia(chave, buscar, aoMudar, { fresco = false } = {}) {
  const c = fresco ? null : lerCopia(chave);
  const pedido = buscar().then((novo) => {
    gravarCopia(chave, novo);
    if (c && !igualJson(c, novo) && aoMudar) aoMudar(novo);
    return novo;
  });
  if (c) { pedido.catch(() => { /* sem rede: fica a cópia */ }); return c; }
  return pedido;
}

// Baixa um Blob com o nome dado.
function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Valores da API em centavos ↔ reais.
const centavos = (reais) => (reais === null || reais === undefined || reais === '' || Number.isNaN(Number(reais))) ? null : Math.round(Number(reais) * 100);
const fmtCentavos = (c) => (c === null || c === undefined) ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
