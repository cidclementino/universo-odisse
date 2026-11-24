# Marketing — universo.odisse.com.br/marketing/

Publicações (construtor de posts 3:4 e pins 2:3), Calendário editorial (pool de mídias), Estratégia e Métricas.
Até 24/11/2026 morava em `marketing.odisse.com.br` (repo marketing-odisse); hoje mora aqui, dentro da casca
do Universo (`/base/v2/casca.js`), e o endereço antigo só redireciona para cá.

- **Casca:** as Abas do Marketing (Publicações · Calendário editorial · Estratégia · Métricas) ficam no topo do
  painel; o item aceso no menu lateral segue a rota (`window.universoCasca.marcar`). No editor, o menu lateral
  recolhe sozinho para dar espaço ao palco e volta ao sair.
- **Entrada:** a senha do Universo (`localStorage 'universo:senha'`, a mesma `UNIVERSO_SENHA` do Worker). Sem
  senha, guarda o endereço em `sessionStorage 'universo:volta'` e vai ao Início para entrar.
- **API:** continua o Worker do repo marketing-odisse (`universo-odisse.…workers.dev`; KV, R2, Instagram). O
  Worker importa `assets/js/grade.js` daquele repo: mudou a grade aqui, mude lá também.
- **Versões:** rode `python3 marketing/tools/versionar.py` antes de cada commit que mude JS ou CSS (import map e
  `?v=` no index.html). O service worker (`sw.js`, cache `marketing-estatico`) só vale para esta pasta.
