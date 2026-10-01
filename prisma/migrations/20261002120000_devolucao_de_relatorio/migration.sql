-- AlterTable
ALTER TABLE "RelatorioAtendimento" ADD COLUMN     "devolvidoEm" TIMESTAMP(3),
ADD COLUMN     "devolvidoPorId" TEXT,
ADD COLUMN     "motivoDevolucao" TEXT;

