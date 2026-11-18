-- 0013 — Dados para contrato (18/11/2026, pedido do Cid): a qualificação completa da pessoa, na tabela restrita
-- pessoas_sensiveis (mesmo id da pessoa). Serve à equipe (sócios como contratada) e aos clientes (vendas).
ALTER TABLE pessoas_sensiveis ADD COLUMN nome_completo TEXT;
ALTER TABLE pessoas_sensiveis ADD COLUMN nacionalidade TEXT;
ALTER TABLE pessoas_sensiveis ADD COLUMN estado_civil TEXT;
ALTER TABLE pessoas_sensiveis ADD COLUMN profissao TEXT;
ALTER TABLE pessoas_sensiveis ADD COLUMN rg_orgao TEXT;
