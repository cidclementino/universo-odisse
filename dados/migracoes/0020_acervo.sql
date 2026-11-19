-- Universo — migração 0020: Acervo, o banco único de imagens (Cid, 19/11).
-- Um banco só de imagens de projetos, objetos e coleções, gerido na Biblioteca do hub.
--   * galeria: liga uma imagem (arquivos) a um projeto, objeto ou coleção; uma imagem pode estar em vários.
--   * arquivos.publica: marcador ligado à mão. Ligado = disponível para o site e afins (marketing);
--     desligado = restrita ao projeto. Toda imagem nasce desligada. Só pode ser ligado com direitos 'livre'.
--   * objetos e colecoes: o desenho aprovado do Acervo (dados.md § 9), com o mínimo de campos.
-- O editor do site mostra só as imagens públicas do projeto do Universo ligado à página.

ALTER TABLE arquivos ADD COLUMN publica INTEGER NOT NULL DEFAULT 0 CHECK (publica IN (0, 1));
CREATE INDEX arquivos_publica ON arquivos (publica) WHERE publica = 1;

-- pública só imagem ou vídeo, com direitos livres e que não seja protegido (rubrica)
CREATE TRIGGER arquivos_publica_ins BEFORE INSERT ON arquivos
WHEN NEW.publica = 1 AND (NEW.direitos IS NOT 'livre' OR NEW.categoria NOT IN ('imagem', 'video') OR NEW.protegido = 1)
BEGIN SELECT RAISE(ABORT, 'publica exige direitos livres'); END;
CREATE TRIGGER arquivos_publica_upd BEFORE UPDATE OF publica, direitos ON arquivos
WHEN NEW.publica = 1 AND (NEW.direitos IS NOT 'livre' OR NEW.categoria NOT IN ('imagem', 'video') OR NEW.protegido = 1)
BEGIN SELECT RAISE(ABORT, 'publica exige direitos livres'); END;

-- ---------------------------------------------------------------- coleções e objetos
CREATE TABLE colecoes (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'col\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  nome           TEXT NOT NULL,
  nucleo_id      TEXT REFERENCES nucleos (id),
  descricao      TEXT
);
CREATE UNIQUE INDEX colecoes_nome ON colecoes (nome) WHERE arquivado_em IS NULL;

CREATE TABLE objetos (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'obj\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  nome           TEXT NOT NULL,
  nome_publico   TEXT,
  colecao_id     TEXT REFERENCES colecoes (id),
  nucleo_id      TEXT REFERENCES nucleos (id),
  descricao      TEXT,
  publicavel     INTEGER NOT NULL DEFAULT 0 CHECK (publicavel IN (0, 1))
);
CREATE INDEX objetos_colecao ON objetos (colecao_id);
CREATE UNIQUE INDEX objetos_nome ON objetos (nome) WHERE arquivado_em IS NULL;

-- ---------------------------------------------------------------- galeria
-- alvo_id = prj_, obj_ ou col_ (conferido pela API). Tirar uma imagem de um projeto = arquivar a ligação.
CREATE TABLE galeria (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'gal\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  arquivo_id     TEXT NOT NULL REFERENCES arquivos (id),
  alvo_id        TEXT NOT NULL CHECK (substr(alvo_id, 1, 4) IN ('prj_', 'obj_', 'col_')),
  ordem          INTEGER,
  destaque       INTEGER NOT NULL DEFAULT 0 CHECK (destaque IN (0, 1))
);
CREATE UNIQUE INDEX galeria_par ON galeria (arquivo_id, alvo_id) WHERE arquivado_em IS NULL;
CREATE INDEX galeria_alvo ON galeria (alvo_id, arquivado_em);
