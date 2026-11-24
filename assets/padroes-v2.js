// Biblioteca › Padrões de interface — o padrão novo, VIVO (Cid, 24/11).
// Diferente do catálogo v1 (cópias .pi-*), aqui as amostras são as próprias peças da base/v2: o que se vê é o que as
// páginas usam. Mudou a peça em base/v2/componentes.js ou base/v2/universo.css, muda aqui e em todas as páginas.

import { numeros, segmentado, secao, bandeja, lista, nome, etiqueta, quando, acao, medidor, marcador, link, gaveta, toque, recorte, esc }
  from '../base/v2/componentes.js';

const PECAS = [
  ['Casca', 'Menu lateral por função (ferramentas.json › menu), topo com "Ir para" (Ctrl K) e o painel. Recolhe a ícones; no celular, abre por cima.', 'esta página'],
  ['Números', 'Os números do dia lado a lado. Um número pode ligar um recorte da lista (fica marcado em ocre) ou levar a outra página.', 'Início'],
  ['Segmentado', 'Filtra o mesmo conteúdo, com a contagem de cada opção. Não troca de página: para isso, Abas.', 'Início › Hoje'],
  ['Lista', 'Régua + grupos + linhas de 42 px numa Bandeja. Colunas pela régua; no celular, as colunas marcadas somem.', 'Início › Hoje e Projetos'],
  ['Bandeja', 'Tom claro com 4 px de recuo em volta de um cartão branco: cantos concêntricos (12 fora, 8 dentro).', 'todas as listas'],
  ['Gaveta', 'O detalhe que entra pela direita sobre a página escurecida, com a ação principal embaixo. Esc fecha.', 'Início › clique numa linha'],
  ['Etiqueta · Quando · Ação · Medidor · Marcador', 'Área (cor por área), prazo (atraso, atenção, hora), ação de linha (uma só em grafite por lista), entregas feitas/total, feito.', 'Início'],
  ['Toque', 'Aviso curto no pé, que some sozinho.', 'Confirmar publicação'],
];

export function vitrineV2() {
  const demoLista = lista({
    colunas: '22px minmax(0,1fr) 120px 150px', colunasCelular: '22px minmax(0,1fr) 96px',
    regua: [{ texto: '' }, { texto: 'Item' }, { texto: 'Quando' }, { texto: 'Ação', fim: true, celular: false }],
    grupos: [
      { nome: 'Atrasados', n: 1, linhas: [{ abre: 'demo', celulas: [{ html: marcador(false, { rotulo: 'Follow-up', id: 'demo1' }) },
        { html: nome('Follow-up da PC-0000', { area: 'comercial', contexto: 'exemplo de proposta' }) }, { html: quando('há 9 dias', 'atraso') },
        { html: acao('Fazer follow-up', { principal: true, dados: { demo: 'toque' } }), fim: true, celular: false }] }] },
      { nome: 'Com horário', n: 1, linhas: [{ abre: 'demo', celulas: [{ html: marcador(false, { hora: true, rotulo: 'Post', id: 'demo2' }) },
        { html: nome('Post no Instagram', { area: 'marketing', contexto: 'exemplo' }) }, { html: quando('18:30', 'hora') },
        { html: acao('Confirmar publicação', { dados: { demo: 'toque' } }), fim: true, celular: false }] }] },
      { nome: 'Para fazer', n: 1, linhas: [{ abre: 'demo', feita: true, celulas: [{ html: marcador(true, { rotulo: 'Entrega', id: 'demo3' }) },
        { html: nome('Entrega do anteprojeto', { area: 'producao', contexto: 'exemplo' }) }, { html: quando('feito') },
        { html: '', fim: true, celular: false }] }] },
    ],
  });
  return secao({ titulo: 'Padrão novo (v2): peças vivas', lado: link('base/v2/componentes.js', 'https://github.com/cidclementino/universo-odisse/blob/main/base/v2/componentes.js'), corpo: `
    ${numeros([
      { id: 'demo-a', rotulo: 'Número', valor: 8, apoio: '<span class="ui-quando is-atraso">2 atrasados</span> · 1 com horário', ativo: true },
      { id: 'demo-b', rotulo: 'Com complemento', valor: 3, sufixo: 'R$ 120 mil em jogo', apoio: 'linha de apoio' },
      { id: 'demo-c', rotulo: 'Sem leitura', valor: null, apoio: 'quando a parte falha' },
      { id: 'demo-d', rotulo: 'Que leva a outra página', valor: 2, sufixo: 'de 15', href: '#/kpis', apoio: 'link' },
    ])}
    <div class="ui-secao__cab" style="padding:20px 4px 10px">${segmentado([{ id: 'a', rotulo: 'Tudo', n: 3 }, { id: 'b', rotulo: 'Comercial', n: 1 }, { id: 'c', rotulo: 'Produção', n: 1 }], 'a', 'demo', 'Exemplo de Segmentado')}
      <div class="ui-secao__lado">${recorte('Só propostas', { demo: 'recorte' })}${etiqueta('', 'comercial')}${etiqueta('', 'producao')}${etiqueta('', 'marketing')}${etiqueta('', 'gestao')}
      ${quando('atraso', 'atraso')}${quando('atenção', 'atencao')}${quando('9:30', 'hora')}<span style="width:120px">${medidor(12, 30)}</span></div></div>
    ${bandeja(demoLista)}
    <div class="ui-bandeja" style="margin-top:16px"><div class="ui-cartao">${lista({ colunas: 'minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)', regua: [{ texto: 'Peça' }, { texto: 'Para quê' }, { texto: 'Onde aparece' }],
      linhas: PECAS.map(([n, p, o]) => ({ celulas: [{ html: `<b>${esc(n)}</b>` }, { html: `<span style="white-space:normal">${esc(p)}</span>` }, { html: `<span class="ui-quando">${esc(o)}</span>` }] })) })}</div></div>` });
}

export function ligarV2(el) {
  el.addEventListener('click', (ev) => {
    const s = ev.target.closest('[data-segmentado="demo"]');
    if (s) { s.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === s ? 'true' : 'false')); return; }
    const m = ev.target.closest('[data-marcar^="demo"]');
    if (m) { ev.stopPropagation(); const on = m.getAttribute('aria-pressed') !== 'true'; m.setAttribute('aria-pressed', on ? 'true' : 'false'); m.closest('.ui-lista__linha')?.classList.toggle('is-feita', on); return; }
    if (ev.target.closest('[data-demo="toque"]')) { ev.stopPropagation(); toque('Exemplo de aviso curto'); return; }
    if (ev.target.closest('[data-numero^="demo"]')) { const b = ev.target.closest('[data-numero]'); b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
    if (ev.target.closest('[data-abre="demo"]')) {
      gaveta.abrir({ etiqueta: etiqueta('', 'comercial'), titulo: 'Gaveta de exemplo', texto: 'O detalhe do item, sem sair da página.',
        campos: [['Quando', quando('há 9 dias', 'atraso')], ['Valor', 'R$ 96.000']], acoes: '<button type="button" class="ui-botao-largo">Ação principal</button>' });
    }
  });
}
