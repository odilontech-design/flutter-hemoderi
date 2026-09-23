-- AlterTable
ALTER TABLE "Profissional" ADD COLUMN     "grupoRepasseId" TEXT,
ADD COLUMN     "uf" TEXT;

-- CreateTable
CREATE TABLE "GrupoRepasse" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "fixoCentavos" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoRepasse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrupoRepasse_nome_key" ON "GrupoRepasse"("nome");

-- CreateIndex
CREATE INDEX "Profissional_grupoRepasseId_idx" ON "Profissional"("grupoRepasseId");

-- AddForeignKey
ALTER TABLE "Profissional" ADD CONSTRAINT "Profissional_grupoRepasseId_fkey" FOREIGN KEY ("grupoRepasseId") REFERENCES "GrupoRepasse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
