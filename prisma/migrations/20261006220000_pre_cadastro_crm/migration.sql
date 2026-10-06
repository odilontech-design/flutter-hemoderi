-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "idCrm" TEXT,
ADD COLUMN     "negociosAbertosCrm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "negociosFechadosCrm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preCadastro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipoCrm" TEXT;

-- CreateTable
CREATE TABLE "PessoaCliente" (
    "id" TEXT NOT NULL,
    "idCrm" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "titulo" TEXT,
    "telefone" TEXT,
    "tipoTelefone" TEXT,
    "telefone2" TEXT,
    "email" TEXT,
    "conselho" TEXT,
    "registroConselho" TEXT,
    "origemCrm" TEXT,
    "negociosFechados" INTEGER NOT NULL DEFAULT 0,
    "negociosAbertos" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PessoaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoPessoaClinica" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,

    CONSTRAINT "VinculoPessoaClinica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PessoaCliente_idCrm_key" ON "PessoaCliente"("idCrm");

-- CreateIndex
CREATE INDEX "VinculoPessoaClinica_clinicaId_idx" ON "VinculoPessoaClinica"("clinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoPessoaClinica_pessoaId_clinicaId_key" ON "VinculoPessoaClinica"("pessoaId", "clinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_idCrm_key" ON "Clinica"("idCrm");

-- CreateIndex
CREATE INDEX "Clinica_preCadastro_idx" ON "Clinica"("preCadastro");

-- AddForeignKey
ALTER TABLE "VinculoPessoaClinica" ADD CONSTRAINT "VinculoPessoaClinica_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "PessoaCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoPessoaClinica" ADD CONSTRAINT "VinculoPessoaClinica_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

