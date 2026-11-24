# Dados do Universo — como é e por quê

Retrato da estrutura de dados **como ela é hoje**, por assunto. O histórico (quando e em que ordem cada coisa entrou)
fica no git e nas migrações (`dados/migracoes/`, o contrato entre as ferramentas). O desenho tabela por tabela está no
doc "dados" do projeto.

## Onde cada coisa mora

| O quê | Onde | Por quê |
|---|---|---|
| Registros e vínculos | D1 `universo` (um banco só) | As ligações cruzam ferramentas (proposta ↔ projeto ↔ cliente ↔ publicação) e são editadas de qualquer lado. O D1 não cruza bancos; vários bancos virariam sincronização. |
| Arquivos | R2 privado `universo-arquivos`, chave `arq/<id>[-m\|-s]` | O caminho não diz a quem o arquivo pertence: reatrelar não move nada. |
| Cópias do banco | R2 privado `universo-copias`, `d1/AAAA-MM-DD.sql.gz` | Os repositórios são públicos: cópia nunca vai para o git. |
| Métricas coletadas, sessões, cache | KV | Rápido e descartável. |
| Tabelas normativas (CUB, normas) | git, versionadas | Públicas, mudam por versão; a proposta registra qual versão usou. |

## Porta única

O Worker `universo-hub` é a única porta do D1 e do R2 (`/api/v1`). Validação, permissões e histórico ficam num lugar só.

- As telas (todas em universo.odisse.com.br) entram com a senha da equipe (`UNIVERSO_SENHA`), a mesma em todos os Workers.
- Rotinas do GitHub Actions entram com um token de máquina (`MAQUINA_TOKEN`), separado de senha de pessoa.
- Os Workers das ferramentas falam com o hub por service binding com ponto de entrada nomeado (`Vendas`, `Projetos`,
  `Radar`, `Site`, `Marketing`, `Fornecedores`). Esses pontos não são acessíveis pela internet; cada um tem as
  permissões da sua ferramenta (`worker/dados/esquema.js`, `editaveis_por`, `linhas_restritas`).

Compromissos aceitos: o hub é ponto único de falha para os dados comuns; mudança de estrutura passa sempre por este
repositório; rotas versionadas.

## Convenções

- **id = prefixo do tipo + ULID** (`org_01…`): único no Universo inteiro; o prefixo diz a tabela, o que permite
  referências "a qualquer tipo" (vínculos, interações) e a rota `registros/:id`. Sementes usam ids legíveis (`srv_ne`).
- **Nada se apaga**: `arquivado_em`. "Único" vale só entre ativos (índices únicos parciais).
- **`versao` em todo registro**: salvar com versão velha dá 409 em vez de sobrescrever.
- **Ausência = NULL**, nunca um valor padrão que pareça dado.
- **Dinheiro em centavos**, **dias em AAAA-MM-DD no fuso de Brasília**, instantes em UTC.
- **Relação que define o registro = coluna** com chave estrangeira; **relação que só acrescenta = `vinculos`**.
- **Sequências no D1** (propostas, contratos, projetos, documentos), incrementadas dentro do banco.
- **Códigos com o ano antes do número**: projeto `OA-AAAA-NNN` (recomeça a cada ano), proposta `PC-AAAA-NNNN` e
  contrato `CT-AAAA-NNNN` (número único que não recomeça). Códigos já impressos em PDF ficam como saíram.

## Escolhas que não são óbvias

- **Sem FTS5**: o D1 não exporta bancos com tabelas virtuais, e a cópia depende da exportação. A busca usa a tabela
  `busca` (texto sem acento, `LIKE` por termo).
- **Histórico × versões × revisões**: histórico = auditoria campo a campo; versões = retrato restaurável de conteúdo
  rico (10 por registro, edições de 10 min agrupadas); revisões = decisão humana pendente (duplicados).
- **Duplicados de contatos**: cada campo (nome normalizado, CNPJ, e-mail, telefone) é classificado em bate / ausente /
  conflito. Bate sem conflito → 409 `possivel_duplicado` (a tela oferece usar o existente; `confirmar_novo: true`
  cria mesmo assim). Bate com conflito → cria e abre uma revisão. "É o mesmo" junta os dois: o escolhido fica, recebe
  tudo o que apontava para o outro, e o outro é arquivado.
- **Dados sensíveis** (`pessoas_sensiveis`: CPF, RG, nascimento, endereço residencial, qualificação para contrato)
  numa tabela à parte, lida um a um, só pelo vendas e pelo hub. O histórico registra o nome dos campos, nunca o valor;
  cada leitura vira `ler_sensivel`. Nunca entram na busca.
- **Arquivos imutáveis**: cada variante (`g` 2400 px, `m` 1200 px, `s` 960 px) sobe uma vez; trocar = arquivo novo
  (cache de um ano). Mesmo sha256 não entra duas vezes. Arquivo `protegido` (assinaturas) não sai pela rota comum.
- **Autoria**: só os sócios usam, com a senha da equipe; `criado_por`/`historico.por` gravam a ferramenta.
- **O SQLite não muda CHECK nem tira NOT NULL** de coluna existente: quando isso é preciso, a migração refaz a tabela
  com os mesmos dados.

## Comercial (casa: /vendas/)

- **Oportunidade é o centro do funil**; proposta e interação penduram nela. Titular = organização ou pessoa
  (`cliente_id`); quem fala com o estúdio = `contato_pessoa_id`. `etapa_desde` e `fechada_em` são gravados pela API.
- **Co-clientes** (casal, sócios) em `vinculos` (papel `cliente`); "tornar titular" troca o `cliente_id` e inverte os
  vínculos. Oportunidades de um contato = titular, co-cliente ou pessoa de contato.
- **Atuações** (pessoa ↔ organização): "encerrar" grava `ate`; "tirar" arquiva. Papel `corretor` para o Radar.
- **Próxima ação** = a da interação mais recente; interação sem próxima ação limpa a pendência.
- **Revisão de proposta** = mesmo número, revisão seguinte (`-R1`); as anteriores abertas passam a "substituída".
- **PDF congelado**: o PDF enviado fica no R2 (`arquivo_pdf_id`); daí em diante título, valor, cálculo e referências
  travam (409 `proposta_congelada`). Mudou, é revisão.
- **Referências do cálculo**: cada proposta grava os números dos retratos publicados (Bases, PGT, Honorários) e a
  região e competência do CUB. As importadas do vendas antigo dizem que essas versões não foram registradas.
- **Simulação** (`propostas.simulacao = 1`): orçamento sem cliente nem oportunidade (CHECK no banco); consome número
  como qualquer proposta; não entra no funil; o PDF sai marcado "Simulação".
- **Endereço do orçamento é do imóvel** (vai para `projetos_local`), nunca dos dados sensíveis.
- **Contrato**: 15 seções fixas; dados vêm das outras ferramentas na hora de emitir (`vendas/contrato-minuta.js`),
  cláusulas dos eventos do PGT ficam em `pgt_eventos.clausula`, cláusulas gerais e despesas reembolsáveis no Gestor de
  cláusulas (`clausulas`, grupos `geral` e `despesa`). Evento marcado sem texto = cláusula a redigir.
- Códigos de origem no texto do WhatsApp: `[LP-<página>]` e `[Herma <lote>]`; o funil reconhece ao colar.

## Radar (casa: /radar/, Worker radar-odisse)

- O Radar leva corretores aos Contatos (papel `corretor`, imobiliária como organização). **Uma oportunidade por
  terreno, com o corretor como titular** (`origem = radar`); quando rende um cliente, abre-se a oportunidade do cliente,
  ligada à do corretor por `vinculos` papel `derivada_de`.
- O ponto `Radar` cria e lê pessoas, organizações, atuações e oportunidades; não vê propostas, contratos, interações
  nem dados sensíveis.

## Projetos, equipe e horas (casa: /projetos/)

- **Projeto nasce da assinatura do contrato principal**: no mesmo lote, cria o projeto, o escopo, o local do imóvel e os
  co-clientes, marca a proposta como aceita e a oportunidade como ganha. Índice único em `projetos.contrato_id`.
  Aditivo aponta para um projeto que existe. Cadastro manual (projetos anteriores ao Universo) aceita o código antigo;
  a sequência do ano sobe até ele.
- **Local do imóvel** (`projetos_local`): endereço exato, só vendas e Projetos. Bairro, cidade e UF ficam no projeto.
- **Horas**: a etapa precisa ser do mesmo projeto (API e gatilho no banco).
- **Marketing** vê do projeto só o que é público e muda só o `nome_publico`.
- **Suspensão** do projeto (`projetos.suspensoes`) congela o calendário do escopo.

## PGT, Serviços e Honorários (casa: /projetos/ e /vendas/)

- **Cadeia Serviços → PGT → Escopo**: os Serviços dizem o que forma o preço (categoria e uso da tipologia, CUB, fator do
  CAU, índice de complexidade); o PGT diz o que se faz (fases › etapas › entregas e eventos, materiais); o Escopo é a
  cópia contratada para um projeto. Vocabulário da NBR 16636 (fase › etapa), com sigla e nome do Odisse e a
  correspondência na NBR.
- **Serviço em fluxo ou em ilha**: em fluxo, entra no plano comum e marca P/O/— em cada cartão; em ilha, tem plano
  próprio (`pgt_etapas.servico_id`). Trocar a dinâmica não apaga nada. Em fluxo, o serviço pede tipologia.
- **Índice de complexidade**: padrão por serviço (`ic_padrao`); em fluxo, cada categoria pode ter o seu (`bases_ic`).
- **Pertinência**: P (vem marcado), O (opcional), sem linha (não se aplica); nos eventos, também S (perpétuo). A
  pertinência da etapa é calculada das entregas.
- **Tipologia = uso dentro de uma categoria** (o uso tem CUB e fator do CAU).
- **Prazo vem das entregas**: duração em turnos (1 turno = 4 h; 1 semana = 10 turnos), pessoas e prazo fixo; a etapa
  soma as entregas que valem (o grupo que corre junto conta a mais longa) e os eventos com tempo do estúdio.
- **Eventos** (`pgt_eventos`): tipo, se o cliente e terceiros participam, de quem é o tempo, duração, cláusula.
  **Decisão** = 2 a 4 resultados, cada um libera cartões suspensos. **Encerramento** = registro único, ativado na
  última etapa contratada.
- **Sequência**: entregas e eventos dividem a `ordem` dentro da etapa; `junto_anterior` = corre junto com o anterior.
  O código do cartão (CE-03) não é gravado: sai da sigla da etapa + posição.
- **Materiais**: link ou **padrão** (formulário, checklist ou modelo feito no Universo, `pgt_modelos`), ligado a
  quantos cartões for preciso; mudou o padrão, mudou em todos.
- **Projetos = estrutura, vendas = custo**: preço dos serviços, pesos das fases, fatores das etapas, entrada e
  cláusulas formam o retrato `honorarios`, editado só no vendas. O Projetos lê.
- **Preço por fase e etapa**: cada fase tem peso por serviço (`pgt_fases_servicos`, fases do fluxo somam 100); a etapa
  tem fator 1 ou 2 e leva fator ÷ soma dos fatores das etapas contratadas da fase. Fase de acréscimo (Obra) vai além
  dos 100%. **"Só tal fase"**: as fases do fluxo não contratadas antes de uma contratada somam uma lacuna, e uma fração
  dela (`acrescimo_lacuna`, padrão 0,5) entra como acréscimo. Ilhas têm preço único.
- **Rascunho × publicado**: as tabelas são o rascunho vivo; publicar grava um retrato numerado em `pgt_publicacoes`
  (tipos `bases`, `pgt`, `honorarios`), que é o que o vendas lê. "Pendente" compara a assinatura SHA-256 do rascunho
  com a do último retrato; publicar sem mudança dá 409.

## Escopo do projeto (casa: /projetos/)

- Lista de etapas, entregas e eventos contratados, copiada do PGT publicado, cada cartão com a sua duração.
- **Calendário calculado**: início + durações em dias úteis, os que correm juntos no mesmo intervalo; nenhum estado
  gravado no cartão. Fica em dia mudando a duração ou movendo (`folga`: hiato; negativa = paralelo).
- **Andamento**: cartões da etapa em paralelo (`junto_anterior`, também entre eventos e camadas) ou em sequência;
  seleção com buracos reorganiza a pilha; `trocar` inverte dois cartões.
- **Alterações** (`escopo_alteracoes`) guardam tudo o que muda: natureza `aditivo`, `prazo` ou `extra`. Base dos aditivos.
- **Materiais do cartão**: os do PGT vêm sozinhos; `escopo_cartoes.materiais` acrescenta ou tira; material novo criado
  no cartão entra no banco do PGT. Mexer em materiais não entra nas Alterações. (A confirmar com o Cid.)
- O calendário tem uma cópia no hub (`worker/dados/calendario.js`) para a Início: mudou em `projetos/escopo.js`, mude lá.

## Estúdio: Empresa, Equipe, Credenciais, Documentos (casa: hub)

- **Empresa** (`emp_odisse`, um registro): identidade jurídica, contato, endereço, textos de apresentação, dados
  bancários, responsável técnico (aponta para a Equipe). Ao salvar, o hub copia a parte pública para o `odisse.json` da
  Marca, que o site lê.
- **Equipe**, cadastro comum que todas as ferramentas leem. **Sócio é estado, cargo é opção**: `socio` decide custo por
  hora e representação legal; cargo e título vêm das listas `cargos` e `titulos` (forma masculina, feminina, inglesa),
  e o `tratamento` escolhe a forma. **Quem assina o quê** (`assina`): RRT exige registro no conselho (com UF:
  "CAU/PB A123456-7"); contrato exige sócio. `papel` só para leitura antiga.
- **Assinatura manuscrita**: PNG no R2, arquivo `protegido`, só por `equipe/:id/assinatura` num uso permitido, sem
  cache, cada leitura no histórico; entra só na emissão.
- **Site**: o ponto `Site` lê `equipe/publica` e as fotos; mudou a equipe, o hub pede a regeneração das páginas.
- **Credenciais** (`credenciais`): cada documento mora com o dono (empresa, pessoa da equipe, projeto). Catálogo de
  tipos no código (`worker/dados/credenciais.js`), sem CHECK. Vencido gera aviso na Início até ser substituído
  (`substitui_id`, uma vez só). Senhas de portais nunca entram.
- **Documentos** (carta, ofício, declaração, memorando): o banco guarda só o conteúdo; a folha é desenhada pela Marca.
  Ofício é opção da carta. Numeração por sigla e ano (`CA-2026-0001`). Só a marca-mãe no timbrado. Folhas em branco
  não viram registro.
- **Textos dos Canais** (`ferramentas_textos`): descrição editada por cima do `ferramentas.json`.

## Acervo de imagens (casa: hub)

- **Um banco só**: imagens de projetos, objetos e coleções; `galeria` liga cada imagem a um ou mais alvos. Mídias com
  dono (fotos da equipe, PDFs) ficam fora da lista.
- **`publica`**, ligado à mão: toda imagem nasce restrita e só fica pública com `direitos = 'livre'` (API e gatilho).
- O marketing e o site só enxergam as públicas. O site serve `/img/a-<arq>` pedindo ao hub (1 dia na borda).
- Imagem enviada pelo editor do site entra pública e ligada ao projeto. (A confirmar com o Cid.)

## Financeiro (casa: hub)

- **Despesas fixas** (`despesas_fixas`): grupo `geral` ou `pessoal`; moeda `brl` ou `usd` (dólar convertido pela PTAX
  do dia nas somas, marcado como previsão); periodicidade mensal, trimestral, semestral ou anual.
- **Valor vigente + histórico** (`despesas_fixas_valores`, com o mês desde quando vale): a previsão de meses passados
  usa o valor da época. **Valor que varia**: o cadastrado é a estimativa; o real do mês fica em `despesas_fixas_meses`.
- **Simulação**: fica fora das contas reais até ser efetivada; uma conta real não volta a ser simulação.
- Encerrar = `fim`; arquivar = cadastrada por engano.

## Como mudar a estrutura

1. Nova migração em `dados/migracoes/NNNN_nome.sql` (nunca editar uma já aplicada).
2. Atualizar `worker/dados/esquema.js` (campos, permissões, prefixos).
3. Testar: `cd worker && node --test testes/*.test.mjs` (o banco dos testes nasce das migrações).
4. Atualizar este documento (o estado novo, não o histórico) e o doc "dados" do projeto.
5. Push em `main`: o workflow aplica a migração e publica.
