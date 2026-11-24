# Marketing — universo.odisse.com.br/marketing/

Publicações (posts 3:4 e pins 2:3), Estratégia, Calendário editorial (com o pool de mídias) e Métricas, dentro da
casca do Universo (`/base/v2/casca.js`). `marketing.odisse.com.br` (repo marketing-odisse) só redireciona para cá;
aquele repo guarda a **API** (Worker + KV), descrita no README dele.

- **Casca:** cada página é um item do menu lateral (Publicações · Estratégia · Calendário editorial · Métricas); o
  item aceso segue a rota (`window.universoCasca.marcar`). Cada página mostra só as próprias Abas. No editor, o
  menu lateral recolhe sozinho e volta ao sair, sem gravar a escolha.
- **Entrada:** a senha do Universo (`localStorage 'universo:senha'`, a mesma `UNIVERSO_SENHA` do Worker). Sem
  senha, guarda o endereço em `sessionStorage 'universo:volta'` e vai ao Início para entrar.
- **API:** `universo-odisse.…workers.dev` (repo marketing-odisse). O Worker importa `assets/js/grade.js`
  daquele repo: mudou a grade aqui, mude lá também.
- **Versões:** `python3 marketing/tools/versionar.py` antes de cada commit que mude JS ou CSS (import map e `?v=`
  no index.html). O service worker (`sw.js`, cache `marketing-estatico`) só vale para esta pasta.

## Publicações (`#/publicacoes/posts`, `#/publicacoes/pins`)

Nas peças da `base/v2`. Abas Posts 3:4 · Pins 2:3 → Cabeçalho → os **cartões de núcleo** para criar (um clique
cria e abre o editor) → Seção **Arquivo**: busca, Segmentados de núcleo, Ativas/Arquivadas, ordem (últimas
salvas ou criadas) e vista (Grade ou Lista, lembradas neste navegador).

- **Cada publicação** mostra a capa, o núcleo, os cards (ou pins), a **situação no pool** (fora do pool, no pool
  para agendar, agendada, publicada; nos pins, quantos estão no pool), as datas automáticas (**criada**, **último
  salvamento** e **envio ao pool**) e a ação do momento: **Enviar ao pool** (ou "Enviar N ao pool", os pins que
  faltam), **Abrir no calendário** (`#/calendario/item/<id>`, que abre o item na semana dele) ou **Restaurar**. O
  menu ⋯ tem Abrir no editor, Duplicar, Baixar (.zip) e **Arquivar** (nada se apaga; volta por Arquivadas).
- **Situação no pool:** sai dos itens do pool com `pub` igual ao id da publicação (`situacaoNoPool` em app.js).
  Clicar na situação abre a Gaveta com o que está no pool, em que dia, e as datas.
- **Alterada depois do envio** (salva depois de `enviadoEm`, com algo ainda não publicado): o pool é atualizado
  sozinho. No editor, depois de cada salvamento na nuvem; no arquivo, ao abrir a página (o que foi salvo noutra
  hora ou noutro computador). O reenvio automático só atualiza o que já está no pool (pins novos entram pelo
  Enviar ao pool) e nunca mexe no que já foi publicado; mantém dia, encaixe e origem.
- **Segundo plano:** enviar, reenviar e baixar do arquivo rodam uma publicação de cada vez; o cartão mostra o
  andamento. O gerador de arquivos (`#exportador`) é um só, usado uma vez de cada vez (`naVez`), pelo editor e
  pelo arquivo. As funções de exportação recebem a publicação (`p`, padrão a aberta).

## Editor (`#/p/<id>[/<card>]`)

- **Barra:** voltar ao formato · núcleo e nome · situação no pool · Salvo às… · Salvar · **Exportar** (card ativo
  ou carrossel/lote) · **Enviar ao pool** (só quando falta algo no pool).
- **Dados da publicação:** nome e rótulo do cabeçalho (pins: projeto, link padrão, créditos, origem). Não há
  campo de data: as **datas automáticas** (criada, último salvamento, envio ao pool) ficam embaixo, só para leitura.
- **Código dos arquivos** (`AAMMDD-NNN-sigla`): a data é a de **criação**. Publicações antigas guardam a data
  escolhida à mão (`globais.dataPublicacao`) e continuam com ela, para os nomes e os links já enviados não mudarem.
- **Palco:** em cima, posição e modelo, Duplicar e Excluir, guias (Diagonais, Terços, 1080×1080) e a vista 3 ·
  Todos. As **setas de mover** ficam embaixo do card em destaque, uma em cada canto; o **+** fica entre o card em
  destaque e o seguinte (o card novo entra ali; na vista Todos, no fim). Embaixo, os números dos cards. As setas
  das pontas e as do teclado trocam de card (não é alteração da publicação).
- **Salvamento:** rascunho contínuo neste navegador (IndexedDB); nuvem ao criar, no Salvar (Ctrl+S), ao exportar,
  ao sair do editor e a cada 20 minutos se houver alteração.
- **Personalização:** cada opção com o rótulo acima do seletor (6 px) e 16 px até a seguinte.
- Exportação sempre em JPG 0,86: post 1080 × 1440; pin 1000 × 1500 (desenhado em 1080 × 1620).

### Pins 2:3 (Pinterest)

Segue `odisse-estrategia-pinterest.pdf`. Cada publicação de pins é um projeto (peça ou texto), com 8 a 15 pins;
começa com 1 e os outros entram pelo +, herdando a composição do pin ativo. Modelo universal P-01 (Imagem plena ·
Foto sobre painel · Título + imagem). Campos do Pinterest por pin (idioma, título, descrição, alt, pasta, link,
tipo; **+ Versão em inglês** ligada por `pin.par`). UTMs: `utm_source=pinterest`, `utm_medium=social`,
`utm_campaign=<sigla>-<projeto>`, `utm_content=<AAMMDD-NNN-sigla>[-en]`, `utm_term=<pasta>`. Lote em `.zip` com o
`textos.txt`. As **pastas do perfil** ficam em Estratégia › Plataformas › Pinterest (`cfg:pin-pastas`).

## Calendário editorial (`#/calendario`) e Estratégia (`#/estrategia`)

Nas peças da `base/v2`; o detalhe está no `marketing.md` do projeto e nos comentários de `pagina-calendario.js`,
`pagina-estrategia.js`, `plano.js`, `grade.js` e `pool.js`. Estratégia › Plataformas: plataforma › formato › tipo,
escalada por plataforma e, no Pinterest, as pastas do perfil (arrastar pela alça ou setas do teclado, dentro do
grupo).

## Métricas (`#/metricas`)

Instagram (@odisseestudio) pela API do Meta, com coleta diária no Worker. O vínculo automático de cada post com a
publicação usa o dia do item no pool (o encaixe ou a publicação confirmada); nas publicações antigas, a data
escolhida à mão. Arquivos em `assets/js/pagina-metricas.js` e `assets/js/metricas/`.

## Estrutura

```
index.html                    vistas (início, editor, padrões, calendário, estratégia, métricas)
assets/css/card.css           o card (grid, tipografia, elementos fixos)
assets/css/app.css            interface: editor (classes antigas) e as peças mk- das páginas da v2
assets/js/app.js              rotas, Publicações (arquivo), editor, exportação, envio ao pool
assets/js/templates.js        modelos de card (3:4 e pin), carimbo, textos, preenchimento
assets/js/pinterest.js        pins: pastas, campos, UTMs, textos.txt
assets/js/pool.js             pool de mídias: itens, repetição, distribuição
assets/js/pagina-calendario.js  Calendário editorial e Pool de mídias
assets/js/plano.js · grade.js · pagina-estrategia.js   Estratégia (grade, plataformas, pautas, ciclo)
assets/js/padroes.js · pagina-padroes.js   estilos de texto e espaçamentos
assets/js/nucleos.js · marca.js · marks.js · imaging.js   núcleos, Marca, selos, tratamento de imagem
assets/js/store.js · nuvem.js   IndexedDB e cliente da API
assets/js/pagina-metricas.js · metricas/   Métricas
vendor/                       html-to-image e JSZip
tools/versionar.py            numera os arquivos para o cache
```
