-- Universo — migração 0002: comercial (casa: vendas.odisse).
-- Oportunidades (funil), propostas (Odisse → cliente) e contratos.
-- Mesmas convenções da 0001 (ids com prefixo, versão, arquivado_em, centavos, dias em Brasília).
--
-- Números de proposta e de contrato saem da tabela `sequencias` (nomes 'propostas' e 'contratos'),
-- incrementados dentro do banco. A de propostas continua do maior número que existia no KV do vendas.

-- ---------------------------------------------------------------- oportunidades
CREATE TABLE oportunidades (
  id                 TEXT PRIMARY KEY CHECK (id LIKE 'opo\_%' ESCAPE '\'),
  criado_em          TEXT NOT NULL,
  atualizado_em      TEXT NOT NULL,
  criado_por         TEXT,
  atualizado_por     TEXT,
  versao             INTEGER NOT NULL DEFAULT 1,
  arquivado_em       TEXT,
  titulo             TEXT NOT NULL,
  cliente_id         TEXT,                  -- titular: organização (org_) ou pessoa (pes_); demais clientes em vínculos
  contato_pessoa_id  TEXT REFERENCES pessoas (id),
  projeto_id         TEXT,                  -- opcional: ampliação ou aditivo de um projeto existente
  nucleo_id          TEXT REFERENCES nucleos (id),
  origem             TEXT CHECK (origem IN ('indicacao', 'instagram', 'site', 'landing_page', 'herma', 'radar', 'outro')),
  origem_detalhe     TEXT,                  -- qual LP, qual lote da Herma, qual post…
  etapa_funil        TEXT NOT NULL DEFAULT 'lead'
                     CHECK (etapa_funil IN ('lead', 'contato', 'briefing', 'proposta', 'negociacao', 'ganha', 'perdida')),
  etapa_desde        TEXT,                  -- dia em que entrou na etapa atual (gravado pela API)
  fechada_em         TEXT,                  -- dia em que virou ganha ou perdida (gravado pela API)
  valor_estimado     INTEGER,               -- centavos
  motivo_perda       TEXT,
  responsavel_id     TEXT REFERENCES equipe (id),
  observacoes        TEXT
);
CREATE INDEX oportunidades_etapa ON oportunidades (etapa_funil) WHERE arquivado_em IS NULL;
CREATE INDEX oportunidades_cliente ON oportunidades (cliente_id);
CREATE INDEX oportunidades_contato ON oportunidades (contato_pessoa_id);

-- ---------------------------------------------------------------- propostas
CREATE TABLE propostas (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'ppt\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  numero           INTEGER NOT NULL,        -- da sequência; revisões repetem o número
  revisao          INTEGER NOT NULL DEFAULT 0,
  codigo           TEXT NOT NULL,           -- como aparece no PDF: PC-0007-2026, PC-0007-2026-R1
  oportunidade_id  TEXT NOT NULL REFERENCES oportunidades (id),
  titulo           TEXT,
  data             TEXT,                    -- data impressa na proposta
  valor_total      INTEGER,                 -- centavos
  situacao         TEXT NOT NULL DEFAULT 'rascunho'
                   CHECK (situacao IN ('rascunho', 'enviada', 'aceita', 'recusada', 'expirada', 'substituida')),
  enviada_em       TEXT,
  validade         TEXT,
  calculo          TEXT,                    -- JSON: retrato completo dos dados do cálculo
  referencias      TEXT,                    -- JSON: versões das tabelas usadas (CUB do mês, arquivos de data/)
  arquivo_pdf_id   TEXT REFERENCES arquivos (id),  -- PDF congelado; depois dele o cálculo não muda mais
  importada_de     TEXT                     -- 'kv:PC-0007-2026' nas propostas trazidas do vendas antigo
);
-- Números nunca se repetem, nem entre arquivadas: o número já foi para um cliente.
CREATE UNIQUE INDEX propostas_numero ON propostas (numero, revisao);
CREATE UNIQUE INDEX propostas_codigo ON propostas (codigo);
CREATE UNIQUE INDEX propostas_importada ON propostas (importada_de) WHERE importada_de IS NOT NULL;
CREATE INDEX propostas_oportunidade ON propostas (oportunidade_id);

-- ---------------------------------------------------------------- contratos
CREATE TABLE contratos (
  id                   TEXT PRIMARY KEY CHECK (id LIKE 'ctr\_%' ESCAPE '\'),
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL,
  criado_por           TEXT,
  atualizado_por       TEXT,
  versao               INTEGER NOT NULL DEFAULT 1,
  arquivado_em         TEXT,
  numero               INTEGER NOT NULL,
  codigo               TEXT NOT NULL,       -- CT-0001-2026
  tipo                 TEXT NOT NULL DEFAULT 'principal' CHECK (tipo IN ('principal', 'aditivo')),
  proposta_id          TEXT REFERENCES propostas (id),
  projeto_id           TEXT,                -- preenchido ao assinar o principal (com a ferramenta Projetos)
  situacao             TEXT NOT NULL DEFAULT 'rascunho'
                       CHECK (situacao IN ('rascunho', 'enviado', 'assinado', 'encerrado', 'cancelado')),
  valor_total          INTEGER,
  assinado_em          TEXT,
  arquivo_assinado_id  TEXT REFERENCES arquivos (id),
  observacoes          TEXT
);
CREATE UNIQUE INDEX contratos_numero ON contratos (numero);
CREATE INDEX contratos_proposta ON contratos (proposta_id);
CREATE INDEX contratos_projeto ON contratos (projeto_id);
