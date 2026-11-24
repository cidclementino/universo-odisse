# Projetos (universo.odisse.com.br/projetos/)

Plano Geral de Trabalho, Projetos (Ficha, Escopo, Alterações) e Gestor de horas. Desde 24/11/2026 as telas moram aqui, dentro do Universo (login único, menu lateral da `base/v2`). O servidor (Worker `projetos-odisse`) continua no repositório `projetos-odisse`, que também mantém projetos.odisse.com.br redirecionando para cá e os endereços antigos das landing pages.

- `topo.js` diz qual item do menu acender; a casca vem de `/base/v2/casca.js`.
- `auth.js` usa a senha do Universo (`universo:senha`).
- O calendário do Escopo (`escopo.js`, `escCalendario`) tem uma cópia no servidor do hub (`worker/dados/calendario.js`) para a Início: mudou a regra aqui, mude lá.
