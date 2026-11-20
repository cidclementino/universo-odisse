-- Universo — migração 0021: Credenciais (Cid, 19/11).
-- Os documentos que editais, termos de referência e concursos pedem ao estúdio. Cada documento mora com o seu dono:
--   * emp_odisse: constituição e registros, sede (página Empresa) e o que vence ou depende de fora — regularidade
--     fiscal, social e trabalhista, econômico-financeira, cadastros e acessos (página Credenciais);
--   * eqp_…: registro no conselho, CATs, diploma, currículo, vínculo, procuração, identidade (ficha da Equipe);
--   * prj_…: atestados de capacidade técnica e RRTs (por projeto).
-- O tipo vem de um catálogo no código (worker/dados/credenciais.js), que diz onde cada um aparece, se vence,
-- se pode haver vários e se é exigido. Sem CHECK no tipo: o catálogo cresce sem migração.
-- Substituir = registro novo com `substitui_id`, que arquiva o anterior no mesmo lote. Documento vencido e não
-- substituído gera o aviso da Início, que só sai com a substituição (ou arquivando o documento).
CREATE TABLE credenciais (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'cre\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  dono_id        TEXT NOT NULL CHECK (substr(dono_id, 1, 4) IN ('emp_', 'eqp_', 'prj_')),
  tipo           TEXT NOT NULL,
  titulo         TEXT,
  numero         TEXT,
  emitido_em     TEXT,
  vence_em       TEXT,
  arquivo_id     TEXT REFERENCES arquivos (id),
  observacao     TEXT,
  substitui_id   TEXT REFERENCES credenciais (id)
);
CREATE INDEX credenciais_dono ON credenciais (dono_id, arquivado_em);
CREATE INDEX credenciais_vence ON credenciais (vence_em) WHERE arquivado_em IS NULL AND vence_em IS NOT NULL;
CREATE UNIQUE INDEX credenciais_substitui ON credenciais (substitui_id) WHERE substitui_id IS NOT NULL;

-- Empresa › Constituição e registros: campos novos (o resto já existia em 0018)
ALTER TABLE empresa ADD COLUMN inscricao_estadual TEXT;
ALTER TABLE empresa ADD COLUMN capital_social INTEGER;              -- centavos
ALTER TABLE empresa ADD COLUMN responsavel_tecnico_id TEXT REFERENCES equipe (id);
