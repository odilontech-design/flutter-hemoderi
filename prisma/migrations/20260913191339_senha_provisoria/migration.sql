-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "senhaProvisoria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senhaTrocadaEm" TIMESTAMP(3);
