# Lógica de precificação — como é e por quê

Retrato de como o vendas calcula os honorários **hoje**. O histórico fica no git. A fórmula linha a linha está nos
comentários de `calc.js`; o percentual por fase e etapa, em `catalogo.js`. Os números (preço dos serviços, pesos das
fases, fatores das etapas, fração da lacuna) moram nos **Honorários** do Universo e chegam pelo último retrato
publicado (ver `dados/DECISOES.md`).

## A fórmula

    H = { [ (CUB × FA) × (A × R × Rr) ] × fp × IC } × M × P ÷ Fm

| Sigla | O que é | De onde vem |
|---|---|---|
| CUB | Custo unitário básico vigente (R$/m²) do código da tipologia | Sinduscon-JP, mensal (rotina do CUB) |
| FA | Fator de adequação da tipologia | Serviços (tipologia) |
| BH = CUB × FA | Base de honorários | — |
| A | Área construída prevista | Formulário |
| R | (A + área externa de intervenção × 0,25) ÷ A | Formulário |
| Rr | Redutor por repetição de unidades ou áreas | Tabela por quantidade de repetições |
| A × R × Rr | Área de cálculo; CEO = BH × área de cálculo | — |
| fp | Fator percentual: faixa de área (pela área construída A) × categoria da edificação (1 a 4) | Tabela do CAU |
| IC | Índice de complexidade: média de 11 critérios (0,7 / 1,0 / 1,3) | Formulário (ver abaixo) |
| M | Modificador do serviço | Honorários |
| P | Percentual contratado (fases e etapas) | `catalogo.js` (ver abaixo) |
| Fm | Fator de ajuste de mercado (atalhos 1, 1,25 e 2,25) | Formulário |

Área do terreno, teto orçamentário e prazo esperado do cliente **não entram na conta**: geram só os alertas da barra
lateral. A distribuição do valor entre as etapas, para o plano de pagamento, é proporcional à duração delas.

## As camadas até o valor base

1. **Serviço** (agrupamento comercial do Odisse) → escolhe o modificador e a dinâmica (em fluxo ou em ilha).
2. **Modificador** (M): Nova Edificação 1,0 é o referencial; reforma e interiores pedem mais esforço por m² (1,25;
   1,50 ou 0,75 na ambientação); consultoria, viabilidade e laudos têm escopo estreito (0,15 a 0,20). Valores tirados
   da planilha CAU ("Modificador de Fator Percentual"), não inventados.
3. **Tipologia** = uso dentro de uma categoria: define a categoria do fp e o FA, e **aponta** para um código de CUB
   (muitos usos para um código; onde não há código próprio, usa-se o mais próximo, como hotéis em residencial
   multifamiliar). Correspondência auditada contra a NBR 12.721.
4. **CUB**: preço bruto de construção, por código.

Só os serviços de Nova Edificação restringem as categorias de tipologia; os outros servem a qualquer imóvel. No
formulário, categoria e uso vêm em dois seletores em cascata.

## Índice de complexidade

- **11 critérios**: empenho vs porte, especialistas, aprovações, detalhamento, responsabilidade civil, intervenção do
  cliente, expectativa plástica, controle de custo, indefinição do escopo, indefinição do prazo e **demanda de
  material para mídias** (critério do Odisse: a produção de conteúdo é um ativo do escritório).
- **Padrão**: o do serviço (`ic_padrao`); em serviço em fluxo, a categoria da tipologia pode ter o seu, que passa por
  cima. Tudo ajustável na proposta.
- **Dois critérios são calculados**, por serem os mais subjetivos:
  - *Detalhamento*: alto com Detalhamento Executivo Complementar; médio com alguma etapa executiva; baixo sem nenhuma.
  - *Empenho vs porte*: pela quantidade de entregas marcadas (até 3 baixo; 4 a 6 médio; 7 ou mais alto).

## Percentual contratado (P)

- Cada **fase** tem um peso por serviço (% do projeto); as fases do fluxo somam 100.
- Dentro da fase, a **etapa** tem fator 1 ou 2 e leva fator ÷ soma dos fatores das etapas **contratadas** da fase: a
  etapa não contratada redistribui o valor da fase entre as que ficaram.
- **Fase de acréscimo** (Obra): o peso vai além dos 100%.
- **"Só tal fase"**: as fases do fluxo não contratadas que vêm antes de uma contratada somam a **lacuna**; uma fração
  dela (padrão 50%, editável em Honorários) entra como acréscimo. Nunca passa de 100%: o acréscimo é sempre uma parte
  do que falta. Com Nova Edificação 40 · 20 · 40:

  | Contratado | Base | Lacuna | Acréscimo | P |
  |---|---|---|---|---|
  | Só Legal | 20% | 40% | 20% | **40%** |
  | Legal + Executiva | 60% | 40% | 20% | **80%** |
  | Conceitual + Executiva | 80% | 20% | 10% | **90%** |
  | Todas | 100% | 0% | 0% | **100%** |

- Serviços em ilha têm preço único, sem fases.
- Etapa desmarcada continua visível no formulário, esmaecida.

## Vocabulário

**Fase › Etapa › Entrega** (vocabulário da NBR 16636, com os nomes do Odisse). "Escopo" fica reservado à seção
Escopo da proposta e ao Escopo do projeto; "Escopo de contratação" e "Indefinição do escopo" mantêm o nome porque são
termos da metodologia CAU/AsBEA.

## O que vai para o PDF

- **Entregas marcadas** de cada etapa: bullets dentro da etapa, em "Etapas de desenvolvimento do projeto".
- **"Compreende o serviço"**: resumo do arco do serviço, por frases-gatilho conforme as fases contratadas (conceitual
  até executivo; aprovação na prefeitura com o Legal; compatibilização e reuniões com o Pré-Executivo; suportes da
  obra). A frase da combinação parcial e o gatilho do Pré-Executivo ainda não têm exemplo do modelo original.
- **"Não compreende"**: toda entrega não marcada, de qualquer etapa, mais os suportes não marcados.

## Pendências

1. Recalibrar os cortes do *empenho vs porte* (3 / 4–6 / 7+), que vêm da lista antiga de escopo, quando houver uso real.
2. "Não compreende" lista tudo o que não foi marcado; em serviços enxutos fica longa. Opção: cada serviço ter só os
   itens que fazem sentido cogitar.
