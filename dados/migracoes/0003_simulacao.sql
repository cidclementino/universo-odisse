-- Universo — migração 0003: propostas de simulação.
-- Simulação = orçamento sem cliente (testar a ferramenta, ter ideia de custo de um serviço).
-- Consome número da sequência como qualquer proposta, mas não tem oportunidade, não entra no
-- funil e o PDF sai marcado como simulação. Toda proposta que não é simulação continua exigindo
-- oportunidade (CHECK abaixo).
--
-- O SQLite não muda NOT NULL de uma coluna existente: a tabela é refeita com os mesmos dados.
-- `contratos` aponta para propostas (proposta_id) e é refeita junto, para a chave estrangeira
-- continuar apontando para a tabela nova.

PRAGMA defer_foreign_keys = true;

CREATE TABLE propostas_nova (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'ppt\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  numero           INTEGER NOT NULL,
  revisao          INTEGER NOT NULL DEFAULT 0,
  codigo           TEXT NOT NULL,
  simulacao        INTEGER NOT NULL DEFAULT 0 CHECK (simulacao IN (0, 1)),
  oportunidade_id  TEXT REFERENCES oportunidades (id),
  titulo           TEXT,
  data             TEXT,
  valor_total      INTEGER,
  situacao         TEXT NOT NULL DEFAULT 'rascunho'
                   CHECK (situacao IN ('rascunho', 'enviada', 'aceita', 'recusada', 'expirada', 'substituida')),
  enviada_em       TEXT,
  validade         TEXT,
  calculo          TEXT,
  referencias      TEXT,
  arquivo_pdf_id   TEXT REFERENCES arquivos (id),
  importada_de     TEXT,
  CHECK (simulacao = 1 OR oportunidade_id IS NOT NULL),
  CHECK (simulacao = 0 OR oportunidade_id IS NULL)
);
INSERT INTO propostas_nova (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em,
  numero, revisao, codigo, simulacao, oportunidade_id, titulo, data, valor_total, situacao, enviada_em,
  validade, calculo, referencias, arquivo_pdf_id, importada_de)
SELECT id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em,
  numero, revisao, codigo, 0, oportunidade_id, titulo, data, valor_total, situacao, enviada_em,
  validade, calculo, referencias, arquivo_pdf_id, importada_de
FROM propostas;

CREATE TABLE contratos_nova (
  id                   TEXT PRIMARY KEY CHECK (id LIKE 'ctr\_%' ESCAPE '\'),
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL,
  criado_por           TEXT,
  atualizado_por       TEXT,
  versao               INTEGER NOT NULL DEFAULT 1,
  arquivado_em         TEXT,
  numero               INTEGER NOT NULL,
  codigo               TEXT NOT NULL,
  tipo                 TEXT NOT NULL DEFAULT 'principal' CHECK (tipo IN ('principal', 'aditivo')),
  proposta_id          TEXT REFERENCES propostas_nova (id),
  projeto_id           TEXT,
  situacao             TEXT NOT NULL DEFAULT 'rascunho'
                       CHECK (situacao IN ('rascunho', 'enviado', 'assinado', 'encerrado', 'cancelado')),
  valor_total          INTEGER,
  assinado_em          TEXT,
  arquivo_assinado_id  TEXT REFERENCES arquivos (id),
  observacoes          TEXT
);
INSERT INTO contratos_nova SELECT * FROM contratos;

DROP TABLE contratos;
DROP TABLE propostas;
ALTER TABLE propostas_nova RENAME TO propostas;
ALTER TABLE contratos_nova RENAME TO contratos;

CREATE UNIQUE INDEX propostas_numero ON propostas (numero, revisao);
CREATE UNIQUE INDEX propostas_codigo ON propostas (codigo);
CREATE UNIQUE INDEX propostas_importada ON propostas (importada_de) WHERE importada_de IS NOT NULL;
CREATE INDEX propostas_oportunidade ON propostas (oportunidade_id);
CREATE INDEX propostas_simulacao ON propostas (simulacao) WHERE simulacao = 1;

CREATE UNIQUE INDEX contratos_numero ON contratos (numero);
CREATE INDEX contratos_proposta ON contratos (proposta_id);
CREATE INDEX contratos_projeto ON contratos (projeto_id);
