// ==========================================================================
// Minuta do contrato (Cid, 21/11/2026; etapa 1 do emissor de contratos).
// As 15 seções do contrato e, em cada uma, os LUGARES DOS DADOS que vêm de outras ferramentas. O texto redigido
// (cláusulas gerais) mora no Gestor de cláusulas (tabela vendas_clausulas, grupo 'geral', migração 0027); as
// cláusulas dos eventos vêm do PGT, escolhidas na proposta. O emissor (etapa 2) monta o contrato assim, seção a seção:
//   dados com apos: 0 → cláusulas gerais na ordem (as N primeiras antes dos dados com apos: N) → dados com apos: 'fim'.
// Cada dado diz de onde vem (fonte) e o que ainda falta construir (falta). Nada aqui sai no contrato como texto fixo.
//
// Condições das cláusulas gerais (campo condicao): entram sozinhas quando o contrato pede.
// Marcas no texto: {proposta} = nº da proposta; {etapa_aprovada} = campo do contrato (padrão: Concepção Básica).
// Tratamento sempre no masculino ("o CONTRATANTE"), qualificação em forma neutra; sem testemunhas (Cid, 21/11).
// ==========================================================================
const ContratoMinuta = (() => {
  const SECOES = [
    { n: 1, nome: 'Partes', dados: [
      { id: 'contratada', apos: 0, nome: 'Qualificação da contratada', fonte: 'O Estúdio › Empresa (razão social, CNPJ, sede) + o sócio que assina (Equipe, uso contrato; dados pessoais: nome completo, nacionalidade, profissão, CPF, RG, CAU, endereço)' },
      { id: 'contratante', apos: 0, nome: 'Qualificação do contratante', fonte: 'Contatos: titular da oportunidade. Pessoa: nome completo, nacionalidade, profissão, CPF, RG, endereço. Organização: razão social, CNPJ, sede e o representante', falta: 'o que não se sabia na proposta é pedido em Gerar contrato e gravado nos Contatos' },
      { id: 'co_clientes', apos: 0, nome: 'Demais contratantes', fonte: 'Co-clientes da oportunidade (vínculos com papel cliente), com a mesma qualificação' },
    ] },
    { n: 2, nome: 'Objeto', dados: [
      { id: 'objeto', apos: 1, nome: 'O serviço contratado', fonte: 'Proposta: serviço e tipologia (PGT), nome do projeto, área; local do imóvel' },
    ] },
    { n: 3, nome: 'Escopo', dados: [
      { id: 'etapas', apos: 0, nome: 'Etapas contratadas, por fase, com a descrição', fonte: 'Proposta: etapas escolhidas; textos do PGT na versão publicada que a proposta registrou' },
      { id: 'entregas', apos: 0, nome: 'Entregas de cada etapa', fonte: 'Proposta: entregas escolhidas (PGT)' },
      { id: 'nao_inclui', apos: 0, nome: 'O que o escopo não inclui', fonte: 'Proposta: o “não inclui” do serviço (PGT)' },
      { id: 'eventos', apos: 0, nome: 'Cláusulas dos eventos', fonte: 'Gestor › Cláusulas dos eventos, as marcadas na proposta (N = quantidade). É aqui que entram os limites de revisão' },
    ] },
    { n: 4, nome: 'Prazos', dados: [
      { id: 'cronograma', apos: 0, nome: 'Cronograma', fonte: 'Proposta: data de início e prazos (PGT × faixa de área ou personalizados). É o mesmo de onde nasce o Escopo do projeto' },
    ] },
    { n: 5, nome: 'Ajustes e aprovações', dados: [] },
    { n: 6, nome: 'Honorários e pagamento', dados: [
      { id: 'valor', apos: 0, nome: 'Valor total, com o extenso', fonte: 'Proposta: valor final' },
      { id: 'plano', apos: 0, nome: 'Forma de pagamento escolhida', fonte: 'Gerar contrato: à vista, entrada + boletos, cartão ou por marcos de etapa, com datas ou marcos', falta: 'a proposta oferece as opções; a escolha é pedida em Gerar contrato' },
      { id: 'dados_pagamento', apos: 0, nome: 'Dados para pagamento', fonte: 'O Estúdio › Empresa › Dados bancários (banco, agência, conta, PIX)' },
    ] },
    { n: 7, nome: 'Despesas reembolsáveis', dados: [
      { id: 'despesas', apos: 0, nome: 'Despesas marcadas', fonte: 'Gestor › Despesas reembolsáveis, as marcadas na proposta' },
    ] },
    { n: 8, nome: 'Obrigações do contratante', dados: [] },
    { n: 9, nome: 'Obrigações da contratada', dados: [] },
    { n: 10, nome: 'Alterações de escopo e aditivos', dados: [] },
    { n: 11, nome: 'Direitos autorais e imagem', dados: [] },
    { n: 12, nome: 'Confidencialidade e proteção de dados', dados: [] },
    { n: 13, nome: 'Força maior e rescisão', dados: [] },
    { n: 14, nome: 'Encerramento e disposições gerais', dados: [
      { id: 'encerramento', apos: 0, nome: 'Fim do serviço', fonte: 'Escopo da proposta: o Encerramento ativo (padrão: fim do Projeto Executivo)' },
    ] },
    { n: 15, nome: 'Foro e assinatura', dados: [
      { id: 'assinaturas', apos: 'fim', nome: 'Local, data e assinaturas', fonte: 'Contratantes e o sócio que assina; assinatura eletrônica por provedor, sem testemunhas' },
    ] },
  ];

  const CONDICOES = {
    projeto_legal: 'só com Projeto Legal',
    legal_executiva: 'só com Projeto Legal e fase Executiva',
    despesas: 'só com despesa marcada',
    co_clientes: 'só com mais de um contratante',
  };

  const secao = (n) => SECOES.find((s) => s.n === n);
  return { SECOES, CONDICOES, secao };
})();
