-- 0012 — Equipe: UF do registro no conselho (18/11/2026, pedido do Cid).
-- O registro passa a sair como "CAU/PB A123456-7". Sem UF, continua "CAU A123456-7".
ALTER TABLE equipe ADD COLUMN registro_uf TEXT;
