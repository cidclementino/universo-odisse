# Universo

O hub que reúne todas as ferramentas do **Odisse, Estúdio de Arquitetura e Design**. Publicado em **https://universo.odisse.com.br** (GitHub Pages).

Cada ferramenta continua no seu próprio repositório e endereço. O Universo dá a elas três coisas em comum: a porta de entrada, o menu e a camada de interface.

## O que tem aqui

| Caminho | Conteúdo |
|---|---|
| `index.html` | Tela de entrada: as ferramentas agrupadas por frente |
| `ferramentas.json` | **A lista única de ferramentas.** Alimenta a tela de entrada e o menu de todas as ferramentas |
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

- `<div data-universo-barra></div>` — barra completa nesse ponto;
- `<span data-universo-menu></span>` — só o botão "Universo" com o menu, para quem já tem a própria barra no topo (herda a cor do texto);
- nenhum dos dois — barra completa no topo da página;
- `data-auto="nao"` no `<script>` — não insere nada sozinha.

Os sites públicos (odisse.com.br, projetos, Herma) **não** usam `universo.css` nem a barra; usam só a marca.

## Adicionar ou mudar uma ferramenta

Editar `ferramentas.json`. Campos: `id`, `nome`, `descricao`, `url`, `hosts` (endereços que identificam a ferramenta, para o menu marcar onde você está), `grupo`, `acesso` (`interna` ou `publica`) e `status` (`no-ar` ou `em-breve`).

## Regras

- **Versão no caminho.** Ajustes compatíveis entram em `base/v1/`. Renomear ou remover classe, variável ou atributo = `base/v2/`; a `v1` continua no ar até nenhuma ferramenta depender dela.
- **Prefixos.** Classes da interface começam com `.u-`; as da barra, com `.ub-`. Assim não colidem com o CSS de cada ferramenta.
- **Se o Universo cair, as ferramentas seguem funcionando.** A barra simplesmente não aparece.

## Próximos passos

Login único (Cloudflare Access ou login próprio do hub) · página **Marca** para editar `marca-odisse` por formulário · **Contatos e funil (CRM)** como primeira ferramenta nova.
