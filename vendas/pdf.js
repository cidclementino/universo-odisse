// ==========================================================================
// Geração do PDF final — formato espelhado no modelo de proposta comercial
// da Odisse (ex: PC050/2024), 100% no navegador via jsPDF + autotable.
//
// Sistema de estilos de texto (6 no total, todos em preto puro, sem
// transparência):
//   1. Nome do cliente        — negrito, corpo levemente maior
//   2. Nº da proposta         — negrito, corpo normal
//   3. Título de seção        — negrito sublinhado, corpo normal
//   4. Corpo do texto         — normal
//   5. Rodapé (texto normal)  — normal, pequeno
//   6. Rodapé (texto negrito) — negrito, pequeno
//
// Quebra de página: NENHUM ponto do documento desenha texto/tabela sem
// primeiro checar se cabe no espaço restante da página. Isso não é uma
// disciplina que cada trecho do código precisa lembrar de aplicar — está
// embutido nas próprias funções de desenho (tituloSecao, paragrafo,
// linhaTexto, listaBullets) e nas margens passadas a toda chamada de
// autoTable. Ao adicionar uma seção nova, use sempre essas funções em vez
// de doc.text()/doc.autoTable() diretamente, para manter essa garantia.
// ==========================================================================

const OdissePdf = (() => {
  // As bibliotecas do PDF (jsPDF, autotable) e a fonte Inter embutida (~220 KB) só carregam quando um PDF
  // vai ser montado: as páginas abrem sem elas. Chame `await OdissePdf.preparar()` antes de montar().
  const LIBS = [
    ['jspdf', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf],
    ['autotable', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', () => window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable],
    ['inter', 'fonts-inter.js?v=31c6429b0b', () => typeof INTER_REGULAR_B64 !== 'undefined'],
  ];
  let preparando = null;
  const script = (src) => new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não consegui carregar ' + src));
    document.head.appendChild(s);
  });
  function preparar() {
    if (!preparando) preparando = (async () => { for (const [, src, pronto] of LIBS) if (!pronto()) await script(src); })()
      .catch((e) => { preparando = null; throw e; });
    return preparando;
  }

  const PAGE_W = 595.28; // A4 pt
  const PAGE_H = 841.89;

  // Documento deslocado à direita: margem esquerda maior que a direita —
  // mas só para o corpo do texto. Cabeçalho e rodapé mantêm a margem original.
  const LEFT = 165;
  const RIGHT = 48;
  const CONTENT_W = PAGE_W - LEFT - RIGHT;

  const MARGIN_HF = 48; // margem de cabeçalho/rodapé — não afetada pelo deslocamento acima

  const PRETO = [0, 0, 0];

  const TOPO_CONTEUDO = 118;   // onde o corpo do texto pode começar, abaixo do cabeçalho
  const FUNDO_LIMITE = 700;    // limite antes de quebrar página — deixa espaço livre até o rodapé
  const RODAPE_Y = 725;
  const MARGEM_TABELA = { top: TOPO_CONTEUDO, bottom: PAGE_H - RODAPE_Y + 6, left: LEFT, right: RIGHT };

  function garantirFonteInter(doc) {
    if (typeof INTER_REGULAR_B64 === 'undefined') return; // fallback: segue com a fonte padrão do jsPDF
    doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR_B64);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD_B64);
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
    doc.setFont('Inter', 'normal');
  }

  // ---------- estilos ----------
  function estiloNomeCliente(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(14); doc.setTextColor(...PRETO); }
  function estiloNumero(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...PRETO); }
  function estiloTitulo(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...PRETO); }
  function estiloCorpo(doc, tamanho = 11) { doc.setFont('Inter', 'normal'); doc.setFontSize(tamanho); doc.setTextColor(...PRETO); }
  function estiloCorpoBold(doc, tamanho = 11) { doc.setFont('Inter', 'bold'); doc.setFontSize(tamanho); doc.setTextColor(...PRETO); }
  function estiloRodapePequeno(doc) { doc.setFont('Inter', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...PRETO); }
  function estiloRodapePequenoBold(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...PRETO); }

  function novaFolha(doc) {
    doc.addPage();
  }

  // Cabeçalho: "ODISSE," / "ARQUITETOS" em duas linhas à esquerda, espaço
  // reservado para a logo à direita (a caixa tracejada é só um placeholder de
  // desenvolvimento — trocar por doc.addImage() assim que a logo for enviada).
  function cabecalho(doc) {
    const topY = 42;
    estiloNumero(doc);
    doc.text('ODISSE,', MARGIN_HF, topY);
    doc.text('ESTÚDIO DE ARQUITETURA E DESIGN', MARGIN_HF, topY + 13);

    const logoW = 90, logoH = 32;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(PAGE_W - MARGIN_HF - logoW, topY - 20, logoW, logoH);
    doc.setLineDashPattern([], 0);

    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_HF, topY + 24, PAGE_W - MARGIN_HF, topY + 24);
  }

  function rodape(doc) {
    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_HF, RODAPE_Y, PAGE_W - MARGIN_HF, RODAPE_Y);

    let ly = RODAPE_Y + 15;
    estiloRodapePequeno(doc);
    doc.text('Av. Bananeiras, 361. Sala 101', MARGIN_HF, ly); ly += 10;
    doc.text('Manaíra, João Pessoa – PB, Brasil', MARGIN_HF, ly); ly += 18;

    estiloRodapePequenoBold(doc);
    doc.text('E: contato@odisse.com.br', MARGIN_HF, ly); ly += 10;
    doc.text('T: +55 83 999 220 474', MARGIN_HF, ly); ly += 18;

    estiloRodapePequeno(doc);
    doc.text('www.odisse.com.br', MARGIN_HF, ly);
  }

  // ---------- primitiva base de quebra de página ----------
  function checarQuebra(doc, cursorY, alturaNecessaria) {
    if (cursorY + alturaNecessaria > FUNDO_LIMITE) {
      novaFolha(doc);
      return TOPO_CONTEUDO;
    }
    return cursorY;
  }

  // ---------- funções de desenho — todas se protegem sozinhas ----------

  // Parágrafo (várias linhas). Sempre verifica se o bloco inteiro cabe antes
  // de desenhar; se não couber, quebra a página primeiro.
  function paragrafo(doc, texto, x, y, largura, tamanho = 11) {
    estiloCorpo(doc, tamanho);
    const linhas = doc.splitTextToSize(texto, largura);
    const altura = linhas.length * (tamanho * 1.35);
    y = checarQuebra(doc, y, altura);
    doc.text(linhas, x, y);
    return y + altura;
  }

  // Linha única solta (rótulos como "Cartão de crédito:", "Cordialmente,").
  // Substitui doc.text() direto em qualquer lugar do documento — nunca
  // chamar doc.text() sem passar por aqui (ou por paragrafo/tituloSecao).
  function linhaTexto(doc, texto, x, y, { tamanho = 11, negrito = false } = {}) {
    if (negrito) estiloCorpoBold(doc, tamanho); else estiloCorpo(doc, tamanho);
    y = checarQuebra(doc, y, tamanho * 1.6);
    doc.text(texto, x, y);
    return y;
  }

  // Título de seção (negrito sublinhado). Já reserva espaço mínimo pra não
  // ficar órfão no fim da página — quem chama não precisa mais lembrar de
  // checar isso antes.
  function tituloSecao(doc, texto, y) {
    y = checarQuebra(doc, y, 34);
    estiloTitulo(doc);
    doc.text(texto, LEFT, y);
    const largura = doc.getTextWidth(texto);
    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.6);
    doc.line(LEFT, y + 2.5, LEFT + largura, y + 2.5);
    return y + 20;
  }

  // Lista de marcadores — cada item já checa individualmente se cabe.
  function listaBullets(doc, itens, y) {
    estiloCorpo(doc);
    for (const item of itens) {
      const linhas = doc.splitTextToSize('•  ' + item, CONTENT_W - 10);
      y = checarQuebra(doc, y, linhas.length * 13);
      doc.text(linhas, LEFT + 6, y);
      y += linhas.length * 13 + 2;
    }
    return y + 8;
  }

  // Envelope para autoTable: garante uma folga mínima antes de começar
  // (evita cabeçalho de tabela órfão sozinho no fim da página) e já aplica
  // a margem de topo/rodapé em toda tabela, sem precisar repetir em cada
  // chamada.
  function tabela(doc, y, opcoes) {
    y = checarQuebra(doc, y, 60);
    doc.autoTable({ startY: y, margin: MARGEM_TABELA, ...opcoes });
    return doc.lastAutoTable.finalY;
  }

  // Estilo de tabela com grade fina (todas as bordas), sem zebra — usado no
  // Cronograma e nas tabelas de forma de pagamento.
  const ESTILO_TABELA_GRADE = {
    theme: 'grid',
    styles: { font: 'Inter', fontSize: 9.5, textColor: PRETO, lineColor: PRETO, lineWidth: 0.5, cellPadding: 6 },
    headStyles: { fillColor: [255, 255, 255], textColor: PRETO, fontStyle: 'bold', lineColor: PRETO, lineWidth: 0.5 }
  };

  // Estilo de tabela só com linha embaixo de cada linha (sem grade, sem
  // zebra) — usado na tabela de Honorários.
  const ESTILO_TABELA_LINHA_INFERIOR = {
    theme: 'plain',
    styles: { font: 'Inter', fontSize: 10.5, textColor: PRETO, cellPadding: 7, lineColor: PRETO, lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 } }
  };

  // Agrupa linhas consecutivas com a mesma "fase", mesclando a coluna via
  // rowSpan (evita repetir "Projeto Conceitual" três vezes seguidas).
  function agruparPorFase(linhas) {
    const corpo = [];
    let i = 0;
    while (i < linhas.length) {
      let j = i;
      while (j < linhas.length && linhas[j].fase === linhas[i].fase) j++;
      const tamanhoGrupo = j - i;
      for (let k = i; k < j; k++) {
        const l = linhas[k];
        const linha = [
          l.nome,
          OdisseCalc.fmtData(l.inicio),
          OdisseCalc.fmtData(l.fim),
          `${l.semanas} sem.`
        ];
        if (k === i) linha.unshift({ content: l.fase, rowSpan: tamanhoGrupo, styles: { valign: 'middle' } });
        corpo.push(linha);
      }
      i = j;
    }
    return corpo;
  }

  // Formas de pagamento (à vista, entrada + boletos, cartão): igual nas duas versões do orçamento.
  function blocoPagamento(doc, y, state, data, r) {
    y = tituloSecao(doc, 'Formas de Pagamento', y);

    const plano = OdisseCalc.planoPagamento(r.valorFinal, data, { descontoAvista: state.descontoAvista, pctEntrada: state.pctEntrada });
    const boletoOpcoes = plano.entradaBoletos.slice(0, state.maxParcelasBoleto || 8);
    const cartaoOpcoes = plano.cartao.slice(0, state.maxParcelasCartao || 8);
    const maxParcelaBoleto = boletoOpcoes.length ? boletoOpcoes[boletoOpcoes.length - 1].parcelas : 0;

    y = paragrafo(doc, 'A cobrança dos valores é feita preferencialmente por meio de boleto bancário, parcelado conforme detalhado abaixo — mas, caso seja mais conveniente, o pagamento no cartão de crédito também está disponível como alternativa.', LEFT, y, CONTENT_W);
    y += 12;
    y = paragrafo(doc, `Os honorários poderão ser pagos em até ${maxParcelaBoleto} parcelas iguais, vencendo a primeira no ato de assinatura do contrato, com carência de até 3 dias para sua quitação.`, LEFT, y, CONTENT_W);
    y += 12;

    y = paragrafo(doc, `À vista: ${OdisseCalc.fmtMoeda(plano.avista)} (desconto de ${Math.round((state.descontoAvista || 0) * 100)}%)`, LEFT, y, CONTENT_W, 10.5);
    y += 10;

    y = checarQuebra(doc, y, 90);
    y = linhaTexto(doc, `Entrada + boletos (entrada de ${OdisseCalc.fmtMoeda(plano.entrada)}):`, LEFT, y, { tamanho: 10.5, negrito: true });
    y += 10;
    y = tabela(doc, y, {
      head: [['Parcelas restantes', 'Valor da parcela']],
      body: boletoOpcoes.map(p => [`${p.parcelas}x`, OdisseCalc.fmtMoeda(p.valorParcela)]),
      ...ESTILO_TABELA_GRADE,
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 1) d.cell.styles.fontStyle = 'bold';
      }
    });
    y += 18;

    y = checarQuebra(doc, y, 90);
    y = linhaTexto(doc, 'Cartão de crédito:', LEFT, y, { tamanho: 10.5, negrito: true });
    y += 10;
    y = tabela(doc, y, {
      head: [['Parcelas', 'Valor total', 'Valor da parcela']],
      body: cartaoOpcoes.map(p => [`${p.parcelas}x`, OdisseCalc.fmtMoeda(p.total), OdisseCalc.fmtMoeda(p.valorParcela)]),
      ...ESTILO_TABELA_GRADE,
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 2) d.cell.styles.fontStyle = 'bold';
      }
    });
    y += 20;
    return y;
  }

  // Monta o PDF e devolve { doc, nomeArquivo } sem baixar (o orçamento guarda o PDF no
  // Universo antes de baixar). gerar() continua existindo: monta e baixa.
  function montarV1(state, data) {
    if (!window.jspdf) throw new Error('Biblioteca de PDF ainda carregando — tente novamente em instantes.');
    // propostas antigas foram salvas antes de alguns campos existirem (ex.: entregáveis por etapa)
    state = {
      ...state,
      etapasEntregaveis: state.etapasEntregaveis || {},
      etapasSemanas: state.etapasSemanas || {},
      etapasSelecionadas: state.etapasSelecionadas || [],
      assessoramentoSelecionados: state.assessoramentoSelecionados || [],
      despesasReembolsaveisSelecionadas: state.despesasReembolsaveisSelecionadas || [],
      cliente: state.cliente || {}
    };
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    garantirFonteInter(doc);
    const r = state._calcResult;
    const hoje = state.dataProposta ? new Date(state.dataProposta + 'T00:00:00') : new Date();
    const dataFmt = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    let y = TOPO_CONTEUDO;
    y = linhaTexto(doc, `João Pessoa, ${dataFmt}`, LEFT, y, {});

    const simulacao = !!state._simulacao;
    y += 30;
    y = linhaTexto(doc, simulacao ? 'Simulação de Honorários' : 'Proposta Comercial', LEFT, y, {});
    if (state.numeroProposta) {
      y += 17;
      y = linhaTexto(doc, state.numeroProposta, LEFT, y, { tamanho: 11.5, negrito: true });
    }

    // Simulação: aviso em caixa na primeira página (e "SIMULAÇÃO" no cabeçalho de todas)
    if (simulacao) {
      y += 22;
      const aviso = 'SIMULAÇÃO. Estimativa de honorários sem cliente definido, calculada pela mesma metodologia das propostas do Odisse. Não constitui proposta comercial.';
      estiloCorpoBold(doc, 11);
      const linhasAviso = doc.splitTextToSize(aviso, CONTENT_W - 24);
      const alturaAviso = linhasAviso.length * 11 * 1.35 + 20;
      doc.setDrawColor(...PRETO);
      doc.setLineWidth(1.2);
      doc.rect(LEFT, y - 4, CONTENT_W, alturaAviso);
      doc.text(linhasAviso, LEFT + 12, y + 12);
      y += alturaAviso + 4;
    }

    if (state.cliente.nome) {
      y += 30;
      y = linhaTexto(doc, `${state.cliente.nome},`, LEFT, y, { tamanho: 14, negrito: true });
    }

    y += 22;
    const intro = simulacao
      ? 'Esta simulação estima os honorários do Odisse Arquitetos para o serviço descrito abaixo, com entendimento do escopo, cronograma e valores calculados como numa proposta comercial.'
      : `Agradecemos o interesse em trabalhar com o Odisse Arquitetos, e a consequente oportunidade de apresentar-lhe nossa proposta comercial. Abaixo, detalhamos nosso entendimento do escopo dos serviços solicitados, assim como cronograma e honorários propostos.`;
    y = paragrafo(doc, intro, LEFT, y, CONTENT_W);

    y += 16;
    y = tituloSecao(doc, 'Entendimento do Projeto', y);
    y = paragrafo(doc, state.entendimentoProjeto || '—', LEFT, y, CONTENT_W);

    if (state.tetoOrcamentario) {
      y += 16;
      y = tituloSecao(doc, 'Limite Orçamentário', y);
      y = paragrafo(doc, `O limite antecipado do custo construtivo foi estimado em ${state.tetoOrcamentario}.`, LEFT, y, CONTENT_W);
    }

    // ---- Escopo ----
    // "Compreende o serviço" agora é um resumo geral do arco do serviço,
    // derivado de quais fases/assessoramento foram contratados — não mais
    // a lista granular de entregáveis (essa lista virou os bullets de cada
    // etapa, lá embaixo em "Etapas de Desenvolvimento do Projeto").
    // "Não compreende" continua específico: todo entregável NÃO marcado,
    // de qualquer etapa (contratada ou não) + assessoramento.
    const temEtapa = id => state.etapasSelecionadas.includes(id);
    const temAssess = id => (state.assessoramentoSelecionados || []).includes(id);
    const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
    const etapasDoServico = servico && servico.etapas_aplicaveis
      ? data.etapas.filter(e => servico.etapas_aplicaveis.includes(e.id))
      : data.etapas;

    const temConceitual = ['programacao_projetual', 'concepcao_esquematica', 'concepcao_basica'].some(temEtapa);
    const temLegal = temEtapa('projeto_basico_legal');
    const temExecutivo = ['pre_executivo', 'projeto_executivo_arquitetura', 'detalhamento_executivo'].some(temEtapa);
    const temInteriores = ['programacao_projetual_interiores', 'concepcao_esquematica_interiores', 'concepcao_basica_interiores', 'pre_executivo_interiores', 'projeto_executivo_interiores'].some(temEtapa);

    const compreendeGeral = [];
    if (temConceitual && temLegal && temExecutivo) {
      compreendeGeral.push('Desenvolvimento de projeto arquitetônico desde o nível conceitual até sua documentação executiva');
    } else if (temConceitual || temLegal || temExecutivo) {
      const partes = [];
      if (temConceitual) partes.push('a concepção conceitual');
      if (temLegal) partes.push('o projeto legal');
      if (temExecutivo) partes.push('a documentação executiva');
      compreendeGeral.push(`Desenvolvimento de projeto arquitetônico compreendendo ${partes.join(', ')}`);
    }
    if (temInteriores) {
      compreendeGeral.push('Desenvolvimento de projeto de decoração das áreas comuns do empreendimento');
    }
    if (temLegal) {
      compreendeGeral.push('Acompanhamento do processo de aprovação do projeto junto à prefeitura municipal e demais órgãos competentes');
    }
    if (temEtapa('pre_executivo')) {
      compreendeGeral.push('Compatibilização do projeto arquitetônico com outras disciplinas complementares');
      compreendeGeral.push('Participação em reuniões de coordenação de projeto com disciplinas complementares');
    }
    if (temAssess('assess__2')) {
      compreendeGeral.push('Suporte técnico à construtora em todas as suas solicitações de esclarecimento do projeto arquitetônico e elaboração de adendos ou croquis quando necessários para o bom andamento das obras');
    }
    if (temAssess('assess__3')) {
      compreendeGeral.push('Suporte técnico à construtora durante as tratativas junto a fornecedores de serviços, elementos e materiais diretamente relacionados à arquitetura');
    }

    const naoCompreendeTextos = [];
    etapasDoServico.forEach(etapa => {
      const marcados = state.etapasEntregaveis[etapa.id] || [];
      etapa.entregaveis.forEach(en => {
        if (!marcados.includes(en.id)) naoCompreendeTextos.push(en.texto);
      });
    });
    data.assessoramento.subitens.forEach(si => {
      if (!temAssess(si.id)) naoCompreendeTextos.push(si.texto_curto);
    });

    y += 16;
    y = tituloSecao(doc, 'Escopo', y);
    y = linhaTexto(doc, 'Compreende o serviço:', LEFT, y, { negrito: true });
    y += 16;
    y = listaBullets(doc, compreendeGeral.length ? compreendeGeral : ['—'], y);

    y = linhaTexto(doc, 'O escopo desta proposta não inclui:', LEFT, y, { negrito: true });
    y += 16;
    y = listaBullets(doc, naoCompreendeTextos.length ? naoCompreendeTextos : ['—'], y);

    // ---- Etapas de desenvolvimento ----
    const etapasSel = data.etapas.filter(e => state.etapasSelecionadas.includes(e.id));
    y += 10;
    y = tituloSecao(doc, 'Etapas de Desenvolvimento do Projeto', y);
    let faseAtual = null;
    for (const etapa of etapasSel) {
      if (etapa.fase !== faseAtual) {
        faseAtual = etapa.fase;
        y = linhaTexto(doc, faseAtual, LEFT, y, { tamanho: 10.5, negrito: true });
        y += 16;
      }
      y = linhaTexto(doc, etapa.nome + ':', LEFT + 8, y, { negrito: true });
      y += 13;
      y = paragrafo(doc, etapa.descricao, LEFT + 8, y, CONTENT_W - 8, 10.5);
      y += 6;
      const entregaveisMarcados = (state.etapasEntregaveis[etapa.id] || []);
      const bulletsEtapa = etapa.entregaveis.filter(en => entregaveisMarcados.includes(en.id)).map(en => en.texto);
      if (bulletsEtapa.length) {
        y = listaBullets(doc, bulletsEtapa, y);
      } else {
        y += 4;
      }
    }

    // ---- Cronograma ----
    if (state.dataInicio && etapasSel.length) {
      const selComSemanas = etapasSel.map(e => ({ ...e, semanas: state.etapasSemanas[e.id] }));
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, selComSemanas);
      y += 10;
      y = tituloSecao(doc, 'Cronograma', y);
      y = paragrafo(doc, 'A prestação do serviço ocorrerá em acordo com o planejamento preliminar abaixo:', LEFT, y, CONTENT_W);
      y += 10;
      y = tabela(doc, y, {
        head: [['Fase', 'Etapa', 'Início', 'Fim', 'Duração']],
        body: agruparPorFase(linhas),
        ...ESTILO_TABELA_GRADE,
        columnStyles: { 0: { cellWidth: 62 } }
      });
      y += 18;
      y = paragrafo(doc, '*A etapa de Projeto Executivo de Arquitetura e suas etapas subsequentes apenas poderão ter datas confirmadas após aprovação do projeto legal junto aos órgãos competentes.', LEFT, y, CONTENT_W, 10.5);
      y += 12;
      y = paragrafo(doc, 'O serviço apenas se inicia após assinatura de contrato e pagamento da 1ª parcela dos honorários. Assim sendo, as datas acima descritas estão sujeitas à alteração.', LEFT, y, CONTENT_W);
      y += 24;
    }

    // ---- Honorários ----
    y += 8;
    y = tituloSecao(doc, 'Honorários', y);
    if (r) {
      y = paragrafo(doc, 'Como remuneração pelos serviços profissionais objetos desta proposta, segue:', LEFT, y, CONTENT_W, 10.5);
      y += 10;
      const distrib = OdisseCalc.distribuirPorEtapa(r.valorFinal, etapasSel.map(e => ({ nome: e.nome, semanas: state.etapasSemanas[e.id] })));
      y = tabela(doc, y, {
        body: [
          ...distrib.map(d => [d.nome, OdisseCalc.fmtMoeda(d.valor)]),
          ['TOTAL', OdisseCalc.fmtMoeda(r.valorFinal)]
        ],
        ...ESTILO_TABELA_LINHA_INFERIOR,
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.row.index === distrib.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 14; }
        }
      });
      y += 20;

      y = blocoPagamento(doc, y, state, data, r);
    }

    // ---- Despesas reembolsáveis ----
    const despesasSelecionadas = (data.despesasReembolsaveis || [])
      .filter(dr => (state.despesasReembolsaveisSelecionadas || []).includes(dr.id));
    if (state.incluirDespesasReembolsaveis && despesasSelecionadas.length) {
      y += 8;
      y = tituloSecao(doc, 'Despesas Reembolsáveis', y);
      y = listaBullets(doc, despesasSelecionadas.map(dr => dr.texto), y);
      y = paragrafo(doc, 'O cliente deverá providenciar o reembolso em até 30 dias, contados do recebimento dos respectivos comprovantes.', LEFT, y, CONTENT_W, 10.5);
    }

    // ---- Assessoramento (bloco independente, texto por subitem marcado) ----
    const assessSelecionados = data.assessoramento.subitens.filter(si => (state.assessoramentoSelecionados || []).includes(si.id));
    if (assessSelecionados.length) {
      y += 16;
      y = tituloSecao(doc, data.assessoramento.titulo, y);
      y = paragrafo(doc, data.assessoramento.descricao_abertura, LEFT, y, CONTENT_W, 10.5);
      y += 6;
      y = listaBullets(doc, assessSelecionados.map(si => si.texto_pdf), y);
    }

    // ---- Informações adicionais ----
    y += 16;
    y = tituloSecao(doc, 'Informações Adicionais', y);
    y = paragrafo(doc, 'Todo o material gráfico eventualmente produzido não tem como objetivo atender a critérios de marketing — sua produção objetiva servir como material de apoio ao cliente, visando sua melhor compreensão do projeto arquitetônico nas suas diversas etapas. Uma vez entregue ao cliente, este poderá fazer uso do material com fins de marketing, tendo desde já o consentimento do Odisse Arquitetos. Eventuais solicitações de revisão do material gráfico sob critérios de marketing não serão atendidas — recomendamos, para tanto, a contratação de uma equipe especializada.', LEFT, y, CONTENT_W, 10.5);
    y += 10;
    y = linhaTexto(doc, 'Esta proposta tem validade de 30 dias.', LEFT, y, { tamanho: 10.5, negrito: true });

    y += 40;
    y = linhaTexto(doc, 'Cordialmente,', LEFT, y, {});
    y += 30;
    if (state.responsavelNome) {
      const linhaNome = state.responsavelCau ? `${state.responsavelNome}, ${state.responsavelCau}` : state.responsavelNome;
      y = linhaTexto(doc, linhaNome, LEFT, y, { negrito: true });
      y += 13;
      y = linhaTexto(doc, 'Arquiteto(a),', LEFT, y, {});
      y += 13;
    }
    y = linhaTexto(doc, 'Odisse Arquitetos', LEFT, y, { negrito: true });

    // ---- Cabeçalho e rodapé em todas as páginas ----
    const totalPaginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      cabecalho(doc);
      rodape(doc);
      if (simulacao) {
        estiloCorpoBold(doc, 9);
        doc.text('SIMULAÇÃO · NÃO É PROPOSTA COMERCIAL', PAGE_W / 2, 48, { align: 'center' });
      }
    }

    const nomeArquivo = simulacao
      ? `${state.numeroProposta || 'Simulacao'}_simulacao${state.cliente.nome ? '_' + state.cliente.nome.replace(/[^\w]+/g, '_') : ''}.pdf`
      : `${state.numeroProposta || 'Proposta'}_${(state.cliente.nome || 'cliente').replace(/[^\w]+/g, '_')}.pdf`;
    return { doc, nomeArquivo };
  }

  // ------------------------------------------------------------------------
  // Versão 2 (desde nov/2026): escopo, textos e cláusulas do PGT publicado no Universo, guardados no
  // retrato da proposta (state.resumo, ver resumoProposta em app.js); quem assina vem da Equipe.
  // ------------------------------------------------------------------------
  function montarV2(state, data) {
    if (!window.jspdf) throw new Error('Biblioteca de PDF ainda carregando — tente novamente em instantes.');
    const R = state.resumo && state.resumo.fases ? state.resumo : (typeof resumoProposta === 'function' ? resumoProposta(state) : null);
    if (!R) throw new Error('faltam os dados do escopo desta proposta');
    state = { ...state, cliente: state.cliente || {}, imovel: state.imovel || {}, despesasReembolsaveisSelecionadas: state.despesasReembolsaveisSelecionadas || [] };
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    garantirFonteInter(doc);
    const r = state._calcResult;
    const fmt = OdisseCalc.fmtMoeda;
    const hoje = state.dataProposta ? new Date(state.dataProposta + 'T00:00:00') : new Date();
    const dataFmt = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const simulacao = !!state._simulacao;

    let y = TOPO_CONTEUDO;
    y = linhaTexto(doc, `João Pessoa, ${dataFmt}`, LEFT, y, {});
    y += 30;
    y = linhaTexto(doc, simulacao ? 'Simulação de Honorários' : 'Proposta Comercial', LEFT, y, {});
    if (state.numeroProposta) { y += 17; y = linhaTexto(doc, state.numeroProposta, LEFT, y, { tamanho: 11.5, negrito: true }); }
    if (simulacao) {
      y += 22;
      const aviso = 'SIMULAÇÃO. Estimativa de honorários sem cliente definido, calculada pela mesma metodologia das propostas do Odisse. Não constitui proposta comercial.';
      estiloCorpoBold(doc, 11);
      const linhasAviso = doc.splitTextToSize(aviso, CONTENT_W - 24);
      const alturaAviso = linhasAviso.length * 11 * 1.35 + 20;
      doc.setDrawColor(...PRETO); doc.setLineWidth(1.2);
      doc.rect(LEFT, y - 4, CONTENT_W, alturaAviso);
      doc.text(linhasAviso, LEFT + 12, y + 12);
      y += alturaAviso + 4;
    }
    if (state.cliente.nome) { y += 30; y = linhaTexto(doc, `${state.cliente.nome},`, LEFT, y, { tamanho: 14, negrito: true }); }

    y += 22;
    y = paragrafo(doc, simulacao
      ? 'Esta simulação estima os honorários do Odisse para o serviço descrito abaixo, com entendimento do escopo, cronograma e valores calculados como numa proposta comercial.'
      : 'Agradecemos o interesse em trabalhar com o Odisse e a oportunidade de apresentar nossa proposta comercial. Abaixo, detalhamos nosso entendimento do escopo dos serviços solicitados, assim como cronograma e honorários propostos.', LEFT, y, CONTENT_W);

    // ---- Objeto ----
    const objeto = [R.servico, R.tipologia].filter(Boolean).join(', ');
    const im = state.imovel;
    const end = [[im.logradouro, im.numero].filter(Boolean).join(', ') + (im.complemento ? ' – ' + im.complemento : ''), im.bairro, im.cidadeUf].filter(Boolean).join(', ');
    y += 16;
    y = tituloSecao(doc, 'Objeto', y);
    y = paragrafo(doc, `${state.nomeProjeto ? state.nomeProjeto + ': ' : ''}${objeto || 'Serviço de arquitetura'}${state.areaConstruida > 0 ? `, com área edificada prevista de ${String(state.areaConstruida).replace('.', ',')} m²` : ''}${end ? `, no imóvel situado em ${end}` : ''}.`, LEFT, y, CONTENT_W);

    y += 16;
    y = tituloSecao(doc, 'Entendimento do Projeto', y);
    y = paragrafo(doc, state.entendimentoProjeto || '—', LEFT, y, CONTENT_W);
    if (state.tetoOrcamentario) {
      y += 16;
      y = tituloSecao(doc, 'Limite Orçamentário', y);
      y = paragrafo(doc, `O limite antecipado do custo construtivo foi estimado em ${state.tetoOrcamentario}.`, LEFT, y, CONTENT_W);
    }

    // ---- Escopo ----
    const lista = (l) => l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : (l[0] || '');
    y += 16;
    y = tituloSecao(doc, 'Escopo', y);
    y = linhaTexto(doc, 'Compreende o serviço:', LEFT, y, { negrito: true });
    y += 16;
    y = listaBullets(doc, R.fases.length ? R.fases.map(f => `${Catalogo.nomeFase(f)}: ${lista(f.etapas.map(e => e.nome))}`) : ['—'], y);
    if (R.naoInclui.length) {
      y = linhaTexto(doc, 'O escopo desta proposta não inclui:', LEFT, y, { negrito: true });
      y += 16;
      y = listaBullets(doc, R.naoInclui, y);
    }
    if (R.clausulas.length) {
      y = linhaTexto(doc, 'Condições incluídas:', LEFT, y, { negrito: true });
      y += 16;
      y = listaBullets(doc, R.clausulas, y);
    }

    // ---- Etapas de desenvolvimento ----
    y += 10;
    y = tituloSecao(doc, 'Etapas de Desenvolvimento do Projeto', y);
    for (const f of R.fases) {
      y = linhaTexto(doc, Catalogo.nomeFase(f), LEFT, y, { tamanho: 10.5, negrito: true });
      y += 14;
      if (f.descricao) { y = paragrafo(doc, f.descricao, LEFT, y, CONTENT_W, 10.5); y += 8; }
      for (const e of f.etapas) {
        y = linhaTexto(doc, `${e.nome}:`, LEFT + 8, y, { negrito: true });
        y += 13;
        if (e.descricao) { y = paragrafo(doc, e.descricao, LEFT + 8, y, CONTENT_W - 8, 10.5); y += 6; }
        if (e.entregas.length) y = listaBullets(doc, e.entregas, y); else y += 4;
      }
    }

    // ---- Cronograma ----
    const comPrazo = R.fases.flatMap(f => f.etapas.map(e => ({ nome: e.nome, sigla: e.sigla, fase: f.nome, semanas: e.semanas }))).filter(e => e.semanas > 0);
    if (state.dataInicio && comPrazo.length) {
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, comPrazo).map(l => ({ ...l, semanas: String(l.semanas).replace('.', ',') }));
      y += 10;
      y = tituloSecao(doc, 'Cronograma', y);
      y = paragrafo(doc, 'A prestação do serviço ocorrerá em acordo com o planejamento preliminar abaixo:', LEFT, y, CONTENT_W);
      y += 10;
      y = tabela(doc, y, { head: [['Fase', 'Etapa', 'Início', 'Fim', 'Duração']], body: agruparPorFase(linhas), ...ESTILO_TABELA_GRADE, columnStyles: { 0: { cellWidth: 62 } } });
      y += 18;
      const siglas = comPrazo.map(e => e.sigla);
      if (siglas.includes('PL') && siglas.some(x => ['PX', 'PE', 'DE'].includes(x))) {
        y = paragrafo(doc, '*As etapas da fase Executiva só poderão ter datas confirmadas após a aprovação do projeto legal junto aos órgãos competentes.', LEFT, y, CONTENT_W, 10.5);
        y += 12;
      }
      y = paragrafo(doc, 'O serviço apenas se inicia após assinatura de contrato e pagamento da 1ª parcela dos honorários. Assim sendo, as datas acima descritas estão sujeitas à alteração.', LEFT, y, CONTENT_W);
      y += 24;
    }

    // ---- Honorários ----
    y += 8;
    y = tituloSecao(doc, 'Honorários', y);
    if (r) {
      y = paragrafo(doc, 'Como remuneração pelos serviços profissionais objetos desta proposta, segue:', LEFT, y, CONTENT_W, 10.5);
      y += 10;
      const porEtapa = R.preco_por_etapa ? R.fases.flatMap(f => f.etapas).filter(e => e.valor != null) : [];
      // etapa sem peso nos Honorários (ex.: Levantamento, Assessoramento) entra como incluída, sem valor próprio
      const corpo = porEtapa.length ? porEtapa.map(e => [e.nome, e.valor > 0 ? fmt(e.valor) : 'incluído']) : [[R.servico || 'Serviço', fmt(r.valorFinal)]];
      y = tabela(doc, y, {
        body: [...corpo, ['TOTAL', fmt(r.valorFinal)]],
        ...ESTILO_TABELA_LINHA_INFERIOR,
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (d) => { if (d.row.index === corpo.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 14; } }
      });
      y += 20;
      y = blocoPagamento(doc, y, state, data, r);
    }

    // ---- Despesas reembolsáveis ----
    const despesas = (data.despesasReembolsaveis || []).filter(dr => state.despesasReembolsaveisSelecionadas.includes(dr.id));
    if (state.incluirDespesasReembolsaveis && despesas.length) {
      y += 8;
      y = tituloSecao(doc, 'Despesas Reembolsáveis', y);
      y = listaBullets(doc, despesas.map(dr => dr.texto), y);
      y = paragrafo(doc, 'O cliente deverá providenciar o reembolso em até 30 dias, contados do recebimento dos respectivos comprovantes.', LEFT, y, CONTENT_W, 10.5);
    }

    // ---- Informações adicionais ----
    y += 16;
    y = tituloSecao(doc, 'Informações Adicionais', y);
    y = paragrafo(doc, 'Todo o material gráfico eventualmente produzido não tem como objetivo atender a critérios de marketing — sua produção objetiva servir como material de apoio ao cliente, visando sua melhor compreensão do projeto arquitetônico nas suas diversas etapas. Uma vez entregue ao cliente, este poderá fazer uso do material com fins de marketing, tendo desde já o consentimento do Odisse. Eventuais solicitações de revisão do material gráfico sob critérios de marketing não serão atendidas — recomendamos, para tanto, a contratação de uma equipe especializada.', LEFT, y, CONTENT_W, 10.5);
    y += 10;
    y = linhaTexto(doc, 'Esta proposta tem validade de 30 dias.', LEFT, y, { tamanho: 10.5, negrito: true });

    // ---- Assinatura: quem emite (Equipe do Universo), com a rubrica abaixo da identificação ----
    y += 40;
    y = linhaTexto(doc, 'Cordialmente,', LEFT, y, {});
    y += 30;
    const rubricas = state._rubricas || {};
    for (const a of (state.assinantes || []).filter(x => x && x.nome)) {
      const linha2 = [a.cargo, a.registro].filter(Boolean).join(' · ');
      y = checarQuebra(doc, y, 13 + (linha2 ? 13 : 0) + 52);
      y = linhaTexto(doc, a.nome, LEFT, y, { negrito: true });
      if (linha2) { y += 13; y = linhaTexto(doc, linha2, LEFT, y, { tamanho: 10.5 }); }
      const img = a.equipe_id && rubricas[a.equipe_id];
      if (img) {
        try {
          const p = doc.getImageProperties(img);
          const h = 30, w = Math.min(90, (p.width / p.height) * h);
          doc.addImage(img, p.fileType || 'PNG', LEFT, y + 8, w, h);
        } catch (e) { console.warn('rubrica no PDF', e); }
        y += 8 + 30;
      }
      y += 24;
    }
    y = linhaTexto(doc, 'Odisse, Estúdio de Arquitetura e Design', LEFT, y, { negrito: true });

    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      cabecalho(doc);
      rodape(doc);
      if (simulacao) { estiloCorpoBold(doc, 9); doc.text('SIMULAÇÃO · NÃO É PROPOSTA COMERCIAL', PAGE_W / 2, 48, { align: 'center' }); }
    }
    const nomeArquivo = simulacao
      ? `${state.numeroProposta || 'Simulacao'}_simulacao${state.cliente.nome ? '_' + state.cliente.nome.replace(/[^\w]+/g, '_') : ''}.pdf`
      : `${state.numeroProposta || 'Proposta'}_${(state.cliente.nome || 'cliente').replace(/[^\w]+/g, '_')}.pdf`;
    return { doc, nomeArquivo };
  }

  // Propostas feitas antes da leitura do PGT (data/*.json) continuam remontando como eram.
  function montar(state, data) {
    return state && state.versao === 2 ? montarV2(state, data) : montarV1(state, data);
  }

  async function gerar(state, data) {
    try {
      await preparar();
      const { doc, nomeArquivo } = montar(state, data);
      doc.save(nomeArquivo);
    } catch (e) {
      alert(e.message);
    }
  }

  return { preparar, montar, gerar };
})();
