ALTER TABLE "CobrancaCartao" ADD COLUMN "atualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "duplicada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ultimoEvento" TEXT,
ADD COLUMN "observacao" TEXT;

CREATE INDEX "CobrancaCartao_status_idx" ON "CobrancaCartao"("status");

CREATE TABLE "EventoAsaas" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT,
    "tipo" TEXT NOT NULL,
    "asaasId" TEXT,
    "cobrancaId" TEXT,
    "resultado" TEXT NOT NULL,
    "erro" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAsaas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoAsaas_eventoId_key" ON "EventoAsaas"("eventoId");
CREATE INDEX "EventoAsaas_recebidoEm_idx" ON "EventoAsaas"("recebidoEm");
