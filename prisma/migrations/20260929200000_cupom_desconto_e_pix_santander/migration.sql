-- AlterEnum: adicionar SANTANDER ao SistemaExterno
ALTER TYPE "SistemaExterno" ADD VALUE 'SANTANDER';

-- CreateEnum
CREATE TYPE "TipoDesconto" AS ENUM ('PERCENTUAL', 'VALOR_FIXO');

-- CreateEnum
CREATE TYPE "StatusCobrancaPix" AS ENUM ('ATIVA', 'CONCLUIDA', 'EXPIRADA', 'CANCELADA');

-- AlterTable: campo de desconto na fatura
ALTER TABLE "Fatura" ADD COLUMN "descontoCentavos" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CupomDesconto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoDesconto" NOT NULL,
    "valor" INTEGER NOT NULL,
    "servicoIds" TEXT[],
    "validoAte" TIMESTAMP(3),
    "limiteUsos" INTEGER,
    "usosRealizados" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CupomDesconto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoCupom" (
    "id" TEXT NOT NULL,
    "cupomId" TEXT NOT NULL,
    "faturaId" TEXT NOT NULL,
    "descontoCentavos" INTEGER NOT NULL,
    "aplicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoPorId" TEXT,

    CONSTRAINT "AplicacaoCupom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobrancaPix" (
    "id" TEXT NOT NULL,
    "faturaId" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" "StatusCobrancaPix" NOT NULL DEFAULT 'ATIVA',
    "qrCode" TEXT,
    "copiaECola" TEXT,
    "imagemQrUrl" TEXT,
    "chavePix" TEXT NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "endToEndId" TEXT,
    "pagoEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CobrancaPix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CupomDesconto_codigo_key" ON "CupomDesconto"("codigo");

-- CreateIndex
CREATE INDEX "CupomDesconto_codigo_idx" ON "CupomDesconto"("codigo");

-- CreateIndex
CREATE INDEX "CupomDesconto_ativo_validoAte_idx" ON "CupomDesconto"("ativo", "validoAte");

-- CreateIndex
CREATE INDEX "AplicacaoCupom_cupomId_idx" ON "AplicacaoCupom"("cupomId");

-- CreateIndex
CREATE INDEX "AplicacaoCupom_faturaId_idx" ON "AplicacaoCupom"("faturaId");

-- CreateIndex
CREATE UNIQUE INDEX "CobrancaPix_txid_key" ON "CobrancaPix"("txid");

-- CreateIndex
CREATE INDEX "CobrancaPix_faturaId_idx" ON "CobrancaPix"("faturaId");

-- CreateIndex
CREATE INDEX "CobrancaPix_status_idx" ON "CobrancaPix"("status");

-- CreateIndex
CREATE INDEX "CobrancaPix_txid_idx" ON "CobrancaPix"("txid");

-- AddForeignKey
ALTER TABLE "AplicacaoCupom" ADD CONSTRAINT "AplicacaoCupom_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "CupomDesconto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoCupom" ADD CONSTRAINT "AplicacaoCupom_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobrancaPix" ADD CONSTRAINT "CobrancaPix_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
