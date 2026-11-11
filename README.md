# Universo

O hub que reúne todas as ferramentas do **Odisse, Estúdio de Arquitetura e Design**. Publicado em **https://universo.odisse.com.br** (GitHub Pages).

Cada ferramenta continua no seu próprio repositório e endereço. O Universo dá a elas três coisas em comum: a porta de entrada, o menu e a camada de interface.

## Seções

| Seção | Natureza | Rota |
|---|---|---|
| **Início** | O que importa hoje | `#/` |
| **Ferramentas** | Onde se trabalha (Marketing, Comercial, Produção) | `#/ferramentas` |
| **Canais** | O que o público vê: sites, redes, publicações | `#/canais` |
| **Marca** | Quem somos: identidade e dados institucionais | `#/marca` |
| **Biblioteca** | O que se reutiliza: acervo, referências, modelos, procedimentos | `#/biblioteca` |

Os endereços das redes em Canais e os dados em Marca vêm do `odisse.json` da marca (fonte única); não se repetem aqui.

## O que tem aqui

| Caminho | Conteúdo |
|---|---|
| `index.html`, `assets/hub.js`, `assets/hub.css` | As páginas do hub (uma por seção, por rota) |
| `ferramentas.json` | **O mapa do Universo:** seções, grupos e itens. Alimenta as páginas do hub e a barra de todas as ferramentas |
| `base/v1/barra.js` | Barra e menu do Universo, para incluir em cada ferramenta |
| `base/v1/universo.css` | Camada de interface das ferramentas internas (botões, campos, tabelas, cartões) |

A marca (cores, fonte, logos, dados institucionais) **não** fica aqui: vem de [marca.odisse.com.br](https://marca.odisse.com.br) (repositório `marca-odisse`), que também atende os sites públicos.

## Como ligar uma ferramenta ao Universo

```html
<!-- marca + interface (só ferramentas internas) -->
<link rel="stylesheet" href="https://marca.odisse.com.br/v1/marca.css">
<link rel="stylesheet" href="https://universo.odisse.com.br/base/v1/universo.css">

<!-- barra e menu -->
<script src="https://universo.odisse.com.br/base/v1/barra.js" defer></script>
```

Onde a barra aparece:

- `<div data-universo-barra></div>` — barra completa nesse ponto (marca, seções e menu "Ir para");
- `<span data-universo-menu></span>` — só o botão "Universo", com as seções e as ferramentas, para quem já tem a própria barra no topo (herda a cor do texto);
- nenhum dos dois — barra completa no topo da página;
- `data-auto="nao"` no `<script>` — não insere nada sozinha.

Os sites públicos (odisse.com.br, projetos, Herma) **não** usam `universo.css` nem a barra; usam só a marca.

## Adicionar ou mudar um item

Editar `ferramentas.json`. Campos de cada item: `id`, `nome`, `descricao`, `secao`, `grupo`, `url`, `hosts` (endereços que identificam a ferramenta, para a barra marcar a seção certa), `extra` (links secundários, ex.: o painel do site), `acesso` (`interna` ou `publica`) e `status` (`no-ar` ou `em-breve`). Itens em breve aparecem nas páginas, mas não no menu "Ir para".

## Regras

- **Versão no caminho.** Ajustes compatíveis entram em `base/v1/`. Renomear ou remover classe, variável ou atributo = `base/v2/`; a `v1` continua no ar até nenhuma ferramenta depender dela.
- **Prefixos.** Classes da interface começam com `.u-`; as da barra, com `.ub-`. Assim não colidem com o CSS de cada ferramenta.
- **Se o Universo cair, as ferramentas seguem funcionando.** A barra simplesmente não aparece.

## Próximos passos

CRM no vendas.odisse (ligado à API de dados) · Projetos · Acervo + publicações do marketing · Fornecedores. Depois: financeiro, login único, plataforma do cliente.

## API do hub (`worker/`)

Cloudflare Worker `universo-hub` (https://universo-hub.reservaprojectbasework.workers.dev), publicado pelo GitHub Actions (`.github/workflows/worker.yml`) a cada mudança em `worker/` ou `dados/migracoes/`.

- `GET /api/marca` e `PUT /api/marca`: lê e grava o `odisse.json` do repositório `marca-odisse`. Cada gravação é um commit ("Dados: … (pelo Universo)"); o formulário fica na página Marca.
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
