-- Universo — migração 0019: cláusulas do vendas (Contratos › Gestor de cláusulas, Cid 19/11).
-- As cláusulas que aparecem no formulário da proposta passam a ser editadas num lugar só, no vendas:
--   * cláusulas dos eventos do PGT: continuam no campo pgt_eventos.clausula (o vendas ganha edição só desse campo);
--   * cláusulas próprias do vendas: aqui. Grupo 'despesa' = despesas reembolsáveis (antes em
--     odisse-orcamentos/data/despesas-reembolsaveis.json); 'geral' = cláusulas comerciais e do contrato (futuro).
-- O retrato dos Honorários leva as duas coisas; a proposta lê da última versão publicada dos Honorários.
CREATE TABLE vendas_clausulas (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'vcl\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  grupo          TEXT NOT NULL CHECK (grupo IN ('despesa', 'geral')),
  texto          TEXT NOT NULL,
  padrao         INTEGER NOT NULL DEFAULT 1 CHECK (padrao IN (0, 1)),
  ordem          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX vendas_clausulas_grupo ON vendas_clausulas (grupo, ordem);
INSERT INTO vendas_clausulas (id, criado_em, atualizado_em, criado_por, atualizado_por, grupo, texto, padrao, ordem) VALUES
  ('vcl_plotagem', '2026-11-19T14:00:00.000Z', '2026-11-19T14:00:00.000Z', 'migracao', 'migracao', 'despesa',
   'Impressão (plotagem) de material gráfico para aprovação do projeto junto a órgãos competentes e/ou suporte técnico à execução da obra.', 1, 1),
  ('vcl_viagens', '2026-11-19T14:00:00.000Z', '2026-11-19T14:00:00.000Z', 'migracao', 'migracao', 'despesa',
   'Viagens cujo destino esteja fora da área metropolitana de João Pessoa – PB, incluindo combustível, passagens e hospedagem.', 1, 2),
  ('vcl_taxas_certidoes', '2026-11-19T14:00:00.000Z', '2026-11-19T14:00:00.000Z', 'migracao', 'migracao', 'despesa',
   'Taxas e similares referentes a certidões, alvarás e afins junto aos órgãos competentes.', 1, 3);
