-- CreateTable
CREATE TABLE "RelatorioServicoAdicional" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RelatorioServicoAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatorioServicoAdicional_servicoId_idx" ON "RelatorioServicoAdicional"("servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioServicoAdicional_relatorioId_servicoId_key" ON "RelatorioServicoAdicional"("relatorioId", "servicoId");

-- AddForeignKey
ALTER TABLE "RelatorioServicoAdicional" ADD CONSTRAINT "RelatorioServicoAdicional_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioAtendimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioServicoAdicional" ADD CONSTRAINT "RelatorioServicoAdicional_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

