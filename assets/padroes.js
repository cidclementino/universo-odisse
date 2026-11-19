// Biblioteca › Padrões de interface (#/padroes) — Cid, 19/11.
// Catálogo das formas de dispor o conteúdo no Odisse, com nome, para pedir "tal página em Registro, com Gaveta".
// Primeira etapa, conservadora: as amostras são CÓPIAS próprias desta página (classes .pi-*, assets/padroes.css);
// nenhuma ferramenta passa a depender delas e nenhuma página muda por causa deste catálogo.
// Situação de cada lugar: s = segue o padrão · v = variação · a = a ajustar (legado do design.md § 0).

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

  vitrine: () => `<div class="pi-grade3">${['Carta', 'Declaração', 'Memorando'].map((n) => `
    <div class="pi-vit"><div class="pi-a4">${tr(5, [50, 90, 85, 88, 40])}</div><b>${n}</b><div class="pi-acoes"><span class="pi-b">Baixar PDF</span><span class="pi-b">Usar este modelo</span></div></div>`).join('')}</div>`,

  mosaico: () => `<div class="pi-mosaico">${['ambar', 'ardosia', 'pessego', 'areia', 'terra', 'nevoa'].map((c, i) => `
    <div class="pi-capa-c"><div class="pi-capa" style="--c:var(--pi-${c})"></div><b>Post ${i + 1}</b><small>1${i}/11</small></div>`).join('')}</div>`,

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
    <div class="pi-form">${['Área', 'Tipologia', 'Fases'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}<div class="pi-acoes"><span class="pi-b">Voltar</span><span class="pi-b">Continuar</span></div></div>
    <div class="pi-previa-c"><small>Prévia</small><b>R$ 48.200</b>${tr(3, [80, 60, 70])}</div></div>`,

  'editor-com-previa': () => `<div class="pi-edprev">
    <div class="pi-form">${['Tipo', 'Destinatário', 'Assunto', 'Texto'].map((r, i) => `<div class="pi-campo"><span>${r}</span><i${i === 3 ? ' class="alto"' : ''}></i></div>`).join('')}</div>
    <div class="pi-folha-g">${tr(8, [35, 50, 92, 88, 90, 86, 60, 30])}</div></div>`,

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
  abas: () => `<div class="pi-var"><small>em pílula · modelo</small>
      <nav class="abas-estudio pi-abas-real"><span class="u-rotulo">O Estúdio</span><div class="abas"><a class="ativa">Empresa</a><a>Equipe</a><a>Marca</a><a>Canais</a></div></nav></div>
    <div class="pi-var"><small>em caixa · vendas, Projetos, Radar</small><span class="pi-abas-caixa"><span class="is-on">Todos <em>42</em></span><span>Pessoas <em>30</em></span><span>Organizações <em>12</em></span></span></div>
    <div class="pi-var"><small>sublinhadas · marketing, painel do site</small><span class="pi-abas-sub"><span class="is-on">Posts 3:4</span><span>Pins</span><span>Stories</span></span></div>`,

  seletor: () => `<div class="pi-var"><small>quadrado · vendas, Projetos, Radar, marketing</small><span class="pi-seg pi-seg--g"><span class="is-on">Cartões</span><span>Lista</span></span></div>
    <div class="pi-var"><small>em pílula · Referências › Fases e etapas</small><span class="pi-seg pi-seg--p"><span class="is-on">%</span><span>R$</span><span>dias</span></span></div>`,

  filtros: () => `<div class="pi-filtros"><span class="pi-busca pi-busca--g">Buscar por nome, e-mail…</span><span class="pi-sel">Todos os núcleos</span><span class="pi-sel">Situação</span><a class="pi-limpar">limpar</a></div>`,

  regua: () => `<div class="pi-regua pi-regua--g"><span></span><span>Ferramenta</span><span>O que faz</span><span>Onde</span><span>Estado</span></div>`,

  etiqueta: () => `<div class="pi-etqs">${etq('categoria')}${etq('no ar', 'ok')}${etq('atenção', 'atencao')}${etq('problema', 'problema')}${etq('em breve', 'breve')}<span class="etq pi-aqui">aqui</span><span class="etq etq--link">Painel do site</span>
    <span class="lingua">PT</span><span class="lingua en">EN</span></div>`,

  'caixa-de-comando': () => `<div class="pi-etqs">${caixaCtl(alca)}${caixaCtl(lapis)}${caixaCtl(cadeado)}${caixaCtl(lapis, true)}<small class="pi-leg">alça · editar · travar · ligado</small></div>`,

  botoes: () => `<div class="pi-etqs"><span class="u-botao">Cargos e títulos</span><span class="u-botao forte">+ Pessoa</span><span class="u-botao pi-perigo">Arquivar</span><a class="pi-limpar">limpar</a></div>`,

  'barra-de-salvar': () => `<div class="pi-folga"></div><div class="pi-salvar pi-salvar--g"><span>3 mudanças não salvas</span><span class="pi-b pi-b--claro">Descartar</span><span class="pi-b pi-b--forte">Salvar</span></div>`,

  gaveta: () => `<div class="pi-gav"><div class="pi-gav__pag">${tr(6, [40, 90, 85, 80, 88, 70])}</div><div class="pi-gav__p"><div class="pi-gav__t"><b>Nova oportunidade</b><span>×</span></div>${['Título', 'Cliente', 'Origem'].map((r) => `<div class="pi-campo"><span>${r}</span><i></i></div>`).join('')}<span class="pi-b pi-b--forte">Criar</span></div></div>`,

  placar: () => `<div class="pi-placar pi-placar--g">${[['Em aberto', '14'], ['Propostas', '6'], ['Ganhas', '3'], ['Valor', 'R$ 312 mil']].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`,

  'previa-de-folha': () => `<div class="pi-pdf"><small class="u-rotulo">Como sai no contrato</small><div class="pi-pdf__f">Odisse, Estúdio de Arquitetura e Design, inscrita no CNPJ sob o nº 00.000.000/0001-00, com sede na Rua Bananeiras, 361, Sala 107, Manaíra, João Pessoa/PB…</div></div>`,

  avisos: () => `<div class="pi-avisos"><div class="pi-aviso">Quando o Funil existir, este espaço mostra as pendências do dia.</div><div class="pi-ok">Salvo.</div><div class="pi-erro">Não foi possível salvar (409).</div></div>`,

  vazio: () => `<div class="pi-vazio">Nenhum documento ainda.</div>`,

  trilha: () => `<div class="pi-etqs"><nav class="u-trilha"><a>Biblioteca</a><span class="sep">/</span><span>Padrões de interface</span></nav></div>`,

  barra: () => `<div class="pi-ub"><span class="pi-ub__e"><i class="pi-selo pi-selo--b"></i><b>ODISSE</b><small>UNIVERSO</small></span><span class="pi-ub__m"><span>Início</span><span>Ferramentas</span><span class="is-on">Biblioteca</span></span><span class="pi-ub__d">Universo ▾</span></div>`,
};

// ---- catálogo ------------------------------------------------------------------------------------------------------
// modelo: página que serve de referência (null = ainda sem página modelo)

const DISPOSICOES = [
  { id: 'lista-em-tons', nome: 'Lista em tons', modelo: 'Ferramentas',
    para: 'Listas de navegação: o que se abre a partir daqui, em grupos coloridos.',
    nao: 'listas de registros (use Registro) nem dados (use Ficha).',
    onde: { s: ['ferramentas', 'canais'] } },
  { id: 'ficha', nome: 'Ficha', modelo: 'Empresa · Equipe',
    para: 'Ver e editar os dados de uma coisa só: caixas por assunto, campos sempre abertos, barra de salvar.',
    onde: { s: ['empresa', 'pessoa', 'marca'], v: ['projeto'] },
    ajustar: 'Ficha do projeto: cabeçalho com linha embaixo e duas colunas de seções; segue como variação por enquanto.' },
  { id: 'registro', nome: 'Registro', modelo: null, decisao: 'padrão próprio (Cid, 19/11)',
    para: 'Listas de registros que crescem: contatos, projetos, documentos emitidos. Linha clicável abre o registro ou a Gaveta.',
    onde: { v: ['contatos', 'projetos', 'emitidos'] },
    ajustar: 'Contatos e Projetos: linha sob o título (barra antiga do vendas e do Projetos).' },
  { id: 'galeria', nome: 'Galeria', modelo: 'Equipe',
    para: 'Pessoas ou coisas reconhecidas pela imagem: grade de cartões com foto.',
    onde: { s: ['equipe'], v: ['corretores'] } },
  { id: 'vitrine', nome: 'Vitrine', modelo: 'Biblioteca › Modelos',
    para: 'Modelos para baixar ou usar: caixa com miniatura e dois comandos (a caixa não é clicável inteira).',
    onde: { s: ['biblioteca'] } },
  { id: 'mosaico', nome: 'Mosaico', modelo: null,
    para: 'Arquivo visual em proporção fixa: as capas são o conteúdo (posts 3:4).',
    onde: { a: ['publicacoes'] },
    ajustar: 'marketing ainda com barra, cores e tipografia anteriores ao Universo (fica para depois).' },
  { id: 'mural', nome: 'Mural', modelo: null,
    para: 'Oportunidades com imagem que se abrem no lugar; alterna com uma lista em linhas.',
    onde: { v: ['corretores'], a: ['concursos', 'licitacoes', 'terrenos'] },
    ajustar: 'Radar: urgência em barra à esquerda deve virar etiqueta (com sua aprovação, antes e depois).' },
  { id: 'pilha', nome: 'Pilha', modelo: 'Cargos e títulos',
    para: 'Itens em ordem que se reordenam: posição, alça, ↑ ↓ ×, "Acrescentar" tracejado no fim.',
    onde: { s: ['cargos'], v: ['pgt'] },
    ajustar: 'PGT: pilhas aninhadas com Fluxo e Ilhas em barra à esquerda e comandos sem caixa (com sua aprovação).' },
  { id: 'sanfona', nome: 'Sanfona', modelo: null,
    para: 'Itens longos lidos um de cada vez: cartões largos que abrem e fecham no lugar.',
    onde: { s: ['acomp'], v: ['pgt'] } },
  { id: 'quadro', nome: 'Quadro', modelo: null,
    para: 'Itens que andam por etapas: colunas por etapa, cartões arrastáveis.',
    onde: { s: ['funil'] },
    ajustar: 'Funil: linha sob o título.' },
  { id: 'matriz', nome: 'Matriz', modelo: 'Referências › Fases e etapas',
    para: 'Tabelas de ajuste com muitas colunas: grupos em tons, números à direita, soma presa ao pé.',
    onde: { s: ['fases'], v: ['referencias', 'bases', 'materiais'] },
    ajustar: 'Bases › Tipologias: faixa colorida à esquerda deve virar fundo em tons.' },
  { id: 'linha', nome: 'Linha', modelo: 'PGT › Linha',
    para: 'Sequências no tempo: nós ligados, com estado e decisões.',
    onde: { s: ['linha'] } },
  { id: 'calendario', nome: 'Calendário', modelo: null,
    para: 'Coisas marcadas em dias: grade do mês ou da semana, com o que falta agendar ao lado.',
    onde: { s: ['calendario'], v: ['estrategia', 'horas'] },
    ajustar: 'marketing com visual anterior ao Universo (fica para depois).' },
  { id: 'balcao', nome: 'Balcão', modelo: null,
    para: 'Criar e consultar no mesmo lugar: blocos para começar algo novo em cima, arquivo com filtros embaixo.',
    onde: { s: ['propostas'], v: ['publicacoes'] } },
  { id: 'assistente', nome: 'Assistente', modelo: null,
    para: 'Montar algo em passos: passos à esquerda, formulário no centro, prévia do resultado à direita.',
    onde: { s: ['emissor'] } },
  { id: 'editor-com-previa', nome: 'Editor com prévia', modelo: 'Emissão de documentos',
    para: 'Escrever um documento vendo a folha: formulário fixo de um lado, folha do outro.',
    onde: { s: ['emissao'] } },
  { id: 'bancada', nome: 'Bancada', modelo: null,
    para: 'Montar uma peça visual: campos de um lado, o objeto sendo montado no centro.',
    onde: { v: ['editorMkt', 'painelSite'] },
    ajustar: 'marketing e painel do site com visual próprio (fica para depois).' },
  { id: 'painel', nome: 'Painel', modelo: null,
    para: 'Acompanhar números: Placar no alto, gráficos e tabelas ordenáveis embaixo.',
    onde: { a: ['metricas'] },
    ajustar: 'marketing com visual anterior ao Universo (fica para depois).' },
  { id: 'menu-em-blocos', nome: 'Menu em blocos', modelo: 'Menu Universo',
    para: 'Ir para outro lugar: seções em pílula, blocos em tons que não recolhem, "aqui" no item atual.',
    onde: { s: ['menu'] } },
  { id: 'entrada', nome: 'Entrada', modelo: 'Entrada do Universo',
    para: 'Pedir a senha antes de abrir: um cartão no centro, selo, campo e Entrar.',
    onde: { s: ['entradaHub'], v: ['entradaV', 'entradaP', 'entradaR'], a: ['entradaM'] } },
];

const PECAS = [
  { id: 'abas', nome: 'Abas', modelo: 'O Estúdio',
    para: 'Subpáginas de uma mesma seção: rótulo da seção à esquerda, abas em pílula; cada aba é uma página com o próprio título.',
    variantes: 'em pílula (modelo) · em caixa, com contagem · sublinhadas',
    onde: { s: ['estudio'], v: ['contatos', 'referencias', 'bases', 'pgt', 'concursos'], a: ['publicacoes', 'metricas', 'painelSite'] },
    ajustar: 'Sublinhadas (marketing, painel do site) são as mais distantes do modelo.' },
  { id: 'seletor', nome: 'Seletor', modelo: null,
    para: 'Escolher um modo ou uma unidade na mesma página (não navega): Cartões / Lista, % / R$.',
    variantes: 'quadrado · em pílula, pequeno',
    onde: { v: ['emissor', 'fases', 'concursos', 'editorMkt', 'painelSite'] } },
  { id: 'filtros', nome: 'Filtros', modelo: null,
    para: 'Busca sem acento, seletores e "limpar" numa linha, acima do que filtram.',
    onde: { v: ['contatos', 'projetos', 'pgt', 'concursos', 'emitidos'] } },
  { id: 'regua', nome: 'Régua', modelo: 'Ferramentas',
    para: 'Rótulos das colunas de uma lista: cartão translúcido, sem linha.',
    onde: { s: ['ferramentas', 'canais'] } },
  { id: 'etiqueta', nome: 'Etiqueta', modelo: 'Ferramentas',
    para: 'Valores curtos de categoria e situação, em pílula. Também as de língua (PT / EN).',
    onde: { s: ['ferramentas', 'canais', 'equipe', 'empresa'], a: ['acervo', 'concursos', 'contatos'] },
    ajustar: 'Etiquetas retangulares (.u-etiqueta) e chips antigos: Acervo da Biblioteca, Radar, vendas.' },
  { id: 'caixa-de-comando', nome: 'Caixa de comando', modelo: 'Ferramentas',
    para: 'Editar e demais comandos do cartão: sempre numa caixa de 24 px, sempre visíveis, à esquerda.',
    onde: { s: ['ferramentas', 'canais', 'cargos'], a: ['pgt', 'concursos'] },
    ajustar: 'PGT (comandos sem caixa) e Radar (lápis só no hover).' },
  { id: 'botoes', nome: 'Botões', modelo: 'Equipe',
    para: 'Neutro para quase tudo; uma ação principal em Ocre por página; perigo fica vermelho no hover.',
    onde: { s: ['equipe', 'empresa'], v: ['vendasTodas', 'projetosTodas'] } },
  { id: 'barra-de-salvar', nome: 'Barra de salvar', modelo: 'Empresa',
    para: 'Presa ao pé, só aparece com mudança: "N mudanças não salvas", Descartar e Salvar em Ocre.',
    onde: { s: ['empresa', 'pessoa', 'marca'], v: ['editorMkt'] } },
  { id: 'gaveta', nome: 'Gaveta', modelo: null,
    para: 'Criar ou editar sem sair da página: painel que entra pela direita sobre a página escurecida.',
    onde: { s: ['funil', 'contatos', 'projetos', 'bases'] } },
  { id: 'placar', nome: 'Placar', modelo: null,
    para: 'Faixa de números grandes no alto de uma página: rótulo pequeno, número grande.',
    onde: { s: ['funil', 'projetos'], a: ['metricas'] } },
  { id: 'previa-de-folha', nome: 'Prévia de folha', modelo: 'Empresa',
    para: '"Como sai no contrato / no documento" ao lado do dado, sobre um pedaço de folha.',
    onde: { s: ['empresa', 'pessoa'] } },
  { id: 'avisos', nome: 'Avisos', modelo: 'Início',
    para: 'Aviso em ocre claro; ok em areia; erro em vermelho claro. Sem barra à esquerda.',
    onde: { s: ['equipe', 'empresa'], a: ['metricas'] },
    ajustar: 'Métricas (erro com barra à esquerda).' },
  { id: 'vazio', nome: 'Vazio', modelo: 'Emissão › emitidos',
    para: 'Quando não há nada: caixa tracejada, texto central.',
    onde: { s: ['emitidos', 'contatos'] } },
  { id: 'trilha', nome: 'Trilha', modelo: 'Equipe › pessoa',
    para: 'No lugar de "← Voltar", em páginas internas: rótulos em maiúsculas separados por "/".',
    onde: { s: ['pessoa', 'emitidos'], v: ['emissor'], a: ['editorMkt'] },
    ajustar: 'Editor do marketing ainda com "← Publicações".' },
  { id: 'barra', nome: 'Barra do Universo', modelo: 'Universo',
    para: 'Barra fixa no alto: selo, ODISSE e o nome da ferramenta à esquerda; seções no centro; Universo / Ir para à direita.',
    onde: { s: ['menu'], v: ['vendasTodas', 'projetosTodas', 'radarTodas'], a: ['mktTodas', 'painelSite'] },
    ajustar: 'marketing e painel do site com barra própria (fica para depois).' },
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
        ${p.modelo ? `<span class="etq etq--ok">modelo: ${esc(p.modelo)}</span>` : '<span class="etq etq--breve">sem página modelo</span>'}</div>
      <div class="pi-palco${p.peca ? ' pi-palco--var' : ''}" aria-hidden="true">${AMOSTRA[p.id] ? AMOSTRA[p.id]() : ''}</div>
      <p class="pi-para">${esc(p.para)}</p>
      ${p.nao ? `<p class="pi-nao">Não usar para: ${esc(p.nao)}</p>` : ''}
      ${p.variantes ? `<p class="pi-nao">Variantes: ${esc(p.variantes)}</p>` : ''}
      ${p.decisao ? `<p class="pi-nao">Decisão: ${esc(p.decisao)}</p>` : ''}
      <dl class="pi-onde">${['s', 'v', 'a'].filter((k) => (p.onde[k] || []).length).map((k) =>
        `<div><dt>${ROT[k]}</dt><dd>${p.onde[k].map(lugar).join('')}</dd></div>`).join('')}</dl>
      ${p.ajustar ? `<p class="pi-ajustar">${esc(p.ajustar)}</p>` : ''}
    </article>`;

  const indice = (rot, lista) => `<div class="pi-indice"><span class="u-rotulo">${rot}</span><div>${lista.map((p) =>
    `<button type="button" class="etq etq--link" data-ir="pi-${p.id}">${esc(p.nome)}</button>`).join('')}</div></div>`;

  function ligar(raiz) {
    raiz.innerHTML = `<div class="cab"><div><nav class="u-trilha" aria-label="Você está em"><a href="#/biblioteca">Biblioteca</a><span class="sep">/</span><span aria-current="page">Padrões de interface</span></nav>
        <h1 class="u-titulo">Padrões de interface</h1></div></div>
      <nav class="pi-indices" aria-label="Padrões">${indice('Disposições', DISPOSICOES)}${indice('Peças', PECAS)}</nav>
      <section class="pi-secao"><h2 class="u-subtitulo">Disposições</h2>
        <div class="pi-grade">${DISPOSICOES.map(caixa).join('')}</div></section>
      <section class="pi-secao"><h2 class="u-subtitulo">Peças</h2>
        <div class="pi-grade">${PECAS.map((p) => caixa({ ...p, peca: true })).join('')}</div></section>
      <section class="pi-secao pi-notas">
        <div><span class="u-rotulo">Como pedir</span><p>Pelo nome: "Fornecedores em Registro, com Gaveta e Filtros"; "esse cartão no desenho da Galeria"; "essa ficha como a Empresa".</p></div>
        <div><span class="u-rotulo">Situações</span><p><b>Segue</b>: a página está no padrão. <b>Variação</b>: mesma ideia, com diferenças. <b>A ajustar</b>: legado que vai migrar para o padrão (design.md § 0).</p></div>
        <div><span class="u-rotulo">Modelo</span><p>A página de referência do padrão. Sem página modelo: o padrão existe e tem nome, mas ainda não foi alinhado ao design.md.</p></div>
        <div><span class="u-rotulo">Amostras</span><p>Cópias pequenas, só para ver. As ferramentas não dependem delas; nenhuma página muda por causa deste catálogo.</p></div>
      </section>`;
    raiz.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => {
      const alvo = raiz.querySelector('#' + b.dataset.ir);
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  return { ligar };
}
