// ==========================================================================
// Casca do Universo no vendas (desde 24/11/2026 o vendas mora em universo.odisse.com.br/vendas/).
//
//   <header class="topo" data-pagina="crm"></header>
//   <script src="topo.js"></script>
//
// O menu lateral, o topo com "Ir para" e o painel vêm da base/v2 do Universo (base/v2/componentes.js): a mesma
// casca de todas as páginas. Esta peça só diz qual item do menu acender e põe o conteúdo da página dentro do painel.
// As páginas que ainda usam o desenho anterior aparecem com a ponte v1 → v2 (base/v2/ponte-v1.css).
// ==========================================================================

(() => {
  // página → item do menu (ferramentas.json › menu)
  const ITEM = { crm: 'funil', contatos: 'contatos', propostas: 'propostas', migrar: 'propostas', contratos: 'contratos', referencias: 'referencias' };
  const raiz = document.querySelector('header.topo');
  const pagina = raiz?.dataset.pagina || '';
  raiz?.remove();

  for (const href of ['/base/v2/universo.css', '/base/v2/ponte-v1.css']) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }

  const montar = async () => {
    const conteudo = document.createElement('div');
    conteudo.className = 'ferramenta-vendas';
    [...document.body.childNodes].filter((n) => !(n.nodeType === 1 && n.tagName === 'SCRIPT')).forEach((n) => conteudo.appendChild(n));
    document.body.prepend(conteudo); // fica no documento enquanto a casca carrega (as páginas procuram os elementos por id)
    const { montarCasca } = await import('/base/v2/componentes.js');
    await montarCasca({
      conteudo,
      atual: ITEM[pagina] || '',
      aoSair: () => { if (typeof logout === 'function') logout(); location.href = '/#/'; },
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
