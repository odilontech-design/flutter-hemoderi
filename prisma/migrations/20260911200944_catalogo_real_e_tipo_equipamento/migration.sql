-- CreateEnum
CREATE TYPE "CategoriaServico" AS ENUM ('ODONTOLOGIA', 'ESTETICA', 'SAUDE');

-- AlterTable
-- categoria nasce nullable, é preenchida para linhas existentes e só então
-- vira NOT NULL — assim a migration não falha em nenhum ambiente que já
-- tenha serviço cadastrado. SAUDE como default de backfill é a categoria
-- mais genérica das três, para não afirmar uma especialidade que a linha
-- antiga não tinha como declarar.
ALTER TABLE "Servico" ADD COLUMN "categoria" "CategoriaServico";
ALTER TABLE "Servico" ADD COLUMN "tipoEquipamento" TEXT;

UPDATE "Servico" SET "categoria" = 'SAUDE' WHERE "categoria" IS NULL;

ALTER TABLE "Servico" ALTER COLUMN "categoria" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Equipamento_tipo_idx" ON "Equipamento"("tipo");

-- CreateIndex
CREATE INDEX "Servico_categoria_idx" ON "Servico"("categoria");
