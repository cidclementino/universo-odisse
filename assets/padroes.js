// Biblioteca › Padrões de interface (#/padroes) — Cid, 19/11.
// Catálogo das formas de dispor o conteúdo no Odisse, com nome, para pedir "tal página em Registro, com Gaveta".
// Primeira etapa, conservadora: as amostras são CÓPIAS próprias desta página (classes .pi-*, assets/padroes.css);
// nenhuma ferramenta passa a depender delas e nenhuma página muda por causa deste catálogo.
// Situação de cada lugar: s = segue o padrão · v = variação · a = a ajustar (legado do design.md § 0).
// 19/11: disposição = desenho de página com regra própria; combinação = arranjo conhecido de peças.
// Disposições em grupos por semelhança; Balcão, Painel, Assistente e Editor com prévia são combinações; Mosaico entra na Vitrine;
// novas peças Bloco, Faixa de criar, Gráfico, Passos e Resumo; Abas em caixa com o nome da seção; Seletor quadrado; nada em pílula.
// 19/11 (vendas › Propostas): Assistente com passos corridos, Passos e Resumo colados nas laterais, nome do passo como título;
// Bloco recolhível (seta à direita); Barra de emitir (variação da Barra de salvar); Prévia de folha com as folhas da Marca e Seletor de modelo.

const H = 'https://universo.odisse.com.br/';
const V = 'https://vendas.odisse.com.br/';
const P = 'https://projetos.odisse.com.br/';
const R = 'https://radar.odisse.com.br/';
const M = 'https://marketing.odisse.com.br/';
const S = 'https://www.odisse.com.br/admin/';

// lugares (nome, ferramenta, endereço)
const L = {
  ferramentas: ['Ferramentas', 'Universo', H + '#/ferramentas'],
  canais: ['Canais', 'Universo', H + '#/canais'],
  empresa: ['Empresa', 'Universo', H + '#/empresa'],
  equipe: ['Equipe', 'Universo', H + '#/equipe'],
  pessoa: ['Equipe › pessoa', 'Universo', H + '#/equipe'],
  cargos: ['Cargos e títulos', 'Universo', H + '#/equipe/cargos'],
  marca: ['Marca', 'Universo', H + '#/marca'],
  biblioteca: ['Biblioteca', 'Universo', H + '#/biblioteca'],
  acervo: ['Acervo e referências', 'Universo', H + '#/biblioteca'],
  emitidos: ['Emissão › emitidos', 'Universo', H + '#/documentos'],
  emissao: ['Emissão › editor', 'Universo', H + '#/documentos'],
  menu: ['Menu Universo / Ir para', 'todas', H + '#/'],
  entradaHub: ['Entrada do Universo', 'Universo', H],
  estudio: ['O Estúdio', 'Universo', H + '#/empresa'],
  funil: ['Funil', 'vendas', V + 'crm.html'],
  contatos: ['Contatos', 'vendas', V + 'contatos.html'],
  propostas: ['Propostas', 'vendas', V + 'index.html'],
  emissor: ['Emissor de proposta', 'vendas', V + 'index.html'],
  historico: ['Propostas › Histórico', 'vendas', V + 'index.html'],
  contratos: ['Contratos', 'vendas', V + 'contratos.html'],
  gestor: ['Contratos › Gestor de cláusulas', 'vendas', V + 'contratos.html#clausulas'],
  fases: ['Referências › Fases e etapas', 'vendas', V + 'honorarios.html'],
  referencias: ['Referências (outras abas)', 'vendas', V + 'honorarios.html'],
  formula: ['Referências › Fórmula', 'vendas', V + 'honorarios.html'],
  entradaV: ['Entrada', 'vendas', V + 'login.html'],
  projetos: ['Projetos (lista)', 'Projetos', P],
  projeto: ['Ficha do projeto', 'Projetos', P],
  horas: ['Horas', 'Projetos', P + 'horas.html'],
  bases: ['Bases', 'Projetos', P + 'bases.html'],
  pgt: ['PGT › Fases, etapas…', 'Projetos', P + 'pgt.html'],
  linha: ['PGT › Linha', 'Projetos', P + 'pgt.html'],
  materiais: ['PGT › Materiais', 'Projetos', P + 'pgt.html'],
  entradaP: ['Entrada', 'Projetos', P + 'login.html'],
  concursos: ['Concursos', 'Radar', R],
  licitacoes: ['Licitações', 'Radar', R + 'licitacoes.html'],
  terrenos: ['Terrenos › Oportunidades', 'Radar', R + 'terrenos.html'],
  corretores: ['Terrenos › Corretores', 'Radar', R + 'terrenos.html'],
  acomp: ['Acompanhamento', 'Radar', R + 'acompanhamento.html'],
  revisao: ['Revisão', 'Radar', R + 'revisao.html'],
  entradaR: ['Entrada', 'Radar', R + 'login.html'],
  publicacoes: ['Publicações', 'marketing', M + '#/publicacoes'],
  editorMkt: ['Editor de publicação', 'marketing', M + '#/publicacoes'],
  calendario: ['Calendário', 'marketing', M + '#/calendario'],
  estrategia: ['Estratégia', 'marketing', M + '#/estrategia'],
  metricas: ['Métricas', 'marketing', M + '#/metricas'],
  padroesPosts: ['Padrões dos posts', 'marketing', M + '#/padroes'],
  entradaM: ['Entrada', 'marketing', M],
  painelSite: ['Painel do site', 'site', S],
  vendasTodas: ['todas as páginas', 'vendas', V + 'crm.html'],
  projetosTodas: ['todas as páginas', 'Projetos', P],
  radarTodas: ['todas as páginas', 'Radar', R],
  mktTodas: ['todas as páginas', 'marketing', M],
};

// ---- amostras (cópias pequenas, só para ver) --------------------------------------------------------------------

const lapis = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6 13.4 5.2 6 12.6 3 13 3.4 10Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const seta = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const alca = '<svg viewBox="0 0 16 16" aria-hidden="true"><g fill="currentColor"><circle cx="6" cy="4" r="1.2"/><circle cx="10" cy="4" r="1.2"/><circle cx="6" cy="8" r="1.2"/><circle cx="10" cy="8" r="1.2"/><circle cx="6" cy="12" r="1.2"/><circle cx="10" cy="12" r="1.2"/></g></svg>';
const cadeado = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const cima = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10 8 6l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const baixo = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6 8 10l4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const xis = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const tr = (n = 1, larg = []) => Array.from({ length: n }, (_, i) => `<i class="pi-tx" style="width:${larg[i] || 70}%"></i>`).join('');
const etq = (t, k = '') => `<span class="etq${k ? ' etq--' + k : ''}">${t}</span>`;
const caixaCtl = (svg, on = false) => `<span class="ctl__btn pi-ctl${on ? ' is-on' : ''}">${svg}</span>`;

const AMOSTRA = {
  'lista-em-tons': () => `
    <div class="pi-regua"><span></span><span>Ferramenta</span><span>O que faz</span><span>Estado</span></div>
    ${[['ambar', 'Marketing', [['Construtor de publicações', 'ok']]],
       ['ardosia', 'Produção', [['Plano Geral de Trabalho', 'ok'], ['Lista de fornecedores', 'breve']]]].map(([c, n, itens]) => `
      <div class="pi-ramo" style="--g:var(--pi-${c})"><div class="pi-ramo__faixa"><span class="pi-seta">${seta}</span>${n} <small>${itens.length} ${itens.length > 1 ? 'ferramentas' : 'ferramenta'}</small></div>
        <div class="pi-ramo__pilha">${itens.map(([t, e]) => `<div class="pi-ferr${e === 'breve' ? ' is-breve' : ''}">${caixaCtl(lapis)}<b>${t}</b>${tr(1, [80])}${e === 'ok' ? etq('no ar', 'ok') : etq('em breve', 'breve')}</div>`).join('')}</div></div>`).join('')}`,

  ficha: () => `
    <div class="pi-caixa"><div class="pi-caixa__t">Identidade ${etq('marca-mãe')}</div>
      <div class="pi-tres">${['Nome curto', 'Razão social', 'CNPJ', 'Nome em inglês', 'Inscrição municipal', 'Fundação'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}</div></div>
    <div class="pi-salvar"><span>2 mudanças não salvas</span><span class="pi-b pi-b--claro">Descartar</span><span class="pi-b pi-b--forte">Salvar</span></div>`,

  registro: () => `
    <div class="pi-barra-pag"><b>Contatos</b><span class="pi-busca"></span><span class="pi-b pi-b--forte">Novo contato</span></div>
    <div class="pi-tabela">${[['Ana Ribeiro', 'Construtora Mar', 'pessoa'], ['Atelier Norte', '—', 'organização'], ['Bruno Lima', 'Prefeitura', 'pessoa'], ['Casa Sertão', '—', 'organização']]
      .map(([a, b, c], i) => `<div class="pi-tr${i === 1 ? ' is-hover' : ''}"><b>${a}</b><span>${b}</span>${etq(c)}<span class="pi-num">1${i}/11</span></div>`).join('')}</div>`,

  galeria: () => `<div class="pi-grade2">${[['CC', 'Cid Clementino', 'Arquiteto coordenador', 'sócio'], ['NL', 'Nathalia Linhares', 'Arquiteta', 'sócio'], ['MA', 'Maria Alves', 'Estagiária', 'no site'], ['JS', 'João Souza', 'Desenhista', '']]
    .map(([i, n, c, e], k) => `<div class="pi-pessoa${k === 0 ? ' is-hover' : ''}"><span class="pi-foto">${i}</span><span><b>${n}</b><small>${c}</small>${e ? etq(e) : ''}</span></div>`).join('')}</div>`,

  vitrine: () => `<div class="pi-vitrine">
    ${['Carta', 'Declaração'].map((n) => `<div class="pi-vit"><div class="pi-a4">${tr(5, [50, 90, 85, 88, 40])}</div><b>${n}</b><div class="pi-acoes"><span class="pi-b">Baixar PDF</span><span class="pi-b">Usar</span></div></div>`).join('')}
    ${[['ambar', 'Post 12'], ['ardosia', 'Post 11'], ['pessego', 'Post 10']].map(([c, n]) => `<div class="pi-vit pi-vit--post"><div class="pi-capa" style="--c:var(--pi-${c})"></div><b>${n}</b><div class="pi-acoes"><span class="pi-b">Abrir</span><span class="pi-b">Duplicar</span></div></div>`).join('')}</div>`,


  mural: () => `<div class="pi-topo-dir"><span class="pi-seg"><span class="is-on">Cartões</span><span>Lista</span></span></div>
    <div class="pi-grade3">${[['ardosia', 'alta'], ['ocre', 'média'], ['areia', 'baixa']].map(([c, u], i) => `
    <div class="pi-mural${i === 0 ? ' is-hover' : ''}"><div class="pi-banner" style="--c:var(--pi-${c})">${etq('novo', 'ok')}</div><b>Concurso ${i + 1}</b>${tr(1, [80])}${etq(u === 'alta' ? '5 dias' : u === 'média' ? '18 dias' : '40 dias', u === 'alta' ? 'atencao' : '')}</div>`).join('')}</div>`,

  pilha: () => `<div class="pi-pilha">${['Arquiteto coordenador', 'Arquiteta', 'Desenhista'].map((n, i) => `
    <div class="pi-item"><span class="pi-pos">${i + 1}</span><b>${n}</b><span class="pi-ctls">${caixaCtl(cima)}${caixaCtl(baixo)}${caixaCtl(xis)}</span></div>`).join('')}
    <div class="pi-item pi-item--novo">+ Acrescentar</div></div>`,

  sanfona: () => `<div class="pi-pilha">
    <div class="pi-sanf"><div class="pi-sanf__cab"><span class="pi-seta">${seta}</span><b>Concurso Sede Municipal</b>${etq('acompanhando')}</div></div>
    <div class="pi-sanf is-aberto"><div class="pi-sanf__cab"><span class="pi-seta">${seta}</span><b>Concurso Praça Central</b>${etq('inscrito', 'ok')}</div>
      <div class="pi-sanf__corpo">${tr(3, [90, 75, 60])}</div></div>
    <div class="pi-sanf"><div class="pi-sanf__cab"><span class="pi-seta">${seta}</span><b>Concurso Biblioteca</b>${etq('acompanhando')}</div></div></div>`,

  quadro: () => `<div class="pi-quadro">${[['Novo', 2], ['Conversa', 1], ['Proposta', 2], ['Negociação', 1]].map(([n, q], c) => `
    <div class="pi-col"><b>${n} <small>${q}</small></b>${Array.from({ length: q }, (_, i) => `<div class="pi-op${c === 2 && i === 0 ? ' is-hover' : ''}"><b>Oportunidade</b>${tr(1, [70])}<em>ligar amanhã</em></div>`).join('')}</div>`).join('')}</div>`,

  matriz: () => `<div class="pi-matriz">
    <div class="pi-mz pi-mz--cab"><span>Etapa</span><span>Peso</span><span>Prazo</span><span>Opcional</span></div>
    <div class="pi-mz pi-mz--grupo" style="--g:var(--pi-ambar)"><span><span class="pi-seta">${seta}</span>Estudo preliminar</span><span>30%</span><span></span><span></span></div>
    ${[['Levantamento', '10%', '5 d'], ['Conceito', '12%', '8 d'], ['Estudo', '8%', '6 d', 1]].map(([a, b, c, o]) => `<div class="pi-mz"><span>${a}</span><span class="pi-num">${b}</span><span class="pi-num">${c}</span><span>${o ? '<i class="pi-trac">sim</i>' : ''}</span></div>`).join('')}
    <div class="pi-soma"><span>Soma</span><b>100%</b></div></div>`,

  linha: () => `<div class="pi-linha">${['Início', 'Levantamento', 'Conceito', 'Decisão', 'Estudo'].map((n, i) => `
    <div class="pi-no${i === 3 ? ' pi-no--dec' : ''}${i < 2 ? ' is-feito' : ''}"><span></span><small>${n}</small></div>`).join('')}</div>`,

  calendario: () => `<div class="pi-cal"><div class="pi-mes">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d) => `<b>${d}</b>`).join('')}
    ${Array.from({ length: 21 }, (_, i) => `<span${i === 9 ? ' class="is-hoje"' : ''}>${i + 1}${[2, 6, 9, 13, 16].includes(i) ? `<i style="--c:var(--pi-${i % 2 ? 'ambar' : 'ardosia'})"></i>` : ''}</span>`).join('')}</div>
    <div class="pi-pool"><b>Pool</b>${['ambar', 'areia', 'ardosia'].map((c) => `<i style="--c:var(--pi-${c})"></i>`).join('')}</div></div>`,

  balcao: () => `<div class="pi-tiles">${['Arquitetura', 'Interiores', 'Ambientação', 'Legal'].map((n) => `<div class="pi-tile"><b>${n}</b><small>+ nova</small></div>`).join('')}</div>
    <div class="pi-arq-cab"><b>Histórico</b><span class="pi-chips"><span class="is-on">Todas</span><span>Propostas</span><span>Simulações</span></span></div>
    <div class="pi-tabela">${['PC-2026-0012', 'PC-2026-0011', 'PC-2026-0010'].map((c) => `<div class="pi-tr"><b>${c}</b>${tr(1, [60])}${etq('enviada')}</div>`).join('')}</div>`,

  assistente: () => `<div class="pi-assis">
    <div class="pi-passos">${['Serviço', 'Cliente', 'Escopo', 'Preço', 'Revisar'].map((n, i) => `<span class="${i === 2 ? 'is-on' : i < 2 ? 'is-feito' : ''}">${i + 1}. ${n}</span>`).join('')}</div>
    <div class="pi-caixa pi-caixa--col"><div class="pi-caixa__t">Escopo</div>${['Área', 'Tipologia', 'Fases'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}<div class="pi-acoes"><span class="pi-b">Voltar</span><span class="pi-b">Continuar</span></div></div>
    <div class="pi-previa-c"><small>Resumo</small><b>R$ 48.200</b>${tr(3, [80, 60, 70])}</div></div>`,

  // Editor com prévia (Cid, 19/11): folha à esquerda, Blocos à direita; o conteúdo próprio do documento se escreve nos dois
  // lugares; o que vem do modelo (cabeçalho, dados do escritório, rodapé) não se edita na folha
  'editor-com-previa': () => `<div class="pi-edprev">
    <div class="pi-folha-g">${tr(3, [35, 50, 30])}<div class="pi-editando">${tr(3, [92, 88, 60])}<span class="pi-cursor"></span></div>${tr(2, [86, 30])}</div>
    <div class="pi-blocos">
      <div class="pi-caixa pi-caixa--col"><div class="pi-caixa__t">Destinatário</div>${['Nome', 'Cargo'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}</div>
      <div class="pi-caixa pi-caixa--col"><div class="pi-caixa__t">Texto</div><div class="pi-campo"><span>Corpo</span><i class="alto pi-sinc"></i></div></div></div></div>`,

  bancada: () => `<div class="pi-banc">
    <div class="pi-form">${['Título', 'Núcleo', 'Texto do card'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}</div>
    <div class="pi-palco-c"><span class="pi-nav">‹</span><div class="pi-capa" style="--c:var(--pi-areia)"></div><div class="pi-capa is-on" style="--c:var(--pi-ambar)"></div><div class="pi-capa" style="--c:var(--pi-pessego)"></div><span class="pi-nav">›</span></div></div>`,

  painel: () => `<div class="pi-placar">${[['Alcance', '12,4 mil'], ['Seguidores', '3.210'], ['Salvos', '486'], ['Posts', '24']].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
    <div class="pi-graf"><svg viewBox="0 0 300 60" preserveAspectRatio="none"><polyline points="0,48 40,40 80,44 120,28 160,32 200,18 240,24 300,10" fill="none" stroke="#2F6FAF" stroke-width="2"/><polyline points="0,54 40,50 80,52 120,44 160,46 200,38 240,40 300,32" fill="none" stroke="#BB8248" stroke-width="2"/></svg></div>`,

  'menu-em-blocos': () => `<div class="pi-menu">
    <div class="pi-pilulas"><span>Início</span><span>Ferramentas</span><span>O Estúdio</span><span>Biblioteca</span></div>
    ${[['ambar', 'Marketing', ['Construtor de publicações', 'Calendário editorial']], ['ocre', 'Comercial', ['Funil comercial', 'Propostas comerciais']]].map(([c, n, it]) => `
      <div class="pi-bloco" style="--g:var(--pi-${c})"><div class="pi-bloco__t">${n} <small>${it.length}</small></div>${it.map((t, i) => `<div class="pi-mi${c === 'ocre' && i === 0 ? ' is-hover' : ''}"><b>${t}</b>${tr(1, [70])}${c === 'ambar' && i === 0 ? '<span class="etq pi-aqui">aqui</span>' : ''}</div>`).join('')}</div>`).join('')}</div>`,

  entrada: () => `<div class="pi-entrada"><div class="pi-ent"><span class="pi-selo"></span><small>UNIVERSO</small><div class="pi-campo"><span>Senha da equipe</span><i></i></div><span class="pi-b pi-b--forte">Entrar</span></div></div>`,

  // ---- peças (tamanho real, quando cabe) ----
  abas: () => `<div class="pi-var"><small>modelo · em caixa, com o nome da seção à esquerda</small>
      <span class="pi-abas-linha"><span class="u-rotulo">O Estúdio</span><span class="pi-abas-caixa"><span class="is-on">Empresa</span><span>Equipe</span><span>Marca</span><span>Canais</span></span></span>
      <span class="pi-abas-linha"><span class="u-rotulo">Contatos</span><span class="pi-abas-caixa"><span class="is-on">Todos <em>42</em></span><span>Pessoas <em>30</em></span><span>Organizações <em>12</em></span></span></span></div>
    <div class="pi-var pi-legado"><small>a ajustar · em pílula</small><nav class="abas-estudio pi-abas-real"><div class="abas"><a class="ativa">Empresa</a><a>Equipe</a><a>Marca</a></div></nav></div>
    <div class="pi-var pi-legado"><small>a ajustar · sublinhadas</small><span class="pi-abas-sub"><span class="is-on">Posts 3:4</span><span>Pins</span><span>Stories</span></span></div>`,

  seletor: () => `<div class="pi-var"><small>modelo · quadrado</small><span class="pi-seg pi-seg--g"><span class="is-on">Cartões</span><span>Lista</span></span>
      <span class="pi-seg pi-seg--g"><span class="is-on">%</span><span>R$</span><span>dias</span></span></div>
    <div class="pi-var pi-legado"><small>a ajustar · em pílula</small><span class="pi-seg pi-seg--p"><span class="is-on">%</span><span>R$</span><span>dias</span></span></div>`,

  filtros: () => `<div class="pi-filtros"><span class="pi-busca pi-busca--g">Buscar por nome, e-mail…</span><span class="pi-sel">Todos os núcleos</span><span class="pi-sel">Situação</span><a class="pi-limpar">limpar</a></div>`,

  regua: () => `<div class="pi-regua pi-regua--g"><span></span><span>Ferramenta</span><span>O que faz</span><span>Onde</span><span>Estado</span></div>`,

  etiqueta: () => `<div class="pi-etqs">${etq('categoria')}${etq('no ar', 'ok')}${etq('atenção', 'atencao')}${etq('problema', 'problema')}${etq('em breve', 'breve')}<span class="etq pi-aqui">aqui</span><span class="etq etq--link">Painel do site</span>
    <span class="lingua">PT</span><span class="lingua en">EN</span></div>`,

  'caixa-de-comando': () => `<div class="pi-etqs">${caixaCtl(alca)}${caixaCtl(lapis)}${caixaCtl(cadeado)}${caixaCtl(lapis, true)}<small class="pi-leg">alça · editar · travar · ligado</small></div>`,

  botoes: () => `<div class="pi-etqs"><span class="u-botao">Cargos e títulos</span><span class="u-botao forte">+ Pessoa</span><span class="u-botao pi-perigo">Arquivar</span><a class="pi-limpar">limpar</a></div>`,

  'barra-de-salvar': () => `<div class="pi-folga"></div><div class="pi-salvar pi-salvar--g"><span>3 mudanças não salvas</span><span class="pi-b pi-b--claro">Descartar</span><span class="pi-b pi-b--forte">Salvar</span></div>`,

  gaveta: () => `<div class="pi-gav"><div class="pi-gav__pag">${tr(6, [40, 90, 85, 80, 88, 70])}</div><div class="pi-gav__p"><div class="pi-gav__t"><b>Nova oportunidade</b><span>×</span></div>${['Título', 'Cliente', 'Origem'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}<span class="pi-b pi-b--forte">Criar</span></div></div>`,

  placar: () => `<div class="pi-placar pi-placar--g">${[['Em aberto', '14'], ['Propostas', '6'], ['Ganhas', '3'], ['Valor', 'R$ 312 mil']].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`,

  passos: () => `<div class="pi-passos pi-passos--g">${['Serviço', 'Cliente', 'Escopo', 'Preço', 'Revisar'].map((n, i) => `<span class="${i === 2 ? 'is-on' : i < 2 ? 'is-feito' : ''}">${i + 1}. ${n}</span>`).join('')}</div>`,

  resumo: () => `<div class="pi-previa-c pi-resumo--g"><small class="u-rotulo">Resumo</small><b>R$ 48.200</b>
      <span class="pi-lin"><span>Projeto legal</span><span>R$ 12.400</span></span><span class="pi-lin"><span>Executivo</span><span>R$ 35.800</span></span><span class="pi-lin"><span>Prazo</span><span>94 dias</span></span></div>`,

  bloco: () => `<div class="pi-caixa pi-caixa--g"><div class="pi-caixa__t">Contato e sede ${etq('público')}</div>
      <div class="pi-tres">${['E-mail', 'Telefone', 'Site', 'Rua e número', 'Bairro', 'Cidade · UF'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}</div>
      <div class="pi-parte">${['Caixa postal', 'CEP'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}</div></div>`,

  'faixa-de-criar': () => `<div class="pi-tiles pi-tiles--g">${['Arquitetura', 'Interiores', 'Ambientação', 'Legal'].map((n) => `<div class="pi-tile"><b>${n}</b><small>+ nova proposta</small></div>`).join('')}</div>`,

  grafico: () => `<div class="pi-graf pi-graf--g"><svg viewBox="0 0 300 70" preserveAspectRatio="none"><polyline points="0,56 40,46 80,50 120,32 160,36 200,20 240,27 300,10" fill="none" stroke="#2F6FAF" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline points="0,64 40,58 80,60 120,50 160,53 200,44 240,46 300,37" fill="none" stroke="#BB8248" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
      <div class="pi-leg-g"><span><i style="background:#2F6FAF"></i>alcance</span><span><i style="background:#BB8248"></i>salvos</span></div></div>`,

  'previa-de-folha': () => `<div class="pi-pdf"><small class="u-rotulo">Como sai no contrato</small><div class="pi-pdf__f">Odisse, Estúdio de Arquitetura e Design, inscrita no CNPJ sob o nº 00.000.000/0001-00, com sede na Rua Bananeiras, 361, Sala 107, Manaíra, João Pessoa/PB…</div></div>`,

  avisos: () => `<div class="pi-avisos"><div class="pi-aviso">Quando o Funil existir, este espaço mostra as pendências do dia.</div><div class="pi-ok">Salvo.</div><div class="pi-erro">Não foi possível salvar (409).</div></div>`,

  vazio: () => `<div class="pi-vazio">Nenhum documento ainda.</div>`,

  trilha: () => `<div class="pi-etqs"><nav class="u-trilha"><a>Biblioteca</a><span class="sep">/</span><span>Padrões de interface</span></nav></div>`,

  barra: () => `<div class="pi-ub"><span class="pi-ub__e"><i class="pi-selo pi-selo--b"></i><b>ODISSE</b><small>UNIVERSO</small></span><span class="pi-ub__m"><span>Início</span><span>Ferramentas</span><span class="is-on">Biblioteca</span></span><span class="pi-ub__d">Universo ▾</span></div>`,
};

// ---- catálogo ------------------------------------------------------------------------------------------------------
// Disposições em grupos por semelhança (Cid, 19/11). modelo: página de referência (null = ainda sem página modelo).

const DISPOSICOES = [
  { grupo: 'Listas', itens: [
    { id: 'lista-em-tons', nome: 'Lista em tons', modelo: 'Ferramentas',
      para: 'Listas de navegação: o que se abre a partir daqui, em grupos coloridos.',
      nao: 'listas de registros (use Registro) nem dados (use Ficha).',
      onde: { s: ['ferramentas', 'canais'] } },
    { id: 'registro', nome: 'Registro', modelo: 'Propostas › Histórico', decisao: 'padrão próprio (Cid, 19/11)',
      para: 'Listas de registros que crescem: Filtros e Seletor no alto, Régua, linhas em cartões brancos, 10 por página com setas em caixa. Linha clicável abre o registro ou a Gaveta.',
      onde: { s: ['historico'], v: ['contatos', 'projetos', 'emitidos'] },
      ajustar: 'Contatos e Projetos: linha sob o título (barra antiga do vendas e do Projetos).' },
    { id: 'pilha', nome: 'Pilha', modelo: 'Cargos e títulos',
      para: 'Itens em ordem que se reordenam: posição, alça, ↑ ↓ ×, "Acrescentar" tracejado no fim.',
      onde: { s: ['cargos', 'gestor'], v: ['pgt'] },
      ajustar: 'PGT: pilhas aninhadas com Fluxo e Ilhas em barra à esquerda e comandos sem caixa (com sua aprovação).' },
    { id: 'sanfona', nome: 'Sanfona', modelo: null,
      para: 'Itens longos lidos um de cada vez: cartões largos que abrem e fecham no lugar.',
      onde: { s: ['acomp'], v: ['pgt'] } },
  ] },
  { grupo: 'Grades de cartões', itens: [
    { id: 'galeria', nome: 'Galeria', modelo: 'Equipe',
      para: 'Pessoas ou coisas reconhecidas pela imagem: grade de cartões com foto.',
      onde: { s: ['equipe'], v: ['corretores'] } },
    { id: 'vitrine', nome: 'Vitrine', modelo: 'Biblioteca › Modelos',
      para: 'Arquivos vistos pela miniatura. A miniatura toma a proporção do arquivo (A4, 3:4, 16:9…); os comandos seguem o que o item é: modelo = Baixar PDF · Usar; post = Abrir · Duplicar · Arquivar.',
      decisao: 'o Mosaico entrou na Vitrine (Cid, 19/11)',
      onde: { s: ['biblioteca'], a: ['publicacoes'] },
      ajustar: 'Publicações (marketing): visual anterior ao Universo e comandos só no hover (fica para depois).' },
    { id: 'mural', nome: 'Mural', modelo: null,
      para: 'Oportunidades com imagem que se abrem no lugar; alterna com uma lista em linhas.',
      onde: { v: ['corretores'], a: ['concursos', 'licitacoes', 'terrenos'] },
      ajustar: 'Radar: urgência em barra à esquerda deve virar etiqueta (com sua aprovação, antes e depois).' },
  ] },
  { grupo: 'Tabelas e colunas', itens: [
    { id: 'matriz', nome: 'Matriz', modelo: 'Referências › Fases e etapas',
      para: 'Tabelas de ajuste com muitas colunas: grupos em tons, números à direita, soma presa ao pé.',
      onde: { s: ['fases'], v: ['referencias', 'bases', 'materiais'] },
      ajustar: 'Bases › Tipologias: faixa colorida à esquerda deve virar fundo em tons.' },
    { id: 'quadro', nome: 'Quadro', modelo: null,
      para: 'Itens que andam por etapas: colunas por etapa, cartões arrastáveis.',
      onde: { s: ['funil'] },
      ajustar: 'Funil: linha sob o título.' },
  ] },
  { grupo: 'Tempo', itens: [
    { id: 'linha', nome: 'Linha', modelo: 'PGT › Linha',
      para: 'Sequências no tempo: nós ligados, com estado e decisões.',
      onde: { s: ['linha'] } },
    { id: 'calendario', nome: 'Calendário', modelo: null,
      para: 'Coisas marcadas em dias: grade do mês ou da semana, com o que falta agendar ao lado.',
      onde: { s: ['calendario'], v: ['estrategia', 'horas'] },
      ajustar: 'marketing com visual anterior ao Universo (fica para depois).' },
  ] },
  { grupo: 'Edição', itens: [
    { id: 'ficha', nome: 'Ficha', modelo: 'Empresa · Equipe',
      para: 'Ver e editar os dados de uma coisa só: a página feita de Blocos, campos sempre abertos, Barra de salvar.',
      onde: { s: ['empresa', 'pessoa', 'marca'], v: ['projeto'] },
      ajustar: 'Ficha do projeto: cabeçalho com linha embaixo e duas colunas de seções; segue como variação por enquanto.' },
    { id: 'bancada', nome: 'Bancada', modelo: null,
      para: 'Montar uma peça visual: campos de um lado, o objeto sendo montado no centro.',
      onde: { v: ['editorMkt', 'painelSite'] },
      ajustar: 'marketing e painel do site com visual próprio (fica para depois).' },
  ] },
  { grupo: 'Navegação e acesso', itens: [
    { id: 'menu-em-blocos', nome: 'Menu em blocos', modelo: 'Menu Universo',
      para: 'Ir para outro lugar: seções no alto, blocos em tons que não recolhem, "aqui" no item atual.',
      onde: { a: ['menu'] },
      ajustar: 'Seções no alto e "aqui" ainda em pílula: passam a levemente quadrados.' },
    { id: 'entrada', nome: 'Entrada', modelo: 'Entrada do Universo',
      para: 'Pedir a senha antes de abrir: um cartão no centro, selo, campo e Entrar.',
      onde: { s: ['entradaHub'], v: ['entradaV', 'entradaP', 'entradaR'], a: ['entradaM'] } },
  ] },
];

// combinações: páginas descritas pelas peças e disposições que juntam (Cid, 19/11)
const COMBINACOES = [
  { id: 'assistente', nome: 'Assistente', receita: ['Passos', 'Bloco', 'Resumo', 'Barra de emitir'],
    para: 'Montar algo em passos. Os passos ficam corridos na página (sem "Seguinte"): o nome de cada passo é uma variação do título da página, com o número numa caixinha, e o passo é feito de Blocos temáticos recolhíveis; um passo se separa do outro pelo filete de seção. Passos colados na lateral esquerda e Resumo colado na direita, fora da largura da página; abaixo de 1180 px o Resumo vira barra no pé que se abre, e no celular os Passos viram uma faixa presa no alto. Barra de emitir presa ao pé do formulário. Explicações de cada passo nas notas do fim.',
    decisao: 'passos corridos, Passos e Resumo nas laterais, Blocos temáticos, Barra de emitir (Cid, 19/11)',
    onde: { s: ['emissor'] } },
  { id: 'editor-com-previa', nome: 'Editor com prévia', receita: ['Prévia de folha', 'Bloco'],
    para: 'Escrever um documento vendo a folha: folha à esquerda, Blocos à direita. O conteúdo próprio do documento (corpo do texto e afins) se escreve nos Blocos ou direto na folha, e os dois ficam iguais. O que vem do modelo (cabeçalho, dados do escritório, rodapé) não se edita na folha.',
    decisao: 'folha à esquerda, Blocos à direita; na folha só se edita o que não vem do modelo (Cid, 19/11)',
    onde: { a: ['emissao'] },
    ajustar: 'Emissão de documentos: hoje campos à esquerda e folha à direita, folha só para ver e campos soltos. Inverter, permitir escrever o corpo do texto direto na folha e levar os campos para Blocos.' },
  { id: 'balcao', nome: 'Balcão', receita: ['Faixa de criar', 'Registro ou Vitrine'],
    para: 'Criar e consultar no mesmo lugar: Faixa de criar em cima; embaixo, o arquivo como Registro (Propostas) ou Vitrine (Publicações).',
    onde: { s: ['propostas'], a: ['publicacoes'] } },
  { id: 'painel', nome: 'Painel', receita: ['Placar', 'Gráfico', 'Matriz'],
    para: 'Acompanhar números: Placar no alto, Gráficos, Matrizes ordenáveis embaixo.',
    onde: { a: ['metricas'] },
    ajustar: 'marketing com visual anterior ao Universo (fica para depois).' },
];

const PECAS = [
  { grupo: 'Navegação', itens: [
    { id: 'barra', nome: 'Barra do Universo', modelo: 'Universo',
      para: 'Barra fixa no alto: selo, ODISSE e o nome da ferramenta à esquerda; seções no centro; Universo / Ir para à direita.',
      onde: { s: ['menu'], v: ['vendasTodas', 'projetosTodas', 'radarTodas'], a: ['mktTodas', 'painelSite'] },
      ajustar: 'marketing e painel do site com barra própria (fica para depois).' },
    { id: 'trilha', nome: 'Trilha', modelo: 'Equipe › pessoa',
      para: 'No lugar de "← Voltar", em páginas internas: rótulos em maiúsculas separados por "/".',
      onde: { s: ['pessoa', 'emitidos'], v: ['emissor'], a: ['editorMkt'] },
      ajustar: 'Editor do marketing ainda com "← Publicações".' },
    { id: 'abas', nome: 'Abas', modelo: 'Contratos', decisao: 'em caixa, com o nome da seção à esquerda (Cid, 19/11)',
      para: 'Subpáginas de uma mesma seção: nome da seção à esquerda, abas em caixa ao lado; contagem quando ajuda.',
      onde: { s: ['contratos'], v: ['contatos', 'referencias', 'bases', 'pgt', 'concursos'], a: ['estudio', 'publicacoes', 'metricas', 'painelSite'] },
      ajustar: 'Em caixa já existe (vendas, Projetos, Radar), falta o nome da seção à esquerda (Contratos já tem). O Estúdio (pílula) e as sublinhadas (marketing, painel do site) mudam de desenho.' },
    { id: 'seletor', nome: 'Seletor', modelo: 'Propostas › Histórico', decisao: 'quadrado (Cid, 19/11)',
      para: 'Escolher um modo, um filtro ou uma unidade na mesma página (não navega): Todas / Propostas / Simulações, Coluna / Ficha, % / R$. Versão pequena nas grades (critérios da Complexidade).',
      onde: { s: ['historico', 'emissor'], v: ['concursos', 'editorMkt', 'painelSite'], a: ['fases'] },
      ajustar: 'Referências › Fases e etapas: o seletor em pílula passa a quadrado.' },
    { id: 'passos', nome: 'Passos', modelo: 'Emissor de proposta',
      para: 'Etapas numeradas de um trabalho em andamento, coladas na lateral esquerda: acompanham a rolagem (a atual em destaque, as feitas marcadas) e levam ao passo com um clique; não há botão "Seguinte". No celular, faixa presa no alto que rola de lado.',
      onde: { s: ['emissor'] } },
    { id: 'filtros', nome: 'Filtros', modelo: null,
      para: 'Busca sem acento, seletores e "limpar" numa linha, acima do que filtram.',
      onde: { v: ['contatos', 'projetos', 'pgt', 'concursos', 'emitidos'] } },
  ] },
  { grupo: 'Conteúdo', itens: [
    { id: 'bloco', nome: 'Bloco', modelo: 'Empresa',
      para: 'Caixa branca com título, campos em até três colunas e partes separadas por filete leve; um assunto por Bloco (temático, nunca um Bloco por passo inteiro). Recolhível pelo título, com a seta (chevron SVG) à direita e o estado lembrado. Botões dentro do Bloco: meia largura. A Ficha é feita de Blocos; o Assistente e o Editor com prévia também os usam.',
      decisao: 'temático e recolhível, seta à direita (Cid, 19/11)',
      onde: { s: ['empresa', 'pessoa', 'marca'], v: ['emissao', 'emissor'] } },
    { id: 'regua', nome: 'Régua', modelo: 'Ferramentas',
      para: 'Rótulos das colunas de uma lista: cartão translúcido, sem linha.',
      onde: { s: ['ferramentas', 'canais'] } },
    { id: 'etiqueta', nome: 'Etiqueta', modelo: null, decisao: 'levemente quadrada, raio 4 px; nada mais em pílula (Cid, 19/11)',
      para: 'Valores curtos de categoria e situação. Também as de língua (PT / EN), as contagens e o "aqui".',
      onde: { a: ['ferramentas', 'canais', 'equipe', 'empresa', 'acervo', 'concursos', 'contatos'] },
      ajustar: 'As em pílula (hub) passam a raio 4; as retangulares antigas (.u-etiqueta, chips do vendas e do Radar) passam às mesmas cores e tamanhos.' },
    { id: 'faixa-de-criar', nome: 'Faixa de criar', modelo: null,
      para: 'Começar algo novo: um bloco por tipo (serviço, núcleo), lado a lado, acima do arquivo.',
      onde: { s: ['propostas'], a: ['publicacoes'] } },
    { id: 'placar', nome: 'Placar', modelo: null,
      para: 'Faixa de números grandes no alto de uma página: rótulo pequeno, número grande.',
      onde: { s: ['funil', 'projetos'], a: ['metricas'] } },
    { id: 'grafico', nome: 'Gráfico', modelo: null,
      para: 'Séries no tempo em caixa branca, cores seguras para daltonismo (azul e ocre), legenda embaixo.',
      onde: { a: ['metricas'] } },
    { id: 'resumo', nome: 'Resumo', modelo: 'Emissor de proposta',
      para: 'O resultado em números enquanto se monta algo, colado na lateral direita: total em destaque, as partes embaixo, conferências calculadas e avisos (ex.: simulação). Abaixo de 1180 px vira barra no pé (total e prazo) que se abre.',
      onde: { s: ['emissor'] } },
    { id: 'previa-de-folha', nome: 'Prévia de folha', modelo: 'Empresa',
      para: '"Como sai no contrato / no documento" sobre um pedaço de folha. Inteira, são as folhas da Marca (montador), reduzidas, com um Seletor dos modelos que a Marca oferece (Coluna, Ficha e os que vierem); sem número antes de emitir e com a caixa da rubrica no lugar dela. No Editor com prévia o conteúdo próprio do documento se escreve direto na folha.',
      onde: { s: ['empresa', 'pessoa', 'emissor'], a: ['emissao'] } },
  ] },
  { grupo: 'Comandos', itens: [
    { id: 'botoes', nome: 'Botões', modelo: 'Equipe',
      para: 'Neutro para quase tudo; uma ação principal em Ocre por página; perigo fica vermelho no hover.',
      onde: { s: ['equipe', 'empresa'], v: ['vendasTodas', 'projetosTodas'] } },
    { id: 'caixa-de-comando', nome: 'Caixa de comando', modelo: 'Ferramentas',
      para: 'Editar e demais comandos do cartão: sempre numa caixa de 24 px, sempre visíveis, à esquerda.',
      onde: { s: ['ferramentas', 'canais', 'cargos'], a: ['pgt', 'concursos'] },
      ajustar: 'PGT (comandos sem caixa) e Radar (lápis só no hover).' },
    { id: 'barra-de-salvar', nome: 'Barra de salvar', modelo: 'Empresa',
      para: 'Presa ao pé, ardósia, só aparece com mudança: "N mudanças não salvas", Descartar e Salvar em Ocre. Variação Barra de emitir (Assistente): sempre visível no pé do formulário, com o que falta (leva ao passo), Salvar rascunho e Emitir em Ocre, que só se ativa com tudo preenchido.',
      onde: { s: ['empresa', 'pessoa', 'marca', 'emissor'], v: ['editorMkt'] } },
    { id: 'gaveta', nome: 'Gaveta', modelo: null,
      para: 'Criar ou editar sem sair da página: painel que entra pela direita sobre a página escurecida.',
      onde: { s: ['funil', 'contatos', 'projetos', 'bases'] } },
  ] },
  { grupo: 'Mensagens', itens: [
    { id: 'avisos', nome: 'Avisos', modelo: 'Início',
      para: 'Aviso em ocre claro; ok em areia; erro em vermelho claro. Sem barra à esquerda.',
      onde: { s: ['equipe', 'empresa'], a: ['metricas'] },
      ajustar: 'Métricas (erro com barra à esquerda).' },
    { id: 'vazio', nome: 'Vazio', modelo: 'Emissão › emitidos',
      para: 'Quando não há nada: caixa tracejada, texto central.',
      onde: { s: ['emitidos', 'contatos'] } },
  ] },
];

// ---- página --------------------------------------------------------------------------------------------------------

export function criarPadroes({ esc }) {
  const fora = (url) => { try { return new URL(url, location.href).origin !== location.origin; } catch { return true; } };
  const lugar = (k) => {
    const [nome, ferr, url] = L[k];
    const alvo = fora(url) ? ' target="_blank" rel="noopener"' : '';
    return `<a class="etq etq--link pi-lugar" href="${esc(url)}"${alvo}>${esc(nome)}<span> · ${esc(ferr)}</span></a>`;
  };
  const ROT = { s: 'Segue', v: 'Variação', a: 'A ajustar' };

  const caixa = (p) => `<article class="u-cartao pi-padrao" id="pi-${p.id}">
      <div class="pi-cab"><h3 class="pi-nome">${esc(p.nome)}</h3>
        ${p.receita ? '<span class="etq">combinação</span>' : p.modelo ? `<span class="etq etq--ok">modelo: ${esc(p.modelo)}</span>` : '<span class="etq etq--breve">sem página modelo</span>'}</div>
      ${p.receita ? `<p class="pi-receita">${p.receita.map((r) => `<span class="etq">${esc(r)}</span>`).join('<span class="pi-mais">+</span>')}</p>` : ''}
      <div class="pi-palco${p.peca ? ' pi-palco--var' : ''}" aria-hidden="true">${AMOSTRA[p.id] ? AMOSTRA[p.id]() : ''}</div>
      <p class="pi-para">${esc(p.para)}</p>
      ${p.nao ? `<p class="pi-nao">Não usar para: ${esc(p.nao)}</p>` : ''}
      ${p.decisao ? `<p class="pi-nao">Decisão: ${esc(p.decisao)}</p>` : ''}
      <dl class="pi-onde">${['s', 'v', 'a'].filter((k) => (p.onde[k] || []).length).map((k) =>
        `<div><dt>${ROT[k]}</dt><dd>${p.onde[k].map(lugar).join('')}</dd></div>`).join('')}</dl>
      ${p.ajustar ? `<p class="pi-ajustar">${esc(p.ajustar)}</p>` : ''}
    </article>`;

  const todos = (grupos) => grupos.flatMap((g) => g.itens);
  const indice = (rot, lista) => `<div class="pi-indice"><span class="u-rotulo">${rot}</span><div>${lista.map((p) =>
    `<button type="button" class="etq etq--link" data-ir="pi-${p.id}">${esc(p.nome)}</button>`).join('')}</div></div>`;
  const grupos = (lista, peca = false) => lista.map((g) => `<div class="pi-grupo"><span class="u-rotulo">${esc(g.grupo)}</span>
      <div class="pi-grade">${g.itens.map((p) => caixa({ ...p, peca })).join('')}</div></div>`).join('');

  function ligar(raiz) {
    raiz.innerHTML = `<div class="cab"><div><nav class="u-trilha" aria-label="Você está em"><a href="#/biblioteca">Biblioteca</a><span class="sep">/</span><span aria-current="page">Padrões de interface</span></nav>
        <h1 class="u-titulo">Padrões de interface</h1></div></div>
      <nav class="pi-indices" aria-label="Padrões">${indice('Disposições', todos(DISPOSICOES))}${indice('Combinações', COMBINACOES)}${indice('Peças', todos(PECAS))}</nav>
      <section class="pi-secao"><h2 class="u-subtitulo">Disposições</h2>${grupos(DISPOSICOES)}</section>
      <section class="pi-secao"><h2 class="u-subtitulo">Combinações</h2>
        <div class="pi-grade">${COMBINACOES.map((p) => caixa(p)).join('')}</div></section>
      <section class="pi-secao"><h2 class="u-subtitulo">Peças</h2>${grupos(PECAS, true)}</section>
      <section class="pi-secao pi-notas">
        <div><span class="u-rotulo">Como pedir</span><p>Pelo nome: "Fornecedores em Registro, com Gaveta e Filtros"; "esse cartão no desenho da Galeria"; "essa ficha como a Empresa".</p></div>
        <div><span class="u-rotulo">Situações</span><p><b>Segue</b>: a página está no padrão. <b>Variação</b>: mesma ideia, com diferenças. <b>A ajustar</b>: legado que vai migrar para o padrão (design.md § 0).</p></div>
        <div><span class="u-rotulo">Disposição, combinação e modelo</span><p>Disposição é um desenho de página com regra própria; combinação é um arranjo conhecido de peças (Cid, 19/11). Modelo é a página de referência; sem página modelo, o padrão tem nome mas ainda não foi alinhado.</p></div>
        <div><span class="u-rotulo">Formas</span><p>Nada em pílula (Cid, 19/11): raio 4 px nas peças pequenas (etiquetas, contagens, PT / EN), 6 px em abas, seletores e botões, 8 px no fundo das abas e nos cartões. As amostras são cópias, só para ver; nenhuma página muda por causa deste catálogo.</p></div>
      </section>`;
    raiz.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => {
      const alvo = raiz.querySelector('#' + b.dataset.ir);
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  return { ligar };
}
