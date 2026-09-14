-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "condicaoPagamento" TEXT,
ADD COLUMN     "doutorNome" TEXT;

-- AlterTable
ALTER TABLE "Profissional" ADD COLUMN     "repasseFixoCentavos" INTEGER;

-- AlterTable
ALTER TABLE "RelatorioAtendimento" ADD COLUMN     "aprovadoEm" TIMESTAMP(3),
ADD COLUMN     "aprovadoPorId" TEXT,
ADD COLUMN     "chavePixConfirmada" TEXT;

-- CreateIndex
CREATE INDEX "RelatorioAtendimento_aprovadoEm_idx" ON "RelatorioAtendimento"("aprovadoEm");
