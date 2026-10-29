-- DropForeignKey
ALTER TABLE "CobrancaPix" DROP CONSTRAINT "CobrancaPix_faturaId_fkey";

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "pixPagoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CobrancaPix" ADD COLUMN     "grupoId" TEXT,
ADD COLUMN     "pedidoId" TEXT,
ALTER COLUMN "faturaId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CobrancaPix_pedidoId_idx" ON "CobrancaPix"("pedidoId");

-- AddForeignKey
ALTER TABLE "CobrancaPix" ADD CONSTRAINT "CobrancaPix_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobrancaPix" ADD CONSTRAINT "CobrancaPix_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

