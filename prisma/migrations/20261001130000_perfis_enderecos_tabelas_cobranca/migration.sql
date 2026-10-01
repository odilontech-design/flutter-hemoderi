-- CreateEnum
CREATE TYPE "UnidadeCobranca" AS ENUM ('PACIENTE', 'PERIODO', 'HORA');

-- CreateEnum
CREATE TYPE "PerfilCliente" AS ENUM ('ODONTOLOGIA', 'MEDICINA', 'ESTETICA', 'CURSO', 'MANDIC', 'PARCEIRO');

-- CreateEnum
CREATE TYPE "StatusCadastro" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "autocadastro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cadastroRevisadoEm" TIMESTAMP(3),
ADD COLUMN     "perfilDeclarado" "PerfilCliente",
ADD COLUMN     "perfis" "PerfilCliente"[] DEFAULT ARRAY[]::"PerfilCliente"[],
ADD COLUMN     "statusCadastro" "StatusCadastro" NOT NULL DEFAULT 'APROVADO';

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "perfis" "PerfilCliente"[] DEFAULT ARRAY[]::"PerfilCliente"[],
ADD COLUMN     "permiteQuantidade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantidadeMaxima" INTEGER,
ADD COLUMN     "rotuloQuantidade" TEXT,
ADD COLUMN     "ufsIndisponiveis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unidadeCobranca" "UnidadeCobranca" NOT NULL DEFAULT 'PACIENTE';

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "enderecoId" TEXT,
ADD COLUMN     "grupoId" TEXT,
ADD COLUMN     "quantidade" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "EnderecoClinica" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnderecoClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabelaPreco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "perfil" "PerfilCliente",
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabelaPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoTabela" (
    "id" TEXT NOT NULL,
    "tabelaId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoTabela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClinicaToTabelaPreco" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "EnderecoClinica_clinicaId_idx" ON "EnderecoClinica"("clinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "TabelaPreco_nome_key" ON "TabelaPreco"("nome");

-- CreateIndex
CREATE INDEX "PrecoTabela_tabelaId_idx" ON "PrecoTabela"("tabelaId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoTabela_tabelaId_servicoId_key" ON "PrecoTabela"("tabelaId", "servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "_ClinicaToTabelaPreco_AB_unique" ON "_ClinicaToTabelaPreco"("A", "B");

-- CreateIndex
CREATE INDEX "_ClinicaToTabelaPreco_B_index" ON "_ClinicaToTabelaPreco"("B");

-- CreateIndex
CREATE INDEX "Pedido_grupoId_idx" ON "Pedido"("grupoId");

-- AddForeignKey
ALTER TABLE "EnderecoClinica" ADD CONSTRAINT "EnderecoClinica_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoTabela" ADD CONSTRAINT "PrecoTabela_tabelaId_fkey" FOREIGN KEY ("tabelaId") REFERENCES "TabelaPreco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoTabela" ADD CONSTRAINT "PrecoTabela_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "EnderecoClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClinicaToTabelaPreco" ADD CONSTRAINT "_ClinicaToTabelaPreco_A_fkey" FOREIGN KEY ("A") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClinicaToTabelaPreco" ADD CONSTRAINT "_ClinicaToTabelaPreco_B_fkey" FOREIGN KEY ("B") REFERENCES "TabelaPreco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

