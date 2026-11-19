-- Universo — migração 0015: estrutura de preço por FASE e ETAPA (decisão do Cid, 18/11/2026).
--
-- Antes: cada etapa tinha um peso fixo (% do honorário do serviço) e a soma das etapas dava 100.
-- Agora:
--   - cada FASE tem um peso por serviço (% do honorário do projeto); as fases do fluxo somam 100;
--   - fase de ACRÉSCIMO (Obra) não faz parte dos 100: o peso dela é um acréscimo escolhido à parte;
--   - dentro da fase, a % de cada etapa é FÓRMULA: fator (1 ou 2) da etapa ÷ soma dos fatores das etapas
--     contratadas da fase. Etapa com fator 2 puxa o dobro. Etapa não contratada: o valor da fase se
--     redistribui entre as que ficaram.
-- pgt_etapas_servicos.peso passa a guardar o FATOR (1 ou 2; nulo = 1). A parcela da fase (pgt_fases.parcela)
-- deixa de ser usada: o pagamento sai da entrada + o peso das fases contratadas.

ALTER TABLE pgt_fases ADD COLUMN acrescimo INTEGER NOT NULL DEFAULT 0 CHECK (acrescimo IN (0, 1));
UPDATE pgt_fases SET acrescimo = 1 WHERE id = 'pfa_obra';

CREATE TABLE pgt_fases_servicos (
  fase_id          TEXT NOT NULL REFERENCES pgt_fases (id),
  servico_id       TEXT NOT NULL REFERENCES bases_servicos (id),
  peso             REAL CHECK (peso IS NULL OR (peso >= 0 AND peso <= 100)),   -- % do honorário do projeto
  PRIMARY KEY (fase_id, servico_id)
);
CREATE INDEX pgt_fases_servicos_srv ON pgt_fases_servicos (servico_id);

-- Peso de cada fase por serviço = soma dos pesos antigos das etapas da fase (fora das ilhas e do acréscimo).
INSERT INTO pgt_fases_servicos (fase_id, servico_id, peso)
  SELECT e.fase_id, x.servico_id, MIN(100, SUM(x.peso))
  FROM pgt_etapas_servicos x
  JOIN pgt_etapas e ON e.id = x.etapa_id
  JOIN pgt_fases f ON f.id = e.fase_id
  WHERE x.peso > 0 AND f.ilha = 0 AND f.acrescimo = 0
  GROUP BY e.fase_id, x.servico_id;

-- Fator da etapa: o peso antigo dividido pelo menor peso da mesma fase e serviço, arredondado e limitado a 1 ou 2
-- (ex.: Executiva de NE com 8 · 16 · 16 → 1 · 2 · 2). Sem peso, fica nulo (= 1). A conta usa uma cópia dos pesos
-- antigos (atualizar a tabela linha a linha mudaria o menor peso no meio do caminho).
CREATE TABLE pesos_0015 AS
  SELECT x.etapa_id, x.servico_id, x.peso, e.fase_id FROM pgt_etapas_servicos x JOIN pgt_etapas e ON e.id = x.etapa_id WHERE x.peso > 0;
UPDATE pgt_etapas_servicos SET peso = (
    SELECT MIN(2, MAX(1, ROUND(a.peso / (SELECT MIN(b.peso) FROM pesos_0015 b WHERE b.servico_id = a.servico_id AND b.fase_id = a.fase_id))))
    FROM pesos_0015 a WHERE a.etapa_id = pgt_etapas_servicos.etapa_id AND a.servico_id = pgt_etapas_servicos.servico_id)
  WHERE peso IS NOT NULL;
DROP TABLE pesos_0015;
