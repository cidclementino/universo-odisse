// ==========================================================================
// Peças comuns das telas de Projetos: cliente da API do Universo (pelo Worker
// desta ferramenta, /u/v1/…), formatos, painel lateral, busca, CEP e avisos.
// Adaptado de odisse-orcamentos (store.js e ui.js), para as ferramentas ficarem iguais.
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
    // Leitura com cache neste computador: chama aoChegar já com o que estava guardado (se houver) e de novo
    // quando a resposta do Universo chega, se ela mudou. soNovo: ignora o guardado (depois de gravar algo).
    async lerComCache(caminho, aoChegar, { soNovo = false } = {}) {
      const chave = 'cache:' + caminho;
      let guardado = null;
      if (!soNovo) { try { guardado = localStorage.getItem(chave); } catch (_) { /* sem armazenamento */ } }
      if (guardado) { try { aoChegar(JSON.parse(guardado)); } catch (_) { guardado = null; } }
      try {
        const novo = await chamar('GET', caminho);
        const texto = JSON.stringify(novo);
        try { localStorage.setItem(chave, texto); } catch (_) { /* cheio: segue sem cache */ }
        if (texto !== guardado) aoChegar(novo);
        return novo;
      } catch (e) {
        if (guardado) return JSON.parse(guardado);   // sem rede: fica o guardado
        throw e;
      }
    },
    criar: async (rota, corpo) => (await chamar('POST', rota, corpo)).registro,
    alterar: async (rota, id, corpo) => (await chamar('PATCH', `${rota}/${encodeURIComponent(id)}`, corpo)).registro,
    buscar: (q, tabela) => chamar('GET', `busca?${qs({ q, tabela })}`),
    painel: () => chamar('GET', 'comercial/painel'),

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

const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const fmtDia = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
const fmtData = (d) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '';
const opcoes = (lista, atual, vazio) => (vazio !== undefined ? `<option value="">${vazio}</option>` : '') +
  lista.map(x => `<option value="${x.id}" ${x.id === atual ? 'selected' : ''}>${escHtml(x.nome)}</option>`).join('');
const reaisDe = (c) => c === null || c === undefined ? '' : String(c / 100).replace('.', ',');
const lerReais = (s) => { const t = String(s || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'); return t ? centavos(t) : null; };
const ehOrg = (id) => String(id || '').startsWith('org_');
// sem acento e em minúsculas, para filtrar listas
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Mensagem de erro legível a partir de um UniversoErro (inclui os erros de validação, 422).
function mensagemDe(e) {
  if (e && e.dados && Array.isArray(e.dados.erros) && e.dados.erros.length) return e.dados.erros.join(' · ');
  if (e && e.status === 409 && e.dados && e.dados.erro === 'conflito') return 'Alguém mudou este cadastro enquanto você editava. Recarreguei; confira e salve de novo.';
  return (e && e.message) || 'erro desconhecido';
}

// Telefone legível: 5583999990001 → (83) 99999-0001
const fmtTel = (d) => {
  const n = String(d || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
};

// Minutos ↔ "2h30"; aceita "2:30", "2h30", "2,5", "150m", "90" (minutos se terminar em m, senão horas)
const fmtMin = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r}min`; };
function lerDuracao(s) {
  const t = String(s || '').trim().toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  let m = t.match(/^(\d+)[:h](\d{1,2})?(?:min|m)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  m = t.match(/^(\d+)(?:min|m)$/);
  if (m) return Number(m[1]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

// ---------------------------------------------------------------- painel lateral

let aoFecharPainel = null;
function fecharPainel() {
  document.getElementById('painel-raiz').innerHTML = '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const f = aoFecharPainel; aoFecharPainel = null;
  if (f) f();
}

function abrirPainel(html, { aoFechar = null } = {}) {
  aoFecharPainel = aoFechar;
  const raiz = document.getElementById('painel-raiz');
  raiz.innerHTML = `<div class="painel-fundo"></div><aside class="painel" role="dialog">${html}</aside>`;
  raiz.querySelector('.painel-fundo').onclick = fecharPainel;
  raiz.querySelectorAll('.painel__fechar').forEach(b => b.onclick = fecharPainel);
  return raiz.querySelector('.painel');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.querySelector('#painel-raiz .painel')) fecharPainel();
});

// Aviso dentro de um elemento: devolve a função (texto, tipo).
function avisoEm(el) {
  return (t, tipo = 'erro') => { el.innerHTML = t ? `<div class="aviso aviso--${tipo}">${escHtml(t)}</div>` : ''; };
}

// ---------------------------------------------------------------- busca de contatos
// Liga um campo de busca a uma lista de resultados (pessoas e/ou organizações do Universo).
//   aoEscolher({ id, titulo, tabela })   — clique num resultado
//   criarNovo(texto)                     — opcional: oferece "Cadastrar «texto»" ao fim da lista
//   ignorar: ids que não devem aparecer
function ligarBuscaContatos(input, res, { tabelas = ['pessoas', 'organizacoes'], aoEscolher, criarNovo = null, rotuloNovo = 'Cadastrar', ignorar = [] }) {
  let tempo = null, rodada = 0;
  const limpar = () => { res.innerHTML = ''; };
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', () => {
    clearTimeout(tempo);
    const q = input.value.trim();
    if (q.length < 2) { limpar(); return; }
    const minha = ++rodada;
    tempo = setTimeout(async () => {
      const listas = await Promise.all(tabelas.map(t => Universo.buscar(q, t).then(r => r.itens).catch(() => [])));
      if (minha !== rodada) return;
      const itens = listas.flat().filter(i => !ignorar.includes(i.id));
      res.innerHTML = itens.map((i, n) => `<button type="button" class="busca-res__item" data-n="${n}">${escHtml(i.titulo)}
          ${tabelas.length > 1 ? `<span class="chip">${i.tabela === 'organizacoes' ? 'organização' : 'pessoa'}</span>` : ''}</button>`).join('') +
        (criarNovo ? `<button type="button" class="busca-res__item busca-res__novo" data-novo="1">+ ${escHtml(rotuloNovo)} “${escHtml(q)}”</button>` : '') ||
        '<p class="small muted busca-res__vazio">Nada encontrado.</p>';
      res.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { limpar(); input.value = ''; aoEscolher(itens[Number(b.dataset.n)]); });
      const novo = res.querySelector('[data-novo]');
      if (novo) novo.onclick = () => { limpar(); const t = input.value.trim(); input.value = ''; criarNovo(t); };
    }, 250);
  });
}

// ---------------------------------------------------------------- CEP (ViaCEP)
async function consultarCep(cep) {
  const d = String(cep || '').replace(/\D/g, '');
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' };
  } catch (_) { return null; }
}

// ---------------------------------------------------------------- listas da produção
const SITUACOES_PROJETO = [
  { id: 'ativo', nome: 'Ativo' }, { id: 'pausado', nome: 'Pausado' }, { id: 'concluido', nome: 'Concluído' }, { id: 'cancelado', nome: 'Cancelado' }
];
const SITUACOES_ETAPA = [
  { id: 'prevista', nome: 'Prevista' }, { id: 'em_andamento', nome: 'Em andamento' }, { id: 'em_aprovacao', nome: 'Em aprovação' }, { id: 'concluida', nome: 'Concluída' }
];
const NUCLEOS = [
  { id: 'arquitetos', nome: 'Arquitetos' }, { id: 'estudio', nome: 'Estúdio' }, { id: 'objetos', nome: 'Objetos' }, { id: 'elaia', nome: 'Elaia' }
];
const PAPEIS_EQUIPE = [
  { id: 'socio', nome: 'Sócio(a)' }, { id: 'arquiteto', nome: 'Arquiteto(a)' }, { id: 'estagiario', nome: 'Estagiário(a)' }, { id: 'colaborador', nome: 'Colaborador(a)' }
];
const nomeDe = (lista, id) => (lista.find((x) => x.id === id) || {}).nome || id || '—';
const VENDAS_URL = '/vendas/';
// segunda-feira da semana de um dia AAAA-MM-DD
function segundaDe(dia) {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function somarDias(dia, n) {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const chipSituacao = (s) => `<span class="chip ${s === 'ativo' || s === 'em_andamento' ? 'chip--ok' : s === 'concluido' || s === 'concluida' ? 'chip--cobre' : s === 'cancelado' ? 'chip--perda' : ''}">${escHtml(nomeDe([...SITUACOES_PROJETO, ...SITUACOES_ETAPA], s))}</span>`;
