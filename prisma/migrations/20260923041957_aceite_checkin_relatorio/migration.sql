-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "aceitoEm" TIMESTAMP(3),
ADD COLUMN     "checkinEm" TIMESTAMP(3),
ADD COLUMN     "checkinLatitude" DOUBLE PRECISION,
ADD COLUMN     "checkinLongitude" DOUBLE PRECISION,
ADD COLUMN     "checkinPrecisaoMetros" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RelatorioAtendimento" ADD COLUMN     "ajudaCustoCentavos" INTEGER,
ADD COLUMN     "ajudaCustoJustificativa" TEXT,
ADD COLUMN     "ajudaCustoValidadaEm" TIMESTAMP(3),
ADD COLUMN     "frequenciaCardiaca" TEXT,
ADD COLUMN     "glicemia" TEXT,
ADD COLUMN     "oxidoNitroso" TEXT,
ADD COLUMN     "oxigenio" TEXT,
ADD COLUMN     "pressaoArterial" TEXT,
ADD COLUMN     "saturacaoOxigenio" TEXT,
ADD COLUMN     "servicoValidadoEm" TIMESTAMP(3),
ADD COLUMN     "servicosAdicionais" TEXT,
ADD COLUMN     "valorValidadoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecusaAtendimento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecusaAtendimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecusaAtendimento_profissionalId_criadaEm_idx" ON "RecusaAtendimento"("profissionalId", "criadaEm");

-- CreateIndex
CREATE INDEX "RecusaAtendimento_pedidoId_idx" ON "RecusaAtendimento"("pedidoId");

-- AddForeignKey
ALTER TABLE "RecusaAtendimento" ADD CONSTRAINT "RecusaAtendimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecusaAtendimento" ADD CONSTRAINT "RecusaAtendimento_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
