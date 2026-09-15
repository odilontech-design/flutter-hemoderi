-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('NOVA', 'VINCULADA', 'RECUSADA');

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "familia" TEXT;

-- CreateTable
CREATE TABLE "SolicitacaoPublica" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "email" TEXT,
    "clinicaNome" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "dataDesejada" TIMESTAMP(3) NOT NULL,
    "horarioDesejado" TEXT NOT NULL,
    "doutorNome" TEXT,
    "pacienteNome" TEXT,
    "observacoes" TEXT,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'NOVA',
    "clinicaId" TEXT,
    "pedidoId" TEXT,
    "motivoRecusa" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tratadaEm" TIMESTAMP(3),
    "tratadaPorId" TEXT,

    CONSTRAINT "SolicitacaoPublica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitacaoPublica_pedidoId_key" ON "SolicitacaoPublica"("pedidoId");

-- CreateIndex
CREATE INDEX "SolicitacaoPublica_status_criadaEm_idx" ON "SolicitacaoPublica"("status", "criadaEm");

-- CreateIndex
CREATE INDEX "SolicitacaoPublica_telefone_idx" ON "SolicitacaoPublica"("telefone");

-- AddForeignKey
ALTER TABLE "SolicitacaoPublica" ADD CONSTRAINT "SolicitacaoPublica_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoPublica" ADD CONSTRAINT "SolicitacaoPublica_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoPublica" ADD CONSTRAINT "SolicitacaoPublica_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
