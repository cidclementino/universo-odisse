// Universo — componentes da interface v2 (Cid, 24/11/2026).
//
// Um código só por padrão: as páginas chamam estas funções e não desenham as peças de novo. Mudou aqui (ou no
// base/v2/universo.css), mudou em todas as páginas que usam. Variação é opção da função, nunca CSS da página.
//
//   import { montarCasca, numeros, segmentado, secao, lista, bandeja, nome, etiqueta, quando, acao, medidor,
//            gaveta, toque, icone, esc } from 'https://universo.odisse.com.br/base/v2/componentes.js';
//
// Peças (nomes do catálogo, Biblioteca › Padrões de interface):
//   Casca      menu lateral (por função, lido de ferramentas.json › menu) + topo (busca) + painel. Lembra se está recolhido.
//   Números    os big numbers lado a lado; cada um pode ser um botão de recorte (aria-pressed) ou um link.
//   Segmentado filtra o mesmo conteúdo (não troca de página; para isso, Abas).
//   Seção      título + contagem + o que vai ao lado (segmentado, link).
//   Lista      régua + grupos + linhas de 42 px, numa Bandeja; colunas por grid; o que some no celular é marcado.
//   Gaveta     o detalhe que entra pela direita sobre a página escurecida.
//   Toque      aviso curto no pé ("Publicação confirmada").

const UNIVERSO = 'https://universo.odisse.com.br/';
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- ícones (traço 1,7; 24 × 24)
const P = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  kpis: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  financeiro: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  contatos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2.2.6 3.5 2.4 3.5 5.2"/>',
  funil: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  propostas: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  contratos: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="m12 12 6-6"/>',
  precos: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  tabela: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M3 14h18M9 9v11"/>',
  pgt: '<path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/>',
  projetos: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  horas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  catalogo: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  estrategia: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  publicacoes: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-5-5L5 21"/>',
  perfil: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M8 8h3M8 12h3M8 16h3M2 21h20"/>',
  biblioteca: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>',
  emitir: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  recolher: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>',
  seta: '<path d="M9 6l6 6-6 6"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  trocar: '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  ok: '<path d="m5 12 5 5L19 7"/>',
  fora: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
export function icone(nome, tam = 16, traco = 1.7) {
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] || ''}</svg>`;
}

// ---------------------------------------------------------------- peças pequenas
const AREAS = { comercial: 'Comercial', producao: 'Produção', marketing: 'Marketing', gestao: 'Gestão' };
export const etiqueta = (texto, area = '') => `<span class="ui-etq${area ? ' is-' + area : ''}">${esc(texto || AREAS[area] || '')}</span>`;
// tom: atraso · atencao · ok · hora · (neutro)
export const quando = (texto, tom = '') => `<span class="ui-quando${tom ? ' is-' + tom : ''}">${esc(texto)}</span>`;
export const nome = (titulo, { area = '', contexto = '' } = {}) =>
  `<span class="ui-nome"><b>${esc(titulo)}</b>${area ? etiqueta('', area) : ''}${contexto ? `<small>${esc(contexto)}</small>` : ''}</span>`;
export const medidor = (feitas, total) => `<span class="ui-medidor"><span class="ui-barra"><i style="width:${total ? Math.round((100 * feitas) / total) : 0}%"></i></span><small>${feitas}/${total}</small></span>`;
const dados = (d = {}) => Object.entries(d).map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join('');
// ação de linha: link (href) ou botão (dados). principal = a mais urgente da lista (uma só).
export function acao(texto, { href = '', principal = false, dados: d = {}, novaAba = false, desligada = false } = {}) {
  const cls = `ui-acao${principal ? ' is-principal' : ''}`;
  if (href) return `<a class="${cls}" href="${esc(href)}"${novaAba ? ' target="_blank" rel="noopener"' : ''}${dados(d)}>${esc(texto)}</a>`;
  return `<button type="button" class="${cls}"${dados(d)}${desligada ? ' disabled' : ''}>${esc(texto)}</button>`;
}
export const link = (texto, href) => `<a class="ui-link" href="${esc(href)}">${esc(texto)}${icone('seta', 12, 2.2)}</a>`;

// ---------------------------------------------------------------- cabeçalho, números, segmentado, seção
export const cabecalho = (titulo, dado = '', lado = '') =>
  `<header class="ui-cab"><div><h1 class="ui-titulo">${esc(titulo)}</h1>${dado ? `<p class="ui-cab__dado">${dado}</p>` : ''}</div>${lado}</header>`;

// [{ id, rotulo, valor | valorHtml, sufixo, apoio (html), tom: 'problema', ativo, href }] · { estatico: true } = só leitura
// Com id e sem href, o número é um botão de recorte (aria-pressed); com href, um link; estático, um bloco.
export function numeros(lista, { estatico = false } = {}) {
  return `<div class="ui-numeros" style="--ui-n:${lista.length}">${lista.map((n) => {
    const val = n.valorHtml ?? esc(n.valor ?? '—');
    const dentro = `<span class="ui-numero__dentro"><span class="ui-numero__rot">${esc(n.rotulo)}</span>
      <span class="ui-numero__val">${val}${n.sufixo ? ` <small>${esc(n.sufixo)}</small>` : ''}</span></span>
      <span class="ui-numero__apoio">${n.apoio || '&nbsp;'}</span>`;
    const cls = `ui-numero${n.valor == null && n.valorHtml == null ? ' is-vazio' : ''}${n.tom ? ' is-' + n.tom : ''}${estatico && !n.href ? ' is-estatico' : ''}`;
    if (n.href) return `<a class="${cls}" href="${esc(n.href)}">${dentro}</a>`;
    if (estatico || !n.id) return `<div class="${cls}">${dentro}</div>`;
    return `<button type="button" class="${cls}" data-numero="${esc(n.id)}" aria-pressed="${n.ativo ? 'true' : 'false'}">${dentro}</button>`;
  }).join('')}</div>`;
}

// [{ id, rotulo, n }] · atual · nome (para data-segmentado)
export const segmentado = (opcoes, atual, nomeGrupo, rotulo = '') => `<div class="ui-segmentado" role="group"${rotulo ? ` aria-label="${esc(rotulo)}"` : ''}>${opcoes.map((o) =>
  `<button type="button" data-segmentado="${esc(nomeGrupo)}" data-valor="${esc(o.id)}" aria-pressed="${o.id === atual ? 'true' : 'false'}">${esc(o.rotulo)}${o.n != null ? ` <small>${o.n}</small>` : ''}</button>`).join('')}</div>`;

// Abas: trocam de página (Perfil › Empresa | Equipe…; KPIs › Painel | Metas). O nome da seção fica à esquerda.
// [{ href, rotulo, ativa }]
export const abas = (secaoNome, itens) => `<nav class="ui-abas" aria-label="${esc(secaoNome)}"><span class="ui-abas__rot">${esc(secaoNome)}</span><span class="ui-abas__caixa">${itens.map((i) =>
  `<a href="${esc(i.href)}"${i.ativa ? ' aria-current="page"' : ''}>${esc(i.rotulo)}</a>`).join('')}</span></nav>`;

export const recorte = (texto, dadosFechar = {}) => `<span class="ui-recorte">${esc(texto)}<button type="button" aria-label="Tirar o recorte"${dados(dadosFechar)}>${icone('fechar', 12, 2.4)}</button></span>`;

export const secao = ({ titulo, n = null, lado = '', corpo = '', id = '', classe = 'ui-secao' }) => `<section${classe ? ` class="${esc(classe)}"` : ''}${id ? ` id="${esc(id)}"` : ''}>
  <div class="ui-secao__cab"><h2 class="ui-secao__tit">${esc(titulo)}${n != null ? ` <small>${esc(n)}</small>` : ''}</h2>${lado ? `<div class="ui-secao__lado">${lado}</div>` : ''}</div>
  ${corpo}</section>`;

export const bandeja = (html, { cartao = true, estilo = '' } = {}) => `<div class="ui-bandeja">${cartao ? `<div class="ui-cartao"${estilo ? ` style="${esc(estilo)}"` : ''}>${html}</div>` : html}</div>`;

// ---------------------------------------------------------------- lista
// colunas: '22px minmax(0,1fr) 112px 160px' · colunasCelular: idem no celular
// regua: [{ texto, celular: false, fim }] · grupos: [{ nome, n, linhas }] ou linhas: [...]
// linha: { celulas: [{ html, celular: false, fim }], abre (id para a Gaveta), href, feita, sel }
export function lista({ colunas, colunasCelular = '', regua = null, grupos = null, linhas = null, vazio = 'Nada aqui.' }) {
  const cel = (c) => `<div${c.celular === false ? ' data-celular="nao"' : ''}${c.fim ? ' class="ui-lista__fim"' : ''}>${c.html ?? ''}</div>`;
  const umaLinha = (l) => {
    const cls = `ui-lista__linha${l.feita ? ' is-feita' : ''}${l.sel ? ' is-sel' : ''}`;
    const corpo = l.celulas.map(cel).join('');
    if (l.href) return `<a class="${cls}" href="${esc(l.href)}">${corpo}</a>`;
    return `<div class="${cls}"${l.abre ? ` data-abre="${esc(l.abre)}" tabindex="0"` : ''}>${corpo}</div>`;
  };
  const gs = grupos || [{ nome: '', linhas: linhas || [] }];
  const total = gs.reduce((t, g) => t + g.linhas.length, 0);
  const estilo = `--ui-colunas:${colunas};${colunasCelular ? `--ui-colunas-celular:${colunasCelular};` : ''}`;
  return `<div class="ui-lista" style="${esc(estilo)}">
    ${regua ? `<div class="ui-lista__regua">${regua.map((r) => cel({ html: esc(r.texto), celular: r.celular, fim: r.fim })).join('')}</div>` : ''}
    ${total ? gs.filter((g) => g.linhas.length).map((g) => (g.nome ? `<div class="ui-lista__grupo">${esc(g.nome)}${g.n != null ? ` <small>${g.n}</small>` : ''}</div>` : '') + g.linhas.map(umaLinha).join('')).join('')
      : `<div class="ui-lista__vazio">${esc(vazio)}</div>`}
  </div>`;
}
export const marcador = (feito, { hora = false, rotulo = '', id = '' } = {}) =>
  `<button type="button" class="ui-check${hora ? ' is-hora' : ''}" aria-pressed="${feito ? 'true' : 'false'}" aria-label="${esc(feito ? 'Desmarcar: ' : 'Marcar como feito: ')}${esc(rotulo)}" data-marcar="${esc(id)}">${feito ? icone('ok', 10, 3.4) : ''}</button>`;

// ---------------------------------------------------------------- gaveta
export const gaveta = {
  // { etiqueta: html, titulo, texto, campos: [[rótulo, html]], acoes: html }
  abrir({ etiqueta: etq = '', titulo, texto = '', campos = [], acoes = '' }) {
    gaveta.fechar(true);
    const veu = Object.assign(document.createElement('div'), { className: 'ui-gaveta-veu' });
    const g = document.createElement('aside');
    g.className = 'ui-gaveta'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', titulo);
    g.innerHTML = `<div class="ui-gaveta__dentro">
      <div class="ui-gaveta__topo"><span>${etq}</span><button type="button" class="ui-fechar" data-fechar-gaveta aria-label="Fechar">${icone('fechar', 15, 2)}</button></div>
      <h3>${esc(titulo)}</h3>${texto ? `<p>${esc(texto)}</p>` : ''}
      ${campos.map(([k, v]) => `<div class="ui-campo-ver"><span>${esc(k)}</span><span>${v}</span></div>`).join('')}
      ${acoes ? `<div class="ui-gaveta__acoes">${acoes}</div>` : ''}</div>`;
    veu.addEventListener('click', () => gaveta.fechar());
    g.addEventListener('click', (ev) => { if (ev.target.closest('[data-fechar-gaveta]')) gaveta.fechar(); });
    gaveta._volta = document.activeElement;
    document.body.append(veu, g);
    g.querySelector('[data-fechar-gaveta]').focus();
    gaveta._tecla = (ev) => { if (ev.key === 'Escape') gaveta.fechar(); };
    document.addEventListener('keydown', gaveta._tecla);
    return g;
  },
  fechar(semFoco = false) {
    document.querySelectorAll('.ui-gaveta, .ui-gaveta-veu').forEach((el) => el.remove());
    if (gaveta._tecla) document.removeEventListener('keydown', gaveta._tecla);
    gaveta._tecla = null;
    if (!semFoco && gaveta._volta?.isConnected) gaveta._volta.focus();
    gaveta.aoFechar?.();
  },
  aoFechar: null,
};

// ---------------------------------------------------------------- toque
export function toque(texto) {
  let el = document.querySelector('.ui-toque');
  if (!el) { el = Object.assign(document.createElement('div'), { className: 'ui-toque' }); el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = texto; el.classList.add('is-on');
  clearTimeout(toque.t); toque.t = setTimeout(() => el.classList.remove('is-on'), 1800);
}

// ---------------------------------------------------------------- casca
const RECOLHIDO = 'universo:menu-recolhido';
const lembrar = { ler: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, gravar: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// Monta o menu lateral, o topo e o painel em volta do conteúdo da página.
//   conteudo: o elemento que vai para o painel (o <main> da página)
//   hub: true quando a página é o próprio Universo (rotas por #/…); nas ferramentas, os links vão para o Universo
//   atual: id do item do menu (sem ele, descobre pela rota do hub ou pelo endereço da ferramenta)
//   mapa: ferramentas.json já lido (senão, lê do Universo) · aoSair: () => {} (mostra "Sair" no pé)
// Devolve { contar({ id: n | { n, tipo: 'novo'|'alerta' } }), arvore(id, [{ nome, cod, href }]), marcar(atual) }
export async function montarCasca({ conteudo, hub = false, atual = '', mapa = null, aoSair = null, pessoa = { nome: 'Equipe Odisse', papel: 'Universo' } } = {}) {
  mapa ||= await fetch(UNIVERSO + 'ferramentas.json', { cache: 'no-cache' }).then((r) => r.json());
  const M = mapa.menu;
  const itens = Object.fromEntries(mapa.itens.map((i) => [i.id, i]));
  const destino = (m) => {
    if (m.rota) return hub ? `#/${m.rota === 'inicio' ? '' : m.rota}` : `${UNIVERSO}#/${m.rota === 'inicio' ? '' : m.rota}`;
    return m.url || itens[m.id]?.url || '';
  };
  const todos = [...M.topo, ...M.grupos.flatMap((g) => g.itens), M.emitir];
  const item = (m) => {
    const href = destino(m);
    if (!href) return '';
    return `<a class="ui-menu__item" href="${esc(href)}" data-menu="${esc(m.id)}">${icone(m.icone)}<span class="ui-menu__rot">${esc(m.nome)}</span><span class="ui-menu__cont" data-cont="${esc(m.contagem || m.id)}" hidden></span></a>${m.arvore ? `<div class="ui-menu__arvore" data-arvore="${esc(m.arvore)}" hidden></div>` : ''}`;
  };

  document.body.classList.add('ui-casca-on');
  const app = document.createElement('div');
  app.className = 'ui-app' + (lembrar.ler(RECOLHIDO) === '1' ? ' is-recolhido' : '');
  app.innerHTML = `
    <nav class="ui-menu" aria-label="Menu do Universo">
      <div class="ui-menu__topo">
        <a class="ui-espaco" href="${esc(hub ? '#/' : UNIVERSO)}" aria-label="Odisse, Universo: Início">
          <span class="ui-espaco__marca"><span></span></span>
          <span class="ui-dupla"><b>Odisse</b><small>Universo · Estúdio</small></span>
        </a>
        <button type="button" class="ui-icone" data-casca="recolher" aria-label="Recolher ou abrir o menu">${icone('recolher')}</button>
      </div>
      <div class="ui-menu__rolagem">
        ${M.topo.map(item).join('')}
        ${M.grupos.map((g) => `<div class="ui-menu__grupo">${esc(g.nome)}</div>${g.itens.map(item).join('')}`).join('')}
      </div>
      <div class="ui-menu__pe">
        <a class="ui-emitir" href="${esc(destino(M.emitir))}" data-menu="${esc(M.emitir.id)}">${icone('emitir')}<span class="ui-menu__rot">${esc(M.emitir.nome)}</span></a>
        <div class="ui-pessoa"><span class="ui-avatar">${esc(pessoa.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase())}</span>
          <span class="ui-dupla"><b>${esc(pessoa.nome)}</b><small>${esc(pessoa.papel)}</small></span>
          ${aoSair ? `<button type="button" class="ui-icone" data-casca="sair" aria-label="Sair do Universo" title="Sair">${icone('sair')}</button>` : ''}</div>
      </div>
    </nav>
    <div class="ui-veu-menu" data-casca="fechar-menu"></div>
    <div class="ui-direita">
      <header class="ui-topo">
        <span><button type="button" class="ui-icone ui-so-celular" data-casca="abrir-menu" aria-label="Abrir o menu">${icone('menu', 18, 1.8)}</button></span>
        <button type="button" class="ui-busca" data-casca="buscar">${icone('busca', 15, 1.8)}<span>Ir para… contatos, propostas, projetos, posts</span><kbd>Ctrl K</kbd></button>
        <span class="ui-topo__fim"></span>
      </header>
      <main class="ui-painel"></main>
    </div>`;
  document.body.prepend(app);
  app.querySelector('.ui-painel').appendChild(conteudo);

  function marcar(id) {
    app.querySelectorAll('.ui-menu [aria-current="page"]').forEach((a) => a.removeAttribute('aria-current'));
    if (id) app.querySelector(`[data-menu="${CSS.escape(id)}"]`)?.setAttribute('aria-current', 'page');
  }
  function descobrir() {
    if (atual) return atual;
    if (hub) {
      const r = (location.hash.match(/^#\/([^/?]+)/) || [])[1] || 'inicio';
      return todos.find((m) => m.rota === r || (m.rotas || []).includes(r))?.id || '';
    }
    const aqui = (location.host + location.pathname).replace(/\/$/, '');
    let melhor = ''; let tam = 0;
    for (const m of todos) for (const h of m.hosts || itens[m.id]?.hosts || []) if (aqui.startsWith(h.replace(/\/$/, '')) && h.length > tam) { melhor = m.id; tam = h.length; }
    return melhor;
  }
  marcar(descobrir());
  if (hub) window.addEventListener('hashchange', () => marcar(descobrir()));

  app.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-casca]');
    if (b) {
      const q = b.dataset.casca;
      if (q === 'recolher') { app.classList.toggle('is-recolhido'); lembrar.gravar(RECOLHIDO, app.classList.contains('is-recolhido') ? '1' : '0'); }
      if (q === 'abrir-menu') app.classList.add('is-menu-aberto');
      if (q === 'fechar-menu') app.classList.remove('is-menu-aberto');
      if (q === 'sair') aoSair?.();
      if (q === 'buscar') abrirBusca();
      return;
    }
    if (ev.target.closest('.ui-menu a')) app.classList.remove('is-menu-aberto');
  });
  document.addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); abrirBusca(); } });

  // Ir para (Ctrl K): todos os destinos do menu, filtrados enquanto se digita; Enter abre o primeiro.
  function abrirBusca() {
    const lugares = [...M.topo.map((m) => [m, '']), ...M.grupos.flatMap((g) => g.itens.map((m) => [m, g.nome])), [M.emitir, 'Estúdio'],
      ...mapa.itens.filter((i) => i.url && i.status !== 'em-breve' && !todos.some((m) => m.id === i.id)).map((i) => [{ id: i.id, nome: i.nome, icone: 'seta', url: i.url }, 'Outros'])];
    const desenhar = (q) => {
      const n = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const f = lugares.filter(([m, g]) => !q || n(m.nome + ' ' + g).includes(n(q))).slice(0, 12);
      return f.map(([m, g], i) => `<a class="ui-lista__linha" href="${esc(destino(m))}" data-ir${i === 0 ? ' data-primeiro' : ''}><span class="ui-nome">${icone(m.icone)}<b>${esc(m.nome)}</b><small>${esc(g)}</small></span></a>`).join('')
        || '<div class="ui-lista__vazio">Nada com esse nome.</div>';
    };
    const g = gaveta.abrir({ titulo: 'Ir para', campos: [] });
    g.querySelector('h3').insertAdjacentHTML('afterend', `<input type="search" class="ui-busca-campo" placeholder="Digite o nome da página ou ferramenta" aria-label="Ir para"
      style="width:100%;box-sizing:border-box;height:36px;border:1px solid var(--ui-linha-forte);border-radius:8px;padding:0 12px;font:13px var(--ui-fonte);margin:4px 0 12px">
      <div class="ui-lista" style="--ui-colunas:minmax(0,1fr)" data-resultados>${desenhar('')}</div>`);
    const campo = g.querySelector('input');
    campo.addEventListener('input', () => { g.querySelector('[data-resultados]').innerHTML = desenhar(campo.value); });
    campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { const a = g.querySelector('[data-primeiro]'); if (a) { a.click(); } } });
    g.addEventListener('click', (ev) => { if (ev.target.closest('[data-ir]')) gaveta.fechar(true); });
    campo.focus();
  }

  return {
    app,
    marcar,
    contar(mapaContagens) {
      for (const [id, v] of Object.entries(mapaContagens)) {
        const el = app.querySelector(`[data-cont="${CSS.escape(id)}"]`);
        if (!el) continue;
        const n = typeof v === 'object' && v ? v.n : v;
        el.hidden = !n;
        el.textContent = n || '';
        el.className = 'ui-menu__cont' + (v?.tipo ? ' is-' + v.tipo : '');
        if (v?.rotulo) el.setAttribute('aria-label', v.rotulo); else el.removeAttribute('aria-label');
      }
    },
    arvore(id, lista) {
      const el = app.querySelector(`[data-arvore="${CSS.escape(id)}"]`);
      if (!el) return;
      el.hidden = !lista?.length;
      el.innerHTML = (lista || []).map((x) => `<a href="${esc(x.href)}"><span>${esc(x.nome)}</span><span>${esc(x.cod || '')}</span></a>`).join('');
    },
  };
}
