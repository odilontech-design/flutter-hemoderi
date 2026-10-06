-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "conselho" TEXT,
ADD COLUMN     "registroConselho" TEXT;

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "detalhes" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "contatoClinica" TEXT;

