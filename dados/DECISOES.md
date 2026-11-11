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

## Como mudar a estrutura

1. Nova migração em `dados/migracoes/NNNN_nome.sql` (nunca editar uma já aplicada).
2. Atualizar `worker/dados/esquema.js` (campos, permissões, prefixos).
3. Testar localmente: `cd worker && npx wrangler d1 migrations apply universo --local && npx wrangler dev --local` (com `.dev.vars` contendo `UNIVERSO_SENHA=…`).
4. Atualizar este documento e o doc do projeto.
5. Push em `main`: o workflow aplica a migração e publica.
