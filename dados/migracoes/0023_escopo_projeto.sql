-- Universo — migração 0023: o Escopo do Projeto (Cid, 20/11/2026).
--
-- O escopo é a lista de etapas, entregas e eventos contratados para um projeto, copiada do PGT, cada cartão com a
-- sua duração. É a ferramenta de gestão do projeto ativo (projetos.odisse › projeto › PGT, Linha por padrão):
--   * o calendário sai sozinho: início + durações em sequência, em dias úteis (seg–sex; sem feriados por ora),
--     os que correm juntos no mesmo intervalo; "em andamento" é o que cai em hoje. Nenhum estado no cartão;
--   * o calendário fica em dia mudando a DURAÇÃO (estender/reduzir: os seguintes andam junto) ou MOVENDO o
--     cartão sem mudar a duração (`folga` = dias úteis de hiato antes dele; negativa = corre em paralelo);
--   * suprimir (a entrega contratada que não fez sentido) e acrescentar (o que não estava previsto);
--   * a suspensão do projeto (`projetos.suspensoes`) congela o calendário;
--   * tudo o que muda fica em `escopo_alteracoes` (base para aditivos): natureza 'aditivo' (acrescentado,
--     suprimido), 'prazo' (duração, mover, suspensão) ou 'extra' (rodada prevista que uma decisão liberou).
--     Cliques seguidos no mesmo cartão (até 10 s entre eles) viram uma alteração só, com a soma dos dias.
-- Nasce do contrato assinado (duração da proposta: PGT × faixa da área, ou o prazo personalizado) ou pelo
-- "Gerar escopo" num projeto cadastrado à mão (PGT × faixa, personalizável). Substitui a tabela simples de
-- etapas do projeto (que fica guardada); as horas passam a apontar para a etapa do escopo.

ALTER TABLE projetos ADD COLUMN escopo_inicio TEXT;          -- AAAA-MM-DD: começo do calendário do escopo
ALTER TABLE projetos ADD COLUMN suspensoes TEXT;             -- JSON [{ de, ate | null }] (ate nulo = suspenso agora)

CREATE TABLE escopo_cartoes (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'esc\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  projeto_id       TEXT NOT NULL REFERENCES projetos (id),
  tipo             TEXT NOT NULL CHECK (tipo IN ('etapa', 'entrega', 'evento')),
  etapa_id         TEXT REFERENCES escopo_cartoes (id),        -- o cartão-etapa (entregas e eventos)
  origem_id        TEXT,                                       -- pet_/pen_/pev_ do PGT; nulo = acrescentado
  ordem            REAL NOT NULL,
  codigo           TEXT,                                       -- CE-01, CE-M02… (retrato do contrato)
  sigla            TEXT,
  texto            TEXT NOT NULL,
  fase_id          TEXT,
  fase_nome        TEXT,
  evento_tipo      TEXT,
  tempo            TEXT CHECK (tempo IS NULL OR tempo IN ('estudio', 'cliente', 'terceiros', 'pontual')),
  cliente          INTEGER NOT NULL DEFAULT 0,
  terceiros        INTEGER NOT NULL DEFAULT 0,
  encerramento     INTEGER NOT NULL DEFAULT 0,
  junto_anterior   INTEGER NOT NULL DEFAULT 0,
  dias             INTEGER NOT NULL DEFAULT 1 CHECK (dias BETWEEN 1 AND 400),
  dias_contratados INTEGER,                                    -- a duração com que nasceu
  folga            INTEGER NOT NULL DEFAULT 0 CHECK (folga BETWEEN -400 AND 400),
  sem_prazo        INTEGER NOT NULL DEFAULT 0,                 -- o PGT não tinha prazo (1 dia de reserva)
  decisao          TEXT,                                       -- JSON [{ id, nome, libera: [esc_…] }]
  decisao_resultado TEXT,
  liberado_por     TEXT REFERENCES escopo_cartoes (id),        -- fica fora até a decisão liberar
  adicionado       INTEGER NOT NULL DEFAULT 0,
  suprimido_em     TEXT,
  observacoes      TEXT
);
CREATE INDEX escopo_cartoes_projeto ON escopo_cartoes (projeto_id, ordem);
CREATE INDEX escopo_cartoes_etapa ON escopo_cartoes (etapa_id);

CREATE TABLE escopo_alteracoes (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'eal\_%' ESCAPE '\'),
  projeto_id       TEXT NOT NULL REFERENCES projetos (id),
  cartao_id        TEXT REFERENCES escopo_cartoes (id),
  tipo             TEXT NOT NULL CHECK (tipo IN ('duracao', 'mover', 'suprimir', 'restaurar', 'acrescentar', 'decisao', 'suspender', 'retomar', 'inicio')),
  natureza         TEXT NOT NULL CHECK (natureza IN ('aditivo', 'prazo', 'extra')),
  dias             INTEGER,                                    -- saldo em dias úteis (+ estende/atrasa, − reduz/adianta)
  antes            TEXT,
  depois           TEXT,
  descricao        TEXT,
  motivo           TEXT,
  por              TEXT,
  em               TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL
);
CREATE INDEX escopo_alteracoes_projeto ON escopo_alteracoes (projeto_id, em);
CREATE INDEX escopo_alteracoes_cartao ON escopo_alteracoes (cartao_id, atualizado_em);

-- horas lançadas na etapa do escopo (a tabela antiga de etapas fica guardada)
ALTER TABLE horas ADD COLUMN cartao_id TEXT REFERENCES escopo_cartoes (id);
CREATE INDEX horas_cartao ON horas (cartao_id);
CREATE TRIGGER horas_cartao_do_projeto_ins BEFORE INSERT ON horas
WHEN NEW.cartao_id IS NOT NULL AND (SELECT projeto_id FROM escopo_cartoes WHERE id = NEW.cartao_id) IS NOT NEW.projeto_id
BEGIN SELECT RAISE(ABORT, 'etapa de outro projeto'); END;
CREATE TRIGGER horas_cartao_do_projeto_upd BEFORE UPDATE OF cartao_id, projeto_id ON horas
WHEN NEW.cartao_id IS NOT NULL AND (SELECT projeto_id FROM escopo_cartoes WHERE id = NEW.cartao_id) IS NOT NEW.projeto_id
BEGIN SELECT RAISE(ABORT, 'etapa de outro projeto'); END;
