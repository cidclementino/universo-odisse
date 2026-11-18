-- 0011 — Equipe como cadastro comum do Universo (18/11/2026, decisões do Cid; desenho em universo-equipe.md).
--   * A equipe sai da ferramenta Projetos e passa a ter página própria no hub (item próprio da barra,
--     separado da Marca). Todas as ferramentas leem dela: seletor de quem assina (propostas, contratos,
--     documentos, RRT), banco de horas, responsáveis, site e créditos do marketing.
--   * Sócio / não sócio é um estado (`socio`) separado do cargo. O cargo e o título profissional vêm de
--     listas editáveis (`cargos`, `titulos`), cada item com forma masculina, feminina e inglesa; o
--     `tratamento` (m/f) da pessoa escolhe a forma ("Coordenadora executiva", "Arquiteta e urbanista").
--   * `papel` (0001) continua só para quem ainda o lê (Projetos); a API o mantém em dia a partir de
--     `socio` e do cargo. Sai quando nenhuma ferramenta usar.
--   * Assinatura manuscrita: PNG no R2 privado, apontado por `assinatura_id`. O arquivo é marcado
--     `protegido` e não sai pela rota comum de arquivos: só por equipe/:id/assinatura, com o uso
--     registrado no histórico. Na prévia dos documentos aparece só a caixa do lugar dela.
--   * Cid e Nathalia entram (ou são completados, se já estavam na equipe) com cargo, bio e "aparece no
--     site" vindos do site (odisse.com.br › Sobre › Equipe). O registro no CAU fica para eles preencherem;
--     por isso o RRT ainda não entra no que assinam (exige registro).

-- ---------------------------------------------------------------- listas
CREATE TABLE cargos (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'crg\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  nome_m         TEXT NOT NULL,
  nome_f         TEXT NOT NULL,
  nome_en        TEXT,
  ordem          INTEGER
);
CREATE UNIQUE INDEX cargos_nome ON cargos (nome_m) WHERE arquivado_em IS NULL;

CREATE TABLE titulos (
  id             TEXT PRIMARY KEY CHECK (id LIKE 'tit\_%' ESCAPE '\'),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  criado_por     TEXT,
  atualizado_por TEXT,
  versao         INTEGER NOT NULL DEFAULT 1,
  arquivado_em   TEXT,
  nome_m         TEXT NOT NULL,
  nome_f         TEXT NOT NULL,
  nome_en        TEXT,
  ordem          INTEGER
);
CREATE UNIQUE INDEX titulos_nome ON titulos (nome_m) WHERE arquivado_em IS NULL;

INSERT INTO cargos (id, criado_em, atualizado_em, criado_por, atualizado_por, nome_m, nome_f, nome_en, ordem) VALUES
  ('crg_coord_criativo',  '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Coordenador criativo',  'Coordenadora criativa',  'Creative Director',  10),
  ('crg_coord_executivo', '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Coordenador executivo', 'Coordenadora executiva', 'Executive Director', 20),
  ('crg_arquiteto',       '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Arquiteto',             'Arquiteta',              'Architect',          30),
  ('crg_estagiario',      '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Estagiário',            'Estagiária',             'Intern',             40),
  ('crg_colaborador',     '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Colaborador',           'Colaboradora',           'Collaborator',       50);

INSERT INTO titulos (id, criado_em, atualizado_em, criado_por, atualizado_por, nome_m, nome_f, nome_en, ordem) VALUES
  ('tit_arq_urb',   '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Arquiteto e urbanista',    'Arquiteta e urbanista',    'Architect and urban planner', 10),
  ('tit_designer',  '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Designer',                 'Designer',                 'Designer',                    20),
  ('tit_estudante', '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', 'Estudante de arquitetura', 'Estudante de arquitetura', 'Architecture student',        30);

-- ---------------------------------------------------------------- equipe: campos novos
ALTER TABLE equipe ADD COLUMN socio INTEGER NOT NULL DEFAULT 0 CHECK (socio IN (0, 1));
ALTER TABLE equipe ADD COLUMN tratamento TEXT CHECK (tratamento IN ('m', 'f'));
ALTER TABLE equipe ADD COLUMN cargo_id TEXT REFERENCES cargos (id);
ALTER TABLE equipe ADD COLUMN titulo_id TEXT REFERENCES titulos (id);
ALTER TABLE equipe ADD COLUMN nome_assinatura TEXT;
ALTER TABLE equipe ADD COLUMN conselho TEXT CHECK (conselho IN ('cau', 'crea', 'abd'));
ALTER TABLE equipe ADD COLUMN registro TEXT;
ALTER TABLE equipe ADD COLUMN foto_id TEXT REFERENCES arquivos (id);
ALTER TABLE equipe ADD COLUMN assinatura_id TEXT REFERENCES arquivos (id);
ALTER TABLE equipe ADD COLUMN assina TEXT;            -- lista separada por vírgula: proposta,contrato,documento,rrt
ALTER TABLE equipe ADD COLUMN bio_pt TEXT;
ALTER TABLE equipe ADD COLUMN bio_en TEXT;
ALTER TABLE equipe ADD COLUMN publico INTEGER NOT NULL DEFAULT 0 CHECK (publico IN (0, 1));
ALTER TABLE equipe ADD COLUMN ordem INTEGER;
ALTER TABLE equipe ADD COLUMN desde TEXT;
ALTER TABLE equipe ADD COLUMN ate TEXT;
CREATE INDEX equipe_cargo ON equipe (cargo_id);
CREATE INDEX equipe_titulo ON equipe (titulo_id);

-- arquivo cujo conteúdo só sai por rota própria (assinaturas manuscritas)
ALTER TABLE arquivos ADD COLUMN protegido INTEGER NOT NULL DEFAULT 0 CHECK (protegido IN (0, 1));

-- quem já estava: sócio pelo papel antigo; cargo equivalente para os outros papéis
UPDATE equipe SET socio = CASE WHEN papel = 'socio' THEN 1 ELSE 0 END,
  cargo_id = CASE papel WHEN 'arquiteto' THEN 'crg_arquiteto' WHEN 'estagiario' THEN 'crg_estagiario'
                        WHEN 'colaborador' THEN 'crg_colaborador' ELSE NULL END,
  assina = CASE WHEN papel = 'estagiario' THEN NULL ELSE 'documento' END;

-- ---------------------------------------------------------------- Cid e Nathalia (dados do site)
-- Acha a pessoa: primeiro quem já está na equipe com o nome começando assim; depois o contato com o
-- nome completo; se não houver, cria a pessoa.
CREATE TABLE _mig_0011 (
  chave      TEXT PRIMARY KEY,
  pessoa_id  TEXT,
  nome       TEXT NOT NULL,
  normal     TEXT NOT NULL,
  tratamento TEXT NOT NULL,
  cargo_id   TEXT NOT NULL,
  bio_pt     TEXT NOT NULL,
  ordem      INTEGER NOT NULL
);
INSERT INTO _mig_0011 (chave, nome, normal, tratamento, cargo_id, bio_pt, ordem) VALUES
  ('cid', 'Cid Clementino', 'cid clementino', 'm', 'crg_coord_criativo',
   'Formado em Arquitetura e Urbanismo pela UFPB, Cid conduz a direção criativa do Odisse, atravessando arquitetura, design de objetos e a produção editorial da Elaia. Sua atuação une rigor técnico à investigação de linguagens visuais, moldando a identidade do estúdio em todas as frentes em que ele se manifesta.',
   1),
  ('nathalia', 'Nathalia Linhares', 'nathalia linhares', 'f', 'crg_coord_executivo',
   'Formada em Arquitetura e Urbanismo pela UFPB, Nathalia lidera a coordenação executiva do Odisse, conduzindo projetos do conceito à obra com atenção rigorosa a prazos, processos e à experiência do cliente em cada etapa.',
   2);

UPDATE _mig_0011 SET pessoa_id = COALESCE(
  (SELECT p.id FROM equipe e JOIN pessoas p ON p.id = e.pessoa_id
     WHERE e.arquivado_em IS NULL AND lower(trim(p.nome)) LIKE _mig_0011.chave || '%' ORDER BY e.criado_em LIMIT 1),
  (SELECT p.id FROM pessoas p WHERE p.arquivado_em IS NULL AND lower(trim(p.nome)) = _mig_0011.normal ORDER BY p.criado_em LIMIT 1));

INSERT INTO pessoas (id, criado_em, atualizado_em, criado_por, atualizado_por, nome)
  SELECT 'pes_' || chave, '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', nome
  FROM _mig_0011 WHERE pessoa_id IS NULL;
INSERT INTO busca (registro_id, tabela, titulo, chave, texto, atualizado_em)
  SELECT 'pes_' || chave, 'pessoas', nome, normal, normal, '2026-11-18T15:00:00.000Z' FROM _mig_0011 WHERE pessoa_id IS NULL;
INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
  SELECT 'pes_' || chave, 'pessoas', 'criar', 'migracao', '2026-11-18T15:00:00.000Z', json_object('nome', nome)
  FROM _mig_0011 WHERE pessoa_id IS NULL;
UPDATE _mig_0011 SET pessoa_id = 'pes_' || chave WHERE pessoa_id IS NULL;

INSERT INTO equipe (id, criado_em, atualizado_em, criado_por, atualizado_por, pessoa_id, papel, ativo)
  SELECT 'eqp_' || m.chave, '2026-11-18T15:00:00.000Z', '2026-11-18T15:00:00.000Z', 'migracao', 'migracao', m.pessoa_id, 'socio', 1
  FROM _mig_0011 m WHERE NOT EXISTS (SELECT 1 FROM equipe e WHERE e.pessoa_id = m.pessoa_id AND e.arquivado_em IS NULL);

UPDATE equipe SET
  papel = 'socio', socio = 1, ativo = 1,
  tratamento = (SELECT tratamento FROM _mig_0011 m WHERE m.pessoa_id = equipe.pessoa_id),
  cargo_id = (SELECT cargo_id FROM _mig_0011 m WHERE m.pessoa_id = equipe.pessoa_id),
  titulo_id = 'tit_arq_urb',
  nome_assinatura = (SELECT nome FROM _mig_0011 m WHERE m.pessoa_id = equipe.pessoa_id),
  conselho = 'cau',
  assina = 'proposta,contrato,documento',
  bio_pt = (SELECT bio_pt FROM _mig_0011 m WHERE m.pessoa_id = equipe.pessoa_id),
  publico = 1,
  ordem = (SELECT ordem FROM _mig_0011 m WHERE m.pessoa_id = equipe.pessoa_id),
  versao = versao + 1,
  atualizado_em = '2026-11-18T15:00:00.000Z',
  atualizado_por = 'migracao'
WHERE arquivado_em IS NULL AND pessoa_id IN (SELECT pessoa_id FROM _mig_0011);

INSERT INTO historico (registro_id, tabela, acao, por, em, mudancas)
  SELECT id, 'equipe', 'alterar', 'migracao', '2026-11-18T15:00:00.000Z',
    json_object('origem', '0011: socio, cargo, titulo, assina' || CASE WHEN publico = 1 THEN ', bio do site' ELSE '' END)
  FROM equipe WHERE arquivado_em IS NULL;

DROP TABLE _mig_0011;
