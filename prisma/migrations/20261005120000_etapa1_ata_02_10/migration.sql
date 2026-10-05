-- AlterTable
ALTER TABLE "EnderecoClinica" ADD COLUMN     "observacoes" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "formaPagamento" TEXT,
ADD COLUMN     "procedimentoPaciente" TEXT;

