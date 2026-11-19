-- Universo — migração 0017: textos das ferramentas editáveis pelo hub (página Ferramentas, lápis na descrição).
-- O mapa continua no ferramentas.json (nome, ramo, endereço, estado); aqui fica só a descrição editada,
-- uma linha por item do mapa (`chave` = id do item). Sem linha, vale a descrição do ferramentas.json.
CREATE TABLE ferramentas_textos (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'frt\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  chave          TEXT NOT NULL,
  descricao      TEXT NOT NULL
);
CREATE UNIQUE INDEX ferramentas_textos_chave ON ferramentas_textos (chave) WHERE arquivado_em IS NULL;
