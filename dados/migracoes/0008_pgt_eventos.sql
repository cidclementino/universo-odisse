-- 0008 — Eventos, sequência da etapa, Encerramento e faixas de prazo (13/11/2026, decisões do Cid;
-- desenho em universo-pgt.md v0.8 e universo-pgt-eventos.md v0.3).
--   * EVENTOS: marcos de controle do fluxo (reuniões, apresentações, envios, aprovações, rodadas de ajuste,
--     visitas, protocolos, revisões internas). Não vão para o contrato como itens; podem ter uma CLÁUSULA,
--     que a pertinência governa na proposta (P = obrigatória, O = opcional, sem marca = não ofertável).
--     Dizem se o cliente participa (base da futura plataforma do cliente) e de quem é o tempo: do estúdio
--     (conta no prazo), do cliente ou de terceiros (aparecem, mas não contam) ou pontual.
--   * 4º estado de pertinência, 'S' = perpétuo (vale sempre, não se desmarca): por ora, só o Encerramento.
--   * ENCERRAMENTO: um evento só, com instâncias nas etapas onde o serviço pode terminar. etapa_id = a
--     instância padrão (fim do PE); no projeto, ativa-se a da última etapa contratada.
--   * SEQUÊNCIA: entregas e eventos dividem a mesma ordem dentro da etapa. Uma entrega com junto_anterior = 1
--     corre ao mesmo tempo que a entrega anterior (cluster): no prazo conta só a mais longa.
--   * Seis entregas que eram eventos saem do pool (arquivadas): PL-08, AS-01, CR-01, PX-01, PX-02, LR-05.
--   * Faixas de prazo por área (estrutura, nas Bases): o vendas multiplica o prazo das entregas pela faixa.

CREATE TABLE pgt_eventos (
  id               TEXT PRIMARY KEY CHECK (id LIKE 'pev\_%' ESCAPE '\'),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL,
  criado_por       TEXT,
  atualizado_por   TEXT,
  versao           INTEGER NOT NULL DEFAULT 1,
  arquivado_em     TEXT,
  etapa_id         TEXT NOT NULL REFERENCES pgt_etapas (id),
  nome             TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('reuniao', 'apresentacao', 'envio', 'aprovacao', 'ajuste', 'visita', 'protocolo', 'revisao', 'encerramento')),
  cliente          INTEGER NOT NULL DEFAULT 0 CHECK (cliente IN (0, 1)),
  tempo            TEXT NOT NULL DEFAULT 'pontual' CHECK (tempo IN ('estudio', 'cliente', 'terceiros', 'pontual')),
  prazo_turnos     REAL CHECK (prazo_turnos IS NULL OR (prazo_turnos > 0 AND prazo_turnos <= 40)),
  quantidade       INTEGER CHECK (quantidade IS NULL OR quantidade BETWEEN 1 AND 99),
  clausula         TEXT,
  observacoes      TEXT,
  ordem            INTEGER NOT NULL DEFAULT 0,
  travado          INTEGER NOT NULL DEFAULT 0 CHECK (travado IN (0, 1)),
  encerramento     INTEGER NOT NULL DEFAULT 0 CHECK (encerramento IN (0, 1)),
  instancias       TEXT                       -- só no Encerramento: JSON com as etapas onde pode ficar
);
CREATE INDEX pgt_eventos_etapa ON pgt_eventos (etapa_id, ordem);
CREATE UNIQUE INDEX pgt_eventos_um_encerramento ON pgt_eventos (encerramento) WHERE encerramento = 1;
CREATE TABLE pgt_eventos_servicos (
  evento_id        TEXT NOT NULL REFERENCES pgt_eventos (id),
  servico_id       TEXT NOT NULL REFERENCES bases_servicos (id),
  pertinencia      TEXT NOT NULL CHECK (pertinencia IN ('P', 'O', 'S')),
  PRIMARY KEY (evento_id, servico_id)
);

ALTER TABLE pgt_entregaveis ADD COLUMN junto_anterior INTEGER NOT NULL DEFAULT 0 CHECK (junto_anterior IN (0, 1));

-- materiais também podem ser de um evento (pev_): a coluna alvo_id já é texto livre.

-- entregas de cada etapa em 10, 20, 30… (sobra lugar para os eventos antes e depois)
UPDATE pgt_entregaveis SET ordem = (
  SELECT 10 * x.n FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY etapa_id ORDER BY ordem, criado_em) AS n FROM pgt_entregaveis) x
  WHERE x.id = pgt_entregaveis.id);

-- seis entregas viram eventos (a promessa fica na cláusula do evento)
UPDATE pgt_entregaveis SET arquivado_em = '2026-11-13T15:00:00.000Z', atualizado_em = '2026-11-13T15:00:00.000Z',
  atualizado_por = 'migracao', versao = versao + 1,
  observacoes = TRIM(COALESCE(observacoes, '') || ' Virou evento em 13/11/2026 (a promessa ficou na cláusula do evento).')
  WHERE id IN ('pen_pl_08', 'pen_as_01', 'pen_cr_01', 'pen_px_01', 'pen_px_02', 'pen_lr_05') AND arquivado_em IS NULL;

-- eventos do rascunho v0.3 (58 por etapa)
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lv_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lv', 'Reunião de início com o cliente', 'reuniao', 1, 'pontual', 1, NULL, NULL, 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m01', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m01', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m01', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lv_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lv', 'Leitura do edital e plano de trabalho', 'revisao', 0, 'estudio', 1, NULL, NULL, 2);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m02', 'srv_co', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lv_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lv', 'Visita técnica ao local', 'visita', 1, 'estudio', 1, 'Visita técnica incluída (deslocamento fora de João Pessoa à parte)', NULL, 3);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_co', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m03', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lv_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lv', 'Recebimento dos documentos do cliente', 'envio', 1, 'cliente', NULL, 'O prazo do Levantamento conta a partir do recebimento dos documentos', NULL, 4);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m04', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m04', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m04', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m04', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m04', 'srv_am', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m04', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lv_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lv', 'Revisão interna do levantamento', 'revisao', 0, 'estudio', 1, NULL, NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_am', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_co', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lv_m05', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pp_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pp', 'Preenchimento do questionário pelo cliente', 'envio', 1, 'cliente', NULL, NULL, NULL, 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m01', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m01', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m01', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m01', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m01', 'srv_ev', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pp_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pp', 'Reunião de briefing', 'reuniao', 1, 'pontual', 1, NULL, NULL, 2);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m02', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m02', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m02', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pp_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pp', 'Apresentação do programa e das diretrizes', 'apresentacao', 1, 'pontual', 1, NULL, NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m03', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m03', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m03', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m03', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m03', 'srv_am', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m03', 'srv_ev', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pp_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pp', 'Validação do programa pelo cliente', 'aprovacao', 1, 'cliente', NULL, 'O programa validado baliza as etapas seguintes; mudanças depois são alteração de escopo', NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m04', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m04', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m04', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m04', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m04', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pp_m04', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ev_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ev', 'Revisão interna do estudo', 'revisao', 0, 'estudio', 1, NULL, NULL, 900);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m01', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m01', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m01', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m01', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ev_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ev', 'Apresentação do relatório de viabilidade', 'apresentacao', 1, 'pontual', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m02', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m02', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m02', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m02', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ev_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ev', 'Decisão do cliente (seguir, ajustar, parar)', 'aprovacao', 1, 'cliente', NULL, 'Abatimento do valor do Estudo de Viabilidade se o cliente contratar o projeto (a decidir)', NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m03', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m03', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m03', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ev_m03', 'srv_ev', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ce_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ce', 'Revisão interna do partido', 'revisao', 0, 'estudio', 1, NULL, NULL, 900);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m01', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m01', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m01', 'srv_co', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ce_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ce', 'Apresentação da Concepção Esquemática', 'apresentacao', 1, 'pontual', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m02', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m02', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ce_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ce', 'Rodada de ajuste', 'ajuste', 1, 'estudio', 1, 'Inclui uma rodada de ajuste', NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m03', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m03', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m03', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m03', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m03', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ce_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ce', 'Segunda rodada de ajuste', 'ajuste', 1, 'estudio', 1, 'Dupla rodada de ajuste', NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m04', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m04', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m04', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m04', 'srv_in', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m04', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ce_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ce', 'Aprovação da Concepção Esquemática', 'aprovacao', 1, 'cliente', NULL, 'A Concepção Básica começa depois da aprovação formal da Concepção Esquemática', NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m05', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m05', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m05', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m05', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ce_m05', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Reunião de materialidade (acabamentos, amostras, showroom)', 'reuniao', 1, 'pontual', 1, 'Acompanhamento em showroom (até N visitas)', NULL, 900);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m01', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m01', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m01', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m01', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Reunião de pré-lançamento com complementares', 'reuniao', 0, 'pontual', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m02', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Revisão interna da Concepção Básica', 'revisao', 0, 'estudio', 1, NULL, NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m03', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m03', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m03', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m03', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m03', 'srv_am', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m03', 'srv_co', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Apresentação da Concepção Básica', 'apresentacao', 1, 'pontual', 1, NULL, NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m04', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m04', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m04', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m04', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m04', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Rodada de ajuste', 'ajuste', 1, 'estudio', 1, 'Inclui uma rodada de ajuste', NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m05', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m05', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m05', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m05', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m05', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m06', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Segunda rodada de ajuste', 'ajuste', 1, 'estudio', 1, 'Dupla rodada de ajuste', NULL, 905);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m06', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m06', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m06', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m06', 'srv_in', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m06', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m07', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Aprovação da Concepção Básica', 'aprovacao', 1, 'cliente', NULL, 'A aprovação da Concepção Básica fecha a fase Conceitual', NULL, 906);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m07', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m07', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m07', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m07', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m07', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m08', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Submissão ao concurso', 'protocolo', 0, 'pontual', 1, NULL, NULL, 907);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m08', 'srv_co', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cb_m09', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cb', 'Resultado do concurso', 'aprovacao', 0, 'terceiros', NULL, NULL, NULL, 908);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cb_m09', 'srv_co', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pl_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pl', 'Revisão interna das peças legais', 'revisao', 0, 'estudio', 1, NULL, NULL, 900);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m01', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m01', 'srv_in', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pl_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pl', 'Assinaturas e documentos do cliente (procuração, escritura, RRT)', 'envio', 1, 'cliente', NULL, 'O prazo do Projeto Legal depende da entrega dos documentos pelo cliente', NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m02', 'srv_in', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pl_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pl', 'Protocolo no condomínio', 'protocolo', 0, 'terceiros', 1, 'Aprovação no condomínio incluída', NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m03', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m03', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m03', 'srv_in', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pl_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pl', 'Protocolo nos órgãos', 'protocolo', 0, 'terceiros', 1, 'Protocolo e acompanhamento da aprovação nos órgãos incluídos', 'Antiga entrega PL-08.', 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m04', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m04', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m04', 'srv_rt', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pl_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pl', 'Atendimento de exigências', 'ajuste', 0, 'estudio', 2, 'Inclui até N atendimentos de exigências', NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m05', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m05', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m05', 'srv_rt', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pl_m06', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pl', 'Aprovação / alvará', 'aprovacao', 1, 'terceiros', NULL, 'O tempo de análise dos órgãos não conta no prazo do estúdio', NULL, 905);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m06', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m06', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pl_m06', 'srv_rt', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_px_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_px', 'Reunião de início com complementares', 'reuniao', 0, 'pontual', 1, NULL, NULL, 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m01', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_px_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_px', 'Reunião de coordenação e compatibilização com complementares', 'reuniao', 0, 'pontual', 3, 'Inclui até N reuniões de coordenação e compatibilização com os projetistas complementares', 'Antiga entrega PX-01.', 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m02', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_px_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_px', 'Reunião de coordenação com fornecedores e marcenaria', 'reuniao', 0, 'pontual', 2, 'Inclui até N reuniões de coordenação com fornecedores e marcenaria', 'Antiga entrega PX-02.', 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m03', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m03', 'srv_in', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_px_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_px', 'Recebimento dos projetos complementares', 'envio', 0, 'terceiros', NULL, 'O prazo do Pré-Executivo depende da entrega dos projetos complementares', NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m04', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m04', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m04', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m04', 'srv_in', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_px_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_px', 'Apresentação do pré-executivo ao cliente', 'apresentacao', 1, 'pontual', 1, NULL, NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m05', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m05', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m05', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_px_m05', 'srv_in', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pe_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pe', 'Validação final de especificações com o cliente', 'reuniao', 1, 'pontual', 1, NULL, NULL, 900);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m01', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m01', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m01', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m01', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pe_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pe', 'Revisão interna (checklist de executivo)', 'revisao', 0, 'estudio', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m02', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m02', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pe_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pe', 'Apresentação do Projeto Executivo', 'apresentacao', 1, 'pontual', 1, NULL, NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m03', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m03', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m03', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m03', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m03', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pe_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pe', 'Rodada de ajuste', 'ajuste', 1, 'estudio', 1, 'Inclui uma rodada de ajuste', NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m04', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m04', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m04', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m04', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m04', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_pe_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pe', 'Aprovação do Projeto Executivo', 'aprovacao', 1, 'cliente', NULL, NULL, NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m05', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m05', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m05', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m05', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_pe_m05', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_de_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_de', 'Revisão interna do detalhamento', 'revisao', 0, 'estudio', 1, NULL, NULL, 900);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m01', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m01', 'srv_in', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_de_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_de', 'Emissão para obra (pacote completo)', 'envio', 1, 'pontual', 1, 'A emissão para obra fecha a fase Executiva', NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_de_m02', 'srv_in', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_as_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_as', 'Reunião de início de obra com a construtora', 'reuniao', 1, 'pontual', 1, NULL, NULL, 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m01', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m01', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_as_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_as', 'Visita à obra, com relatório', 'visita', 1, 'estudio', NULL, 'Visitas mensais à obra, com relatório, durante N meses', 'Uma por mês de obra. Antiga entrega AS-01.', 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m02', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m02', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_as_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_as', 'Visita extra de frequência quinzenal', 'visita', 1, 'estudio', NULL, 'Visitas quinzenais à obra', 'Uma a mais por mês de obra.', 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m03', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m03', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m03', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m03', 'srv_in', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m03', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_as_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_as', 'Reunião com fornecedores', 'reuniao', 0, 'pontual', NULL, NULL, NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m04', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m04', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m04', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m04', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m04', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_as_m05', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_as', 'Vistoria de conclusão da obra', 'visita', 1, 'estudio', 1, NULL, NULL, 904);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m05', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m05', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m05', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m05', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_as_m05', 'srv_am', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ab_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ab', 'Vistoria de levantamento do construído', 'visita', 0, 'estudio', 1, NULL, NULL, 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m01', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m01', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m01', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m01', 'srv_in', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ab_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ab', 'Entrega do as built e do manual', 'envio', 1, 'pontual', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m02', 'srv_ne', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m02', 'srv_rf', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m02', 'srv_rt', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m02', 'srv_in', 'P');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m02', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_ab_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_ab', 'Visita pós-ocupação (6 a 12 meses)', 'visita', 1, 'pontual', 1, 'Visita pós-ocupação incluída', NULL, 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m03', 'srv_ne', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m03', 'srv_rf', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m03', 'srv_rt', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m03', 'srv_in', 'O');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_ab_m03', 'srv_am', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cr_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cr', 'Reunião online de consultoria', 'reuniao', 1, 'pontual', NULL, 'Inclui N reuniões online de até X minutos', 'Antiga entrega CR-01.', 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cr_m01', 'srv_cr', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_cr_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_cr', 'Envio do relatório de orientações', 'envio', 1, 'pontual', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_cr_m02', 'srv_cr', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lr_m01', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lr', 'Vistoria técnica', 'visita', 1, 'estudio', 1, NULL, NULL, 1);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lr_m01', 'srv_la', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lr_m02', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lr', 'Envio do laudo', 'envio', 1, 'pontual', 1, NULL, NULL, 901);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lr_m02', 'srv_la', 'P');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lr_m03', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lr', 'Protocolo e acompanhamento nos órgãos', 'protocolo', 0, 'terceiros', 1, 'Protocolo e acompanhamento nos órgãos incluídos', 'Antiga entrega LR-05.', 902);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lr_m03', 'srv_la', 'O');
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, quantidade, clausula, observacoes, ordem) VALUES ('pev_lr_m04', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_lr', 'Atendimento de exigências', 'ajuste', 0, 'estudio', 2, 'Inclui até N atendimentos de exigências', NULL, 903);
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia) VALUES ('pev_lr_m04', 'srv_la', 'O');

-- Encerramento: um cartão, várias instâncias; perpétuo em todos os serviços
INSERT INTO pgt_eventos (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, etapa_id, nome, tipo, cliente, tempo, ordem, encerramento, instancias, observacoes)
  VALUES ('pev_encerramento', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pet_pe',
  'Encerramento do serviço', 'encerramento', 1, 'pontual', 9999, 1,
  '["pet_cb","pet_pl","pet_pe","pet_de","pet_as","pet_ab","pet_ev","pet_cr","pet_lr"]',
  'Fica na última etapa contratada (padrão: fim do Projeto Executivo). Em Concurso, é interno.');
INSERT INTO pgt_eventos_servicos (evento_id, servico_id, pertinencia)
  SELECT 'pev_encerramento', id, 'S' FROM bases_servicos WHERE arquivado_em IS NULL;
INSERT INTO pgt_materiais (id, criado_em, atualizado_em, criado_por, atualizado_por, versao, alvo_id, tipo, nome, ordem) VALUES
  ('pma_enc_termo', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pev_encerramento', 'modelo', 'Termo de encerramento do serviço', 1),
  ('pma_enc_pesquisa', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pev_encerramento', 'formulario', 'Pesquisa de satisfação', 2),
  ('pma_enc_imagens', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pev_encerramento', 'modelo', 'Autorização de uso de imagens do projeto no portfólio', 3),
  ('pma_enc_arquivo', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pev_encerramento', 'checklist', 'Arquivamento do projeto no Drive', 4),
  ('pma_enc_depoimento', '2026-11-13T15:00:00.000Z', '2026-11-13T15:00:00.000Z', 'migracao', 'migracao', 1, 'pev_encerramento', 'modelo', 'Pedido de depoimento', 5);

-- faixas de prazo por área (valores provisórios, a calibrar): até X m² → multiplicador; a última sem teto
INSERT INTO bases_parametros (chave, valor, rotulo, atualizado_em, atualizado_por) VALUES ('faixas_prazo',
  '[{"ate":150,"mult":1},{"ate":300,"mult":1.25},{"ate":600,"mult":1.5},{"ate":1200,"mult":1.9},{"ate":null,"mult":2.4}]',
  'Faixas de prazo por área', '2026-11-13T15:00:00.000Z', 'migracao')
  ON CONFLICT (chave) DO NOTHING;
