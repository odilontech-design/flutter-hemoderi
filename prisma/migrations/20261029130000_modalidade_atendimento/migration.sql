-- CreateEnum
CREATE TYPE "ModalidadeAtendimento" AS ENUM ('PARTICULAR', 'CURSO');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "modalidade" "ModalidadeAtendimento" NOT NULL DEFAULT 'PARTICULAR';
