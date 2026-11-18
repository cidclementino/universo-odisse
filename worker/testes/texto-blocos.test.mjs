// Teste do conversor de texto em blocos (assets/texto-blocos.js), usado pelos Documentos do Universo.
// Rodar: node --no-warnings worker/testes/texto-blocos.test.mjs
import { textoEmBlocos } from '../../assets/texto-blocos.js';

const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const json = (x) => JSON.stringify(x);

// texto simples continua igual ao de antes: parágrafos por linha em branco, linhas seguidas juntas
ok(json(textoEmBlocos('Primeira linha\ncontinua aqui.\n\nSegundo parágrafo.')) === json(['Primeira linha continua aqui.', 'Segundo parágrafo.']),
  'texto simples vira parágrafos (como antes)');
ok(textoEmBlocos('').length === 0 && textoEmBlocos(null).length === 0, 'vazio não gera bloco');

const b = textoEmBlocos(`# Escopo
Texto da seção
logo abaixo.
- Levantamento
- Análise do entorno
  com continuação recuada
1. Primeira rodada
2) Segunda rodada

> Nota pequena
> em duas linhas.

**Esta proposta tem validade de 30 dias.**`);
ok(b[0].tipo === 'secao' && b[0].texto === 'Escopo', 'seção com #');
ok(b[1] === 'Texto da seção logo abaixo.', 'parágrafo colado à seção');
ok(b[2].tipo === 'lista' && !b[2].numerada && b[2].itens.length === 2, 'lista com travessão');
ok(b[2].itens[1] === 'Análise do entorno com continuação recuada', 'continuação recuada junta ao item');
ok(b[3].tipo === 'lista' && b[3].numerada && b[3].itens[1] === 'Segunda rodada', 'lista numerada (1. e 2))');
ok(b[4].tipo === 'nota' && b[4].texto === 'Nota pequena em duas linhas.', 'nota com >');
ok(b[5].tipo === 'paragrafo' && b[5].negrito && b[5].texto.startsWith('Esta proposta'), 'parágrafo em negrito com **');

const t = textoEmBlocos(`| Etapa | Prazo | Parcela |
|---|---:|:---:|
| Concepção | 3 semanas | 20% |
| Executivo | 6 semanas | 40% |
|---|---|---|
| Total | 9 semanas | 60% |`)[0];
ok(t.tipo === 'tabela' && t.colunas.map((c) => c.titulo).join() === 'Etapa,Prazo,Parcela', 'tabela com cabeçalho');
ok(t.colunas[1].alinhar === 'direita' && t.colunas[2].alinhar === 'centro' && t.colunas[0].alinhar === 'esquerda', 'alinhamento pelos dois-pontos');
ok(t.linhas.length === 2 && t.linhas[1][0] === 'Executivo', 'linhas do corpo');
ok(json(t.total) === json(['Total', '9 semanas', '60%']), 'linha de total depois do segundo |---|');

const s = textoEmBlocos('| a | b |\n| c | d |')[0];
ok(s.colunas.every((c) => !c.titulo) && s.linhas.length === 2 && !s.total, 'tabela sem cabeçalho');
console.log('texto-blocos: tudo certo');
