-- Universo — migração 0005: Bases e Plano Geral de Trabalho (PGT); códigos com o ano antes do número.
-- Referência: docs "universo-pgt.md" (v0.5) e "universo-pgt-entregaveis.md" (v0.1) no projeto do Claude,
-- e dados/DECISOES.md. Casa: ferramenta Projetos (páginas Bases e PGT); o vendas lê.
--
-- Cadeia (decisão do Cid): Bases → PGT → Projetos. As Bases dizem o que forma o preço (serviço,
-- categoria e uso da tipologia, CUB, fator do CAU, índice de complexidade); o PGT diz o que se faz
-- (fases, etapas, entregáveis, materiais) e para quais serviços; o Escopo do Projeto (migração futura)
-- é a cópia do PGT contratada para um projeto.
--
-- Rascunho × publicado: as tabelas abaixo são o rascunho vivo, editado pela ferramenta Projetos.
-- "Publicar" grava um retrato completo em `pgt_publicacoes` (tipo 'bases' ou 'pgt', número 1, 2, 3…);
-- é esse retrato que o vendas vai ler, e a proposta vai registrar o número usado.
--
-- Pertinência: P = vem marcado · O = opcional · ausência da linha = não se aplica.
-- Códigos dos entregáveis (CE-03…) não são gravados: saem da sigla da etapa + ordem.
-- Ids das sementes são legíveis (srv_ne, pet_ce, pen_ce_03); os criados depois usam ULID.
-- Não há busca (tabela `busca`) para estes registros: as páginas carregam tudo de uma vez.

-- ================================================================= Bases

CREATE TABLE bases_servicos (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'srv\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  sigla            TEXT NOT NULL,             -- NE, RF, RT, IN…
  nome             TEXT NOT NULL,
  descricao        TEXT,
  ordem            INTEGER NOT NULL DEFAULT 0,
  modificador      REAL,                      -- modificador do serviço sobre o valor do CAU (nulo = sem preço)
  pede_tipologia   INTEGER NOT NULL DEFAULT 1 CHECK (pede_tipologia IN (0, 1)),
  com_preco        INTEGER NOT NULL DEFAULT 1 CHECK (com_preco IN (0, 1)),
  preco_por_etapa  INTEGER NOT NULL DEFAULT 0 CHECK (preco_por_etapa IN (0, 1)),  -- honorário repartido pelos pesos das etapas
  ic_ajustes       TEXT,                      -- JSON { criterio: 'baixo'|'medio'|'alto' } que sobrepõe o preset da categoria
  ref_vendas       TEXT,                      -- ids antigos em data/servicos-odisse.json
  observacoes      TEXT
);
CREATE UNIQUE INDEX bases_servicos_sigla ON bases_servicos (sigla) WHERE arquivado_em IS NULL;

CREATE TABLE bases_categorias (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'tca\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  grupo            TEXT NOT NULL CHECK (grupo IN ('residencial', 'comercial', 'institucional', 'diversos')),
  nome             TEXT NOT NULL,             -- Residencial Unifamiliar, Hospedagem…
  ordem            INTEGER NOT NULL DEFAULT 0,
  ic_preset        TEXT,                      -- JSON { criterio: nível } do índice de complexidade
  ref_vendas       TEXT,                      -- chave antiga em data/tipologias.json
  observacoes      TEXT
);
CREATE UNIQUE INDEX bases_categorias_nome ON bases_categorias (nome) WHERE arquivado_em IS NULL;

CREATE TABLE bases_usos (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'tus\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  categoria_id     TEXT NOT NULL REFERENCES bases_categorias (id),
  item             TEXT,                      -- item da tabela do CAU (1.2, 2.2.4…)
  descricao        TEXT NOT NULL,             -- Residências (Padrão médio)…
  categoria_cau    INTEGER CHECK (categoria_cau IS NULL OR categoria_cau BETWEEN 1 AND 4),  -- linha do fator percentual
  cub_codigo       TEXT,                      -- R-1-N, CSL-16-A…
  cub_referencia   REAL,                      -- valor do CUB de reserva, se a tabela vigente não tiver o código
  fator_adequacao  REAL,
  ordem            INTEGER NOT NULL DEFAULT 0,
  observacoes      TEXT
);
CREATE INDEX bases_usos_categoria ON bases_usos (categoria_id, ordem);

-- Parâmetros soltos (chave → valor JSON). Hoje: parcela_entrada.
CREATE TABLE bases_parametros (
  chave            TEXT PRIMARY KEY,
  valor            TEXT,
  rotulo           TEXT,
  atualizado_em    TEXT NOT NULL,
  atualizado_por   TEXT
);

-- ================================================================= PGT

CREATE TABLE pgt_fases (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'pfa\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  nome             TEXT NOT NULL,             -- Conceitual, Legal, Executiva, Obra, Ilhas
  ordem            INTEGER NOT NULL DEFAULT 0,
  ilha             INTEGER NOT NULL DEFAULT 0 CHECK (ilha IN (0, 1)),   -- fora do fluxo: sem prazos encadeados nem parcelas
  parcela          REAL CHECK (parcela IS NULL OR (parcela >= 0 AND parcela <= 1)),  -- parcela do pagamento ao concluir a fase
  descricao        TEXT
);

CREATE TABLE pgt_etapas (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'pet\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  fase_id          TEXT NOT NULL REFERENCES pgt_fases (id),
  sigla            TEXT NOT NULL,             -- sigla Odisse: LV, PP, EV, CE, CB, PL, PX, PE, DE, AS, AB, CR, LR
  nome             TEXT NOT NULL,
  ordem            INTEGER NOT NULL DEFAULT 0,
  nbr_nome         TEXT,                      -- correspondência na NBR 16636, para o (i): Estudo Preliminar
  nbr_sigla        TEXT,                      -- EP-ARQ
  nbr_nota         TEXT,                      -- quando não há etapa equivalente ou há ressalva
  descricao        TEXT,                      -- texto do contrato
  semanas_base     REAL,
  ref_vendas       TEXT                       -- ids antigos em data/etapas.json
);
CREATE UNIQUE INDEX pgt_etapas_sigla ON pgt_etapas (sigla) WHERE arquivado_em IS NULL;
CREATE INDEX pgt_etapas_fase ON pgt_etapas (fase_id, ordem);

-- Etapa × serviço. Peso: participação da etapa no honorário (serviços com preço por etapa).
CREATE TABLE pgt_etapas_servicos (
  etapa_id         TEXT NOT NULL REFERENCES pgt_etapas (id),
  servico_id       TEXT NOT NULL REFERENCES bases_servicos (id),
  pertinencia      TEXT NOT NULL CHECK (pertinencia IN ('P', 'O')),
  peso             REAL CHECK (peso IS NULL OR peso >= 0),
  semanas          REAL CHECK (semanas IS NULL OR semanas >= 0),   -- nulo = semanas_base da etapa
  PRIMARY KEY (etapa_id, servico_id)
);
CREATE INDEX pgt_etapas_servicos_srv ON pgt_etapas_servicos (servico_id);

CREATE TABLE pgt_entregaveis (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'pen\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  etapa_id         TEXT NOT NULL REFERENCES pgt_etapas (id),
  texto            TEXT NOT NULL,             -- como vai no contrato
  ordem            INTEGER NOT NULL DEFAULT 0,
  ref_vendas       TEXT,                      -- entregáveis antigos fundidos aqui (etapas.json, assessoramento.json)
  observacoes      TEXT
);
CREATE INDEX pgt_entregaveis_etapa ON pgt_entregaveis (etapa_id, ordem);

CREATE TABLE pgt_entregaveis_servicos (
  entregavel_id    TEXT NOT NULL REFERENCES pgt_entregaveis (id),
  servico_id       TEXT NOT NULL REFERENCES bases_servicos (id),
  pertinencia      TEXT NOT NULL CHECK (pertinencia IN ('P', 'O')),
  PRIMARY KEY (entregavel_id, servico_id)
);
CREATE INDEX pgt_entregaveis_servicos_srv ON pgt_entregaveis_servicos (servico_id);

-- Restrição por categoria de tipologia: sem linhas = vale para todas.
CREATE TABLE pgt_entregaveis_categorias (
  entregavel_id    TEXT NOT NULL REFERENCES pgt_entregaveis (id),
  categoria_id     TEXT NOT NULL REFERENCES bases_categorias (id),
  PRIMARY KEY (entregavel_id, categoria_id)
);

-- Materiais de uso interno (modelos, formulários, checklists, referências), ligados a uma etapa
-- ou a um entregável. Nesta migração só a estrutura e o link; envio de arquivos e criação de
-- formulários vêm depois.
CREATE TABLE pgt_materiais (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'pma\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  alvo_id          TEXT NOT NULL,             -- pet_ (etapa) ou pen_ (entregável)
  tipo             TEXT NOT NULL CHECK (tipo IN ('modelo', 'formulario', 'checklist', 'referencia')),
  nome             TEXT NOT NULL,
  descricao        TEXT,
  link             TEXT,                      -- https:// (Drive, Biblioteca…)
  arquivo_id       TEXT REFERENCES arquivos (id),
  ordem            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX pgt_materiais_alvo ON pgt_materiais (alvo_id, ordem);

-- Retratos publicados. `dados` = JSON completo; `assinatura` = SHA-256 do JSON (compara rascunho × publicado).
CREATE TABLE pgt_publicacoes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo             TEXT NOT NULL CHECK (tipo IN ('bases', 'pgt')),
  numero           INTEGER NOT NULL,
  publicado_em     TEXT NOT NULL,
  por              TEXT,
  nota             TEXT,
  assinatura       TEXT NOT NULL,
  dados            TEXT NOT NULL
);
CREATE UNIQUE INDEX pgt_publicacoes_numero ON pgt_publicacoes (tipo, numero);

-- ================================================================= códigos: ano antes do número
-- Projeto AAAA-NNN → OA-AAAA-NNN (código interno, de pastas e arquivos). Propostas e contratos
-- já emitidos ficam como estão (o código está impresso no PDF que o cliente recebeu); os novos
-- saem PC-AAAA-NNNN e CT-AAAA-NNNN (regras.js).
INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
  SELECT id, 'projetos', 'alterar', 'migracao', '2026-11-12T15:00:00.000Z', json_object('codigo', json_array(codigo, 'OA-' || codigo))
  FROM projetos WHERE codigo NOT LIKE 'OA-%';
UPDATE busca SET titulo = 'OA-' || titulo, chave = 'oa-' || chave, texto = 'oa-' || texto
  WHERE tabela = 'projetos' AND titulo NOT LIKE 'OA-%';
UPDATE projetos SET codigo = 'OA-' || codigo, versao = versao + 1, atualizado_em = '2026-11-12T15:00:00.000Z', atualizado_por = 'migracao' WHERE codigo NOT LIKE 'OA-%';

-- ================================================================= sementes
-- Geradas a partir de data/*.json do vendas (odisse-orcamentos) e do pool de entregáveis v0.1.
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_ne', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'NE', 'Arquitetura – Nova Edificação', 'Projeto de arquitetura de uma edificação nova. A natureza do uso (residencial, comercial, institucional…) vem da tipologia.', 1, 1.0, 1, 1, 1, '{}', 'residencial,comercial,institucional,edificios_mistos');
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_rf', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'RF', 'Reforma', 'Reforma de espaços existentes.', 2, 1.25, 1, 1, 1, '{"grau_controle_custo": "alto", "indefinicao_escopo": "alto", "indefinicao_prazo": "alto"}', 'reforma');
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_rt', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'RT', 'Retrofit', 'Intervenção sobre a própria arquitetura existente (fachada, sistemas, complementares).', 3, 1.25, 1, 1, 1, '{"grau_controle_custo": "alto", "indefinicao_escopo": "alto", "indefinicao_prazo": "alto"}', NULL);
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_in', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'IN', 'Interiores', 'Projeto de interiores, com marcenaria, acabamentos e mobiliário.', 4, 1.5, 1, 1, 1, '{"qtd_especialistas": "baixo", "qtd_aprovacoes": "baixo", "grau_resp_civil": "baixo", "grau_intervencao_cliente": "alto", "expectativa_plastica": "medio", "grau_controle_custo": "medio", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'interiores');
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_am', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'AM', 'Ambientação', 'Ambientação e decoração, sem detalhamento executivo de interiores.', 5, 0.75, 1, 1, 1, '{"qtd_especialistas": "baixo", "qtd_aprovacoes": "baixo", "grau_resp_civil": "baixo", "grau_intervencao_cliente": "alto", "expectativa_plastica": "medio", "grau_controle_custo": "medio", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'interiores');
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_co', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'CO', 'Concurso', 'Participação em concurso de arquitetura: desenvolvimento conceitual e entrega conforme o edital.', 6, NULL, 1, 0, 0, '{}', NULL);
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_ev', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'EV', 'Estudo de Viabilidade', 'Estudo do potencial do terreno ou imóvel para a decisão do empreendimento.', 7, 0.2, 1, 1, 0, '{"qtd_especialistas": "baixo", "qtd_aprovacoes": "baixo", "grau_resp_civil": "baixo", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "alto", "indefinicao_prazo": "medio", "demanda_midia": "baixo"}', 'viabilidade');
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_cr', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'CR', 'Consultoria Remota', 'Orientação técnica a distância, fora do fluxo de projeto.', 8, 0.15, 0, 1, 0, '{"qtd_especialistas": "baixo", "qtd_aprovacoes": "baixo", "grau_resp_civil": "baixo", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "baixo", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "baixo"}', 'consultoria_remota');
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, sigla, nome, descricao, ordem, modificador, pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, ref_vendas) VALUES ('srv_la', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'LA', 'Laudos e Regularização', 'Laudos técnicos e regularização de imóveis, fora do fluxo de projeto.', 9, 0.15, 0, 1, 0, '{"qtd_especialistas": "baixo", "qtd_aprovacoes": "baixo", "grau_resp_civil": "medio", "grau_intervencao_cliente": "baixo", "expectativa_plastica": "medio", "grau_controle_custo": "baixo", "indefinicao_escopo": "baixo", "indefinicao_prazo": "baixo", "demanda_midia": "baixo"}', 'laudos');
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_res_unifamiliar', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'residencial', 'Residencial Unifamiliar', 1, '{"qtd_especialistas": "baixo", "qtd_aprovacoes": "medio", "grau_resp_civil": "medio", "grau_intervencao_cliente": "alto", "expectativa_plastica": "medio", "grau_controle_custo": "medio", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'HabitacionalUnifamiliar');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_res_unifamiliar_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_res_unifamiliar', '1.1', 'Residências (Padrão baixo)', 2, 'R-1-B', 1638.53, 1.0, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_res_unifamiliar_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_res_unifamiliar', '1.2', 'Residências (Padrão médio)', 3, 'R-1-N', 1970.37, 1.5, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_res_unifamiliar_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_res_unifamiliar', '1.3', 'Residências (Padrão alto)', 4, 'R-1-A', 2416.57, 2.0, 3);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_res_multifamiliar', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'residencial', 'Residencial Multifamiliar', 2, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "medio", "grau_resp_civil": "alto", "grau_intervencao_cliente": "baixo", "expectativa_plastica": "medio", "grau_controle_custo": "medio", "indefinicao_escopo": "medio", "indefinicao_prazo": "alto", "demanda_midia": "medio"}', 'HabitacionalMultifamiliar');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_res_multifamiliar_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_res_multifamiliar', '2.1', 'Edifícios de apartamentos, conjuntos habitacionais de casas e/ou edifícios, condomínios e vilas (Padrão normal)', 1, 'R-8-N', 1543.9, 1.5, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_res_multifamiliar_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_res_multifamiliar', '2.2', 'Edifícios de apartamentos, conjuntos habitacionais de casas e/ou edifícios, condomínios e vilas (Padrão alto)', 2, 'R-16-A', 1990.89, 1.5, 2);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_hab_especiais', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'residencial', 'Habitações Especiais', 3, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "medio", "grau_resp_civil": "alto", "grau_intervencao_cliente": "baixo", "expectativa_plastica": "medio", "grau_controle_custo": "medio", "indefinicao_escopo": "medio", "indefinicao_prazo": "alto", "demanda_midia": "medio"}', 'HabitaçõesEspeciais');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_hab_especiais_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_hab_especiais', '4.1', 'Projeto habitacional de Interesse Social', 1, 'PIS', 996.18, 1.0, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_hab_especiais_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_hab_especiais', '4.2', 'Alojamentos, asilos, orfanatos, internatos, conventos e mosteiros', 2, 'R-8-N', 1543.9, 1.5, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_hab_especiais_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_hab_especiais', '4.3', 'Quartéis', 3, 'R-8-N', 1543.9, 1.5, 3);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_hab_especiais_4', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_hab_especiais', '4.4', 'Presídios e penitenciárias', 4, 'R-8-N', 1543.9, 1.5, 4);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_hospedagem', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'comercial', 'Hospedagem', 4, '{"qtd_especialistas": "medio", "qtd_aprovacoes": "medio", "grau_resp_civil": "medio", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "baixo", "indefinicao_prazo": "alto", "demanda_midia": "medio"}', 'Hospedagem');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_hospedagem_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_hospedagem', '3.1', 'Albergues, pousadas, hotéis simples e motéis', 2, 'R-8-N', 1543.9, 1.5, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_hospedagem_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_hospedagem', '3.2', 'Hotéis de luxo', 4, 'R-16-A', 1990.89, 3.0, 2);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_comercio', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'comercial', 'Comércio', 5, '{"qtd_especialistas": "medio", "qtd_aprovacoes": "medio", "grau_resp_civil": "medio", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "baixo", "indefinicao_prazo": "alto", "demanda_midia": "medio"}', 'Comércio');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_comercio_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_comercio', '5.1', 'Armazéns e depósitos', 1, 'GI', 927.36, 1.5, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_comercio_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_comercio', '5.2', 'Supermercados, hortomercados e pavilhões para realização de feitas e exposições', 2, 'CAL-8-N', 1759.02, 1.3, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_comercio_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_comercio', '5.3', 'Lojas de departamentos, magazines, centros comerciais e shopping centers', 3, 'CSL-16-N', 2056.99, 1.5, 3);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_comercio_4', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_comercio', '5.4', 'Lojas, butiques, stands e show-rooms', 4, 'CSL-16-A', 2221.71, 1.5, 4);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_servicos', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'comercial', 'Serviços', 6, '{"qtd_especialistas": "medio", "qtd_aprovacoes": "medio", "grau_resp_civil": "medio", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "baixo", "indefinicao_prazo": "alto", "demanda_midia": "medio"}', 'Serviços');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_servicos_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_servicos', '2.2.1', 'Edificações com desenho de ocupação (leiaute interno) fornecido', 1, 'CSL-8-N', 1539.12, 1.0, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_servicos_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_servicos', '2.2.2', 'Edifícios de escritório e edifícios administrativos com andar de salas/conj.', 3, 'CSL-8-N', 1539.12, 1.5, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_servicos_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_servicos', '2.2.3', 'Edifícios de escritórios e edifícios administrativos de andar corrido', 4, 'CAL-8-N', 1759.02, 2.5, 3);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_servicos_4', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_servicos', '2.2.4', 'Bancos, sede de empresas, instituições e órgãos públicos', 4, 'CSL-16-N', 2056.99, 2.25, 4);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_servicos_5', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_servicos', '2.2.5', 'Centro de processamento de dados', 4, 'CSL-16-N', 2056.99, 2.5, 5);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_educacao', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'institucional', 'Educação', 7, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "alto", "grau_resp_civil": "alto", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'Educação');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_educacao_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_educacao', '7.1', 'Creches, escolas primárias e secundárias', 2, 'CAL-8-N', 1759.02, 1.5, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_educacao_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_educacao', '7.2', 'Escolas técnicas, especializadas, superiores e universidades', 4, 'CSL-16-N', 2056.99, 2.0, 2);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_saude', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'institucional', 'Saúde', 8, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "alto", "grau_resp_civil": "alto", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'Saúde');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_saude_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_saude', '8.1', 'Ambulatórios e postos de saúde', 2, 'CSL-8-N', 1539.12, 1.5, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_saude_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_saude', '8.2', 'Clínicas e consultórios', 3, 'CSL-16-N', 2056.99, 1.5, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_saude_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_saude', '8.3', 'Hospitais', 4, 'CSL-16-A', 2221.71, 2.5, 3);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_esportes', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'institucional', 'Esportes', 9, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "alto", "grau_resp_civil": "alto", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'Esportes');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_esportes_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_esportes', '9.1', 'Quadras cobertas e galpões para barcos', 1, 'GI', 927.36, 1.3, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_esportes_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_esportes', '9.2', 'Clube, ginásios esportivos simples', 3, 'CSL-8-N', 1539.12, 1.5, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_esportes_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_esportes', '9.3', 'Instalações esportivas descobertas', 2, 'CAL-8-N', 1759.02, 1.0, 3);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_esportes_4', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_esportes', '9.4', 'Piscinas descobertas', 3, 'CSL-8-N', 1539.12, 1.5, 4);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_esportes_5', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_esportes', '9.5', 'Estádio e instalações esportivas especializadas', 4, 'CSL-16-N', 2056.99, 3.0, 5);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_lazer', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'institucional', 'Lazer', 10, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "alto", "grau_resp_civil": "alto", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'Lazer');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_lazer_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_lazer', '10.1', 'Restaurantes, boates, casas de espetáculo, cinema e teatro simples', 4, 'CSL-16-N', 2056.99, 2.0, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_lazer_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_lazer', '10.2', 'Planetários e teatros especializados', 4, 'CSL-16-A', 2221.71, 2.5, 2);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_cultura', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'institucional', 'Cultura', 11, '{"qtd_especialistas": "alto", "qtd_aprovacoes": "alto", "grau_resp_civil": "alto", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "medio", "indefinicao_prazo": "medio", "demanda_midia": "medio"}', 'Cultura');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_cultura_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_cultura', '11.1', 'Galerias de arte, salas de exposição, arquivos, bibliotecas e museus simples', 4, 'CSL-16-N', 2056.99, 2.0, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_cultura_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_cultura', '11.2', 'Arquivos, bibliotecas, museus especializados', 4, 'CSL-16-A', 2221.71, 3.0, 2);
INSERT INTO bases_categorias (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, grupo, nome, ordem, ic_preset, ref_vendas) VALUES ('tca_diversos', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'diversos', 'Diversos', 12, '{"qtd_especialistas": "medio", "qtd_aprovacoes": "medio", "grau_resp_civil": "medio", "grau_intervencao_cliente": "medio", "expectativa_plastica": "medio", "grau_controle_custo": "alto", "indefinicao_escopo": "baixo", "indefinicao_prazo": "alto", "demanda_midia": "medio"}', 'Diversos');
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_1', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.1', 'Galpões para máquinas, armazéns, estábulos, cocheiras, pocilgas, aviários e instalações rurais simples', 1, 'GI', 927.36, 1.0, 1);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_2', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.2', 'Galpões, oficinas e depósitos', 1, 'GI', 927.36, 1.0, 2);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_3', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.3', 'Garagens simples', 1, 'GI', 927.36, 1.0, 3);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_4', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.4', 'Matadouros e instalações rurais especializadas', 2, 'CSL-8-N', 1539.12, 1.0, 4);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_5', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.5', 'Edifícios-garagem, pedágios e postos de serviços', 2, 'CSL-8-N', 1539.12, 1.0, 5);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_6', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.6', 'Fábricas e laboratórios simples', 2, 'CSL-8-N', 1539.12, 1.0, 6);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_7', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.7', 'Templos religiosos, capelas, mortuários e cemitérios', 3, 'CSL-16-N', 2056.99, 1.0, 7);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_8', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.8', 'Terminais e estações rodoviárias e ferroviárias', 3, 'CSL-16-N', 2056.99, 1.0, 8);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_9', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.9', 'Projeto de monumentos e pavilhões de exposições', 3, 'CSL-16-N', 2056.99, 1.0, 9);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_10', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.10', 'Agências e centrais (Telegráficas e telefônicas)', 3, 'CSL-16-N', 2056.99, 1.0, 10);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_11', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.11', 'Auditórios, salas de conferências e pavilhões para realização de congressos', 4, 'CSL-16-N', 2056.99, 2.0, 11);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_12', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.12', 'Aeroportos', 4, 'CSL-16-A', 2221.71, 2.6, 12);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_13', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.13', 'Estúdios e estações de gravação, rádio e televisão', 4, 'CSL-16-A', 2221.71, 1.5, 13);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_14', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.14', 'Usinas, fábricas e laboratórios especializados', 4, 'CSL-16-A', 2221.71, 1.5, 14);
INSERT INTO bases_usos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, categoria_id, item, descricao, categoria_cau, cub_codigo, cub_referencia, fator_adequacao, ordem) VALUES ('tus_diversos_15', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'tca_diversos', '12.15', 'Outras áreas descobertas', 1, 'GI', 927.36, 0.25, 15);
INSERT INTO bases_parametros (chave, valor, rotulo, atualizado_em, atualizado_por) VALUES ('parcela_entrada', '0.3', 'Parcela de entrada (na assinatura)', '2026-11-12T15:00:00.000Z', 'migracao');
INSERT INTO pgt_fases (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, nome, ordem, ilha, parcela) VALUES ('pfa_conceitual', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'Conceitual', 1, 0, 0.2);
INSERT INTO pgt_fases (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, nome, ordem, ilha, parcela) VALUES ('pfa_legal', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'Legal', 2, 0, 0.2);
INSERT INTO pgt_fases (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, nome, ordem, ilha, parcela) VALUES ('pfa_executiva', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'Executiva', 3, 0, 0.3);
INSERT INTO pgt_fases (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, nome, ordem, ilha, parcela) VALUES ('pfa_obra', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'Obra', 4, 0, NULL);
INSERT INTO pgt_fases (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, nome, ordem, ilha, parcela) VALUES ('pfa_ilhas', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'Ilhas', 5, 1, NULL);
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_lv', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_conceitual', 'LV', 'Levantamento', 1, 'Levantamento de Dados', 'LV-ARQ', NULL, 'Etapa de reconhecimento do terreno ou do imóvel e da documentação existente: registro fotográfico, levantamento cadastral, entorno imediato, legislação incidente e documentos recebidos.', 1, NULL);
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_pp', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_conceitual', 'PP', 'Programação Projetual', 2, 'Programa de Necessidades', 'PN-ARQ', NULL, 'Etapa de definição dos requisitos, objetivos e diretrizes que orientarão o desenvolvimento do projeto, levando em consideração as necessidades do cliente, as características do terreno e as regulamentações aplicáveis.', 2, 'programacao_projetual,programacao_projetual_interiores');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_ev', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_conceitual', 'EV', 'Estudo de Viabilidade', 3, 'Estudo de Viabilidade', 'EV-ARQ', NULL, 'Etapa de verificação do potencial do terreno ou do imóvel: ocupação máxima permitida, quadro de áreas e índices, estimativa de custo da obra e recomendações para a decisão do empreendimento.', 2, NULL);
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_ce', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_conceitual', 'CE', 'Concepção Esquemática', 4, 'Estudo Preliminar', 'EP-ARQ', NULL, 'Etapa onde são desenvolvidos os primeiros ensaios de ocupação do terreno, assim como os primeiros volumes, soluções formais do projeto, definições de fluxos e a relação do edifício com seu entorno imediato e com as restrições legais impostas sobre ele.', 2, 'concepcao_esquematica,concepcao_esquematica_interiores');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_cb', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_conceitual', 'CB', 'Concepção Básica', 5, 'Anteprojeto', 'AP-ARQ', 'Absorve o antigo "projeto básico".', 'Etapa de consolidação de uma das alternativas de ocupação do terreno, com ampliação do grau de materialidade do projeto, trazendo primeiras propostas de solução estrutural e de materialidade do projeto.', 3, 'concepcao_basica,concepcao_basica_interiores');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_pl', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_legal', 'PL', 'Projeto Legal', 6, 'Projeto Legal', 'PL-ARQ', NULL, 'Etapa de desenvolvimento da documentação técnico-legal para solicitação de alvará de construção junto aos órgãos competentes.', 2, 'projeto_basico_legal');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_px', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_executiva', 'PX', 'Pré-Executivo', 7, NULL, NULL, 'Sem etapa própria na NBR: coordenação e compatibilização com os projetos complementares.', 'Etapa de coordenação do projeto arquitetônico junto aos projetos de disciplinas complementares. Todos os materiais técnicos produzidos pelas equipes de projetos complementares serão analisados pela equipe do Odisse.', 8, 'pre_executivo,pre_executivo_interiores');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_pe', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_executiva', 'PE', 'Projeto Executivo', 8, 'Projeto Executivo', 'PE-ARQ', NULL, 'Descrição completa e detalhada do projeto arquitetônico em plantas, cortes e elevações, assim como a consolidação da compatibilização e coordenação de projetos técnicos, de consultoria e de engenharia.', 8, 'projeto_executivo_arquitetura,projeto_executivo_interiores');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_de', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_executiva', 'DE', 'Detalhamento Executivo', 9, 'Projeto Executivo', 'PE-ARQ', 'Parte de detalhamento do projeto executivo.', 'Compreende a descrição detalhada e específica das soluções, junções, elementos, objetos e materiais propostos.', 4, 'detalhamento_executivo');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_as', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_obra', 'AS', 'Assessoramento', 10, NULL, NULL, 'Fora das etapas de projeto da NBR (equivale ao estágio 5 do RIBA, construção).', 'Durante o desenvolvimento e execução do projeto, a equipe do Odisse Arquitetos oferecerá o seguinte assessoramento técnico:', NULL, 'assessoramento');
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_ab', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_obra', 'AB', 'As Built', 11, NULL, NULL, 'Fora das etapas de projeto da NBR (equivale ao estágio 6 do RIBA, entrega e uso).', 'Registro do que foi efetivamente construído e entrega dos documentos de uso, manutenção e garantias.', 2, NULL);
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_cr', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_ilhas', 'CR', 'Consultoria Remota', 12, NULL, NULL, 'Fora das etapas da NBR. Etapa-ilha: fora do encadeamento de prazos e das parcelas.', 'Orientação técnica a distância, em reuniões online, com registro das recomendações.', NULL, NULL);
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, fase_id, sigla, nome, ordem, nbr_nome, nbr_sigla, nbr_nota, descricao, semanas_base, ref_vendas) VALUES ('pet_lr', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pfa_ilhas', 'LR', 'Laudos e Regularização', 13, NULL, NULL, 'Fora das etapas da NBR. Etapa-ilha: fora do encadeamento de prazos e das parcelas.', 'Vistoria, laudo técnico e peças para regularização do imóvel junto aos órgãos competentes.', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_ne', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_rf', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_rt', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_in', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_am', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_co', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lv', 'srv_ev', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_ne', 'P', 12, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_rf', 'O', 12, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_rt', 'P', 12, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_in', 'P', 18, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_am', 'P', 18, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_co', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pp', 'srv_ev', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ev', 'srv_ne', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ev', 'srv_rf', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ev', 'srv_rt', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ev', 'srv_ev', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ce', 'srv_ne', 'P', 12, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ce', 'srv_rf', 'O', 12, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ce', 'srv_rt', 'P', 12, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ce', 'srv_in', 'P', 17, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ce', 'srv_am', 'P', 17, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ce', 'srv_co', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cb', 'srv_ne', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cb', 'srv_rf', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cb', 'srv_rt', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cb', 'srv_in', 'P', 23, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cb', 'srv_am', 'O', 23, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cb', 'srv_co', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pl', 'srv_ne', 'P', 20, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pl', 'srv_rf', 'P', 20, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pl', 'srv_rt', 'P', 20, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pl', 'srv_in', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_px', 'srv_ne', 'P', 8, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_px', 'srv_rf', 'O', 8, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_px', 'srv_rt', 'P', 8, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_px', 'srv_in', 'P', 14, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pe', 'srv_ne', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pe', 'srv_rf', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pe', 'srv_rt', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pe', 'srv_in', 'P', 28, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_pe', 'srv_am', 'O', 28, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_de', 'srv_ne', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_de', 'srv_rf', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_de', 'srv_rt', 'P', 16, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_de', 'srv_in', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_as', 'srv_ne', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_as', 'srv_rf', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_as', 'srv_rt', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_as', 'srv_in', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_as', 'srv_am', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ab', 'srv_ne', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ab', 'srv_rf', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ab', 'srv_rt', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_ab', 'srv_in', 'O', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_cr', 'srv_cr', 'P', NULL, NULL);
INSERT INTO pgt_etapas_servicos (etapa_id, servico_id, pertinencia, peso, semanas) VALUES ('pet_lr', 'srv_la', 'P', NULL, NULL);
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lv_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lv', 'Levantamento fotográfico do terreno ou imóvel', 1, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_co', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_01', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lv_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lv', 'Levantamento cadastral do existente (medição e desenho)', 2, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_02', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_02', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_02', 'srv_ev', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lv_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lv', 'Análise do entorno imediato', 3, 'programacao_projetual__2 + programacao_projetual_interiores__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_03', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_03', 'srv_in', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_03', 'srv_co', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_03', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lv_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lv', 'Análise da legislação incidente', 4, 'programacao_projetual__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_04', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_04', 'srv_in', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_04', 'srv_co', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_04', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lv_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lv', 'Compilação dos documentos recebidos (topografia, sondagem, plantas existentes, edital e bases)', 5, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_co', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lv_05', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pp_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pp', 'Briefing com o cliente (questionário de necessidades e perfil de uso)', 1, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_01', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_01', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_01', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pp_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pp', 'Análise de similares', 2, 'programacao_projetual__1 + programacao_projetual_interiores__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_co', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_02', 'srv_ev', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pp_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pp', 'Definição do programa de necessidades', 3, 'programacao_projetual__3 + programacao_projetual_interiores__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_co', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_03', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pp_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pp', 'Lista preliminar de mobiliário e artigos de decoração', 4, 'programacao_projetual_interiores__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_04', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_04', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pp_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pp', 'Relatório sintético com diretrizes para o projeto', 5, 'programacao_projetual__5 + programacao_projetual_interiores__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_05', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_05', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_05', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pp_05', 'srv_co', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ev_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ev', 'Estudo de massas e de ocupação máxima do terreno', 1, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_01', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_01', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_01', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ev_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ev', 'Quadro de potencial construtivo (áreas, índices, gabarito, recuos)', 2, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_02', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_02', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_02', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_02', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ev_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ev', 'Estimativa de custo da obra (base CUB)', 3, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_03', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_03', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_03', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_03', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ev_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ev', 'Relatório de viabilidade com recomendações', 4, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_04', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_04', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_04', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ev_04', 'srv_ev', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Estudos volumétricos e de massas', 1, 'concepcao_esquematica__1 + concepcao_esquematica_interiores__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_01', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_01', 'srv_in', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_01', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Diagramas de fluxos', 2, 'concepcao_esquematica__2 + concepcao_esquematica_interiores__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_02', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_02', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_02', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Diagramas de zoneamento', 3, 'concepcao_esquematica__3 + concepcao_esquematica_interiores__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_03', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_03', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_03', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_03', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_03', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Croquis e esboços preliminares', 4, 'concepcao_esquematica__4 + concepcao_esquematica_interiores__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_04', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_04', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_04', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_04', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Modelos 3D ou maquetes físicas esquemáticas', 5, 'concepcao_esquematica__5 + concepcao_esquematica_interiores__7');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_05', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_05', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_05', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_05', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_06', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Planta de layout com definição de mobiliário', 6, 'concepcao_esquematica_interiores__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_06', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_06', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_06', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_07', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Ilustrações preliminares', 7, 'concepcao_esquematica_interiores__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_07', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_07', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_07', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_07', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_07', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_07', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ce_08', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ce', 'Numérico inicial de áreas (totais e privativas)', 8, 'concepcao_esquematica__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_08', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_08', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_08', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ce_08', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Definição da linguagem estética e da materialidade', 1, 'concepcao_basica__1 + concepcao_basica_interiores__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_01', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_01', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_01', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Plantas com layout dos pavimentos ou ambientes', 2, 'concepcao_basica__2 + concepcao_basica_interiores__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_02', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_02', 'srv_am', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_02', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Cortes esquemáticos', 3, 'concepcao_basica__3 + concepcao_basica_interiores__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_03', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_03', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_03', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Modelo 3D consolidado', 4, 'concepcao_basica__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_04', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_04', 'srv_in', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_04', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Ilustrações do projeto', 5, 'concepcao_basica__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_05', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_05', 'srv_in', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_05', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_05', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_06', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Numérico consolidado de áreas', 6, 'concepcao_basica__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_06', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_06', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_06', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_06', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_07', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Estudos das marcenarias fixas', 7, 'concepcao_basica_interiores__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_07', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_07', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_08', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Prancha de amostras de acabamentos', 8, 'concepcao_basica_interiores__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_08', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_08', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_08', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_08', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_08', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_09', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Sugestão dos principais acabamentos', 9, 'projeto_basico_legal__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_09', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_09', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_09', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_10', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Memorial descritivo simplificado', 10, 'projeto_basico_legal__7');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_10', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_10', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_10', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_10', 'srv_in', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_11', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Pré-lançamento de projetos complementares', 11, 'projeto_basico_legal__8');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_11', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_11', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_11', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_12', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Orçamento simplificado da obra', 12, 'concepcao_basica__7 + projeto_basico_legal__9 + concepcao_basica_interiores__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_12', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_12', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_12', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_12', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_12', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_13', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Pranchas de apresentação conforme o edital', 13, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_13', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_14', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Memorial justificativo', 14, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_14', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cb_15', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cb', 'Imagens finais para apresentação', 15, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_15', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_15', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_15', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_15', 'srv_in', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_15', 'srv_am', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cb_15', 'srv_co', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Planta de implantação', 1, 'projeto_basico_legal__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Planta de coberta', 2, 'projeto_basico_legal__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_02', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Plantas baixas de todos os pavimentos', 3, 'projeto_basico_legal__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_03', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Dois cortes técnicos', 4, 'projeto_basico_legal__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_04', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Quatro elevações', 5, 'projeto_basico_legal__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_05', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_06', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Quadro de áreas e parâmetros urbanísticos', 6, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_06', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_06', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_06', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_07', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Documentação para aprovação no condomínio', 7, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_07', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_07', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_07', 'srv_in', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pl_08', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pl', 'Protocolo e acompanhamento da aprovação nos órgãos', 8, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_08', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_08', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pl_08', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Reuniões de coordenação e compatibilização com projetistas complementares', 1, 'pre_executivo__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_01', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Reuniões de coordenação com fornecedores e marcenaria', 2, 'pre_executivo_interiores__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_02', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Análise dos desenhos e amostras dos fornecedores', 3, 'pre_executivo_interiores__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_03', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_03', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Planta de coberta compatibilizada', 4, 'pre_executivo__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_04', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Plantas baixas compatibilizadas', 5, 'pre_executivo__3 + pre_executivo_interiores__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_05', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_05', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_06', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Planta de pontos elétricos e hidrossanitários', 6, 'pre_executivo__4 + pre_executivo_interiores__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_06', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_06', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_06', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_06', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_07', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Cortes técnicos compatibilizados', 7, 'pre_executivo__5 + pre_executivo_interiores__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_07', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_07', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_07', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_07', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_px_08', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_px', 'Documentação básica dos principais elementos de fachada', 8, 'pre_executivo__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_08', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_08', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_px_08', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Plantas de implantação, coberta e todos os pavimentos', 1, 'projeto_executivo_arquitetura__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Plantas de layout, forros e acabamentos', 2, 'projeto_executivo_arquitetura__2 + projeto_executivo_interiores__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_02', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_02', 'srv_am', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Planta de locação de pontos elétricos e hidrossanitários', 3, 'projeto_executivo_arquitetura__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_03', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_03', 'srv_in', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Cortes e fachadas', 4, 'projeto_executivo_arquitetura__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_04', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Elevações internas dos ambientes', 5, 'projeto_executivo_interiores__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_05', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_05', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_05', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_05', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_05', 'srv_am', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_06', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Detalhamento de esquadrias', 6, 'projeto_executivo_arquitetura__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_06', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_06', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_06', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_07', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Memorial descritivo', 7, 'projeto_executivo_arquitetura__6 + projeto_executivo_interiores__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_07', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_07', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_07', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_07', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_08', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Ilustrações do projeto', 8, 'projeto_executivo_arquitetura__7 + projeto_executivo_interiores__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_08', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_08', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_08', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_08', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_08', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_09', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Detalhamento de marcenarias fixas', 9, 'projeto_executivo_interiores__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_09', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_09', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_10', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Detalhamento técnico de mobiliário, bancadas e afins', 10, 'projeto_executivo_interiores__7');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_10', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_10', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_11', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Lista consolidada de mobiliário e artigos de decoração', 11, 'projeto_executivo_interiores__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_11', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_11', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_pe_12', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_pe', 'Planilha orçamentária consolidada', 12, 'projeto_executivo_interiores__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_12', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_12', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_12', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_12', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_pe_12', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Ampliação de áreas molhadas', 1, 'detalhamento_executivo__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_01', 'srv_in', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Detalhamento de bancadas, escadas e rampas', 2, 'detalhamento_executivo__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_02', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Detalhamento interno de elevadores', 3, 'detalhamento_executivo__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_03', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id) VALUES ('pen_de_03', 'tca_res_multifamiliar');
INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id) VALUES ('pen_de_03', 'tca_hospedagem');
INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id) VALUES ('pen_de_03', 'tca_servicos');
INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id) VALUES ('pen_de_03', 'tca_saude');
INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id) VALUES ('pen_de_03', 'tca_educacao');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Detalhamento de guarda-corpos e corrimãos', 4, 'detalhamento_executivo__4');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_04', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_04', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_04', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Detalhamento de portões, portas, janelas e painéis', 5, 'detalhamento_executivo__5');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_05', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_05', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_05', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_06', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Detalhamento de jardineiras e elementos específicos', 6, 'detalhamento_executivo__6');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_06', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_06', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_06', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_de_07', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_de', 'Detalhamento de fachada (revestimentos, brises, juntas)', 7, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_07', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_de_07', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_as_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_as', 'Visitas mensais à obra, com relatório', 1, 'assess__1');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_01', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_01', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_as_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_as', 'Suporte técnico ao cliente e à construtora (dúvidas, adendos, croquis)', 2, 'assess__2');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_02', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_02', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_as_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_as', 'Suporte técnico nas tratativas com fornecedores', 3, 'assess__3');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_03', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_03', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_03', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_03', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_03', 'srv_am', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_as_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_as', 'Registro e controle das alterações em obra (AL01, AL02…)', 4, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_04', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_04', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_04', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_as_04', 'srv_in', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ab_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ab', 'Desenhos as built de arquitetura', 1, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_01', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_01', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_01', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_01', 'srv_in', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ab_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ab', 'Manual do usuário (uso, manutenção e especificações)', 2, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_02', 'srv_ne', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_02', 'srv_rf', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_02', 'srv_rt', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_02', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_02', 'srv_am', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_ab_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_ab', 'Compilação de garantias e contatos de fornecedores', 3, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_03', 'srv_ne', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_03', 'srv_rf', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_03', 'srv_rt', 'O');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_03', 'srv_in', 'P');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_ab_03', 'srv_am', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cr_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cr', 'Reuniões online de consultoria', 1, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cr_01', 'srv_cr', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cr_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cr', 'Relatório de orientações e recomendações', 2, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cr_02', 'srv_cr', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_cr_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_cr', 'Croquis e referências de apoio', 3, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_cr_03', 'srv_cr', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lr_01', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lr', 'Vistoria técnica no local', 1, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lr_01', 'srv_la', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lr_02', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lr', 'Levantamento cadastral do existente', 2, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lr_02', 'srv_la', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lr_03', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lr', 'Laudo técnico com RRT', 3, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lr_03', 'srv_la', 'P');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lr_04', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lr', 'Peças gráficas para regularização nos órgãos', 4, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lr_04', 'srv_la', 'O');
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, arquivado_em, etapa_id, texto, ordem, ref_vendas) VALUES ('pen_lr_05', '2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00.000Z', 'migracao', 'migracao', 1, NULL, 'pet_lr', 'Protocolo e acompanhamento do processo', 5, NULL);
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia) VALUES ('pen_lr_05', 'srv_la', 'O');
