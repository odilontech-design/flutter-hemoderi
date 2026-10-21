-- CreateTable
CREATE TABLE "RepassePraca" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "praca" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "fixoCentavos" INTEGER,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepassePraca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepassePraca_praca_idx" ON "RepassePraca"("praca");

-- CreateIndex
CREATE UNIQUE INDEX "RepassePraca_servicoId_praca_key" ON "RepassePraca"("servicoId", "praca");

-- AddForeignKey
ALTER TABLE "RepassePraca" ADD CONSTRAINT "RepassePraca_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

