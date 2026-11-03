ALTER TABLE "Pedido" ADD COLUMN "cartaoPagoEm" TIMESTAMP(3);

CREATE TABLE "CobrancaCartao" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "asaasId" TEXT NOT NULL,
    "parcelamentoId" TEXT,
    "pedidoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "valorCentavos" INTEGER NOT NULL,
    "valorTotalCentavos" INTEGER NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "linkPagamento" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),
    CONSTRAINT "CobrancaCartao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CobrancaCartao_asaasId_key" ON "CobrancaCartao"("asaasId");
CREATE INDEX "CobrancaCartao_parcelamentoId_idx" ON "CobrancaCartao"("parcelamentoId");
CREATE INDEX "CobrancaCartao_clinicaId_idx" ON "CobrancaCartao"("clinicaId");
