// ==========================================================================
// Proposta na folha da Marca (19/11). Monta o conteúdo da proposta no formato do montador de documentos
// da Marca (marca.odisse.com.br/v1/documentos): o desenho (Coluna, Ficha e os que vierem) é todo de lá.
//   PropostaDoc.doc(state, data, { modelo, numero, rubricas, previa })  → doc do montador
//   PropostaDoc.modelos()      → folhas disponíveis (lidas da Marca)
//   PropostaDoc.montar(el, doc) → desenha as folhas na página (prévia)
//   PropostaDoc.pdf(doc)        → Blob do PDF (desenhista da Marca, texto selecionável)
// Propostas antigas (sem esta folha) continuam remontando pelo pdf.js.
// ==========================================================================
const PropostaDoc = (() => {
  const MARCA = 'https://marca.odisse.com.br/v1/documentos/';
  let mod = null, modPdf = null, rec = null;
  async function carregar() {
    if (!mod) mod = await import(MARCA + 'documentos.js');
    if (!rec) rec = await mod.recursos();
    return mod;
  }
  async function modelos() {
    try { return (await carregar()).MODELOS || [{ id: 'coluna', nome: 'Coluna' }, { id: 'ficha', nome: 'Ficha' }]; }
    catch (_) { return [{ id: 'coluna', nome: 'Coluna' }, { id: 'ficha', nome: 'Ficha' }]; }
  }
  async function montar(el, doc) { const m = await carregar(); return m.montar(el, doc, rec); }
  async function pdf(doc) {
    await carregar();
    if (!modPdf) modPdf = await import(MARCA + 'pdf.js');
    await OdissePdf.preparar();     // jsPDF e a Inter em TTF (fonts-inter.js)
    return modPdf.pdf(doc, rec, { jsPDF: window.jspdf.jsPDF, fontes: { normal: INTER_REGULAR_B64, negrito: INTER_BOLD_B64 } });
  }

  const fmt = (v) => OdisseCalc.fmtMoeda(v);
  const fmtD = (d) => OdisseCalc.fmtData(d);
  const lista = (l) => l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : (l[0] || '');
  const sem = (n) => `${String(n).replace('.', ',')} ${n === 1 ? 'semana' : 'semanas'}`;
  const paragrafos = (t) => String(t || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

  function doc(state, data, { modelo = 'coluna', numero = '', rubricas = {}, previa = false } = {}) {
    const R = state.resumo && state.resumo.fases ? state.resumo : resumoProposta(state);
    const r = state._calcResult;
    const simulacao = !!state._simulacao;
    const c = state.cliente || {};
    const hoje = state.dataProposta ? new Date(state.dataProposta + 'T00:00:00') : new Date();
    const im = state.imovel || {};
    const end = [[im.logradouro, im.numero].filter(Boolean).join(', ') + (im.complemento ? ' – ' + im.complemento : ''), im.bairro, im.cidadeUf].filter(Boolean).join(', ');
    const B = [];
    const secao = (t) => B.push({ tipo: 'secao', texto: t });
    const p = (t, negrito) => { if (t) B.push({ tipo: 'paragrafo', texto: t, negrito: !!negrito }); };

    if (simulacao) B.push({ tipo: 'nota', texto: 'Simulação: estimativa de honorários sem cliente definido, calculada pela mesma metodologia das propostas do Odisse. Não constitui proposta comercial.' });

    secao('Objeto');
    p(`${state.nomeProjeto ? state.nomeProjeto + ': ' : ''}${[R.servico, R.tipologia].filter(Boolean).join(', ') || 'Serviço de arquitetura'}${state.areaConstruida > 0 ? `, com área edificada prevista de ${String(state.areaConstruida).replace('.', ',')} m²` : ''}${end ? `, no imóvel situado em ${end}` : ''}.`);

    secao('Entendimento do projeto');
    for (const t of paragrafos(state.entendimentoProjeto)) p(t);
    if (state.tetoOrcamentario) p(`O limite antecipado do custo construtivo foi estimado em ${state.tetoOrcamentario}.`);

    secao('Escopo');
    p('Compreende o serviço:', true);
    B.push({ tipo: 'lista', itens: R.fases.length ? R.fases.map((f) => `${Catalogo.nomeFase(f)}: ${lista(f.etapas.map((e) => e.nome))}`) : ['—'] });
    if (R.naoInclui.length) { p('O escopo desta proposta não inclui:', true); B.push({ tipo: 'lista', itens: R.naoInclui }); }
    if (R.clausulas.length) { p('Condições incluídas:', true); B.push({ tipo: 'lista', itens: R.clausulas }); }

    secao('Etapas de desenvolvimento do projeto');
    for (const f of R.fases) {
      p(Catalogo.nomeFase(f), true);
      if (f.descricao) p(f.descricao);
      for (const e of f.etapas) {
        B.push({ tipo: 'clausula', titulo: e.nome, paragrafos: e.descricao ? [e.descricao] : [], itens: e.entregas });
      }
    }

    const comPrazo = R.fases.flatMap((f) => f.etapas.map((e) => ({ nome: e.nome, sigla: e.sigla, fase: Catalogo.nomeFase(f), semanas: e.semanas }))).filter((e) => e.semanas > 0);
    if (state.dataInicio && comPrazo.length) {
      secao('Cronograma');
      p('A prestação do serviço ocorrerá de acordo com o planejamento preliminar abaixo:');
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, comPrazo);
      B.push({ tipo: 'tabela', colunas: [{ titulo: 'Etapa' }, { titulo: 'Início', largura: 96 }, { titulo: 'Fim', largura: 96 }, { titulo: 'Duração', alinhar: 'direita', largura: 96 }],
        linhas: linhas.map((l) => [l.nome, fmtD(l.inicio), fmtD(l.fim), sem(l.semanas)]) });
      const siglas = comPrazo.map((e) => e.sigla);
      if (siglas.includes('PL') && siglas.some((x) => ['PX', 'PE', 'DE'].includes(x))) B.push({ tipo: 'nota', texto: 'As etapas da fase Executiva só poderão ter datas confirmadas após a aprovação do projeto legal junto aos órgãos competentes.' });
      B.push({ tipo: 'nota', texto: 'O serviço só se inicia após a assinatura do contrato e o pagamento da primeira parcela dos honorários; por isso, as datas acima estão sujeitas a alteração.' });
    }

    secao('Honorários');
    if (r) {
      p('Como remuneração pelos serviços profissionais objeto desta proposta:');
      const porEtapa = R.preco_por_etapa ? R.fases.flatMap((f) => f.etapas).filter((e) => e.valor != null) : [];
      const corpo = porEtapa.length ? porEtapa.map((e) => [e.nome, e.valor > 0 ? fmt(e.valor) : 'incluído']) : [[R.servico || 'Serviço', fmt(r.valorFinal)]];
      B.push({ tipo: 'tabela', colunas: [{ titulo: 'Etapa' }, { titulo: 'Valor', alinhar: 'direita', largura: 140 }], linhas: corpo, total: ['Total', fmt(r.valorFinal)] });

      const plano = OdisseCalc.planoPagamento(r.valorFinal, data, { descontoAvista: state.descontoAvista, pctEntrada: state.pctEntrada });
      const boletos = plano.entradaBoletos.slice(0, state.maxParcelasBoleto || 8);
      const cartao = plano.cartao.slice(0, state.maxParcelasCartao || 8);
      secao('Formas de pagamento');
      p('A cobrança é feita preferencialmente por boleto bancário, parcelado como abaixo; se for mais conveniente, o cartão de crédito também está disponível.');
      p(`À vista: ${fmt(plano.avista)} (desconto de ${Math.round((state.descontoAvista || 0) * 100)}%).`, true);
      p(`Entrada de ${fmt(plano.entrada)} na assinatura do contrato, com carência de até 3 dias, e o restante em boletos:`, true);
      B.push({ tipo: 'tabela', colunas: [{ titulo: 'Parcelas restantes' }, { titulo: 'Valor da parcela', alinhar: 'direita' }], linhas: boletos.map((x) => [`${x.parcelas}×`, fmt(x.valorParcela)]) });
      p('Cartão de crédito:', true);
      B.push({ tipo: 'tabela', colunas: [{ titulo: 'Parcelas' }, { titulo: 'Valor total', alinhar: 'direita' }, { titulo: 'Valor da parcela', alinhar: 'direita' }], linhas: cartao.map((x) => [`${x.parcelas}×`, fmt(x.total), fmt(x.valorParcela)]) });
    }

    const despesas = (data.despesasReembolsaveis || []).filter((d) => (state.despesasReembolsaveisSelecionadas || []).includes(d.id));
    if (despesas.length) {
      secao('Despesas reembolsáveis');
      B.push({ tipo: 'lista', itens: despesas.map((d) => d.texto) });
      B.push({ tipo: 'nota', texto: 'O cliente providencia o reembolso em até 30 dias, contados do recebimento dos comprovantes.' });
    }

    secao('Informações adicionais');
    p('O material gráfico produzido serve de apoio ao cliente, para a melhor compreensão do projeto em suas etapas, e não tem como objetivo atender a critérios de marketing. Uma vez entregue, o cliente pode usá-lo com esse fim, com o consentimento do Odisse; revisões sob critérios de marketing não são atendidas (recomendamos, para isso, uma equipe especializada).');
    p('Esta proposta tem validade de 30 dias.', true);

    const assinaturas = (state.assinantes || []).filter((a) => a && a.nome).map((a) => ({
      nome: a.nome, cargo: a.cargo, registro: a.registro,
      rubrica: previa ? (a.rubrica ? 'caixa' : undefined) : (a.equipe_id && rubricas[a.equipe_id]) || undefined,
    }));

    const assunto = [simulacao ? 'Simulação de honorários' : 'Proposta comercial', R.servico, state.nomeProjeto].filter(Boolean).join(' · ');
    const campos = [{ rotulo: 'Para', valor: [c.nome || (simulacao ? 'Simulação, sem cliente' : '—'), c.email].filter(Boolean).join('\n') }];
    if (numero) campos.push({ rotulo: 'Nº', valor: numero });
    campos.push({ rotulo: 'Data', valor: fmtD(hoje) }, { rotulo: 'Validade', valor: '30 dias' }, { rotulo: 'Assunto', valor: assunto, largo: true });

    return {
      modelo, miolo: 'texto', codigo: numero || '', campos,
      titulo: simulacao ? 'Simulação de honorários' : 'Proposta comercial',
      saudacao: c.nome ? `${c.nome},` : '',
      paragrafos: [simulacao
        ? 'Esta simulação estima os honorários do Odisse para o serviço descrito abaixo, com entendimento do escopo, cronograma e valores calculados como numa proposta comercial.'
        : 'Agradecemos o interesse em trabalhar com o Odisse e a oportunidade de apresentar nossa proposta. Abaixo estão o nosso entendimento do escopo, o cronograma e os honorários.'],
      blocos: B, fecho: 'Cordialmente,', assinaturas,
    };
  }

  const nomeArquivo = (state, numero) => state._simulacao
    ? `${numero || 'Simulacao'}_simulacao${state.cliente && state.cliente.nome ? '_' + state.cliente.nome.replace(/[^\w]+/g, '_') : ''}.pdf`
    : `${numero || 'Proposta'}_${((state.cliente && state.cliente.nome) || 'cliente').replace(/[^\w]+/g, '_')}.pdf`;

  return { doc, modelos, montar, pdf, nomeArquivo };
})();
