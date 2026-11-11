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

## Como mudar a estrutura

1. Nova migração em `dados/migracoes/NNNN_nome.sql` (nunca editar uma já aplicada).
2. Atualizar `worker/dados/esquema.js` (campos, permissões, prefixos).
3. Testar localmente: `cd worker && npx wrangler d1 migrations apply universo --local && npx wrangler dev --local` (com `.dev.vars` contendo `UNIVERSO_SENHA=…`).
4. Atualizar este documento e o doc do projeto.
5. Push em `main`: o workflow aplica a migração e publica.
