-- CreateTable
CREATE TABLE "PesquisaNps" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "janelaInicio" TIMESTAMP(3) NOT NULL,
    "janelaFim" TIMESTAMP(3) NOT NULL,
    "atendimentosNoPeriodo" INTEGER NOT NULL,
    "nota" INTEGER,
    "pontosPositivos" TEXT,
    "expectativasNaoAtendidas" TEXT,
    "sugestoes" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "PesquisaNps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PesquisaNps_clinicaId_respondidaEm_idx" ON "PesquisaNps"("clinicaId", "respondidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "PesquisaNps_clinicaId_janelaInicio_key" ON "PesquisaNps"("clinicaId", "janelaInicio");

-- AddForeignKey
ALTER TABLE "PesquisaNps" ADD CONSTRAINT "PesquisaNps_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
