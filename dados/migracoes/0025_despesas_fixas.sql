-- Universo — migração 0025: Financeiro › Despesas fixas (Cid, 20/11).
-- Primeira parte do Financeiro, seção própria do menu principal: o cadastro das despesas fixas do estúdio (um CNPJ
-- só, sem rateio por núcleo) e a previsão de custos do ano, calculada na página.
--   * grupo: 'geral' ou 'pessoal' (pró-labore, salários, encargos; seção própria da página, fechada até pedir,
--     fora da cópia do navegador);
--   * moeda: 'brl' (padrão) ou 'usd'. O valor fica na moeda dele; nas somas, o dólar é convertido pela cotação do dia
--     (PTAX do Banco Central, no R2 em financeiro/cotacao.json) e o total ganha um * de previsão;
--   * valor = o vigente. Mudou o valor, o antigo não se perde: despesas_fixas_valores guarda cada valor com o mês
--     desde quando vale (a regra grava junto, no mesmo lote), e a previsão de meses passados usa o valor da época;
--   * periodicidade mensal, trimestral, semestral ou anual; `mes` = mês do pagamento (ou do primeiro, nas trimestrais
--     e semestrais), nulo nas mensais;
--   * encerrar = gravar `fim` (a despesa deixa de contar dali em diante); arquivar = cadastrada por engano.
CREATE TABLE despesas_fixas (
  id              TEXT PRIMARY KEY CHECK (id LIKE 'dfx\_%' ESCAPE '\'),
  criado_em       TEXT NOT NULL,
  atualizado_em   TEXT NOT NULL,
  criado_por      TEXT,
  atualizado_por  TEXT,
  versao          INTEGER NOT NULL DEFAULT 1,
  arquivado_em    TEXT,
  nome            TEXT NOT NULL,
  grupo           TEXT NOT NULL DEFAULT 'geral' CHECK (grupo IN ('geral', 'pessoal')),
  categoria       TEXT,
  moeda           TEXT NOT NULL DEFAULT 'brl' CHECK (moeda IN ('brl', 'usd')),
  valor           INTEGER NOT NULL CHECK (valor >= 0),             -- centavos, na moeda da despesa
  periodicidade   TEXT NOT NULL DEFAULT 'mensal' CHECK (periodicidade IN ('mensal', 'trimestral', 'semestral', 'anual')),
  dia             INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),   -- dia do vencimento
  mes             INTEGER CHECK (mes BETWEEN 1 AND 12),
  forma           TEXT CHECK (forma IN ('boleto', 'debito', 'cartao', 'pix', 'transferencia')),
  fornecedor      TEXT,
  inicio          TEXT,                                            -- AAAA-MM-DD; nulo = desde sempre
  fim             TEXT,                                            -- AAAA-MM-DD; encerrada
  reajuste_mes    INTEGER CHECK (reajuste_mes BETWEEN 1 AND 12),
  reajuste_indice TEXT,
  observacoes     TEXT,
  arquivo_id      TEXT REFERENCES arquivos (id)
);
CREATE INDEX despesas_fixas_grupo ON despesas_fixas (grupo, arquivado_em);

-- Valores de cada despesa ao longo do tempo (só a regra grava; um por despesa e mês)
CREATE TABLE despesas_fixas_valores (
  id          TEXT PRIMARY KEY CHECK (id LIKE 'dfv\_%' ESCAPE '\'),
  despesa_id  TEXT NOT NULL REFERENCES despesas_fixas (id),
  desde       TEXT NOT NULL CHECK (desde GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  valor       INTEGER NOT NULL CHECK (valor >= 0),
  moeda       TEXT NOT NULL CHECK (moeda IN ('brl', 'usd')),
  criado_em   TEXT NOT NULL,
  criado_por  TEXT,
  UNIQUE (despesa_id, desde)
);
