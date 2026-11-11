/*
  Barra do Universo — v1
  Uma linha em cada ferramenta liga ela ao hub:

    <script src="https://universo.odisse.com.br/base/v1/barra.js" defer></script>

  Onde a barra aparece:
    - <div data-universo-barra></div>  → barra completa nesse lugar (marca, seções e "Ir para");
    - <span data-universo-menu></span> → só o botão "Universo" com o menu, para ferramentas
      que já têm a própria barra no topo (herda a cor do texto ao redor);
    - nenhum dos dois                   → barra completa no topo da página;
    - <script ... data-auto="nao">      → não insere nada sozinha.

  Seções e itens vêm de ferramentas.json, no próprio hub: mudou lá, muda em todas.
  Os estilos ficam aqui dentro, com prefixo .ub-, para não depender de nada da ferramenta.
  Se o hub estiver fora do ar, nada aparece e a ferramenta segue normalmente.
*/
(() => {
  const script = document.currentScript;
  const HUB = new URL('../../', script.src).href;            // https://universo.odisse.com.br/
  const NO_HUB = location.href.startsWith(HUB);
  const MARCA = 'https://marca.odisse.com.br/';

  const css = `
  /* três colunas: marca à esquerda, seções no centro exato da página, menu à direita */
  .ub-barra { box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center; column-gap: 20px; height: 48px; padding: 0 16px; background: #3F4B57; color: #FAFAF7;
    font: 500 13px/1 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
  .ub-barra *, .ub-menu * { box-sizing: border-box; }
  .ub-barra > [data-ub-menu] { justify-self: end; }
  .ub-casa { justify-self: start; display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; min-width: 0; }
  /* logo oficial: selo da mão + logotipo ODISSE, desenhados em currentColor a partir da marca */
  .ub-selo { flex: none; width: 17px; height: 28px; background: currentColor;
    -webkit-mask: url(${MARCA}selos/mao.svg) center / contain no-repeat; mask: url(${MARCA}selos/mao.svg) center / contain no-repeat; }
  .ub-logotipo { flex: none; width: 66px; height: 14px; background: currentColor;
    -webkit-mask: url(${MARCA}logos/logotipo-odisse.svg) center / contain no-repeat; mask: url(${MARCA}logos/logotipo-odisse.svg) center / contain no-repeat; }
  .ub-sub { font-size: 10.5px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; opacity: .6;
    padding-left: 10px; border-left: 1px solid rgba(255,255,255,.25); white-space: nowrap; }
  .ub-secoes { position: relative; display: flex; align-items: stretch; height: 100%; gap: 2px; overflow-x: auto; scrollbar-width: none; min-width: 0; }
  .ub-secoes::-webkit-scrollbar { display: none; }
  .ub-secoes a { display: flex; align-items: center; padding: 0 12px; color: inherit; text-decoration: none; white-space: nowrap;
    opacity: .78; border-bottom: 2px solid transparent; border-top: 2px solid transparent; }
  .ub-secoes a:hover { opacity: 1; }
  .ub-secoes a.ub-ativo { opacity: 1; font-weight: 600; border-bottom-color: currentColor; }
  .ub-menu { position: relative; display: inline-flex; color: inherit; flex: none;
    font: 500 13px/1 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .ub-botao { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 6px;
    border: 1px solid rgba(127,127,127,.45); border-color: color-mix(in srgb, currentColor 30%, transparent);
    background: transparent; color: inherit; font: inherit; cursor: pointer; white-space: nowrap; }
  .ub-botao:hover, .ub-botao[aria-expanded="true"] { background: color-mix(in srgb, currentColor 12%, transparent); }
  .ub-botao svg { width: 10px; height: 10px; }
  .ub-painel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 2147483000; width: 340px; max-width: calc(100vw - 24px);
    max-height: 75vh; overflow-y: auto; background: #FAFAF7; color: #3F4B57; border: 1px solid #D7DADD; border-radius: 8px;
    box-shadow: 0 12px 32px rgba(46,48,54,.18); padding: 8px; text-align: left; }
  .ub-painel[hidden] { display: none; }
  .ub-cab { font-size: 10.5px; font-weight: 650; letter-spacing: .09em; text-transform: uppercase; opacity: .6; padding: 10px 10px 4px; }
  .ub-secs { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 6px 8px; border-bottom: 1px solid #D7DADD; margin-bottom: 4px; }
  .ub-secs a { padding: 6px 9px; border-radius: 6px; color: inherit; text-decoration: none; font-weight: 600; font-size: 12.5px; background: #E6E8EB; }
  .ub-secs a:hover { background: #3F4B57; color: #FAFAF7; }
  .ub-item { display: block; padding: 7px 10px; border-radius: 6px; color: inherit; text-decoration: none; }
  .ub-item:hover { background: #E6E8EB; }
  .ub-item b { display: block; font-weight: 600; font-size: 13px; }
  .ub-item small { display: block; font-size: 12px; line-height: 1.35; opacity: .7; font-weight: 400; margin-top: 2px; }
  .ub-item.ub-ativo { background: #E6E8EB; }
  /* telas estreitas: sem espaço para centrar, as seções ocupam o meio e rolam */
  @media (max-width: 860px) { .ub-sub { display: none; } }
  @media (max-width: 640px) { .ub-barra { grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 10px; }
    .ub-logotipo { display: none; } }
  `;

  const seta = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linkSecao = (id) => (NO_HUB ? '#/' : HUB + '#/') + (id === 'inicio' ? '' : id);

  function itemAtual(itens) {
    // o endereço mais específico vence (ex.: odisse.com.br/admin)
    const aqui = (location.host + location.pathname).replace(/^www\./, '');
    let melhor = null, tam = -1;
    for (const f of itens) for (const h of f.hosts || []) {
      const alvo = h.replace(/^www\./, '');
      if (aqui.startsWith(alvo) && alvo.length > tam) { melhor = f; tam = alvo.length; }
    }
    return melhor;
  }

  function secaoAtual(dados, item) {
    if (NO_HUB) {
      const id = (location.hash.match(/^#\/([^/?]+)/) || [])[1];
      return dados.secoes.some((s) => s.id === id) ? id : 'inicio';
    }
    return item ? item.secao : null;
  }

  function montarMenu(raiz, dados, item, comSecoes) {
    raiz.classList.add('ub-menu');
    raiz.innerHTML = `<button type="button" class="ub-botao" aria-haspopup="true" aria-expanded="false">${comSecoes ? 'Universo' : 'Ir para'} ${seta}</button>
      <div class="ub-painel" hidden></div>`;
    const botao = raiz.querySelector('.ub-botao');
    const painel = raiz.querySelector('.ub-painel');

    // só o que tem endereço e está no ar: o menu é para ir, não para listar planos
    const prontos = dados.itens.filter((f) => f.url && f.status !== 'em-breve');
    const blocos = dados.secoes.map((s) => {
      const daSecao = prontos.filter((f) => f.secao === s.id);
      if (!daSecao.length) return '';
      return `<div class="ub-cab">${esc(s.nome)}</div>` + daSecao.map((f) => {
        const ativo = item && item.id === f.id ? ' ub-ativo' : '';
        return `<a class="ub-item${ativo}" href="${esc(f.url)}"><b>${esc(f.nome)}</b><small>${esc(f.descricao)}</small></a>` +
          (f.extra || []).map((x) => `<a class="ub-item" href="${esc(x.url)}"><b>${esc(x.nome)}</b></a>`).join('');
      }).join('');
    }).join('');

    painel.innerHTML = (comSecoes
      ? `<div class="ub-secs">${dados.secoes.map((s) => `<a href="${linkSecao(s.id)}">${esc(s.nome)}</a>`).join('')}</div>`
      : '') + blocos;

    const fechar = () => { painel.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
    botao.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = painel.hidden;
      painel.hidden = !abrir; botao.setAttribute('aria-expanded', String(abrir));
    });
    painel.addEventListener('click', (e) => { if (e.target.closest('a')) fechar(); });
    document.addEventListener('click', (e) => { if (!raiz.contains(e.target)) fechar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  }

  function montarBarra(raiz, dados, item) {
    raiz.classList.add('ub-barra');
    raiz.innerHTML = `<a class="ub-casa" href="${linkSecao('inicio')}"><span class="ub-selo" aria-hidden="true"></span>
        <span class="ub-logotipo" role="img" aria-label="Odisse"></span><span class="ub-sub">Universo</span></a>
      <nav class="ub-secoes" aria-label="Seções do Universo">${dados.secoes.map((s) =>
        `<a href="${linkSecao(s.id)}" data-secao="${s.id}">${esc(s.nome)}</a>`).join('')}</nav>
      <span data-ub-menu></span>`;
    montarMenu(raiz.querySelector('[data-ub-menu]'), dados, item, false);

    const marcar = () => {
      const atual = secaoAtual(dados, item);
      raiz.querySelectorAll('.ub-secoes a').forEach((a) => a.classList.toggle('ub-ativo', a.dataset.secao === atual));
      // em telas estreitas a faixa de seções rola: traz a ativa para dentro da vista
      const nav = raiz.querySelector('.ub-secoes'), a = nav.querySelector('.ub-ativo');
      if (a && (a.offsetLeft + a.offsetWidth > nav.scrollLeft + nav.clientWidth || a.offsetLeft < nav.scrollLeft)) {
        nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
      }
    };
    marcar();
    window.addEventListener('hashchange', marcar);
  }

  async function iniciar() {
    let dados;
    try { dados = await fetch(HUB + 'ferramentas.json', { cache: 'no-cache' }).then((r) => r.json()); }
    catch { return; }

    const estilo = document.createElement('style');
    estilo.textContent = css;
    document.head.appendChild(estilo);

    const item = itemAtual(dados.itens);
    const menus = document.querySelectorAll('[data-universo-menu]');
    const barras = document.querySelectorAll('[data-universo-barra]');
    menus.forEach((el) => montarMenu(el, dados, item, true));
    barras.forEach((el) => montarBarra(el, dados, item));

    if (!menus.length && !barras.length && script.dataset.auto !== 'nao') {
      const el = document.createElement('div');
      document.body.prepend(el);
      montarBarra(el, dados, item);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
