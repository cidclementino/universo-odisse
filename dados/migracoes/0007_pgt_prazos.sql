-- 0007 — PGT numa interface única (12/11/2026, pedidos do Cid):
--   * Fluxo e ilha são ESTADOS, não fases: a fase "Ilhas" vira um grupo sem nome próprio na tela
--     (`solta = 1`), que só junta as etapas avulsas (CR, LR). Uma fase do fluxo pode virar ilha pelo botão.
--   * Prazo vem dos ENTREGÁVEIS: cada um tem duração (em turnos), pessoas e se o prazo é fixo
--     (pôr mais gente não encurta). O prazo da etapa é a soma dos entregáveis que valem para o serviço.
--     1 turno = 4 h; 1 dia = 2 turnos; 1 semana = 5 dias = 10 turnos; 1 mês = 4 semanas = 40 turnos.
--   * A pertinência da etapa × serviço passa a ser CALCULADA dos entregáveis (P se algum entregável é P;
--     O se só há opcionais). A tabela pgt_etapas_servicos fica só com o peso (honorários) e guarda a
--     pertinência marcada à mão até aqui, sem uso, para consulta.
--   * Cadeado: fase, etapa e entregável podem ser travados contra edição (só na tela; fora dos retratos).

ALTER TABLE pgt_fases ADD COLUMN solta INTEGER NOT NULL DEFAULT 0 CHECK (solta IN (0, 1));
ALTER TABLE pgt_fases ADD COLUMN travado INTEGER NOT NULL DEFAULT 0 CHECK (travado IN (0, 1));
ALTER TABLE pgt_etapas ADD COLUMN travado INTEGER NOT NULL DEFAULT 0 CHECK (travado IN (0, 1));
ALTER TABLE pgt_entregaveis ADD COLUMN prazo_turnos REAL CHECK (prazo_turnos IS NULL OR (prazo_turnos > 0 AND prazo_turnos <= 40));
ALTER TABLE pgt_entregaveis ADD COLUMN pessoas INTEGER NOT NULL DEFAULT 1 CHECK (pessoas BETWEEN 1 AND 20);
ALTER TABLE pgt_entregaveis ADD COLUMN prazo_fixo INTEGER NOT NULL DEFAULT 0 CHECK (prazo_fixo IN (0, 1));
ALTER TABLE pgt_entregaveis ADD COLUMN travado INTEGER NOT NULL DEFAULT 0 CHECK (travado IN (0, 1));

-- pertinência da etapa deixa de ser obrigatória (a linha pode existir só pelo peso)
CREATE TABLE pgt_etapas_servicos_nova (
  etapa_id         TEXT NOT NULL REFERENCES pgt_etapas (id),
  servico_id       TEXT NOT NULL REFERENCES bases_servicos (id),
  pertinencia      TEXT CHECK (pertinencia IS NULL OR pertinencia IN ('P', 'O')),   -- marcada à mão até a 0007 (sem uso)
  peso             REAL CHECK (peso IS NULL OR peso >= 0),
  semanas          REAL CHECK (semanas IS NULL OR semanas >= 0),                     -- sem uso desde a 0007
  PRIMARY KEY (etapa_id, servico_id)
);
INSERT INTO pgt_etapas_servicos_nova (etapa_id, servico_id, pertinencia, peso, semanas)
  SELECT etapa_id, servico_id, pertinencia, peso, semanas FROM pgt_etapas_servicos;
DROP TABLE pgt_etapas_servicos;
ALTER TABLE pgt_etapas_servicos_nova RENAME TO pgt_etapas_servicos;
CREATE INDEX pgt_etapas_servicos_srv ON pgt_etapas_servicos (servico_id);

UPDATE pgt_fases SET solta = 1, ilha = 1 WHERE id = 'pfa_ilhas';

-- descrições das fases (texto da proposta comercial); só onde ainda não há texto
UPDATE pgt_fases SET descricao = 'Fase de entendimento e concepção do projeto. Começa pelo reconhecimento do terreno ou do imóvel e pela definição do programa de necessidades, passa pelos primeiros estudos de ocupação, volume e fluxos e termina com uma solução arquitetônica consolidada, com materialidade e primeiras definições técnicas.'
  WHERE id = 'pfa_conceitual' AND (descricao IS NULL OR descricao = '');
UPDATE pgt_fases SET descricao = 'Fase de preparação da documentação técnica e legal do projeto para análise e aprovação na prefeitura e nos demais órgãos competentes, de acordo com a legislação incidente, até a solicitação do alvará de construção.'
  WHERE id = 'pfa_legal' AND (descricao IS NULL OR descricao = '');
UPDATE pgt_fases SET descricao = 'Fase de desenvolvimento do projeto para a obra. Coordena e compatibiliza a arquitetura com os projetos complementares e produz os desenhos, as especificações e os detalhes necessários para orçar, contratar e executar a construção com precisão.'
  WHERE id = 'pfa_executiva' AND (descricao IS NULL OR descricao = '');
UPDATE pgt_fases SET descricao = 'Fase de acompanhamento da execução. O Odisse assessora a obra para que o que foi projetado seja construído como projetado, esclarecendo dúvidas e orientando ajustes, e registra ao final o que foi efetivamente construído (as built).'
  WHERE id = 'pfa_obra' AND (descricao IS NULL OR descricao = '');
UPDATE pgt_fases SET descricao = 'Serviços avulsos, contratados de forma independente e fora do encadeamento das fases do projeto.'
  WHERE id = 'pfa_ilhas' AND (descricao IS NULL OR descricao = '');
