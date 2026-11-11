/*
  Barra do Universo — v1
  Uma linha em cada ferramenta liga ela ao hub:

    <script src="https://universo.odisse.com.br/base/v1/barra.js" defer></script>

  Onde a barra aparece:
    - <div data-universo-barra></div>  → barra completa nesse lugar;
    - <span data-universo-menu></span> → só o botão "Universo" com o menu, para ferramentas
      que já têm a própria barra no topo (herda a cor do texto ao redor);
    - nenhum dos dois                   → barra completa no topo da página.
    - <script ... data-auto="nao">      → não insere nada sozinha.

  O menu vem de ferramentas.json, no próprio hub: mudou lá, muda em todas.
  Os estilos ficam todos aqui dentro, com prefixo .ub-, para não depender de nada da ferramenta.
*/
(() => {
  const script = document.currentScript;
  const HUB = new URL('../../', script.src).href;           // https://universo.odisse.com.br/
  const MARCA = 'https://marca.odisse.com.br/';

  const css = `
  .ub-barra { box-sizing: border-box; display: flex; align-items: center; gap: 16px; height: 44px;
    padding: 0 16px; background: #3F4B57; color: #FAFAF7;
    font: 500 13px/1 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
  .ub-barra *, .ub-menu * { box-sizing: border-box; }
  .ub-casa { display: flex; align-items: center; gap: 9px; color: inherit; text-decoration: none; }
  .ub-selo { width: 14px; height: 22px; background: currentColor;
    -webkit-mask: url(${MARCA}selos/mao.svg) center / contain no-repeat; mask: url(${MARCA}selos/mao.svg) center / contain no-repeat; }
  .ub-nome { font-weight: 700; font-size: 15px; letter-spacing: -.02em; }
  .ub-sub { font-size: 10.5px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; opacity: .6;
    padding-left: 9px; border-left: 1px solid rgba(255,255,255,.25); }
  .ub-atual { opacity: .85; }
  .ub-esp { flex: 1; }
  .ub-menu { position: relative; display: inline-flex; color: inherit;
    font: 500 13px/1 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .ub-botao { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 6px;
    border: 1px solid currentColor; border-color: color-mix(in srgb, currentColor 30%, transparent);
    background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .ub-botao:hover, .ub-botao[aria-expanded="true"] { background: color-mix(in srgb, currentColor 12%, transparent); }
  .ub-botao svg { width: 10px; height: 10px; }
  .ub-painel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 2147483000; width: 340px; max-width: calc(100vw - 24px); max-height: 75vh; overflow-y: auto;
    background: #FAFAF7; color: #3F4B57; border: 1px solid #D7DADD; border-radius: 8px;
    box-shadow: 0 12px 32px rgba(46,48,54,.18); padding: 8px; text-align: left; }
  .ub-painel[hidden] { display: none; }
  .ub-grupo { font-size: 10.5px; font-weight: 650; letter-spacing: .09em; text-transform: uppercase; opacity: .6; padding: 10px 10px 4px; }
  .ub-item { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 8px 10px; border-radius: 6px;
    color: inherit; text-decoration: none; }
  a.ub-item:hover { background: #E6E8EB; }
  .ub-item b { font-weight: 600; font-size: 13px; }
  .ub-item small { grid-column: 1 / -1; font-size: 12px; line-height: 1.35; opacity: .7; font-weight: 400; }
  .ub-item.ub-ativo { background: #E6E8EB; }
  .ub-item.ub-breve { opacity: .5; }
  .ub-tag { font-size: 10.5px; font-weight: 600; padding: 3px 6px; border-radius: 4px; background: #E3D9C6; color: #3F4B57; align-self: start; }
  .ub-hub { display: block; margin: 6px 2px 2px; padding: 9px 10px; border-top: 1px solid #D7DADD; color: inherit;
    text-decoration: none; font-weight: 600; font-size: 12.5px; }
  .ub-hub:hover { text-decoration: underline; }
  `;

  const seta = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const aqui = (location.host + location.pathname).replace(/^www\./, '');

  function atual(lista) {
    // o host mais específico vence (ex.: odisse.com.br/admin antes de odisse.com.br)
    let melhor = null, tam = -1;
    for (const f of lista) for (const h of f.hosts || []) {
      const alvo = h.replace(/^www\./, '');
      if (aqui.startsWith(alvo) && alvo.length > tam) { melhor = f; tam = alvo.length; }
    }
    return melhor;
  }

  function montarMenu(raiz, dados, ativa) {
    raiz.classList.add('ub-menu');
    raiz.innerHTML = `<button type="button" class="ub-botao" aria-haspopup="true" aria-expanded="false">Universo ${seta}</button>
      <div class="ub-painel" role="menu" hidden></div>`;
    const botao = raiz.querySelector('.ub-botao');
    const painel = raiz.querySelector('.ub-painel');

    painel.innerHTML = dados.grupos.map((g) => {
      const itens = dados.ferramentas.filter((f) => f.grupo === g.id);
      if (!itens.length) return '';
      return `<div class="ub-grupo">${esc(g.nome)}</div>` + itens.map((f) => {
        const tag = f.status === 'em-breve' ? '<span class="ub-tag">em breve</span>'
          : f.acesso === 'publica' ? '<span class="ub-tag">público</span>' : '';
        const corpo = `<b>${esc(f.nome)}</b>${tag}<small>${esc(f.descricao)}</small>`;
        const cls = 'ub-item' + (ativa && f.id === ativa.id ? ' ub-ativo' : '');
        return f.url && f.status !== 'em-breve'
          ? `<a class="${cls}" role="menuitem" href="${esc(f.url)}">${corpo}</a>`
          : `<div class="${cls} ub-breve">${corpo}</div>`;
      }).join('');
    }).join('') + `<a class="ub-hub" href="${HUB}">Abrir o Universo →</a>`;

    const fechar = () => { painel.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
    botao.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = painel.hidden;
      painel.hidden = !abrir; botao.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (e) => { if (!raiz.contains(e.target)) fechar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  }

  function montarBarra(raiz, dados, ativa) {
    raiz.classList.add('ub-barra');
    raiz.innerHTML = `<a class="ub-casa" href="${HUB}"><span class="ub-selo" aria-hidden="true"></span>
        <span class="ub-nome">Odisse</span><span class="ub-sub">Universo</span></a>
      ${ativa ? `<span class="ub-atual">${esc(ativa.nome)}</span>` : ''}
      <span class="ub-esp"></span><span data-ub-menu></span>`;
    montarMenu(raiz.querySelector('[data-ub-menu]'), dados, ativa);
  }

  async function iniciar() {
    const estilo = document.createElement('style');
    estilo.textContent = css;
    document.head.appendChild(estilo);

    let dados;
    try { dados = await fetch(HUB + 'ferramentas.json', { cache: 'no-cache' }).then((r) => r.json()); }
    catch { return; } // sem o menu, a ferramenta segue funcionando normalmente

    const ativa = atual(dados.ferramentas);
    const menus = document.querySelectorAll('[data-universo-menu]');
    const barras = document.querySelectorAll('[data-universo-barra]');
    menus.forEach((el) => montarMenu(el, dados, ativa));
    barras.forEach((el) => montarBarra(el, dados, ativa));

    if (!menus.length && !barras.length && script.dataset.auto !== 'nao') {
      const el = document.createElement('div');
      document.body.prepend(el);
      montarBarra(el, dados, ativa);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
