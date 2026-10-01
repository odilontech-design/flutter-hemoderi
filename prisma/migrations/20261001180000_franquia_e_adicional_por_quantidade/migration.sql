-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "quantidadeIncluida" INTEGER,
ADD COLUMN     "quantidadeMinima" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "valorAdicionalCentavos" INTEGER NOT NULL DEFAULT 0;

