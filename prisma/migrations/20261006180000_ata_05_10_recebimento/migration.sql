-- AlterTable
ALTER TABLE "RelatorioAtendimento" ADD COLUMN     "formaRecebimento" TEXT,
ADD COLUMN     "recebimento" TEXT,
ADD COLUMN     "valorRecebidoCentavos" INTEGER;

-- CreateTable
CREATE TABLE "ComprovanteRecebimento" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprovanteRecebimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComprovanteRecebimento_relatorioId_key" ON "ComprovanteRecebimento"("relatorioId");

-- AddForeignKey
ALTER TABLE "ComprovanteRecebimento" ADD CONSTRAINT "ComprovanteRecebimento_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioAtendimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

