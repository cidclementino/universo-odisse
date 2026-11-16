-- 0009 — Eventos de decisão e participação de terceiros (16/11/2026, decisões do Cid; desenho em
-- universo-visualizacao-nos.md, ensaio 7 e "Comportamento da linha").
--   * DECISÃO: um evento pode ser "de decisão". Guarda em `decisao` (JSON) a lista de resultados possíveis,
--     cada um com os cartões RELACIONADOS que ele tira de suspensão:
--       [{"id":"aprovado","nome":"Aprovado","libera":[]},
--        {"id":"segunda","nome":"Segunda rodada","libera":["pev_ce_m04"]}]
--     O primeiro resultado é o caminho esperado. Um cartão citado em algum `libera` fica SUSPENSO até a
--     decisão: aparece tracejado e esmaecido; se sair o resultado que o libera, concretiza-se; se sair outro,
--     some. NULL = evento comum.
--   * TERCEIROS: `terceiros` diz se fornecedores, complementares, órgãos ou construtora participam do evento.
--     Com `cliente`, define o ator na linha: só cliente = linha de interação com o cliente; só terceiros =
--     linha de interação com terceiros; os dois = os três atores (cartão alto, atravessando a faixa do cliente).
--   * Upgrade dos eventos do PGT que funcionam como decisão (análise de 16/11):
--       CE-M05 Aprovação da CE      → Aprovada · Segunda rodada (libera CE-M04)   — passa para antes da 2ª rodada
--       CB-M07 Aprovação da CB      → Aprovada · Segunda rodada (libera CB-M06)   — idem
--       PL-M06 Aprovação / alvará   → Aprovado · Com exigências (libera PL-M05)   — passa para antes das exigências
--       LR-M03 Protocolo nos órgãos → Aprovado · Com exigências (libera LR-M04)
--       EV-M03 Decisão do cliente   → Seguir · Ajustar · Parar (sem relacionados por ora)
--       CB-M09 Resultado do concurso → Premiado · Não premiado (sem relacionados por ora)

ALTER TABLE pgt_eventos ADD COLUMN decisao TEXT;
ALTER TABLE pgt_eventos ADD COLUMN terceiros INTEGER NOT NULL DEFAULT 0 CHECK (terceiros IN (0, 1));

-- quem tem terceiros: reuniões e protocolos com complementares, fornecedores, construtora, órgãos, júri
UPDATE pgt_eventos SET terceiros = 1, versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao'
  WHERE id IN ('pev_cb_m02', 'pev_cb_m08', 'pev_cb_m09', 'pev_pl_m03', 'pev_pl_m04', 'pev_pl_m06', 'pev_px_m01', 'pev_px_m02',
               'pev_px_m03', 'pev_px_m04', 'pev_as_m01', 'pev_as_m04', 'pev_lr_m03');

-- decisões
UPDATE pgt_eventos SET versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao',
  decisao = '[{"id":"aprovado","nome":"Aprovada","libera":[]},{"id":"segunda","nome":"Segunda rodada","libera":["pev_ce_m04"]}]'
  WHERE id = 'pev_ce_m05' AND EXISTS (SELECT 1 FROM pgt_eventos WHERE id = 'pev_ce_m04' AND arquivado_em IS NULL);
UPDATE pgt_eventos SET versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao',
  decisao = '[{"id":"aprovado","nome":"Aprovada","libera":[]},{"id":"segunda","nome":"Segunda rodada","libera":["pev_cb_m06"]}]'
  WHERE id = 'pev_cb_m07' AND EXISTS (SELECT 1 FROM pgt_eventos WHERE id = 'pev_cb_m06' AND arquivado_em IS NULL);
UPDATE pgt_eventos SET versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao',
  decisao = '[{"id":"aprovado","nome":"Aprovado","libera":[]},{"id":"exigencias","nome":"Com exigências","libera":["pev_pl_m05"]}]'
  WHERE id = 'pev_pl_m06' AND EXISTS (SELECT 1 FROM pgt_eventos WHERE id = 'pev_pl_m05' AND arquivado_em IS NULL);
UPDATE pgt_eventos SET versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao',
  decisao = '[{"id":"aprovado","nome":"Aprovado","libera":[]},{"id":"exigencias","nome":"Com exigências","libera":["pev_lr_m04"]}]'
  WHERE id = 'pev_lr_m03' AND EXISTS (SELECT 1 FROM pgt_eventos WHERE id = 'pev_lr_m04' AND arquivado_em IS NULL);
UPDATE pgt_eventos SET versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao',
  decisao = '[{"id":"seguir","nome":"Seguir","libera":[]},{"id":"ajustar","nome":"Ajustar","libera":[]},{"id":"parar","nome":"Parar","libera":[]}]'
  WHERE id = 'pev_ev_m03';
UPDATE pgt_eventos SET versao = versao + 1, atualizado_em = '2026-11-16T22:00:00.000Z', atualizado_por = 'migracao',
  decisao = '[{"id":"premiado","nome":"Premiado","libera":[]},{"id":"nao","nome":"Não premiado","libera":[]}]'
  WHERE id = 'pev_cb_m09';

-- a decisão vem antes dos cartões que ela libera: troca as duas posições se a aprovação estiver depois
-- (vale mesmo que a sequência já tenha sido mexida na página). Em três passos, porque o SQLite lê a tabela
-- já alterada dentro do mesmo UPDATE: guarda as duas ordens no número da decisão, passa uma e depois a outra.
UPDATE pgt_eventos SET ordem = 100000000 + ordem * 10000 + (SELECT ordem FROM pgt_eventos WHERE id = 'pev_ce_m04')
  WHERE id = 'pev_ce_m05' AND ordem > (SELECT ordem FROM pgt_eventos WHERE id = 'pev_ce_m04')
    AND etapa_id = (SELECT etapa_id FROM pgt_eventos WHERE id = 'pev_ce_m04');
UPDATE pgt_eventos SET ordem = ((SELECT ordem FROM pgt_eventos WHERE id = 'pev_ce_m05') - 100000000) / 10000
  WHERE id = 'pev_ce_m04' AND (SELECT ordem FROM pgt_eventos WHERE id = 'pev_ce_m05') >= 100000000;
UPDATE pgt_eventos SET ordem = (ordem - 100000000) % 10000 WHERE id = 'pev_ce_m05' AND ordem >= 100000000;
UPDATE pgt_eventos SET ordem = 100000000 + ordem * 10000 + (SELECT ordem FROM pgt_eventos WHERE id = 'pev_cb_m06')
  WHERE id = 'pev_cb_m07' AND ordem > (SELECT ordem FROM pgt_eventos WHERE id = 'pev_cb_m06')
    AND etapa_id = (SELECT etapa_id FROM pgt_eventos WHERE id = 'pev_cb_m06');
UPDATE pgt_eventos SET ordem = ((SELECT ordem FROM pgt_eventos WHERE id = 'pev_cb_m07') - 100000000) / 10000
  WHERE id = 'pev_cb_m06' AND (SELECT ordem FROM pgt_eventos WHERE id = 'pev_cb_m07') >= 100000000;
UPDATE pgt_eventos SET ordem = (ordem - 100000000) % 10000 WHERE id = 'pev_cb_m07' AND ordem >= 100000000;
UPDATE pgt_eventos SET ordem = 100000000 + ordem * 10000 + (SELECT ordem FROM pgt_eventos WHERE id = 'pev_pl_m05')
  WHERE id = 'pev_pl_m06' AND ordem > (SELECT ordem FROM pgt_eventos WHERE id = 'pev_pl_m05')
    AND etapa_id = (SELECT etapa_id FROM pgt_eventos WHERE id = 'pev_pl_m05');
UPDATE pgt_eventos SET ordem = ((SELECT ordem FROM pgt_eventos WHERE id = 'pev_pl_m06') - 100000000) / 10000
  WHERE id = 'pev_pl_m05' AND (SELECT ordem FROM pgt_eventos WHERE id = 'pev_pl_m06') >= 100000000;
UPDATE pgt_eventos SET ordem = (ordem - 100000000) % 10000 WHERE id = 'pev_pl_m06' AND ordem >= 100000000;
