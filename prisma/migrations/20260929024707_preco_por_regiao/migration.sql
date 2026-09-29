-- CreateTable
CREATE TABLE "RegiaoPreco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ufs" TEXT[],
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegiaoPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoRegiao" (
    "id" TEXT NOT NULL,
    "regiaoId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoRegiao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegiaoPreco_nome_key" ON "RegiaoPreco"("nome");

-- CreateIndex
CREATE INDEX "RegiaoPreco_ativa_idx" ON "RegiaoPreco"("ativa");

-- CreateIndex
CREATE INDEX "PrecoRegiao_regiaoId_idx" ON "PrecoRegiao"("regiaoId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoRegiao_regiaoId_servicoId_key" ON "PrecoRegiao"("regiaoId", "servicoId");

-- AddForeignKey
ALTER TABLE "PrecoRegiao" ADD CONSTRAINT "PrecoRegiao_regiaoId_fkey" FOREIGN KEY ("regiaoId") REFERENCES "RegiaoPreco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoRegiao" ADD CONSTRAINT "PrecoRegiao_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
