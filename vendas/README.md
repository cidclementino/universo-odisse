# Vendas (universo.odisse.com.br/vendas/)

Funil, Contatos, Propostas, Contratos e Referências de preço. Desde 24/11/2026 as telas moram aqui, dentro do Universo
(um endereço só, login único com a senha da equipe, menu lateral da `base/v2`). O servidor (Worker `odisse-orcamentos-api`)
continua no repositório `odisse-orcamentos`, que também mantém vendas.odisse.com.br redirecionando para cá.

- `topo.js` põe a página dentro da casca do Universo e acende o item do menu.
- `auth.js` usa a senha do Universo (`universo:senha`); sem ela, leva à entrada do Universo e volta para a página.
- Antes de cada commit que mude JS/CSS: `python3 vendas/tools/versionar.py` (o workflow *Vendas — conferir versões* cobra).
- CUB mensal: workflow *Vendas — atualizar CUB* (dia 8), grava `vendas/data/cub.json`.
- `PRICING.md`: como o preço é calculado.
