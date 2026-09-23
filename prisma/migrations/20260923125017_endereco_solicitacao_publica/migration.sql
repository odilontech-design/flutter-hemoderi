/*
  Warnings:

  - Added the required column `bairro` to the `SolicitacaoPublica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cep` to the `SolicitacaoPublica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cidade` to the `SolicitacaoPublica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endereco` to the `SolicitacaoPublica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uf` to the `SolicitacaoPublica` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- As cinco colunas obrigatórias nascem com um default temporário só para as
-- solicitações que já existem (a maioria já tratada, sem endereço coletado
-- na época); o default sai em seguida, então toda solicitação nova é
-- obrigada a informar o endereço de verdade.
ALTER TABLE "SolicitacaoPublica" ADD COLUMN     "bairro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cep" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cidade" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "endereco" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "pontoReferencia" TEXT,
ADD COLUMN     "uf" TEXT NOT NULL DEFAULT '';

ALTER TABLE "SolicitacaoPublica" ALTER COLUMN "bairro" DROP DEFAULT,
ALTER COLUMN "cep" DROP DEFAULT,
ALTER COLUMN "cidade" DROP DEFAULT,
ALTER COLUMN "endereco" DROP DEFAULT,
ALTER COLUMN "uf" DROP DEFAULT;
