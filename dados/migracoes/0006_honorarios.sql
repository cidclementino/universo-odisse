-- 0006 — Honorários: o custo sai das Bases e do PGT e ganha publicação própria (12/11/2026).
--
-- Decisão do Cid: a ferramenta Projetos trata da ESTRUTURA (serviços, tipologias, fases, etapas,
-- entregáveis, materiais); o CUSTO fica no vendas. Os dados continuam nas mesmas tabelas:
--   bases_servicos.modificador / com_preco / preco_por_etapa   → preço dos serviços
--   pgt_fases.parcela                                         → parcela ao concluir a fase
--   pgt_etapas_servicos.peso                                  → peso da etapa no honorário
--   bases_parametros (parcela_entrada)                        → parcela de entrada
-- mas saem dos retratos 'bases' e 'pgt' e passam a formar o retrato 'honorarios', publicado pela
-- página Honorários do vendas. Uma proposta vai registrar as três versões (bases, pgt, honorarios).
--
-- Aqui só se abre o tipo 'honorarios' em pgt_publicacoes (o CHECK do SQLite não se altera: a tabela
-- é refeita, com os retratos já publicados).

CREATE TABLE pgt_publicacoes_nova (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo             TEXT NOT NULL CHECK (tipo IN ('bases', 'pgt', 'honorarios')),
  numero           INTEGER NOT NULL,
  publicado_em     TEXT NOT NULL,
  por              TEXT,
  nota             TEXT,
  assinatura       TEXT NOT NULL,
  dados            TEXT NOT NULL
);
INSERT INTO pgt_publicacoes_nova (id, tipo, numero, publicado_em, por, nota, assinatura, dados)
  SELECT id, tipo, numero, publicado_em, por, nota, assinatura, dados FROM pgt_publicacoes;
DROP TABLE pgt_publicacoes;
ALTER TABLE pgt_publicacoes_nova RENAME TO pgt_publicacoes;
CREATE UNIQUE INDEX pgt_publicacoes_numero ON pgt_publicacoes (tipo, numero);
