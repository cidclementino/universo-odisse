-- Universo — migração 0024: padrões de material do PGT (Cid, 20/11/2026).
--
-- Um PADRÃO é um material feito no próprio Universo (formulário, checklist ou modelo de documento): campos em
-- ordem e a folha da Marca em que ele sai. Criado uma vez na aba Materiais do PGT, é LIGADO a quantas etapas,
-- entregas e eventos for preciso, de qualquer fase e serviço; mudou o padrão, mudou em todos. Cada ligação é um
-- registro de pgt_materiais com modelo_id (o nome e o tipo vêm do padrão). Os materiais com link continuam iguais.
--   campos (JSON): [{ id, tipo, rotulo, … }], tipo = secao | texto | texto_longo | data | numero | escolha | marcar |
--                  tabela | pessoas | assinatura | automatico (projeto, cliente, endereco, etapa, cartao, data, responsavel)
--   folha: 'coluna' | 'ficha' (modelos da Marca); miolo: 'texto' | 'vazio' | 'pontos'
--   preenche: quem preenche no projeto; prova: ao concluir, o PDF vira prova do cartão.
CREATE TABLE pgt_modelos (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'pmo\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  nome             TEXT NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'formulario' CHECK (tipo IN ('formulario', 'checklist', 'modelo')),
  descricao        TEXT,
  folha            TEXT NOT NULL DEFAULT 'ficha' CHECK (folha IN ('coluna', 'ficha')),
  miolo            TEXT NOT NULL DEFAULT 'texto' CHECK (miolo IN ('texto', 'vazio', 'pontos')),
  preenche         TEXT NOT NULL DEFAULT 'estudio' CHECK (preenche IN ('estudio', 'cliente', 'ambos')),
  prova            INTEGER NOT NULL DEFAULT 1 CHECK (prova IN (0, 1)),
  campos           TEXT,
  ordem            INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE pgt_materiais ADD COLUMN modelo_id TEXT REFERENCES pgt_modelos (id);
CREATE INDEX pgt_materiais_modelo ON pgt_materiais (modelo_id);
