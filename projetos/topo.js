// ==========================================================================
// Casca do Universo no Projetos (desde 24/11/2026 o Projetos mora em universo.odisse.com.br/projetos/).
//   <header class="topo" data-pagina="projetos"></header>
//   <script src="topo.js"></script>
// Diz qual item do menu lateral acender; a casca (menu, Ir para, painel) vem de /base/v2/casca.js.
// ==========================================================================
(() => {
  const ITEM = { pgt: 'pgt', bases: 'pgt', projetos: 'projetos', projeto: 'projetos', horas: 'horas' };
  const raiz = document.querySelector('header.topo');
  const pagina = raiz?.dataset.pagina || '';
  raiz?.remove();
  const s = document.createElement('script');
  s.src = '/base/v2/casca.js';
  s.dataset.item = ITEM[pagina] || '';
  s.dataset.classe = 'ferramenta-projetos';
  document.head.appendChild(s);
})();
