# Dados do Universo — decisões e porquês

Este documento registra **por que** a estrutura de dados é como é, no espírito do `PRICING.md` (vendas) e do `RADAR.md` (Radar). O desenho completo, tabela por tabela, está no doc "Universo — estrutura geral de dados" do projeto (v1.4, 11/11/2026). As migrações ficam em `dados/migracoes/` e são o contrato entre as ferramentas.

## Onde cada coisa mora

| O quê | Onde | Por quê |
|---|---|---|
| Registros e vínculos | D1 `universo` (um banco só) | As ligações cruzam ferramentas (cotação ↔ projeto ↔ cliente ↔ publicação) e são editadas de qualquer lado. O D1 não cruza dados entre bancos; vários bancos virariam sincronização. |
| Arquivos | R2 privado `universo-arquivos`, chave `arq/<id>[-m\|-s]` | O caminho não diz a quem o arquivo pertence: reatrelar uma cotação a outro projeto não move nada. |
| Cópias do banco | R2 privado `universo-copias`, `d1/AAAA-MM-DD.sql.gz` | Os repositórios são públicos: cópia nunca vai para o git. |
| Métricas coletadas, sessões, cache | KV | Rápido e descartável. |
| Tabelas normativas (CUB, tipologias, normas) | git, versionadas, nas ferramentas | Públicas, mudam por versão; a proposta registra qual versão usou. |

## Porta única

O Worker `universo-hub` é a única porta do D1 e do R2 (`/api/v1`). Validação, permissões e histórico ficam num lugar só.

- O hub, pelo navegador, entra com a senha da equipe (`UNIVERSO_SENHA`).
- Rotinas do GitHub Actions entram com um token de máquina (`MAQUINA_TOKEN`), separado de senha de pessoa (padrão do `COLLECT_SECRET` do Radar).
- As outras ferramentas falam Worker a Worker, por service binding com ponto de entrada nomeado (`Vendas`, `Projetos`, `Fornecedores`, `Marketing`). Esses pontos de entrada não são acessíveis pela internet, então não precisam de senha; cada um tem as permissões da sua ferramenta (`worker/dados/esquema.js`).

Compromissos aceitos: o hub é ponto único de falha para os dados comuns; mudança de estrutura passa sempre por este repositório; rotas versionadas (`/api/v1`).

## Convenções

- **id = prefixo do tipo + ULID** (`org_01…`). Único no Universo inteiro; o prefixo diz a tabela, o que permite referências "a qualquer tipo" (vínculos, sínteses, interações) e a rota `registros/:id`.
- **Nada se apaga**: `arquivado_em`. Regras de "único" valem só entre ativos (índices únicos parciais), senão um registro arquivado impediria recriar.
- **`versao` em todo registro**: salvar com versão velha dá 409 em vez de sobrescrever o que outra pessoa salvou.
- **Ausência = NULL**, nunca um valor padrão que pareça dado (padrão do Radar).
- **Dinheiro em centavos** (inteiro), **dias em AAAA-MM-DD no fuso de Brasília**, instantes em UTC.
- **Relação que define o registro = coluna** com chave estrangeira; **relação que só acrescenta = `vinculos`**.

## Escolhas que não são óbvias

- **Sem FTS5.** O D1 aceita busca de texto (FTS5), mas não exporta bancos que tenham tabelas virtuais, e a cópia semanal depende da exportação. A busca usa a tabela `busca` (texto sem acento, em minúsculas, `LIKE` por termo). Para o volume do Odisse, é rápido; se um dia não for, criar o FTS5 e trocar a cópia por outra estratégia.
- **Histórico × versões × revisões.** Histórico = auditoria campo a campo (quem mudou o quê). Versões = retrato completo restaurável, só para conteúdo rico (sínteses; depois publicações e propostas), agrupando edições de 10 minutos e guardando 10 por registro (padrão do painel do site). Revisões = decisão humana pendente (padrão de dedup do Radar).
- **Duplicados de contatos.** Ao criar organização ou pessoa, cada campo (nome normalizado, CNPJ, e-mail, telefone) é classificado em bate / ausente / conflito em relação aos existentes. Algo bate e nada conflita → 409 `possivel_duplicado` (a tela oferece usar o existente; para criar mesmo assim, reenviar com `confirmar_novo: true`). Algo bate mas há conflito → cria e abre uma revisão.
- **Dados sensíveis** (`pessoas_sensiveis`: CPF, RG, nascimento, endereço residencial) ficam numa tabela à parte, só para o vendas, lidos um a um. O histórico registra só o nome dos campos mudados, nunca o valor, e cada leitura vira um registro `ler_sensivel`. Nunca entram na busca.
- **Arquivos imutáveis.** Cada variante (`g` 2400 px, `m` 1200 px, `s` 960 px — mesmo sistema do odisse.com.br) sobe uma vez só; trocar = arquivo novo. É isso que permite cache de um ano no navegador. Mídia repetida (mesmo sha256) não entra duas vezes no acervo.
- **Autoria**: por ora só os dois sócios usam; `criado_por`/`atualizado_por`/`historico.por` gravam a ferramenta. O seletor de pessoa entra com o login único.
- **Sequências** (números de proposta, contrato, projeto) no D1, incrementadas dentro do banco. No KV, duas propostas simultâneas podiam receber o mesmo número.

## Comercial (migração 0002, casa: vendas.odisse)

- **Oportunidade é o centro do funil**; proposta e interação penduram nela. O cliente titular é organização ou pessoa (`cliente_id`); a pessoa com quem se fala fica em `contato_pessoa_id`. `etapa_desde` e `fechada_em` são gravados pela API quando a etapa muda (dá para medir tempo por etapa sem ler o histórico).
- **Numeração das propostas continua do vendas antigo.** A sequência `propostas` só passa a existir quando a migração (ou `POST propostas/numeracao`) a ajusta ao último número do KV; até lá, criar proposta nova dá 409 `numeracao_nao_ajustada`. Sem essa trava, o Universo começaria do 1 e repetiria números que já foram para clientes. Números nunca se repetem, nem entre arquivadas (índice único sem filtro).
- **Revisão = mesmo número, revisão seguinte** (`PC-0007-2026-R1`), criada com `revisao_de`. As revisões anteriores ainda em rascunho ou enviadas passam a "substituída" no mesmo lote.
- **PDF congelado.** O PDF que vai para o cliente é guardado no R2 no momento em que é gerado (`arquivo_pdf_id`, categoria `pdf_proposta`, dono = a proposta). Daí em diante título, data, valor, validade, cálculo e referências travam (409 `proposta_congelada`), e restaurar versão também é recusado: mudou, é revisão. Remontar o PDF a partir dos dados continua possível, mas o congelado é o documento de valor.
- **Referências do cálculo**: cada proposta grava a região e a competência do CUB e a impressão digital (SHA-256, 12 caracteres) de cada tabela de `data/` do vendas. As propostas importadas do KV dizem explicitamente que essas versões não foram registradas na época, e o PDF delas é remontado com o modelo atual (marcado assim na legenda do arquivo).
- **Importação** (`importada_de: 'kv:<código>'`, só vendas e máquina): mantém número e código originais e leva a sequência até eles. Índice único em `importada_de` torna a migração segura para rodar de novo.
- **Endereço do orçamento é do imóvel**, não do cliente: fica no retrato do cálculo (e irá para `projetos_local`), nunca em `pessoas_sensiveis`. Do orçamento, só o CPF vai para os dados sensíveis, e só se ainda não houver.
- **O vendas chega ao Universo pelo próprio Worker**: o navegador chama `/u/v1/…` no Worker do vendas (com a senha do vendas), que repassa pelo service binding `Vendas`. A senha do hub nunca vai para o vendas.
- `GET comercial/painel` monta a tela do funil numa chamada só (oportunidades abertas e fechadas nos últimos 90 dias, com nome do cliente, contato, última proposta e a interação mais recente). A "próxima ação" é a da interação mais recente: registrar uma interação sem próxima ação limpa a pendência.
- Códigos de origem no texto pronto do WhatsApp: `[LP-<página>]` (landing pages, projetos-odisse/analytics.js) e `[Herma <lote>]` (herma-odisse). O funil reconhece o código ao colar a mensagem.

## Simulações e duplicados (migração 0003)

- **Simulação** (`propostas.simulacao = 1`): orçamento sem cliente, para testar a ferramenta ou estimar o custo de um serviço. Consome número da sequência como qualquer proposta (decisão do Cid: testes também contam na numeração), não tem oportunidade (CHECK no banco: simulação ⇔ sem oportunidade), não entra no funil, e o PDF sai com "Simulação de Honorários", um aviso em caixa na primeira página e "SIMULAÇÃO · NÃO É PROPOSTA COMERCIAL" no cabeçalho de todas. Revisão de simulação continua simulação; simulação reaberta como proposta de verdade ganha número próprio. A 0003 refez `propostas` (e `contratos`, que aponta para ela) porque o SQLite não tira NOT NULL de coluna existente.
- **Duplicados**: `POST revisoes/:id/resolver`. "São diferentes" só registra. "É o mesmo": o cadastro escolhido fica, é completado com o que só o outro tinha (observações somadas), recebe tudo que apontava para o outro (oportunidades, interações, atuações, equipe, vínculos, documentos e, para pessoas, os dados sensíveis que faltavam) e o outro é arquivado com a nota "Juntado a …". Pendências sobre o mesmo par seguem a mesma decisão; pendências que passam a repetir um par já perguntado são arquivadas. Tela: Contatos → "Possíveis duplicados" (no vendas).
- O ano do código (`PC-NNNN-AAAA`) vem da data da proposta; o número é uma sequência única que não recomeça a cada ano (como no vendas antigo).

## Contatos e co-clientes (sem migração nova, nov/2026)

- **Tela de Contatos** (vendas.odisse.com.br/contatos.html) lê duas rotas de leitura juntada, sem SQL novo no banco:
  - `GET comercial/contatos[?arquivados=1]`: pessoas e organizações, cada uma com as ligações ativas (atuações sem `ate`) e a contagem de oportunidades (total e em aberto). O próprio Odisse (`org_odisse`) fica de fora.
  - `GET comercial/contatos/:id`: ficha com o registro, as atuações (com o nome do outro lado), as oportunidades e as interações (sobre o contato ou com ele).
  - Permissão: quem lê oportunidades e pessoas (hub, vendas, projetos, máquina). O marketing não vê.
- **Oportunidades de um contato** = em que ele é titular (`cliente_id`), co-cliente (vínculo `papel = 'cliente'`) ou pessoa de contato (`contato_pessoa_id`). A ficha diz qual.
- **Co-clientes** (um casal, sócios) usam `vinculos` (de_id = oportunidade, para_id = pessoa ou organização, papel `cliente`), como o desenho previa; não há coluna nova. "Tornar titular" troca o `cliente_id` e inverte os vínculos. O painel do funil devolve `coclientes` (nomes) para o cartão mostrar "Ana Lins + Rafael Lins".
- **Ligações pessoa ↔ organização** (atuações): "encerrar" grava `ate` (a pessoa saiu; a ligação fica no histórico); "tirar" arquiva (ligação feita por engano).
- **Dados pessoais** continuam só no vendas, abertos sob pedido na ficha ("Mostrar dados pessoais"), e cada leitura entra no histórico.

## Projetos, etapas e horas (migração 0004, casa: ferramenta Projetos)

- **Código AAAA-NNN, recomeçando a cada ano** (decisão do Cid): sequência `projetos-<ano>` em `sequencias`. Os códigos de 2026 já tinham ido até 051 fora do Universo (pastas e contratos), então a 0004 deixa `projetos-2026` em 51 e o primeiro projeto do Universo é 2026-052. Em 2027 a sequência nasce sozinha e começa do 001. O ano é o da assinatura do contrato (ou o do início, no cadastro manual). Códigos nunca se repetem, nem entre arquivados.
- **Projeto nasce da assinatura do contrato principal**: `contratos` com `situacao = 'assinado'` (na criação ou num PATCH) cria, no mesmo lote, o projeto, as etapas, o local do imóvel e os co-clientes, marca a proposta como aceita e a oportunidade como ganha. Cliente, núcleo e co-clientes vêm da oportunidade; o vendas manda em `projeto` o que só ele sabe ler do cálculo (nomes e semanas das etapas, endereço do imóvel, tipologia, área). Cada comando do lote se guarda pela versão nova do contrato: se outra pessoa salvou antes (409), nada é criado. Índice único em `projetos.contrato_id` impede dois projetos para o mesmo contrato. Aditivo assinado não cria projeto: aponta para um que existe. `projeto_existente` liga o contrato a um projeto já cadastrado à mão.
- **Cadastro manual** (só a ferramenta Projetos e a máquina): para projetos anteriores ao Universo, com o código que já tinham (`codigo: '2026-031'`); a sequência do ano sobe até ele, então o próximo automático nunca repete um código antigo.
- **Prazos das etapas** seguem o cronograma da proposta: dias corridos, `semanas × 7`, cada etapa começa no dia em que a anterior termina. `percentual_pagamento` fica nulo por ora: a proposta cobra entrada + parcelas, não por etapa (entra com o financeiro).
- **Local do imóvel** (`projetos_local`, mesmo id do projeto): endereço exato, só vendas e Projetos. Bairro, cidade e UF ficam no projeto (aparecem em listas e no site). O endereço da etapa 1 do orçamento vai para cá na assinatura.
- **Horas**: a etapa precisa ser do mesmo projeto, conferido pela API e por gatilho no banco (`horas_etapa_do_projeto_*`). A exportação do D1 leva os gatilhos (conferido).
- **Equipe**: `POST producao/equipe { nome, email, papel }` usa a pessoa que já existe (algo bate e nada conflita) ou cria a pessoa; a ferramenta Projetos só lê contatos, então essa é a única pessoa que ela cria.
- **Marketing** vê do projeto só o que é público (código, nome, nome público, núcleo, tipologia, área, bairro, cidade, situação, datas, publicável) e só muda o `nome_publico` (`editaveis_por` no esquema).
- **Telas por leitura juntada** (`producao.js`): `producao/painel` (projetos com cliente, co-clientes, etapa atual, horas totais e dos últimos 30 dias, e a equipe), `producao/projetos/:id` (ficha completa) e `producao/horas?de=&ate=`. Exigem leitura de projetos e do comercial (o marketing não vê clientes). O painel do funil passou a devolver o `projeto` de cada oportunidade.

## Bases e Plano Geral de Trabalho (migração 0005, casa: ferramenta Projetos)

- **Cadeia Bases → PGT → Projetos** (decisão do Cid): as **Bases** dizem o que forma o preço (serviço, categoria e uso da tipologia, CUB, fator do CAU, índice de complexidade); o **Plano Geral de Trabalho (PGT)** diz o que se faz (fases, etapas, entregáveis, materiais) e para quais serviços; o **Escopo do Projeto** (migração futura) será a cópia do PGT contratada para um projeto. Desenho completo nos docs `universo-pgt.md` e `universo-pgt-entregaveis.md` do projeto do Claude.
- **Vocabulário da NBR 16636**: fase › etapa (não "subetapa"). As etapas têm sigla e nome do Odisse (Concepção Esquemática, CE) e guardam a correspondência na NBR (Estudo Preliminar, EP-ARQ) para o (i) das telas.
- **Arquitetura e interiores usam as mesmas etapas**; o que muda são os entregáveis, filtrados pela pertinência ao serviço. Por isso os entregáveis são um **pool comum** com pertinência por serviço (P = vem marcado, O = opcional, sem linha = não se aplica) e restrição opcional por **categoria** de tipologia (sem linha = todas).
- **Tipologia = uso dentro de uma categoria** (Hotéis de luxo, em Hospedagem), não só o grupo (Comercial): é o uso que tem CUB, fator de adequação e categoria do fator percentual do CAU. As quatro "Nova Edificação" do vendas viraram um serviço só; a diferença foi para a tipologia. O preset do índice de complexidade passou para a categoria; o serviço só ajusta alguns critérios (`ic_ajustes`).
- **Pesos das etapas ficam na matriz etapa × serviço**, não na etapa: interiores e arquitetura repartem o honorário de jeitos diferentes nas mesmas etapas (pesos copiados de `data/pesos-etapas.json`). Etapas novas (LV, EV, AS, AB) começam sem peso.
- **Etapas-ilha** (fase Ilhas: Consultoria Remota e Laudos): fora do encadeamento de prazos e das parcelas.
- **Rascunho × publicado**: as tabelas são o rascunho vivo, editado nas páginas Bases e PGT. Publicar grava um retrato completo e numerado em `pgt_publicacoes`; é o retrato que o vendas vai ler (`GET publicacoes/ultima?tipo=…`) e a proposta vai registrar o número usado (substitui as impressões digitais dos `data/*.json`). "Pendente" compara a assinatura SHA-256 do rascunho com a do último retrato; publicar sem mudança dá 409. O retrato do PGT leva o número das Bases publicadas na hora.
- **Código do entregável (CE-03) não é gravado**: sai da sigla da etapa + posição. Reordenar ou mudar de etapa muda o código; o id não muda, e é o id que as propostas vão guardar.
- **Matrizes sem colunas comuns** (`pgt_etapas_servicos`, `pgt_entregaveis_servicos`, `pgt_entregaveis_categorias`): são ligações, editadas por rotas próprias (`pgt/etapas-servicos`, `pgt/entregaveis-servicos` em massa, `pgt/entregaveis-categorias`). Cada mudança entra no histórico do entregável ou da etapa (`servico:<id>`: antes/depois).
- **Sementes com ids legíveis** (srv_ne, tca_hospedagem, pet_ce, pen_ce_03), geradas a partir dos `data/*.json` do vendas e do pool aprovado em 12/11/2026. Registros criados depois usam ULID.
- **Materiais**: nesta migração só estrutura e link; envio de arquivos e criação de formulários e checklists vêm depois.
- **Códigos com o ano antes do número** (decisão do Cid, 12/11): projeto `OA-AAAA-NNN`, proposta `PC-AAAA-NNNN`, contrato `CT-AAAA-NNNN`. A 0005 renomeou os projetos que já existiam (`2026-052` → `OA-2026-052`, com histórico e busca), porque o código do projeto é interno (pastas e arquivos). Propostas e contratos já emitidos ficam com o código antigo: ele está impresso no PDF que o cliente recebeu. Revisão de uma proposta antiga continua no formato antigo (mesmo número). O cadastro manual aceita `OA-2026-031` ou `2026-031`.

## Honorários (migração 0006, casa: vendas)

- **Projetos = estrutura, vendas = custo** (decisão do Cid, 12/11): preço dos serviços (`modificador`, `com_preco`, `preco_por_etapa`), parcela de cada fase, pesos das etapas na matriz etapa × serviço e parcela de entrada saíram das páginas Bases e PGT e dos retratos `bases` e `pgt`. Continuam nas mesmas tabelas, mas formam o retrato **`honorarios`**, editado e publicado pela página Honorários do vendas. O CUB vigente e a base de honorários (CUB × fator) também só aparecem no vendas; nas Bases fica o código do CUB de cada uso.
- **Permissões**: o vendas muda só os campos de custo (`editaveis_por` em `bases_servicos` e `pgt_fases`) e os pesos (`POST honorarios/pesos`, só onde a etapa vale para o serviço); o Projetos lê os honorários e não os edita. Alternar a pertinência no PGT mantém o peso que havia (`pgt/etapas-servicos` só grava o peso se ele vier no pedido).
- O retrato dos honorários leva os números das Bases e do PGT publicados na hora (`bases_numero`, `pgt_numero`), fora da assinatura. A proposta vai registrar as três versões.
- A 0006 refaz `pgt_publicacoes` para aceitar o tipo `honorarios` (o CHECK do SQLite não se altera), mantendo os retratos já publicados. Como os retratos de Bases e PGT mudaram de forma, as duas páginas aparecem "pendentes" uma vez depois desta mudança.

## Como mudar a estrutura

1. Nova migração em `dados/migracoes/NNNN_nome.sql` (nunca editar uma já aplicada).
2. Atualizar `worker/dados/esquema.js` (campos, permissões, prefixos).
3. Testar localmente: `cd worker && npx wrangler d1 migrations apply universo --local && npx wrangler dev --local` (com `.dev.vars` contendo `UNIVERSO_SENHA=…`).
4. Atualizar este documento e o doc do projeto.
5. Push em `main`: o workflow aplica a migração e publica.
