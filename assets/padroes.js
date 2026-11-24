// Biblioteca › Padrões de interface (#/padroes): o catálogo vivo da base/v2.
// As amostras são as próprias peças (assets/padroes-v2.js usa base/v2/componentes.js): mudou a peça, muda aqui e em
// todas as páginas. Os padrões mudam só nas conversas com o Claude.

import { cabecalho } from '../base/v2/componentes.js';
import { vitrineV2, ligarV2 } from './padroes-v2.js';

export function criarPadroes() {
  function ligar(raiz) {
    raiz.innerHTML = `${cabecalho('Padrões de interface', 'As peças da base/v2, vivas: é o que as páginas usam.')}
      ${vitrineV2()}
      <section class="pas-notas">
        <div><h3 class="u-rotulo">Como pedir</h3><p>Pelo nome da peça: "essa lista com Segmentado por área"; "o detalhe numa Gaveta"; "Números no topo, o último levando aos KPIs".</p></div>
        <div><h3 class="u-rotulo">Onde está o código</h3><p>Aparência em <b>base/v2/universo.css</b> (cores por função, raios 12 · 8 · 4, alturas 44 · 30 · 42); estrutura em <b>base/v2/componentes.js</b>; a casca das ferramentas em <b>base/v2/casca.js</b>.</p></div>
        <div><h3 class="u-rotulo">Telas antigas</h3><p>As classes da v1 (<b>u-*</b>) que ainda existem nas telas de Vendas, Projetos e Radar são restilizadas pela <b>base/v2/ponte-v1.css</b> até cada tela passar para as peças.</p></div>
      </section>`;
    ligarV2(raiz);
  }
  return { ligar };
}
