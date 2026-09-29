-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "condicaoPagamento" TEXT;

-- AlterTable
ALTER TABLE "RecusaAtendimento" ALTER COLUMN "motivo" DROP NOT NULL;
