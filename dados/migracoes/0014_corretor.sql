-- Universo — migração 0014: papel "corretor" nas atuações (pessoa ↔ organização).
-- O Radar (radar.odisse.com.br) descobre corretores de imóveis e os leva aos Contatos do vendas
-- com esse papel. O corretor é o titular da oportunidade aberta sobre um terreno; quando a conversa
-- rende, nasce outra oportunidade, cujo titular é o cliente (ver DECISOES.md, "Radar").
--
-- O SQLite não muda o CHECK de uma coluna existente: a tabela é refeita com os mesmos dados.
-- Nenhuma tabela aponta para atuacoes (chave estrangeira), então ela é refeita sozinha.

PRAGMA defer_foreign_keys = true;

CREATE TABLE atuacoes_nova (
  id              TEXT PRIMARY KEY CHECK (id LIKE 'atu\_%' ESCAPE '\'),
  criado_em       TEXT NOT NULL,
  atualizado_em   TEXT NOT NULL,
  criado_por      TEXT,
  atualizado_por  TEXT,
  versao          INTEGER NOT NULL DEFAULT 1,
  arquivado_em    TEXT,
  pessoa_id       TEXT NOT NULL REFERENCES pessoas (id),
  organizacao_id  TEXT NOT NULL REFERENCES organizacoes (id),
  papel           TEXT NOT NULL CHECK (papel IN ('atendente', 'vendedor', 'representante', 'socio', 'funcionario', 'contato', 'corretor')),
  cargo           TEXT,
  desde           TEXT,
  ate             TEXT,
  principal       INTEGER CHECK (principal IN (0, 1)),
  observacoes     TEXT
);
INSERT INTO atuacoes_nova (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em,
  pessoa_id, organizacao_id, papel, cargo, desde, ate, principal, observacoes)
SELECT id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em,
  pessoa_id, organizacao_id, papel, cargo, desde, ate, principal, observacoes FROM atuacoes;

DROP TABLE atuacoes;
ALTER TABLE atuacoes_nova RENAME TO atuacoes;

CREATE INDEX atuacoes_pessoa ON atuacoes (pessoa_id);
CREATE INDEX atuacoes_organizacao ON atuacoes (organizacao_id);
