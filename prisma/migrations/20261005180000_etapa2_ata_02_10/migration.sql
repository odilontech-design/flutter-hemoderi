-- AlterTable
ALTER TABLE "RelatorioAtendimento" ADD COLUMN     "servicoRealizadoId" TEXT;

-- CreateTable
CREATE TABLE "_ServicosAptosDoProfissional" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ServicosAptosDoProfissional_AB_unique" ON "_ServicosAptosDoProfissional"("A", "B");

-- CreateIndex
CREATE INDEX "_ServicosAptosDoProfissional_B_index" ON "_ServicosAptosDoProfissional"("B");

-- AddForeignKey
ALTER TABLE "RelatorioAtendimento" ADD CONSTRAINT "RelatorioAtendimento_servicoRealizadoId_fkey" FOREIGN KEY ("servicoRealizadoId") REFERENCES "Servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServicosAptosDoProfissional" ADD CONSTRAINT "_ServicosAptosDoProfissional_A_fkey" FOREIGN KEY ("A") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServicosAptosDoProfissional" ADD CONSTRAINT "_ServicosAptosDoProfissional_B_fkey" FOREIGN KEY ("B") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

