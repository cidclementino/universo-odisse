-- Universo — migração 0004: produção (casa: ferramenta Projetos, producao.odisse.com.br).
-- Projetos, local do imóvel, etapas e horas. Mesmas convenções da 0001.
--
-- Código do projeto: AAAA-NNN (ex.: 2026-052). A numeração recomeça a cada ano: sequência
-- `projetos-<ano>` em `sequencias`. Os códigos de 2026 já foram até 051 fora do Universo
-- (pastas e contratos), então a sequência de 2026 começa em 51 e o próximo é 2026-052.
--
-- Um projeto nasce de dois jeitos:
--   1. assinatura do contrato principal (vendas): cria projeto, local, etapas e co-clientes num lote só;
--   2. cadastro manual na ferramenta Projetos (projetos que já existiam antes do Universo).

-- ---------------------------------------------------------------- projetos
CREATE TABLE projetos (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'prj\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  codigo           TEXT NOT NULL,            -- 2026-052
  ano              INTEGER NOT NULL,
  numero           INTEGER NOT NULL,
  nome             TEXT NOT NULL,            -- nome interno (Casa Jacumã)
  nome_publico     TEXT,                     -- como aparece no site e nas redes
  nucleo_id        TEXT REFERENCES nucleos (id),
  cliente_id       TEXT,                     -- titular: org_ ou pes_; demais clientes em vínculos (papel 'cliente')
  oportunidade_id  TEXT REFERENCES oportunidades (id),
  contrato_id      TEXT REFERENCES contratos (id),   -- contrato principal que criou o projeto
  servico          TEXT,                     -- serviço da proposta (Projeto Residencial…)
  tipologia        TEXT,
  area_m2          REAL,
  bairro           TEXT,
  cidade           TEXT,
  uf               TEXT CHECK (uf IS NULL OR length(uf) = 2),
  situacao         TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'pausado', 'concluido', 'cancelado')),
  inicio           TEXT,
  previsao_fim     TEXT,
  fim              TEXT,
  responsavel_id   TEXT REFERENCES equipe (id),
  publicavel       INTEGER CHECK (publicavel IN (0, 1)),   -- nulo = ainda não decidido
  observacoes      TEXT
);
-- códigos nunca se repetem, nem entre arquivados (o código já foi para pastas e contratos)
CREATE UNIQUE INDEX projetos_codigo ON projetos (codigo);
CREATE UNIQUE INDEX projetos_ano_numero ON projetos (ano, numero);
-- um contrato principal cria no máximo um projeto (protege contra dois cliques ao mesmo tempo)
CREATE UNIQUE INDEX projetos_contrato ON projetos (contrato_id) WHERE contrato_id IS NOT NULL;
CREATE INDEX projetos_situacao ON projetos (situacao) WHERE arquivado_em IS NULL;
CREATE INDEX projetos_cliente ON projetos (cliente_id);
CREATE INDEX projetos_oportunidade ON projetos (oportunidade_id);

-- ---------------------------------------------------------------- local do imóvel
-- Restrito: só vendas e Projetos. Mesmo id do projeto. Bairro, cidade e UF ficam no projeto
-- (aparecem em listas e no site); aqui fica o endereço exato.
CREATE TABLE projetos_local (
  id             TEXT PRIMARY KEY REFERENCES projetos (id),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  logradouro     TEXT,
  numero         TEXT,
  complemento    TEXT,
  cep            TEXT,
  referencias    TEXT                         -- como chegar, portaria, chaves…
);

-- ---------------------------------------------------------------- etapas
CREATE TABLE etapas (
  id                    TEXT PRIMARY KEY CHECK (id LIKE 'eta\_%' ESCAPE '\'),
  criado_em             TEXT NOT NULL,
  atualizado_em         TEXT NOT NULL,
  criado_por            TEXT,
  atualizado_por        TEXT,
  versao                INTEGER NOT NULL DEFAULT 1,
  arquivado_em          TEXT,
  projeto_id            TEXT NOT NULL REFERENCES projetos (id),
  ordem                 INTEGER NOT NULL,
  nome                  TEXT NOT NULL,
  fase                  TEXT,                 -- agrupamento da proposta (Projeto Conceitual, Projeto Legal…)
  ref_vendas            TEXT,                 -- id da etapa nas tabelas do vendas (concepcao_basica…)
  semanas               REAL,                 -- prazo combinado na proposta
  situacao              TEXT NOT NULL DEFAULT 'prevista'
                        CHECK (situacao IN ('prevista', 'em_andamento', 'em_aprovacao', 'concluida')),
  inicio_previsto       TEXT,
  fim_previsto          TEXT,
  inicio                TEXT,
  fim                   TEXT,
  percentual_pagamento  REAL CHECK (percentual_pagamento IS NULL OR (percentual_pagamento >= 0 AND percentual_pagamento <= 1)),
  observacoes           TEXT
);
CREATE INDEX etapas_projeto ON etapas (projeto_id, ordem);

-- ---------------------------------------------------------------- horas
CREATE TABLE horas (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'hor\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  equipe_id      TEXT NOT NULL REFERENCES equipe (id),
  projeto_id     TEXT NOT NULL REFERENCES projetos (id),
  etapa_id       TEXT REFERENCES etapas (id),
  data           TEXT NOT NULL,
  minutos        INTEGER NOT NULL CHECK (minutos > 0 AND minutos <= 1440),
  descricao      TEXT
);
CREATE INDEX horas_projeto ON horas (projeto_id, data);
CREATE INDEX horas_etapa ON horas (etapa_id);
CREATE INDEX horas_equipe ON horas (equipe_id, data);

-- A etapa de uma hora precisa ser do mesmo projeto (conferido no banco, não só na tela).
CREATE TRIGGER horas_etapa_do_projeto_ins BEFORE INSERT ON horas
WHEN NEW.etapa_id IS NOT NULL AND (SELECT projeto_id FROM etapas WHERE id = NEW.etapa_id) IS NOT NEW.projeto_id
BEGIN SELECT RAISE(ABORT, 'etapa de outro projeto'); END;
CREATE TRIGGER horas_etapa_do_projeto_upd BEFORE UPDATE OF etapa_id, projeto_id ON horas
WHEN NEW.etapa_id IS NOT NULL AND (SELECT projeto_id FROM etapas WHERE id = NEW.etapa_id) IS NOT NEW.projeto_id
BEGIN SELECT RAISE(ABORT, 'etapa de outro projeto'); END;

-- ---------------------------------------------------------------- numeração
INSERT INTO sequencias (nome, valor) VALUES ('projetos-2026', 51)
  ON CONFLICT (nome) DO UPDATE SET valor = max(valor, 51);
