# Radar (universo.odisse.com.br/radar/)

Concursos, Terrenos e Licitações. Desde 24/11/2026 as telas moram aqui, dentro do Universo (login único, menu lateral da `base/v2`, Abas do Radar no alto). O servidor (Worker `radar-odisse`) e as coletas (GitHub Actions) continuam no repositório `radar-odisse`, que também mantém radar.odisse.com.br redirecionando para cá.

- `js/comum.js` monta as Abas do Radar e chama a casca (`/base/v2/casca.js`).
- `js/auth.js` usa a senha do Universo (`universo:senha`).
- `js/extrair-site.js` e `js/ler-tr.js` têm cópia no `radar-odisse` (usadas pelas coletas e pelos testes de lá): mudou aqui, mude lá.
- Antes de cada commit que mude JS/CSS: `python3 radar/tools/versionar.py`.
