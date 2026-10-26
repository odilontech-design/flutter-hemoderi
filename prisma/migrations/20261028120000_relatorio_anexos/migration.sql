-- CreateTable
CREATE TABLE "RelatorioAnexo" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatorioAnexo_relatorioId_idx" ON "RelatorioAnexo"("relatorioId");

-- AddForeignKey
ALTER TABLE "RelatorioAnexo" ADD CONSTRAINT "RelatorioAnexo_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioAtendimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

