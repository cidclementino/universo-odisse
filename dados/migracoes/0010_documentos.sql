-- 0010 — Documentos do estúdio (18/11/2026, decisões do Cid; desenho em universo-documentos.md).
--   * Grupo 1 (identidade e correspondência) mora no Universo: carta (com a opção ofício), declaração e
--     memorando. O desenho da folha (Coluna ou Ficha) vem da Marca (marca.odisse.com.br/v1/documentos/);
--     aqui fica só o conteúdo. Separar formatação de conteúdo: o tipo do documento decide os campos,
--     o modelo decide a folha.
--   * Numeração por sigla e por ano, gravada pela API (regras.js): CA-2026-0001 (carta e ofício),
--     DE-2026-0001 (declaração), MI-2026-0001 (memorando). O ano é o da data do documento. A sequência
--     recomeça a cada ano. Números nunca se repetem, nem entre arquivados.
--   * `assinaturas` é uma lista JSON: [{"nome":"Cid Clementino","cargo":"Arquiteto e urbanista","registro":"CAU A000000-0"}].
--   * O documento emitido fica aqui, a priori (decisão de 17/11). PDF congelado no R2 fica para depois.

CREATE TABLE documentos (
  id              TEXT PRIMARY KEY CHECK (id LIKE 'doc\_%' ESCAPE '\'),
  criado_em       TEXT NOT NULL,
  atualizado_em   TEXT NOT NULL,
  criado_por      TEXT,
  atualizado_por  TEXT,
  versao          INTEGER NOT NULL DEFAULT 1,
  arquivado_em    TEXT,
  numero          INTEGER NOT NULL,
  ano             INTEGER NOT NULL,
  codigo          TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('carta', 'declaracao', 'memorando')),
  modelo          TEXT NOT NULL DEFAULT 'coluna' CHECK (modelo IN ('coluna', 'ficha')),
  oficio          INTEGER NOT NULL DEFAULT 0 CHECK (oficio IN (0, 1)),
  data            TEXT NOT NULL,
  local           TEXT,
  destinatario    TEXT,
  remetente       TEXT,
  assunto         TEXT,
  referencia      TEXT,
  titulo          TEXT,
  saudacao        TEXT,
  corpo           TEXT,
  fecho           TEXT,
  assinaturas     TEXT,
  anexos          TEXT,
  projeto_id      TEXT,
  observacoes     TEXT
);

CREATE UNIQUE INDEX documentos_codigo ON documentos (codigo);
CREATE INDEX documentos_tipo ON documentos (tipo) WHERE arquivado_em IS NULL;
CREATE INDEX documentos_projeto ON documentos (projeto_id) WHERE projeto_id IS NOT NULL;
