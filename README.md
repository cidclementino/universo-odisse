# Universo

O hub que reúne todas as ferramentas do **Odisse, Estúdio de Arquitetura e Design**. Publicado em **https://universo.odisse.com.br** (GitHub Pages).

Cada ferramenta continua no seu próprio repositório e endereço. O Universo dá a elas três coisas em comum: a porta de entrada, o menu e a camada de interface.

## Seções

| Seção | Natureza | Rota |
|---|---|---|
| **Início** | O que importa hoje | `#/` |
| **Ferramentas** | Onde se trabalha (Marketing, Comercial, Produção) | `#/ferramentas` |
| **Canais** | O que o público vê: sites, redes, publicações | `#/canais` |
| **Equipe** | Quem faz: pessoas (sócio, cargo, título, registro, foto, assinatura, bios), listas de cargos e títulos. Todas as ferramentas leem daqui | `#/equipe` |
| **Marca** | Quem somos: marca-mãe (que é o Estúdio), núcleos, paleta e tipografia; edição em PT/EN e envio de logos | `#/marca` |
| **Biblioteca** | O que se reutiliza: acervo, referências, modelos, procedimentos | `#/biblioteca` |
| Documentos (na Biblioteca) | Cartas, ofícios, declarações e memorandos numerados; folhas em branco da marca | `#/documentos` |

Os endereços das redes em Canais e os dados em Marca vêm do `odisse.json` da marca (fonte única); não se repetem aqui.

## O que tem aqui

| Caminho | Conteúdo |
|---|---|
| `index.html`, `assets/hub.js`, `assets/hub.css` | As páginas do hub (uma por seção, por rota) |
| `assets/equipe.js` | Página Equipe: lista, ficha da pessoa (foto, cargo, registro, quem assina, assinatura manuscrita, bios do site) e listas de cargos e títulos |
| `assets/memoria.js` | Cópias locais das leituras (a página abre na hora com a última cópia e confere por baixo) e imagens guardadas no navegador pelo id do arquivo. **Regra para todas as páginas:** nada de recarregar tudo do zero |
| `assets/documentos.js` | Página Documentos: lista, editor com prévia e PDF. O desenho da folha vem da Marca (`marca.odisse.com.br/v1/documentos/`) |
| `ferramentas.json` | **O mapa do Universo:** menu lateral, seções, ramos, grupos e itens. Alimenta o menu (casca da `base/v2`), o "Ir para" e as páginas do hub |
| `base/v1/universo.css` | Camada de interface das ferramentas internas (botões, campos, tabelas, cartões) |
| `base/v1/assinantes.js` | Seletor de quem assina (módulo): equipe com foto, nome e registro, vários assinantes, último lembrado, pessoa de fora. Devolve a cópia que o documento guarda; a rubrica entra só na emissão |

A marca (cores, fonte, logos, dados institucionais) **não** fica aqui: vem de [marca.odisse.com.br](https://marca.odisse.com.br) (repositório `marca-odisse`), que também atende os sites públicos.

## Como ligar uma ferramenta ao Universo

Desde 24/11/2026 as telas de todas as ferramentas moram aqui, cada uma na sua pasta (`/vendas/`, `/projetos/`,
`/radar/`, `/catalogo/`, `/marketing/`), com a senha única do Universo (`localStorage 'universo:senha'`). Cada
ferramenta carrega a casca da `base/v2` (menu lateral, "Ir para" e painel), dizendo qual item do menu acender:

```html
<script src="/base/v2/casca.js" data-item="funil" data-classe="ferramenta-vendas"></script>
```

Sem senha, a ferramenta guarda o endereço em `sessionStorage 'universo:volta'` e vai ao Início para entrar; o Início
traz de volta. A barra antiga (`base/v1/barra.js`) saiu em 24/11/2026.

Os sites públicos (odisse.com.br, projetos, servicos, Herma) **não** usam `universo.css` nem a casca; usam só a marca.

## Padrão novo: `base/v2` (Cid, 23–24/11/2026)

Menu lateral por função, topo com "Ir para" (Ctrl K) e o conteúdo num painel branco sobre a ardósia. As peças têm um código só:

```html
<link rel="stylesheet" href="https://marca.odisse.com.br/v1/marca.css">
<link rel="stylesheet" href="https://universo.odisse.com.br/base/v2/universo.css">
<script type="module">
  import { montarCasca, numeros, lista, gaveta } from 'https://universo.odisse.com.br/base/v2/componentes.js';
  const casca = await montarCasca({ conteudo: document.querySelector('main') }); // menu lido de ferramentas.json › menu
</script>
```

- **Mexeu no padrão, mexeu em todas as páginas**: as páginas chamam as funções de `componentes.js` e não redesenham as peças `ui-*` no próprio CSS (o teste `worker/testes/v2-sem-sobrescrita.test.mjs` barra o deploy). Variação é opção da função.
- **Cores por função** (`--ui-fundo`, `--ui-texto`, `--ui-bandeja`…), raios concêntricos (12 → 8 → 4), alturas fixas (topo 44, menu 30, linha 42).
- **Menu**: `ferramentas.json › menu` (topo, grupos, Emitir documento). Contagens e a árvore de projetos vêm da leitura da Início.
- O catálogo vivo fica em Biblioteca › Padrões de interface. Todas as ferramentas já estão na casca da `v2`; a `base/v1/universo.css` segue para as classes `u-*` das telas antigas, restilizadas pela `ponte-v1.css`.

## Adicionar ou mudar um item

Editar `ferramentas.json`. Campos de cada item: `id`, `nome`, `descricao`, `secao`, `ramo` (só nas Ferramentas: marketing, comercial, produção, gestão — vira o rótulo do cartão; a página é uma grade só, na ordem de `ramos`) ou `grupo` (Canais e Biblioteca), `url`, `hosts` (endereços que identificam a ferramenta, para a barra marcar a seção certa), `extra` (links secundários, ex.: o painel do site), `acesso` (`interna` ou `publica`) e `status` (`no-ar` ou `em-breve`). Itens em breve aparecem nas páginas, mas não no menu "Ir para". O menu lateral da v2 tem a sua ordem e os seus nomes curtos em `menu`.

## Regras

- **Versão no caminho.** Ajustes compatíveis entram em `base/v1/`. Renomear ou remover classe, variável ou atributo = `base/v2/`; a `v1` continua no ar até nenhuma ferramenta depender dela.
- **Prefixos.** Classes da interface começam com `.u-`; as da barra, com `.ub-`. Assim não colidem com o CSS de cada ferramenta.
- **Se o Universo cair, as ferramentas seguem funcionando.** A barra simplesmente não aparece.

## Próximos passos

CRM no vendas.odisse (ligado à API de dados) · Projetos · Acervo + publicações do marketing · Fornecedores. Depois: financeiro, login único, plataforma do cliente.

## API do hub (`worker/`)

Cloudflare Worker `universo-hub` (https://universo-hub.reservaprojectbasework.workers.dev), publicado pelo GitHub Actions (`.github/workflows/worker.yml`) a cada mudança em `worker/` ou `dados/migracoes/`.

- `GET /api/marca` e `PUT /api/marca`: lê e grava o `odisse.json` do repositório `marca-odisse`. Cada gravação é um commit ("Dados: … (pelo Universo)"); se a paleta, os papéis ou as cores dos núcleos mudarem, o mesmo commit reescreve os valores do `v1/marca.css`.
- `POST /api/marca/logo`: recebe um SVG (conferido: só desenho, sem scripts, imagens embutidas ou links externos), acrescenta ou substitui uma peça de um núcleo e atualiza a lista de logos no `odisse.json`, tudo num commit ("Logo: … (pelo Universo)").
- `/api/v1/equipe/…`: equipe comum a todas as ferramentas (quadro, seletor de quem assina, parte pública para o site, foto e assinatura manuscrita protegida). Ver `worker/dados/equipe.js` e a seção da 0011 no `dados/DECISOES.md`.
- Regras puras da Marca em `worker/marca.js`; teste: `node --no-warnings worker/testes/marca.test.mjs ../marca-odisse`.
- Página Marca no navegador: `assets/marca.js` (leitura, edição com a chave PT/EN, paleta, envio de logo).
- `/api/v1/…`: **API de dados**, a única porta do banco D1 `universo` e do R2 `universo-arquivos`. Rotas em `worker/dados/api.js`; tabelas, campos e permissões por ferramenta em `worker/dados/esquema.js`; estrutura em `dados/migracoes/`; porquês em [`dados/DECISOES.md`](dados/DECISOES.md).
- Secrets do repositório: `CLOUDFLARE_API_TOKEN` (precisa de Workers Scripts, D1 e Workers R2 Storage: Edit), `CLOUDFLARE_ACCOUNT_ID`, `UNIVERSO_SENHA` (senha da equipe), `MAQUINA_TOKEN` (rotinas automáticas) e `MARCA_GITHUB_TOKEN` (token fine-grained do GitHub, só para `marca-odisse`, Contents: Read and write).
- Cópia semanal do banco: `.github/workflows/copia.yml` (domingo de madrugada) → R2 `universo-copias`, guardada por 90 dias.

### Ligar uma ferramenta à API de dados

No `wrangler.toml` da ferramenta (mesma conta da Cloudflare):

```toml
[[services]]
binding = "UNIVERSO"
service = "universo-hub"
entrypoint = "Vendas"   # ou Projetos, Fornecedores, Marketing
```

E no Worker da ferramenta: `env.UNIVERSO.fetch('https://universo/api/v1/organizacoes?q=pedra')`. Sem senha: o ponto de entrada só é acessível por outro Worker da conta, e já carrega as permissões da ferramenta.
