// ==========================================================================
// Peças comuns das telas do comercial (Funil e Contatos): listas fixas,
// formatos, painel lateral, busca de contatos, CEP e avisos.
// Depende de store.js (Universo, escHtml, centavos) e comercial.js (Comercial).
// ==========================================================================

const TIPOS_INTERACAO = [
  { id: 'mensagem', nome: 'Mensagem' }, { id: 'ligacao', nome: 'Ligação' }, { id: 'reuniao', nome: 'Reunião' },
  { id: 'email', nome: 'E-mail' }, { id: 'visita', nome: 'Visita' }
];
const PAPEIS_ATUACAO = [
  { id: 'contato', nome: 'Contato' }, { id: 'socio', nome: 'Sócio(a)' }, { id: 'funcionario', nome: 'Funcionário(a)' },
  { id: 'representante', nome: 'Representante' }, { id: 'vendedor', nome: 'Vendedor(a)' }, { id: 'atendente', nome: 'Atendente' }
];
const TIPOS_ORG = [
  { id: 'empresa', nome: 'Empresa' }, { id: 'escritorio', nome: 'Escritório' },
  { id: 'orgao_publico', nome: 'Órgão público' }, { id: 'outro', nome: 'Outro' }
];
const PAPEIS_NA_OPORTUNIDADE = { titular: 'titular', cocliente: 'co-cliente', contato: 'contato' };

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

// Links de contato (WhatsApp, e-mail, Instagram, site) de uma pessoa ou organização.
function meiosDeContato(c) {
  if (!c) return '';
  const tel = (n) => escHtml(String(n).replace(/\D/g, ''));
  return [
    c.whatsapp ? `<a href="https://wa.me/${tel(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp ${escHtml(Comercial.fmtTel(c.whatsapp))}</a>` : '',
    c.telefone && c.telefone !== c.whatsapp ? `<a href="tel:+${tel(c.telefone)}">Tel. ${escHtml(Comercial.fmtTel(c.telefone))}</a>` : '',
    c.email ? `<a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a>` : '',
    c.instagram ? `<a href="https://instagram.com/${escHtml(String(c.instagram).replace(/^@/, ''))}" target="_blank" rel="noopener">@${escHtml(String(c.instagram).replace(/^@/, ''))}</a>` : '',
    c.site ? `<a href="${escHtml(c.site)}" target="_blank" rel="noopener">${escHtml(String(c.site).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : ''
  ].filter(Boolean).join('<span class="sep">·</span>');
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
