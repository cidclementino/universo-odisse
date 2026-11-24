// ==========================================================================
// Casca do Universo no vendas (o vendas mora em universo.odisse.com.br/vendas/).
//   <header class="topo" data-pagina="crm"></header>
//   <script src="topo.js"></script>
// Diz qual item do menu lateral acender; a casca (menu, Ir para, painel) vem de /base/v2/casca.js.
// ==========================================================================
(() => {
  const ITEM = { crm: 'funil', contatos: 'contatos', propostas: 'propostas', migrar: 'propostas', contratos: 'contratos', referencias: 'referencias' };
  const raiz = document.querySelector('header.topo');
  const pagina = raiz?.dataset.pagina || '';
  raiz?.remove();
  const s = document.createElement('script');
  s.src = '/base/v2/casca.js';
  s.dataset.item = ITEM[pagina] || '';
  s.dataset.classe = 'ferramenta-vendas';
  document.head.appendChild(s);
})();
