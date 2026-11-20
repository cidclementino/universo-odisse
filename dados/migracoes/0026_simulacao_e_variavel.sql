-- Universo — migração 0026: simulação e valor que varia nas Despesas fixas (Cid, 20/11).
-- Despesa simulada: entra para dimensionar o impacto no orçamento, sem tocar nas contas reais. Fica fora do custo
-- por mês, da previsão e dos vencimentos reais; a página mostra o impacto quando se escolhe "Com simulações".
-- Efetivar = simulada 0 (passa a contar). Uma conta real não volta a ser simulação (regra em financeiro.js).
-- Descartar = arquivar.
ALTER TABLE despesas_fixas ADD COLUMN simulada INTEGER NOT NULL DEFAULT 0 CHECK (simulada IN (0, 1));

-- Valor que varia (Cid, 20/11): contas como a de luz continuam fixas, mas o valor cadastrado é a estimativa (média).
-- O valor real de cada mês, quando conhecido, fica em despesas_fixas_meses (um por despesa e mês, na moeda da
-- despesa). Na previsão vale o real do mês; nos meses sem lançamento, a estimativa, marcada como previsão (*).
ALTER TABLE despesas_fixas ADD COLUMN variavel INTEGER NOT NULL DEFAULT 0 CHECK (variavel IN (0, 1));
CREATE TABLE despesas_fixas_meses (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'dfm\_%' ESCAPE '\'),
  despesa_id     TEXT NOT NULL REFERENCES despesas_fixas (id),
  mes            TEXT NOT NULL CHECK (mes GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  valor          INTEGER NOT NULL CHECK (valor >= 0),   -- centavos, na moeda da despesa
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  por            TEXT,
  UNIQUE (despesa_id, mes)
);
