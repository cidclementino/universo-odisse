-- Universo — migração 0028: andamento e materiais no Escopo do Projeto (Cid, 21/11/2026).
--
-- 1. Andamento (Barra de seleção do Escopo): cartões selecionados de uma etapa passam a correr AO MESMO TEMPO
--    (`junto_anterior`, que antes valia só para entregas, agora vale também para eventos) ou EM SEQUÊNCIA. Com buracos
--    na seleção, os selecionados passam à frente dos do meio, como quem reorganiza a pilha, e os códigos da etapa
--    acompanham a nova ordem (PP-04 vira PP-03). Registro em `escopo_alteracoes` com o tipo novo 'andamento'
--    (natureza 'prazo'). O SQLite não muda CHECK de coluna: a tabela é refeita com os mesmos dados (nenhuma aponta para ela).
-- 2. Materiais do cartão (`escopo_cartoes.materiais`, JSON { mais: [pma_/pmo_…], menos: [pma_…] }): os do PGT publicado
--    ligados ao cartão continuam vindo sozinhos; `mais` acrescenta do banco de materiais do PGT, `menos` tira do cartão.
--    O cartão aponta para o banco (link vivo). Material novo criado no cartão entra na hora em `pgt_materiais`, ligado à
--    entrega/evento de origem (ou à etapa, num cartão acrescentado); a ligação vale nos escopos novos depois de publicar.

ALTER TABLE escopo_cartoes ADD COLUMN materiais TEXT;

CREATE TABLE escopo_alteracoes_nova (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'eal\_%' ESCAPE '\'),
  projeto_id       TEXT NOT NULL REFERENCES projetos (id),
  cartao_id        TEXT REFERENCES escopo_cartoes (id),
  tipo             TEXT NOT NULL CHECK (tipo IN ('duracao', 'mover', 'suprimir', 'restaurar', 'acrescentar', 'decisao', 'suspender', 'retomar', 'inicio', 'andamento')),
  natureza         TEXT NOT NULL CHECK (natureza IN ('aditivo', 'prazo', 'extra')),
  dias             INTEGER,
  antes            TEXT,
  depois           TEXT,
  descricao        TEXT,
  motivo           TEXT,
  por              TEXT,
  em               TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL
);
INSERT INTO escopo_alteracoes_nova (id, projeto_id, cartao_id, tipo, natureza, dias, antes, depois, descricao, motivo, por, em, atualizado_em)
  SELECT id, projeto_id, cartao_id, tipo, natureza, dias, antes, depois, descricao, motivo, por, em, atualizado_em FROM escopo_alteracoes;
DROP TABLE escopo_alteracoes;
ALTER TABLE escopo_alteracoes_nova RENAME TO escopo_alteracoes;
CREATE INDEX escopo_alteracoes_projeto ON escopo_alteracoes (projeto_id, em);
CREATE INDEX escopo_alteracoes_cartao ON escopo_alteracoes (cartao_id, atualizado_em);
