-- Universo — migração 0022: serviços em fluxo e serviços em ilha; IC por serviço × categoria (Cid, 20/11/2026).
--
-- O PGT passa a ser organizado pelos SERVIÇOS (página Serviços do projetos.odisse, que absorve as Bases):
--   * cada serviço é EM FLUXO (entra no plano comum das fases encadeadas; marca-se P/O/— em cada cartão) ou
--     EM ILHA (tem o seu próprio plano, com cartões só dele). `dinamica` substitui o "pede tipologia":
--     serviço em fluxo pede tipologia, serviço em ilha não (pede_tipologia continua sincronizado, para leitura antiga);
--   * a etapa de uma ilha pertence ao serviço (`pgt_etapas.servico_id`); as do fluxo não têm dono;
--   * trocar a dinâmica não apaga nada: as marcações do fluxo e os cartões da ilha ficam guardados e só
--     valem (nos retratos e nas telas) enquanto o serviço estiver na dinâmica deles;
--   * índice de complexidade: cada serviço tem um padrão (`ic_padrao`; nasce no ponto médio). Em fluxo, cada
--     categoria da tipologia pode ter o seu (`bases_ic`), que passa por cima do padrão; sem valor próprio,
--     vale o padrão. Em ilha, vale só o padrão. Não há média entre serviços.
--   * ic_preset (categoria) e ic_ajustes (serviço) ficam guardados, sem uso.
--
-- Primeiro dia (opção a do Cid): cada par serviço em fluxo × categoria nasce com o valor de hoje
-- (preset da categoria + ajustes do serviço), para nenhum preço mudar. As ilhas de hoje (CR, LA) nascem com
-- o padrão = ponto médio + os ajustes que já tinham.
--
-- Também (Cid, 20/11): o serviço EV vira CONSULTORIA DE VIABILIDADE (sigla CV), em ilha, começando com a
-- cópia dos cartões da etapa EV (a etapa EV continua no fluxo para os outros serviços); e sete serviços em
-- ilha novos, vindos do Catálogo de serviços, nascem vazios (uma etapa cada) e sem preço calculado.

ALTER TABLE bases_servicos ADD COLUMN dinamica TEXT NOT NULL DEFAULT 'fluxo' CHECK (dinamica IN ('fluxo', 'ilha'));
ALTER TABLE bases_servicos ADD COLUMN ic_padrao TEXT;          -- JSON { criterio: 'baixo'|'medio'|'alto' }
ALTER TABLE pgt_etapas ADD COLUMN servico_id TEXT REFERENCES bases_servicos (id);   -- dono (etapas de ilha)
CREATE INDEX pgt_etapas_servico ON pgt_etapas (servico_id) WHERE servico_id IS NOT NULL;

CREATE TABLE bases_ic (
  servico_id       TEXT NOT NULL REFERENCES bases_servicos (id),
  categoria_id     TEXT NOT NULL REFERENCES bases_categorias (id),
  ic               TEXT NOT NULL,                              -- JSON { criterio: nível }
  atualizado_em    TEXT NOT NULL,
  atualizado_por   TEXT,
  PRIMARY KEY (servico_id, categoria_id)
);
CREATE INDEX bases_ic_categoria ON bases_ic (categoria_id);

-- ----------------------------------------------------------------- padrão e pares
UPDATE bases_servicos SET ic_padrao = '{"qtd_especialistas":"medio","qtd_aprovacoes":"medio","grau_resp_civil":"medio","grau_intervencao_cliente":"medio","expectativa_plastica":"medio","grau_controle_custo":"medio","indefinicao_escopo":"medio","indefinicao_prazo":"medio","demanda_midia":"medio"}';

-- serviço que não pedia tipologia já era o serviço de ilha
UPDATE bases_servicos SET dinamica = 'ilha' WHERE pede_tipologia = 0;
UPDATE bases_servicos SET ic_padrao = json_patch(ic_padrao, COALESCE(NULLIF(ic_ajustes, ''), '{}')) WHERE dinamica = 'ilha';

-- cada serviço em fluxo × cada categoria: o valor de hoje (inclui o EV, que vira ilha logo abaixo: fica guardado)
INSERT INTO bases_ic (servico_id, categoria_id, ic, atualizado_em, atualizado_por)
  SELECT s.id, c.id, json_patch(COALESCE(NULLIF(c.ic_preset, ''), '{}'), COALESCE(NULLIF(s.ic_ajustes, ''), '{}')), '2026-11-20T18:00:00.000Z', 'migracao'
  FROM bases_servicos s CROSS JOIN bases_categorias c
  WHERE s.dinamica = 'fluxo' AND s.arquivado_em IS NULL AND c.arquivado_em IS NULL;

-- etapas das ilhas de hoje pertencem aos seus serviços
UPDATE pgt_etapas SET servico_id = 'srv_cr' WHERE id = 'pet_cr' AND EXISTS (SELECT 1 FROM bases_servicos WHERE id = 'srv_cr');
UPDATE pgt_etapas SET servico_id = 'srv_la' WHERE id = 'pet_lr' AND EXISTS (SELECT 1 FROM bases_servicos WHERE id = 'srv_la');

-- ----------------------------------------------------------------- EV → CV (Consultoria de viabilidade), em ilha
UPDATE bases_servicos SET sigla = 'CV', nome = 'Consultoria de viabilidade', dinamica = 'ilha', pede_tipologia = 0,
  ic_padrao = json_patch(ic_padrao, COALESCE(NULLIF(ic_ajustes, ''), '{}')),
  versao = versao + 1, atualizado_em = '2026-11-20T18:00:00.000Z', atualizado_por = 'migracao'
  WHERE id = 'srv_ev';

INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, fase_id, sigla, nome, ordem, descricao, servico_id)
  SELECT 'pet_cv', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'pfa_ilhas', 'CV', 'Consultoria de viabilidade',
    (SELECT COALESCE(MAX(ordem), 0) + 1 FROM pgt_etapas), descricao, 'srv_ev'
  FROM pgt_etapas WHERE id = 'pet_ev';

-- cópia das entregas da etapa EV (ids novos: pen_ev_01 → pen_cv_01; os demais ganham cv_ à frente)
INSERT INTO pgt_entregaveis (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, texto, ordem, observacoes, prazo_turnos, pessoas, prazo_fixo, travado, junto_anterior)
  SELECT CASE WHEN id LIKE 'pen\_ev\_%' ESCAPE '\' THEN 'pen_cv_' || substr(id, 8) ELSE 'pen_cv_' || substr(id, 5) END,
    '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cv', texto, ordem, observacoes, prazo_turnos, pessoas, prazo_fixo, 0, junto_anterior
  FROM pgt_entregaveis WHERE etapa_id = 'pet_ev' AND arquivado_em IS NULL AND EXISTS (SELECT 1 FROM pgt_etapas WHERE id = 'pet_cv');
INSERT INTO pgt_entregaveis_servicos (entregavel_id, servico_id, pertinencia)
  SELECT CASE WHEN e.id LIKE 'pen\_ev\_%' ESCAPE '\' THEN 'pen_cv_' || substr(e.id, 8) ELSE 'pen_cv_' || substr(e.id, 5) END, 'srv_ev',
    COALESCE((SELECT x.pertinencia FROM pgt_entregaveis_servicos x WHERE x.entregavel_id = e.id AND x.servico_id = 'srv_ev'), 'O')
  FROM pgt_entregaveis e WHERE e.etapa_id = 'pet_ev' AND e.arquivado_em IS NULL AND EXISTS (SELECT 1 FROM pgt_etapas WHERE id = 'pet_cv');
INSERT INTO pgt_entregaveis_categorias (entregavel_id, categoria_id)
  SELECT CASE WHEN e.id LIKE 'pen\_ev\_%' ESCAPE '\' THEN 'pen_cv_' || substr(e.id, 8) ELSE 'pen_cv_' || substr(e.id, 5) END, x.categoria_id
  FROM pgt_entregaveis e JOIN pgt_entregaveis_categorias x ON x.entregavel_id = e.id
  WHERE e.etapa_id = 'pet_ev' AND e.arquivado_em IS NULL AND EXISTS (SELECT 1 FROM pgt_etapas WHERE id = 'pet_cv');

-- cópia dos eventos (sem o Encerramento); a decisão aponta para as cópias
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, prazo_turnos, quantidade,
    clausula, observacoes, ordem, travado, encerramento, instancias, decisao, terceiros, clausula_marcada)
  SELECT CASE WHEN id LIKE 'pev\_ev\_%' ESCAPE '\' THEN 'pev_cv_' || substr(id, 8) ELSE 'pev_cv_' || substr(id, 5) END,
    '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cv', nome, tipo, cliente, tempo, prazo_turnos, quantidade,
    clausula, observacoes, ordem, 0, 0, NULL,
    CASE WHEN decisao IS NULL THEN NULL ELSE replace(replace(decisao, '"pen_ev_', '"pen_cv_'), '"pev_ev_', '"pev_cv_') END,
    terceiros, clausula_marcada
  FROM pgt_eventos WHERE etapa_id = 'pet_ev' AND arquivado_em IS NULL AND encerramento = 0 AND EXISTS (SELECT 1 FROM pgt_etapas WHERE id = 'pet_cv');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
  SELECT CASE WHEN v.id LIKE 'pev\_ev\_%' ESCAPE '\' THEN 'pev_cv_' || substr(v.id, 8) ELSE 'pev_cv_' || substr(v.id, 5) END, 'srv_ev',
    COALESCE((SELECT x.pertinencia FROM pgt_eventos_servicos x WHERE x.evento_id = v.id AND x.servico_id = 'srv_ev'), 'O')
  FROM pgt_eventos v WHERE v.etapa_id = 'pet_ev' AND v.arquivado_em IS NULL AND v.encerramento = 0 AND EXISTS (SELECT 1 FROM pgt_etapas WHERE id = 'pet_cv');

-- cópia dos materiais da etapa e dos seus cartões
INSERT INTO pgt_materiais (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, alvo_id, tipo, nome, descricao, link, arquivo_id, ordem)
  SELECT 'pma_cv_' || substr(m.id, 5), '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1,
    CASE WHEN m.alvo_id = 'pet_ev' THEN 'pet_cv'
         WHEN m.alvo_id LIKE 'pen\_ev\_%' ESCAPE '\' THEN 'pen_cv_' || substr(m.alvo_id, 8)
         WHEN m.alvo_id LIKE 'pev\_ev\_%' ESCAPE '\' THEN 'pev_cv_' || substr(m.alvo_id, 8)
         ELSE substr(m.alvo_id, 1, 4) || 'cv_' || substr(m.alvo_id, 5) END,
    m.tipo, m.nome, m.descricao, m.link, m.arquivo_id, m.ordem
  FROM pgt_materiais m
  WHERE m.arquivado_em IS NULL AND EXISTS (SELECT 1 FROM pgt_etapas WHERE id = 'pet_cv') AND (m.alvo_id = 'pet_ev'
    OR m.alvo_id IN (SELECT id FROM pgt_entregaveis WHERE etapa_id = 'pet_ev' AND arquivado_em IS NULL)
    OR m.alvo_id IN (SELECT id FROM pgt_eventos WHERE etapa_id = 'pet_ev' AND arquivado_em IS NULL AND encerramento = 0));

-- ----------------------------------------------------------------- sete serviços em ilha novos (Catálogo de serviços)
INSERT INTO bases_servicos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, sigla, nome, descricao, ordem, modificador,
    pede_tipologia, com_preco, preco_por_etapa, ic_ajustes, dinamica, ic_padrao) VALUES
  ('srv_po', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'PO', 'Planejador da obra',
    'Ferramenta gratuita do trilho do cliente final: perguntas sobre a obra e um plano em PDF (custo em faixa, linha do tempo, riscos, próximo passo).', 20, NULL, 0, 0, 0, '{}', 'ilha', NULL),
  ('srv_sp', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'SP', 'Sessão de projeto',
    'Sessão de orientação de projeto, com folha de orientações depois; preço fixo, abatido do projeto.', 21, NULL, 0, 0, 0, '{}', 'ilha', NULL),
  ('srv_av', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'AV', 'Avaliação antes de comprar',
    'Visita ao imóvel e relatório sobre o que dá para mudar, o custo da reforma e o veredito antes da compra.', 22, NULL, 0, 0, 0, '{}', 'ilha', NULL),
  ('srv_ft', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'FT', 'Ficha do terreno',
    'Ficha do potencial de um terreno para corretores.', 23, NULL, 0, 0, 0, '{}', 'ilha', NULL),
  ('srv_do', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'DO', 'Dossiê para construtoras',
    'Dossiê de apresentação do estúdio para construtoras e incorporadoras.', 24, NULL, 0, 0, 0, '{}', 'ilha', NULL),
  ('srv_pu', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'PU', 'Personalização de unidades',
    'Personalização das unidades de um empreendimento para os compradores, em contrato com a construtora.', 25, NULL, 0, 0, 0, '{}', 'ilha', NULL),
  ('srv_cc', '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'CC', 'Consultoria em design computacional',
    'Consultoria para outros escritórios em design computacional e geometria complexa.', 26, NULL, 0, 0, 0, '{}', 'ilha', NULL);
UPDATE bases_servicos SET ic_padrao = '{"qtd_especialistas":"medio","qtd_aprovacoes":"medio","grau_resp_civil":"medio","grau_intervencao_cliente":"medio","expectativa_plastica":"medio","grau_controle_custo":"medio","indefinicao_escopo":"medio","indefinicao_prazo":"medio","demanda_midia":"medio"}'
  WHERE id IN ('srv_po', 'srv_sp', 'srv_av', 'srv_ft', 'srv_do', 'srv_pu', 'srv_cc');

-- uma etapa vazia para cada ilha nova (a sigla da etapa é a do serviço)
INSERT INTO pgt_etapas (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, fase_id, sigla, nome, ordem, servico_id)
  SELECT 'pet_' || lower(s.sigla), '2026-11-20T18:00:00.000Z', '2026-11-20T18:00:00.000Z', 'migracao', 'migracao', 1, 'pfa_ilhas', s.sigla, s.nome,
    (SELECT COALESCE(MAX(ordem), 0) FROM pgt_etapas) + s.ordem, s.id
  FROM bases_servicos s WHERE s.id IN ('srv_po', 'srv_sp', 'srv_av', 'srv_ft', 'srv_do', 'srv_pu', 'srv_cc');

-- Encerramento: perpétuo nos serviços novos; instâncias também no fim das etapas das ilhas novas
INSERT OR IGNORE INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
  SELECT v.id, s.id, 'S' FROM pgt_eventos v CROSS JOIN bases_servicos s
  WHERE v.encerramento = 1 AND s.id IN ('srv_po', 'srv_sp', 'srv_av', 'srv_ft', 'srv_do', 'srv_pu', 'srv_cc');
UPDATE pgt_eventos SET instancias = (
    SELECT json_group_array(value) FROM (
      SELECT value FROM json_each(pgt_eventos.instancias)
      UNION ALL SELECT id FROM pgt_etapas WHERE id IN ('pet_cv', 'pet_po', 'pet_sp', 'pet_av', 'pet_ft', 'pet_do', 'pet_pu', 'pet_cc')
        AND id NOT IN (SELECT value FROM json_each(pgt_eventos.instancias))))
  WHERE encerramento = 1;
