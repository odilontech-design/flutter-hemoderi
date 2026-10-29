-- O CNPJ padrão tinha os dígitos verificadores errados (…/0001-89); o certo, o mesmo do certificado digital da empresa, é …/0001-84.
ALTER TABLE "Parametros" ALTER COLUMN "cnpj" SET DEFAULT '35.272.539/0001-84';
UPDATE "Parametros" SET "cnpj" = '35.272.539/0001-84' WHERE "cnpj" = '35.272.539/0001-89';
