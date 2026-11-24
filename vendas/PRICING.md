# Lógica de Precificação — Odisse Orçamentos

Este documento registra as decisões tomadas sobre a lógica de cálculo de honorários,
para que qualquer pessoa (inclusive uma versão futura desta conversa) entenda o
*porquê* por trás de cada peça, não só o *como*. Complementa os comentários em
`calc.js`, que descrevem a fórmula linha a linha.

## Visão geral da fórmula

```
BH    = CUB vigente (código da tipologia) × Fator de Adequação da tipologia
CEO   = BH × Área Edificada Prevista
fp    = Fator Percentual (tabela por faixa de área × categoria da edificação)
IC    = média aritmética de 11 critérios de complexidade (0,7 / 1,0 / 1,3 cada)
redutor = redutor por repetição de unidades/áreas
R     = (Área Edificada + Área Externa de Intervenção × 0,25) ÷ Área Edificada

valor_CAU       = CEO × fp × IC
valor_ajustado  = valor_CAU × redutor × R
valor_modificado = valor_ajustado × Modificador do Serviço Odisse
valor_mercado   = valor_modificado ÷ Fator de Ajuste de Mercado
Honorário Final = valor_mercado × % do Escopo de Contratação
```

A Área do Imóvel/Terreno, o Teto Orçamentário do cliente e o Prazo Esperado do
cliente **não entram nesta fórmula** — são informativos/comparativos (geram os
alertas da barra lateral), não fatores de cálculo.

---

## 1. Modificador de Intervenção → consolidado nos Serviços Odisse

**Decisão:** o modificador deixou de vir de uma tabela genérica ligada à
metodologia CAU (Tipo de Intervenção, com Nova Edificação/Reforma/Interiores/
Decoração/Adequação de Acessibilidade/Levantamento Arquitetônico) e passou a
ser uma propriedade direta de cada um dos 9 Serviços Odisse.

**Origem dos valores:** conferidos contra `Template_Odisse_PO.ods`, aba "Base de
Dados", linhas 116-122 (seção "Modificador de Fator Percentual") — batem exatos,
não foram inventados.

| Serviço Odisse | Modificador(es) | Origem do valor |
|---|---|---|
| Projeto de Nova Edificação Residencial | 1,00 | Nova Edificação (CAU) |
| Projeto de Nova Edificação Multifamiliar e/ou Mista | 1,00 | Nova Edificação (CAU) |
| Projeto de Nova Edificação Comercial | 1,00 | Nova Edificação (CAU) |
| Projeto de Nova Edificação Institucional | 1,00 | Nova Edificação (CAU) |
| Projeto de Reforma | 1,25 | Reforma (CAU) |
| Projeto de Interiores e Ambientação | 1,50 (Projeto de Interiores) ou 0,75 (Ambientação) — escolha do usuário | Interiores / Decoração (CAU) |
| Consultoria Remota | 0,15 | Levantamento Arquitetônico (CAU), por analogia |
| Estudo de Viabilidade | 0,20 | Match exato: "Estudo de Viabilidade Econômico-Financeira de Projeto de Edificações" (linha 167 da planilha) — mais preciso que a analogia inicial com Levantamento Arquitetônico |
| Laudos e Regularização Técnica | 0,15 | Levantamento Arquitetônico (CAU), por analogia — nenhum item da seção "Relatórios Técnicos" bateu melhor |

**Eliminado:** "Adequação de Acessibilidade" (0,20) saiu do modelo por completo —
não é mais opção de nenhum serviço.

**Lógica por trás dos valores:** Nova Edificação = 1,0 é o referencial neutro.
Os demais deslocam esse valor conforme a intensidade de trabalho por m² relativa
a um projeto do zero — reforma e interiores exigem mais esforço por m² (mais
incerteza, mais detalhamento), consultoria/viabilidade/laudos exigem menos
(escopo mais estreito, menos técnico).

---

## 2. Índice de Complexidade — 11 critérios

**Adicionado:** Demanda de material para mídias (critério novo, não vem da
tabela CAU original — específico da Odisse, dado que a marca de conteúdo é um
ativo real do escritório).

- Baixo: sem necessidade de material fotográfico/audiovisual voltado à divulgação
- Médio: registro fotográfico padrão das etapas e do resultado final, para portfólio
- Alto: produção de conteúdo dedicado (vídeo, ensaio fotográfico, making-of) para mídias e redes sociais

**Considerado e descartado:** um critério de "Grau de Inovação em materiais/técnicas"
— decisão foi não adicionar, por já estar implicitamente capturado em "Quantidade
de especialistas", "Grau de detalhamento" e "Expectativa plástica".

**Dois critérios deixaram de ser preenchidos manualmente e viraram indicadores
calculados**, por serem os mais vagos/subjetivos dos dez originais:

### Grau de Detalhamento (calculado, exibido em "Etapas & Cronograma")
```
Alto:  etapa "Detalhamento Executivo Complementar" selecionada
Médio: alguma etapa da fase "Projeto Executivo" selecionada, mas sem Detalhamento Executivo Complementar
Baixo: nenhuma etapa de "Projeto Executivo" selecionada
```

### Empenho ao Projeto vs Porte (calculado, exibido em "Etapas & Cronograma")
```
Baixo:  até 3 entregáveis marcados (soma de todas as etapas + Assessoramento)
Médio:  de 4 a 6 entregáveis marcados
Alto:   7 ou mais entregáveis marcados
```

Pendente de recalibração: os cortes 3 / 4-6 / 7+ foram definidos ainda
com a lista antiga de escopo (~14 itens possíveis). Depois da unificação do
escopo com os entregáveis das etapas (item 3 abaixo), a base de contagem mudou —
agora soma entregáveis de todas as etapas selecionadas, tipicamente um número bem
maior. Os cortes continuam com esses valores por acordo explícito, mas devem
ser revisados assim que houver uso real da ferramenta para calibrar.

**Onde cada critério mora agora:**

| Critério | Onde é preenchido |
|---|---|
| Empenho ao Projeto vs Porte | Calculado — badge em "Etapas & Cronograma" |
| Quantidade de especialistas | Manual — "Índice de Complexidade" |
| Quantidade de aprovações | Manual — "Índice de Complexidade" |
| Grau de detalhamento | Calculado — badge em "Etapas & Cronograma" |
| Grau de responsabilidade civil | Manual — "Índice de Complexidade" |
| Grau de intervenção do cliente | Manual — "Índice de Complexidade" |
| Expectativa plástica | Manual — "Índice de Complexidade" (padrão "Médio" em todos os serviços) |
| Grau de controle de custo | Manual — "Índice de Complexidade" |
| Indefinição do escopo | Manual — "Classificação do Serviço" (junto das áreas) |
| Indefinição do prazo | Manual — "Índice de Complexidade" |
| Demanda de material para mídias | Manual — "Índice de Complexidade" |

---

## 3. Unificação de Entregáveis + Etapas, e nomenclatura Fase/Etapa/Entregável

**Decisão de nomenclatura:** a hierarquia interna do formulário passou a se
chamar consistentemente **Fase → Etapa → Entregável** (ex: Fase "Projeto
Conceitual" → Etapa "Programação Projetual" → Entregável "Análise de
similares"). A palavra "Escopo" foi removida dessa hierarquia de propósito —
fica reservada exclusivamente para a seção "Escopo" da proposta comercial,
que é um conceito diferente (ver adiante). Dois usos correlatos que **não**
mudaram de nome, por decisão explícita:
- "Escopo de Contratação" (dropdown de percentual fixo, só nos 4 serviços
  sem fórmula própria) — mantido, porque é sobre "quanto do contrato" está
  sendo fechado, semanticamente alinhado com o uso do termo na proposta.
- "Indefinição do Escopo" (um dos 11 critérios do Índice de Complexidade) —
  mantido, é terminologia da própria metodologia CAU/AsBEA.

**Decisão de unificação (histórico):** as duas listas separadas de escopo
("Compreende o serviço" / "Não compreende") deixaram de existir como página
própria. Os Entregáveis agora pertencem a cada Etapa — ao marcar uma Etapa
("Programação Projetual", por exemplo), seus Entregáveis ficam disponíveis
para refinar o que está incluso.

- Cada etapa que entra no `etapas_default` de um serviço já vem com todos os
  seus Entregáveis pré-marcados — ajustável livremente depois.

### Onde os Entregáveis aparecem no PDF (revisão desta decisão)

A ideia original era que Entregável marcado virasse "Compreende o serviço" e
Entregável não marcado virasse "Não compreende" — mas isso confundia dois
conceitos diferentes (o "escopo" comercial da proposta vs. o detalhe técnico
de cada etapa). Revisado para:

- **Entregáveis marcados de cada etapa** → aparecem como bullets dentro da
  própria etapa, na seção "Etapas de Desenvolvimento do Projeto" (logo após
  a descrição fixa da etapa) — igual ao modelo original da Odisse.
- **"Compreende o serviço"** (na seção "Escopo") → deixou de ser a lista
  granular de Entregáveis. Virou um resumo geral do arco do serviço,
  composto por frases-gatilho baseadas em quais Fases/Etapas/Assessoramento
  foram contratados (ver tabela de gatilhos abaixo).
- **"Não compreende"** → continua específico: todo Entregável NÃO marcado,
  de qualquer etapa (contratada ou não) + subitens de Assessoramento não
  marcados. Isso pode gerar uma lista de exclusão longa para serviços
  enxutos (ex: Consultoria Remota listando dezenas de itens não inclusos que
  nem fariam sentido cogitar). Aceito assim por ora — ver pendência abaixo.

### Gatilhos de "Compreende o serviço" (frases gerais)

| Frase | Gatilho |
|---|---|
| "Desenvolvimento de projeto arquitetônico desde o nível conceitual até sua documentação executiva" | Alguma etapa de Conceitual **+** alguma de Legal **+** alguma de Executivo |
| "Desenvolvimento de projeto arquitetônico compreendendo [combinação parcial]" | Só algumas das 3 fases acima — frase montada dinamicamente (redação provisória, sem exemplo do modelo original) |
| "Desenvolvimento de projeto de decoração das áreas comuns do empreendimento" | Qualquer etapa da fase "Projeto de Decoração de Interiores" |
| "Acompanhamento do processo de aprovação do projeto junto à prefeitura municipal e demais órgãos competentes" | Etapa "Projeto Básico/Legal" |
| "Compatibilização do projeto arquitetônico com outras disciplinas complementares" | Etapa "Pré-Executivo" (gatilho específico — poderia ser "qualquer etapa da fase Executivo", não confirmado) |
| "Participação em reuniões de coordenação de projeto com disciplinas complementares" | Mesmo gatilho acima |
| "Suporte técnico à construtora em todas as suas solicitações..." | Assessoramento: subitem "suporte ao cliente/construtora" |
| "Suporte técnico à construtora durante as tratativas junto a fornecedores..." | Assessoramento: subitem "suporte a fornecedores" |

Confirmado como satisfatório pelo Cid; os dois pontos sem exemplo do modelo
original (combinação parcial, e o gatilho específico do Pré-Executivo)
seguem sinalizados para eventual ajuste futuro.

### Bloco "Assessoramento" (independente)

Existem itens que não pertencem a nenhuma etapa específica de projeto — hoje
eram um switch único ("incluir acompanhamento mensal de obra"). Viraram um
bloco à parte, fora do conjunto de etapas e do cronograma (sem duração em
semanas, sem entrar na soma de prazo total):

- Acompanhamento mensal da execução da obra
- Suporte técnico ao cliente/construtora para esclarecimento do projeto
- Suporte técnico em tratativas com fornecedores

No PDF, o texto da seção "Assessoramento" é montado dinamicamente: só entram
a abertura fixa + as frases dos subitens efetivamente marcados. Se nenhum
subitem for marcado, o bloco inteiro some do documento. ("Acompanhamento
mensal da obra" propositalmente não gera frase em "Compreende o serviço" —
já é coberto integralmente pela seção própria de Assessoramento.)

---

## 4. Percentual do serviço por etapa (Base + Incremento)

**Decisão:** o "Escopo de Contratação" (dropdown com combinações nomeadas —
Projeto Completo, Até Estudo Preliminar, etc.) foi removido para os 5
serviços com estrutura Conceitual/Legal/Executivo (Nova Edificação em
suas 4 variações, e Reforma). Motivo: essas combinações nomeadas
duplicavam a própria seleção de etapas — escolher "Até Projeto Legal" no
dropdown e marcar as etapas de Conceitual+Legal na lista eram, na
prática, duas formas de dizer a mesma coisa, e podiam dessincronizar (o
dropdown não se atualizava se você editasse as etapas manualmente
depois).

**Confirmação de que Interiores é um serviço à parte:** durante essa
discussão ficou confirmado que "Projeto de Interiores e Ambientação" não
é um complemento de Nova Edificação/Reforma — é um orçamento próprio,
com sua própria estrutura de etapas (Estudo Básico / Projeto Executivo
de Interiores). As etapas de interiores foram removidas do
`etapas_default` de "Edifício Misto e Multifamiliar" por causa disso.
Isso generaliza a ideia antiga de "Tipo X vs Tipo Y" (item 2 das
pendências abaixo) — na verdade são N estruturas, uma por família de
serviço, e o campo `modificador` de cada serviço agora também funciona
como a chave que decide isso.

### Peso de cada etapa (soma 100% no Projeto Completo)

| Fase | % da fase | Etapa | % da etapa (sobre os 100%) |
|---|---|---|---|
| Projeto Conceitual | 40% | Programação Projetual | 12% |
| | | Concepção Esquemática | 12% |
| | | Concepção Básica | 16% |
| Projeto Legal | 20% | Projeto Básico/Legal | 20% |
| Projeto Executivo | 40% | Pré-Executivo | 8% |
| | | Projeto Executivo de Arquitetura | 16% |
| | | Detalhamento Executivo Complementar | 16% |

A primeira e a última fase pesam mais (40% cada) porque demandam mais
esforço/tempo; dentro do Executivo, a etapa de Projeto Legal concentra
boa parte da documentação técnica produzida do zero, por isso pesa mais
por etapa do que as etapas de Conceitual, mesmo a fase Legal sendo menor
no total.

> **Desde nov/2026 (Universo, migrações 0015 e 0016):** os pesos moram nos Honorários do Universo e a regra
> passou a valer **por fase**: cada fase tem um peso por serviço (% do projeto, as do fluxo somam 100); dentro da
> fase, a etapa tem fator 1 ou 2 e leva fator ÷ soma dos fatores das etapas contratadas (a não contratada
> redistribui o valor da fase). A lacuna abaixo é calculada com as **fases** do fluxo não contratadas que vêm
> antes de uma contratada, com a fração editável em Honorários (padrão 50%); a fase Obra é acréscimo além dos
> 100% e fica fora da lacuna. Os exemplos da tabela continuam dando os mesmos números. Código: `catalogo.js`.

### A fórmula

```
Base       = soma do peso de cada etapa marcada
Lacuna     = soma do peso de cada etapa NÃO marcada que vem antes de
             alguma etapa marcada (cada uma conta uma única vez, mesmo
             que fique "atrás" de mais de uma etapa contratada)
Incremento = 50% da Lacuna
Percentual = Base + Incremento
```

Prova informal de que isso nunca ultrapassa 100%: o incremento máximo
possível é sempre metade do que falta, então o total satura em "base +
metade do que falta", que só chega a 100% quando base já é 100% (Lacuna
= 0). Não precisa de trava manual em nenhum cenário.

### Exemplos testados e validados

| Etapas contratadas | Base | Lacuna | Incremento | Percentual |
|---|---|---|---|---|
| Só Projeto Básico/Legal | 20% | 40% (Conceitual) | 20% | **40%** |
| Legal + Executivo (sem Conceitual) | 60% | 40% (Conceitual) | 20% | **80%** |
| Conceitual + Executivo (pulando o Legal) | 80% | 20% (Legal) | 10% | **90%** |
| Todas as 7 etapas | 100% | 0% | 0% | **100%** |

O terceiro exemplo é o caso que travava antes de fechar essa fórmula
(uma tentativa anterior de "penalidade fixa de +30% ao pular qualquer
etapa anterior" dava 110% nesse cenário, o que não fazia sentido).

### Etapas desmarcadas ficam visíveis, só esmaecidas

Todas as etapas vêm marcadas por padrão (contam no orçamento). Ao
desmarcar uma etapa, ela não desaparece da lista — fica com opacidade
reduzida, deixando claro que está fora do orçamento sem esconder a opção
de marcar de volta.

## 5. As 4 camadas até o valor base (Serviço → Modificador → Tipologia → CUB)

**Contexto:** revisão de como o Serviço Odisse, o Modificador, a Tipologia
construtiva e o CUB se relacionam — nenhuma mudança de código aqui, só
esclarecimento e auditoria da lógica existente (documentado porque valia a
pena registrar; hoje resumido na legenda de Referências › Fórmula).

São 4 classificações de fontes diferentes, encadeadas:

| # | Camada | Fonte | Quantidade | Entra na fórmula como |
|---|---|---|---|---|
| 1 | Serviço Odisse | Agrupamento comercial próprio | 9 | Escolhe o modificador (camada 2) |
| 2 | Modificador | Planilha CAU, "Modificador de Fator Percentual" | 6 valores | `× modificadorIntervencao` |
| 3 | Tipologia construtiva | Planilha CAU, tabela de enquadramento | 49 | `categoria` (1-4, define fp) + `fator_adequacao` |
| 4 | CUB | Sinduscon-JP, mensal | 19 códigos | Preço bruto de construção (R$/m²) |

**A Tipologia não deriva do CUB — ela referencia um dos 19 códigos.** É uma
relação de muitos-para-um (ex: 13 das 49 tipologias apontam pro mesmo
código `CSL-16-N`). A Tipologia usa esse valor bruto e ajusta com seu
próprio Fator de Adequação: `BH = CUB vigente × Fator de Adequação`.

**Auditoria da correspondência Tipologia ↔ CUB:** conferida tipologia por
tipologia contra o significado oficial de cada código de CUB (nomenclatura
NBR 12.721/ABNT). Resultado: a correspondência está correta — inclusive
casos exatos (ex: "Projeto habitacional de Interesse Social" → código
`PIS`) e aproximações sensatas onde não existe código dedicado (ex:
hotéis usam códigos residenciais multifamiliares, já que não existe
código de CUB específico pra hotelaria). Único ponto que chamou atenção,
sem ser erro: "Presídios e penitenciárias" usa `R-8-N` (residência
multifamiliar) como referência de custo — estranho conceitualmente, mas
não existe alternativa melhor entre os 19 códigos, e a categoria de
complexidade já compensa isso (fica no nível 4, o máximo).

**Filtro de Tipologia por Serviço (`macro_categorias`):** só os 4 serviços
de Nova Edificação restringem quais macro categorias/tipologias aparecem
no formulário — faz sentido, cada um corresponde a um tipo de edificação
específico. Os outros 5 (Reforma, Estudo de Viabilidade, Laudos,
Consultoria Remota, Interiores) deixam as 12 macro categorias e 49
tipologias completas abertas, porque esses serviços podem se aplicar a
qualquer tipo de imóvel.

**Mudança de interface decorrente:** o campo único "Tipologia específica"
virou dois dropdowns em cascata — Macro Categoria (filtrada pelo Serviço)
e, dentro dela, a Tipologia — em vez de uma lista longa com `<optgroup>`.
Reduz a lista visível em cada passo e deixa mais claro que são duas
classificações diferentes.

## 6. Fórmula única e área de cálculo (nov/2026)

**Decisão (Cid, 18/11):** a página "Como funciona o cálculo" virou a aba
Referências › Fórmula, só com a conta e a legenda das siglas:

    H = { [ (CUB × FA) × (A × R × Rr) ] × fp × IC } × M × P ÷ Fm

O ajuste de área (R e o redutor por repetição) passou para dentro do CEO,
junto da área: **área de cálculo = A × R × Rr** e **CEO = BH × área de
cálculo**. O honorário final não muda (é tudo multiplicação); mudam só o CEO e
o valor de tabela mostrados na memória de cálculo, que agora batem com a
fórmula. A faixa do fp continua escolhida pela área construída (A).

## Pendências para revisão futura

1. Recalibrar os cortes de "Empenho ao Projeto vs Porte" (3 / 4-6 / 7+)
   agora que a base de contagem mudou (entregáveis de etapas em vez da lista
   plana antiga).
2. Estrutura própria por serviço — confirmado que não são só "Tipo X vs
   Tipo Y", são N estruturas (uma por família de serviço — ver seção 4
   acima). O campo `servico.formula_percentual_por_etapa` já resolve isso
   para os 5 serviços com fases Conceitual/Legal/Executivo. Falta desenhar
   a estrutura própria dos outros 4: Interiores (provavelmente 2 fases —
   Estudo Básico / Executivo, com pesos próprios), e Consultoria Remota /
   Estudo de Viabilidade / Laudos (provavelmente sem fases progressivas,
   direto por escopo).
3. Lista de escopo por serviço, ao invés de tudo-ou-nada — hoje, se um
   item não pertence a uma sub-lista "relevante" de um serviço, ele ainda
   aparece como exclusão explícita no PDF. Uma opção futura seria cada
   serviço ter sua própria lista de itens relevantes, e itens fora dela
   simplesmente não aparecerem no documento (nem como inclusão, nem como
   exclusão).
