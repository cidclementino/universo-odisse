// ==========================================================================
// Motor de cálculo — metodologia CAU/AsBEA adaptada (Template_Odisse_PO.ods)
//
// Resumo da lógica (documentado aqui porque a planilha original não deixa
// isso explícito num único lugar):
//
//   CEO   = Base de Honorários da tipologia (BH, R$/m²) × área de cálculo
//   fp    = Fator Percentual — tabela por faixa de área × categoria da
//           edificação (1 Baixo / 2 Médio / 3 Alto / 4 Especial), pegando
//           a primeira faixa de área que seja >= área construída
//   IC    = média aritmética dos 10 critérios de complexidade (0.7/1/1.3)
//   R     = razão entre área projetada e construída (área externa entra
//           com peso de 25%, conforme nota da planilha original)
//   redutor = redutor por repetição de áreas (tabela por qtd. repetições)
//   área de cálculo = área construída × R × redutor     (nov/2026: o ajuste de
//           área entra no CEO, como na fórmula de Honorários › Fórmula; o
//           honorário final não muda. A faixa do fp segue pela área construída.)
//
//   valor_cau      = CEO × fp × IC                      (valor "de tabela")
//   valor_ajustado = valor_cau                          (mantido por compatibilidade)
//   valor_modif    = valor_ajustado × modificador de intervenção
//                    (Nova Edificação=1, Reforma=1.25, Interiores=1.5, etc.)
//   valor_mercado  = valor_modif ÷ fator de ajuste de mercado
//                    (a planilha original usa 1.25 ou 2.25 como divisores
//                    de duas propostas alternativas — aqui isso fica
//                    editável, com esses dois como atalhos)
//   valor_final    = valor_mercado × percentual de redução de escopo
//                    (100% completo, ou uma contratação parcial)
//
// A distribuição do valor_final entre as etapas contratadas é feita
// proporcionalmente à duração (em semanas) de cada etapa selecionada —
// uma simplificação deliberada da tabela fixa "Entrada 30% / Estudo
// Preliminar 20% / Projeto Legal 20% / Executivo 30%" da planilha
// original, que só fazia sentido quando as 4 fases eram sempre
// contratadas por inteiro. Com a seleção granular das 9 etapas, a
// distribuição por peso de semanas é o que generaliza corretamente.
// ==========================================================================

const OdisseCalc = (() => {

  function mediaIC(icValores) {
    const vals = Object.values(icValores);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function lookupFatorPercentual(faixas, areaConstruida, categoria) {
    const col = { 1: 'baixo', 2: 'medio', 3: 'alto', 4: 'especial' }[categoria] || 'baixo';
    // pega a primeira faixa cujo limite (numérico) é >= área; senão usa a última
    let faixaEscolhida = faixas[faixas.length - 1];
    for (const faixa of faixas) {
      const limite = parseFloat(String(faixa.area_limite).replace(/[^\d.]/g, ''));
      if (!isNaN(limite) && areaConstruida <= limite) {
        faixaEscolhida = faixa;
        break;
      }
    }
    return { valor: faixaEscolhida[col], faixa: faixaEscolhida };
  }

  // BH é recalculada a partir do CUB vigente (data/cub.json) × fator de
  // adequação da tipologia — nunca a partir de um valor congelado — assim
  // a atualização mensal do CUB (ver scripts/update_cub.py) se reflete
  // automaticamente no cálculo, sem precisar regravar tipologias.json.
  function tabelaCubAtiva(cub) {
    return cub.regioes[cub.regiao_ativa].tabela;
  }

  function bhAtual(tipologia, cubTabela) {
    const cubItem = cubTabela[tipologia.categoria_cub];
    const cubValor = cubItem ? cubItem.honerado : tipologia.cub;
    return cubValor * tipologia.fator_adequacao;
  }

  function lookupRedutor(tabela, qtdRepeticoes) {
    if (!qtdRepeticoes || qtdRepeticoes <= 0) return 1;
    let melhor = tabela[0];
    for (const row of tabela) {
      const q = parseFloat(String(row.q).replace(/[^\d.]/g, ''));
      if (!isNaN(q) && q <= qtdRepeticoes) melhor = row;
    }
    return melhor.r;
  }

  // Entrada: objeto completo com todos os dados do formulário + tabelas de referência
  function calcular(input, tabelas) {
    const {
      tipologia,               // objeto de data/tipologias.json {bh, categoria, ...}
      areaConstruida,          // m²
      areaExterna,             // m²
      contagemRepeticoes,
      icValores,               // {criterio_id: 0.7|1|1.3, ...} (10 chaves)
      modificadorIntervencao,  // número (1, 1.25, 1.5, 0.75, 0.2, 0.15)
      fatorAjuste,             // número (ex: 1.25)
      reducaoEscopoPercentual  // 0..1 (1 = projeto completo)
    } = input;

    const areaTotalProjetada = areaConstruida + (areaExterna || 0) * 0.25;
    const R = areaConstruida > 0 ? areaTotalProjetada / areaConstruida : 1;

    const bh = bhAtual(tipologia, tabelaCubAtiva(tabelas.cub));
    const redutor = lookupRedutor(tabelas.redutorRepeticao, contagemRepeticoes);
    const areaCalculo = areaConstruida * R * redutor;
    const ceo = bh * areaCalculo;
    const { valor: fp, faixa: faixaFp } = lookupFatorPercentual(tabelas.fatorPercentual, areaConstruida, tipologia.categoria);
    const ic = mediaIC(icValores);

    const valorCau = ceo * fp * ic;
    const valorAjustado = valorCau;
    const valorModificado = valorAjustado * (modificadorIntervencao || 1);
    const valorMercado = valorModificado / (fatorAjuste || 1);
    const valorFinal = valorMercado * (reducaoEscopoPercentual != null ? reducaoEscopoPercentual : 1);

    return {
      bh, areaTotalProjetada, R, areaCalculo, ceo, fp, faixaFp, ic, redutor,
      valorCau, valorAjustado, valorModificado, valorMercado, valorFinal
    };
  }

  // ---------------------------------------------------------------------
  // Percentual do serviço a partir do peso de cada etapa (Base + Incremento)
  // — só para os serviços com estrutura Conceitual/Legal/Executivo
  // (servico.formula_percentual_por_etapa === true). Ver PRICING.md para a
  // lógica completa por trás desta fórmula.
  //
  //   Base       = soma dos pesos das etapas selecionadas
  //   Lacuna     = soma dos pesos das etapas NÃO selecionadas que vêm antes
  //                de alguma etapa selecionada (cada uma contada uma única
  //                vez, mesmo que "esteja atrás" de mais de uma selecionada)
  //   Incremento = 50% da Lacuna
  //   Percentual = Base + Incremento  (nunca ultrapassa 100%)
  // ---------------------------------------------------------------------
  function percentualPorEtapas(etapasSelecionadas, pesosEtapas) {
    const ordem = Object.keys(pesosEtapas);
    let base = 0;
    ordem.forEach(id => { if (etapasSelecionadas.includes(id)) base += pesosEtapas[id]; });

    let lacuna = 0;
    for (let i = 0; i < ordem.length; i++) {
      const id = ordem[i];
      if (etapasSelecionadas.includes(id)) continue;
      const temSelecionadaDepois = ordem.slice(i + 1).some(j => etapasSelecionadas.includes(j));
      if (temSelecionadaDepois) lacuna += pesosEtapas[id];
    }

    const incremento = 0.5 * lacuna;
    const percentual = Math.min(100, base + incremento) / 100;
    return { base: base / 100, lacuna: lacuna / 100, incremento: incremento / 100, percentual };
  }

  function planoPagamento(valorFinal, tabelas, { descontoAvista, pctEntrada }) {
    const avista = valorFinal * (1 - (descontoAvista != null ? descontoAvista : 0.08));

    const cartao = tabelas.jurosParcelamento.map(({ parcelas, juros }) => {
      const total = valorFinal * (1 + juros);
      return { parcelas, juros, total, valorParcela: total / parcelas };
    });

    const entrada = valorFinal * (pctEntrada != null ? pctEntrada : 0.35);
    const restante = valorFinal - entrada;
    const entradaBoletos = [2, 3, 4, 6, 10].map(n => ({
      parcelas: n,
      entrada,
      valorParcela: restante / n
    }));

    return { avista, cartao, entradaBoletos, entrada };
  }

  // Distribui o valor final entre as etapas selecionadas, proporcional
  // à duração (semanas) de cada uma.
  function distribuirPorEtapa(valorFinal, etapasSelecionadas) {
    const totalSemanas = etapasSelecionadas.reduce((a, e) => a + e.semanas, 0);
    if (totalSemanas <= 0) return etapasSelecionadas.map(e => ({ ...e, valor: 0 }));
    return etapasSelecionadas.map(e => ({
      ...e,
      valor: valorFinal * (e.semanas / totalSemanas)
    }));
  }

  // Monta o cronograma (datas de início/fim sequenciais) a partir de uma data
  // de início e da lista de etapas com suas durações em semanas.
  function montarCronograma(dataInicioStr, etapasSelecionadas) {
    let cursor = new Date(dataInicioStr + 'T00:00:00');
    const linhas = [];
    for (const etapa of etapasSelecionadas) {
      const inicio = new Date(cursor);
      const fim = new Date(cursor);
      fim.setDate(fim.getDate() + Math.round(etapa.semanas * 7));
      linhas.push({ ...etapa, inicio, fim });
      cursor = new Date(fim);
    }
    return linhas;
  }

  function fmtMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtData(d) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return { calcular, planoPagamento, distribuirPorEtapa, montarCronograma, fmtMoeda, fmtData, mediaIC, bhAtual, tabelaCubAtiva, percentualPorEtapas };
})();
