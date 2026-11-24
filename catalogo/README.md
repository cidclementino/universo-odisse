# Catálogo de serviços — universo.odisse.com.br/catalogo/

Painel do Catálogo de serviços e do montador de landing pages. Até 24/11/2026 morava em
`servicos.odisse.com.br/painel/` (repo servicos-odisse); hoje mora aqui, dentro da casca do Universo
(`/base/v2/casca.js`, item `catalogo` do menu), e o endereço antigo só redireciona para cá.

O que continua no servicos-odisse:
- o site público (landing pages, `/inicio/`, formulários);
- a biblioteca de módulos `assets/lp/blocos.js` e `blocos.css` — o painel importa de
  `https://servicos.odisse.com.br/assets/lp/blocos.js`, então mudou a biblioteca lá, mudou aqui também;
- o Worker `servicos-odisse` (API do catálogo e das páginas; aceita a origem do Universo).

Entrada: a senha do Universo (`localStorage 'universo:senha'`, a mesma do Worker). Sem senha, guarda o
endereço em `sessionStorage 'universo:volta'` e vai ao Início para entrar.

Prévia do rascunho: desenhada pelo próprio painel numa aba nova (rascunho pela API, com a senha, e os
módulos e o endereço do site), porque a prévia `?previa` do site não enxerga a senha guardada aqui.
