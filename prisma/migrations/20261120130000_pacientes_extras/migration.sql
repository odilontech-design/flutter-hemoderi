CREATE TABLE "RelatorioPacienteExtra" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "procedimento" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "acrescentadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedidoGeradoId" TEXT,

    CONSTRAINT "RelatorioPacienteExtra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelatorioPacienteExtra_pedidoGeradoId_key" ON "RelatorioPacienteExtra"("pedidoGeradoId");
CREATE INDEX "RelatorioPacienteExtra_relatorioId_idx" ON "RelatorioPacienteExtra"("relatorioId");

ALTER TABLE "RelatorioPacienteExtra" ADD CONSTRAINT "RelatorioPacienteExtra_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioAtendimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
