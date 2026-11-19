-- Universo — migração 0016: acréscimo por fase anterior não contratada (regra do "só tal fase").
-- Volta, agora no nível da fase, a regra do PRICING.md do vendas: quem contrata uma fase sem as anteriores
-- (ex.: só a Legal) paga um acréscimo de uma fração (padrão 50%) do peso das fases do fluxo não contratadas
-- que vêm antes de alguma fase contratada. A fase de acréscimo (Obra) e as ilhas ficam fora da conta.
-- Ex. (NE 40 · 20 · 40): só Legal = 20 + 50% × 40 = 40%; Legal + Executiva = 60 + 20 = 80%;
-- Conceitual + Executiva = 80 + 10 = 90%; todas = 100%.
INSERT INTO bases_parametros (chave, valor, rotulo, atualizado_em, atualizado_por)
  VALUES ('acrescimo_lacuna', '0.5', 'Acréscimo sobre fase anterior não contratada', '2026-11-18T22:30:00.000Z', 'migracao')
  ON CONFLICT (chave) DO NOTHING;
