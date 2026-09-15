-- CreateEnum
CREATE TYPE "PerfilInterno" AS ENUM ('ATENDENTE', 'RESPONSAVEL');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "perfilInterno" "PerfilInterno";

-- Ninguém que já tinha acesso interno perde alcance com este campo: toda
-- conta INTERNO existente nasce RESPONSAVEL. A distinção só passa a valer
-- de fato para o próximo acesso criado ou o primeiro ajuste manual de
-- perfil (ver src/lib/papeis.ts:perfilEfetivo, que também trata NULL como
-- RESPONSAVEL — cinto e suspensório contra qualquer linha que escape disto).
UPDATE "Usuario" SET "perfilInterno" = 'RESPONSAVEL' WHERE "papel" = 'INTERNO';
