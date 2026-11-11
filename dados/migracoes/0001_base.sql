-- Universo — migração 0001: base comum, contatos, núcleos, equipe e sínteses.
-- Referência: doc "universo-dados.md" (v1.4) no projeto do Claude e dados/DECISOES.md.
--
-- Convenções (valem para todas as tabelas principais):
--   id            texto: prefixo do tipo + ULID (ex.: org_01JD…), único no Universo inteiro
--   criado_em     instante ISO 8601 em UTC          atualizado_em  idem
--   criado_por    ferramenta (e pessoa, quando houver login)   atualizado_por  idem
--   versao        inteiro; salvar com versão velha = conflito (409)
--   arquivado_em  nulo = ativo. Nada se apaga.
-- Dias (sem hora) em AAAA-MM-DD no fuso de Brasília. Dinheiro em centavos (inteiro).
-- Ausência de informação = NULL, nunca um valor padrão que pareça dado real.
-- "Único" vale só entre registros ativos (índices únicos parciais).
--
-- Sem tabelas virtuais (FTS5): o D1 não exporta bancos que as tenham, e a cópia
-- semanal depende da exportação. A busca usa a tabela `busca` com texto normalizado.

-- ---------------------------------------------------------------- núcleos
CREATE TABLE nucleos (
  id     TEXT PRIMARY KEY,               -- ids fixos, iguais aos do odisse.json
  nome   TEXT NOT NULL,
  ordem  INTEGER NOT NULL
);
INSERT INTO nucleos (id, nome, ordem) VALUES
  ('estudio',    'Odisse Estúdio',    1),
  ('arquitetos', 'Odisse Arquitetos', 2),
  ('objetos',    'Odisse Objetos',    3),
  ('elaia',      'Odisse Elaia',      4);

-- ---------------------------------------------------------------- contatos
CREATE TABLE organizacoes (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'org\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  nome           TEXT NOT NULL,
  razao_social   TEXT,
  cnpj           TEXT,                   -- só dígitos
  tipo           TEXT CHECK (tipo IN ('empresa', 'escritorio', 'orgao_publico', 'outro')),
  email          TEXT,
  telefone       TEXT,                   -- só dígitos, com DDI
  site           TEXT,
  instagram      TEXT,
  cidade         TEXT,
  uf             TEXT CHECK (uf IS NULL OR length(uf) = 2),
  observacoes    TEXT
);
CREATE UNIQUE INDEX organizacoes_cnpj ON organizacoes (cnpj) WHERE cnpj IS NOT NULL AND arquivado_em IS NULL;
CREATE INDEX organizacoes_email ON organizacoes (email);
CREATE INDEX organizacoes_telefone ON organizacoes (telefone);

INSERT INTO organizacoes (id, criado_em, atualizado_em, criado_por, atualizado_por, nome, razao_social, tipo, email, telefone, site, instagram, cidade, uf)
VALUES ('org_odisse', '2026-11-11T00:00:00.000Z', '2026-11-11T00:00:00.000Z', 'migracao', 'migracao',
        'Odisse', 'Odisse, Estúdio de Arquitetura & Design', 'escritorio', 'contato@odisse.com.br', '5583991223088',
        'https://www.odisse.com.br', 'odisseestudio', 'João Pessoa', 'PB');

CREATE TABLE pessoas (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'pes\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  nome           TEXT NOT NULL,
  apelido        TEXT,
  email          TEXT,
  telefone       TEXT,
  whatsapp       TEXT,
  instagram      TEXT,
  observacoes    TEXT
);
CREATE INDEX pessoas_email ON pessoas (email);
CREATE INDEX pessoas_telefone ON pessoas (telefone);

-- Restrita: só o vendas.odisse lê e grava. O histórico registra só o nome dos campos mudados.
CREATE TABLE pessoas_sensiveis (
  id             TEXT PRIMARY KEY REFERENCES pessoas (id),   -- o mesmo id da pessoa
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  cpf            TEXT,
  rg             TEXT,
  nascimento     TEXT,
  logradouro     TEXT,
  numero         TEXT,
  complemento    TEXT,
  bairro         TEXT,
  cidade         TEXT,
  uf             TEXT CHECK (uf IS NULL OR length(uf) = 2),
  cep            TEXT
);

CREATE TABLE atuacoes (
  id              TEXT PRIMARY KEY CHECK (id LIKE 'atu\_%' ESCAPE '\'),
  criado_em       TEXT NOT NULL,
  atualizado_em   TEXT NOT NULL,
  criado_por      TEXT,
  atualizado_por  TEXT,
  versao          INTEGER NOT NULL DEFAULT 1,
  arquivado_em    TEXT,
  pessoa_id       TEXT NOT NULL REFERENCES pessoas (id),
  organizacao_id  TEXT NOT NULL REFERENCES organizacoes (id),
  papel           TEXT NOT NULL CHECK (papel IN ('atendente', 'vendedor', 'representante', 'socio', 'funcionario', 'contato')),
  cargo           TEXT,
  desde           TEXT,
  ate             TEXT,
  principal       INTEGER CHECK (principal IN (0, 1)),
  observacoes     TEXT
);
CREATE INDEX atuacoes_pessoa ON atuacoes (pessoa_id);
CREATE INDEX atuacoes_organizacao ON atuacoes (organizacao_id);

CREATE TABLE interacoes (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'int\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  sobre_id         TEXT NOT NULL,          -- oportunidade, organização, pessoa, fornecedor, pedido ou projeto
  pessoa_id        TEXT REFERENCES pessoas (id),
  tipo             TEXT NOT NULL CHECK (tipo IN ('reuniao', 'ligacao', 'mensagem', 'email', 'visita')),
  data             TEXT NOT NULL,
  resumo           TEXT,
  proxima_acao     TEXT,
  proxima_acao_em  TEXT
);
CREATE INDEX interacoes_sobre ON interacoes (sobre_id);
CREATE INDEX interacoes_pessoa ON interacoes (pessoa_id);
CREATE INDEX interacoes_proxima ON interacoes (proxima_acao_em) WHERE proxima_acao_em IS NOT NULL AND arquivado_em IS NULL;

-- ---------------------------------------------------------------- equipe
CREATE TABLE equipe (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'eqp\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  pessoa_id      TEXT NOT NULL REFERENCES pessoas (id),
  papel          TEXT NOT NULL CHECK (papel IN ('socio', 'arquiteto', 'estagiario', 'colaborador')),
  ativo          INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  custo_hora     INTEGER                    -- centavos; só sócios veem
);
CREATE UNIQUE INDEX equipe_pessoa ON equipe (pessoa_id) WHERE arquivado_em IS NULL;

-- ---------------------------------------------------------------- sínteses
CREATE TABLE sinteses (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'sin\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  alvo_id        TEXT NOT NULL,             -- projeto, objeto ou coleção
  idioma         TEXT NOT NULL CHECK (idioma IN ('pt', 'en')),
  texto          TEXT NOT NULL
);
CREATE UNIQUE INDEX sinteses_alvo ON sinteses (alvo_id, idioma) WHERE arquivado_em IS NULL;

-- ---------------------------------------------------------------- arquivos
CREATE TABLE arquivos (
  id                 TEXT PRIMARY KEY CHECK (id LIKE 'arq\_%' ESCAPE '\'),
  criado_em          TEXT NOT NULL,
  atualizado_em      TEXT NOT NULL,
  criado_por         TEXT,
  atualizado_por     TEXT,
  versao             INTEGER NOT NULL DEFAULT 1,
  arquivado_em       TEXT,
  dono_id            TEXT,                  -- o registro que o documento documenta; nulo para mídias do acervo
  nome_original      TEXT NOT NULL,
  tipo_mime          TEXT NOT NULL,
  tamanho            INTEGER,               -- bytes da versão principal
  sha256             TEXT,                  -- do arquivo enviado (antes da conversão)
  variantes          TEXT,                  -- tamanhos que já subiram: 'g', 'g,m,s'
  categoria          TEXT NOT NULL CHECK (categoria IN ('pdf_proposta', 'contrato', 'cotacao', 'imagem', 'video', 'desenho', 'outro')),
  visivel_cliente    INTEGER NOT NULL DEFAULT 0 CHECK (visivel_cliente IN (0, 1)),
  largura            INTEGER,
  altura             INTEGER,
  duracao            REAL,
  texto_alternativo  TEXT,
  legenda            TEXT,
  credito            TEXT,
  data_captura       TEXT,
  direitos           TEXT CHECK (direitos IN ('livre', 'uso_interno', 'aguarda_autorizacao')),
  origem_drive       TEXT
);
CREATE INDEX arquivos_dono ON arquivos (dono_id);
CREATE UNIQUE INDEX arquivos_sha_midia ON arquivos (sha256)
  WHERE sha256 IS NOT NULL AND categoria IN ('imagem', 'video') AND arquivado_em IS NULL;

-- ---------------------------------------------------------------- vínculos
CREATE TABLE vinculos (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'vin\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  de_id          TEXT NOT NULL,
  para_id        TEXT NOT NULL,
  papel          TEXT NOT NULL,
  observacao     TEXT,
  CHECK (de_id <> para_id)
);
CREATE UNIQUE INDEX vinculos_unico ON vinculos (de_id, para_id, papel) WHERE arquivado_em IS NULL;
CREATE INDEX vinculos_para ON vinculos (para_id);

-- ---------------------------------------------------------------- revisões (fila de decisão humana)
CREATE TABLE revisoes (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'rev\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('duplicado_contato', 'importacao')),
  registros      TEXT NOT NULL,             -- JSON: ids envolvidos
  campos         TEXT,                      -- JSON: { campo: 'bate' | 'ausente' | 'conflito' }
  situacao       TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'mesmo', 'diferentes')),
  decidido_em    TEXT
);
CREATE INDEX revisoes_pendentes ON revisoes (situacao) WHERE situacao = 'pendente';

-- ---------------------------------------------------------------- histórico, versões, sequências, busca
-- Auditoria campo a campo. Campos de tabelas sensíveis entram só pelo nome, nunca com valor.
CREATE TABLE historico (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_id  TEXT NOT NULL,
  tabela       TEXT NOT NULL,
  acao         TEXT NOT NULL CHECK (acao IN ('criar', 'alterar', 'arquivar', 'restaurar', 'ler_sensivel')),
  por          TEXT,
  em           TEXT NOT NULL,
  mudancas     TEXT                          -- JSON
);
CREATE INDEX historico_registro ON historico (registro_id, tabela, id);

-- Retratos completos restauráveis, só para conteúdos ricos (sínteses agora; publicações e propostas depois).
CREATE TABLE versoes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_id  TEXT NOT NULL,
  tabela       TEXT NOT NULL,
  em           TEXT NOT NULL,
  motivo       TEXT NOT NULL CHECK (motivo IN ('edicao', 'restauracao', 'migracao')),
  dados        TEXT NOT NULL                 -- JSON do registro como estava
);
CREATE INDEX versoes_registro ON versoes (registro_id, id);

CREATE TABLE sequencias (
  nome   TEXT PRIMARY KEY,
  valor  INTEGER NOT NULL DEFAULT 0
);

-- Índice de busca: texto sem acento e em minúsculas. Nunca recebe dados sensíveis.
CREATE TABLE busca (
  registro_id    TEXT PRIMARY KEY,
  tabela         TEXT NOT NULL,
  titulo         TEXT NOT NULL,             -- como aparece na lista
  chave          TEXT NOT NULL,             -- título normalizado (comparação de duplicados)
  texto          TEXT NOT NULL,             -- tudo o que é buscável, normalizado
  arquivado      INTEGER NOT NULL DEFAULT 0,
  atualizado_em  TEXT NOT NULL
);
CREATE INDEX busca_chave ON busca (tabela, chave);
INSERT INTO busca (registro_id, tabela, titulo, chave, texto, atualizado_em)
VALUES ('org_odisse', 'organizacoes', 'Odisse', 'odisse',
        'odisse odisse, estudio de arquitetura & design contato@odisse.com.br 5583991223088 joao pessoa pb',
        '2026-11-11T00:00:00.000Z');
