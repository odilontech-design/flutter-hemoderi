-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('INTERNO', 'CLINICA', 'PROFISSIONAL');

-- CreateEnum
CREATE TYPE "StatusEquipamento" AS ENUM ('DISPONIVEL', 'EM_USO', 'MANUTENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('SOLICITADO', 'CONFIRMADO', 'ALOCADO', 'REALIZADO', 'FALTOU', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrigemPedido" AS ENUM ('INTERNO', 'PORTAL_CLINICA');

-- CreateEnum
CREATE TYPE "StatusRepasse" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('ABERTA', 'PAGA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('CONFIRMACAO', 'ALOCACAO', 'LEMBRETE', 'RESULTADO');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SistemaExterno" AS ENUM ('PIPEDRIVE', 'GOOGLE_AGENDA', 'WHATSAPP');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "telefone" TEXT,
    "clinicaId" TEXT,
    "profissionalId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desativadoEm" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametros" (
    "id" TEXT NOT NULL DEFAULT 'hemoderi',
    "nome" TEXT NOT NULL DEFAULT 'Hemoderi',
    "cnpj" TEXT NOT NULL DEFAULT '35.272.539/0001-89',
    "whatsapp" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "horaAbertura" TEXT NOT NULL DEFAULT '07:00',
    "horaFechamento" TEXT NOT NULL DEFAULT '19:00',
    "antecedenciaMinimaHoras" INTEGER NOT NULL DEFAULT 24,
    "horasLembrete" INTEGER NOT NULL DEFAULT 24,
    "repassePercentPadrao" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "prazoFaturamentoDias" INTEGER NOT NULL DEFAULT 10,
    "proximoNumeroPedido" INTEGER NOT NULL DEFAULT 1,
    "proximoNumeroFatura" INTEGER NOT NULL DEFAULT 1,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinica" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cnpj" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "salas" INTEGER NOT NULL DEFAULT 1,
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    "desativadaEm" TIMESTAMP(3),

    CONSTRAINT "Clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "duracaoMin" INTEGER NOT NULL DEFAULT 60,
    "valorPadraoCentavos" INTEGER NOT NULL DEFAULT 0,
    "repassePercent" DOUBLE PRECISION,
    "repasseFixoCentavos" INTEGER,
    "exigeEquipamento" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "desativadoEm" TIMESTAMP(3),

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoClinica" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "patrimonio" TEXT,
    "status" "StatusEquipamento" NOT NULL DEFAULT 'DISPONIVEL',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profissional" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "conselho" TEXT,
    "registro" TEXT,
    "especialidade" TEXT,
    "chavePix" TEXT,
    "repassePercentPadrao" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "desativadoEm" TIMESTAMP(3),

    CONSTRAINT "Profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegraRepasse" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "fixoCentavos" INTEGER,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraRepasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disponibilidade" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Disponibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT,
    "horaFim" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "profissionalId" TEXT,
    "equipamentoId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'SOLICITADO',
    "origem" "OrigemPedido" NOT NULL DEFAULT 'INTERNO',
    "valorServicoCentavos" INTEGER NOT NULL DEFAULT 0,
    "valorRepasseCentavos" INTEGER NOT NULL DEFAULT 0,
    "pacienteNome" TEXT,
    "pacienteContato" TEXT,
    "observacoes" TEXT,
    "googleEventoId" TEXT,
    "pipedriveNegocioId" TEXT,
    "faturaId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioAtendimento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "compareceu" BOOLEAN NOT NULL DEFAULT true,
    "inicioReal" TEXT,
    "fimReal" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "intercorrencia" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioAtendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repasse" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" "StatusRepasse" NOT NULL DEFAULT 'PENDENTE',
    "pagoEm" TIMESTAMP(3),
    "comprovante" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fatura" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL DEFAULT 0,
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'ABERTA',
    "pagaEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemWhatsapp" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT,
    "tipo" "TipoMensagem" NOT NULL,
    "destinatario" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "StatusMensagem" NOT NULL DEFAULT 'PENDENTE',
    "agendadaPara" TIMESTAMP(3),
    "enviadaEm" TIMESTAMP(3),
    "erro" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SincronizacaoExterna" (
    "id" TEXT NOT NULL,
    "sistema" "SistemaExterno" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "sucesso" BOOLEAN NOT NULL,
    "referencia" TEXT,
    "erro" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SincronizacaoExterna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_papel_idx" ON "Usuario"("papel");

-- CreateIndex
CREATE INDEX "Usuario_clinicaId_idx" ON "Usuario"("clinicaId");

-- CreateIndex
CREATE INDEX "Usuario_profissionalId_idx" ON "Usuario"("profissionalId");

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_slug_key" ON "Clinica"("slug");

-- CreateIndex
CREATE INDEX "Clinica_ativa_idx" ON "Clinica"("ativa");

-- CreateIndex
CREATE INDEX "Servico_ativo_idx" ON "Servico"("ativo");

-- CreateIndex
CREATE INDEX "PrecoClinica_clinicaId_idx" ON "PrecoClinica"("clinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoClinica_clinicaId_servicoId_key" ON "PrecoClinica"("clinicaId", "servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_patrimonio_key" ON "Equipamento"("patrimonio");

-- CreateIndex
CREATE INDEX "Equipamento_status_idx" ON "Equipamento"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Profissional_cpf_key" ON "Profissional"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Profissional_email_key" ON "Profissional"("email");

-- CreateIndex
CREATE INDEX "Profissional_ativo_idx" ON "Profissional"("ativo");

-- CreateIndex
CREATE INDEX "RegraRepasse_profissionalId_idx" ON "RegraRepasse"("profissionalId");

-- CreateIndex
CREATE UNIQUE INDEX "RegraRepasse_profissionalId_servicoId_key" ON "RegraRepasse"("profissionalId", "servicoId");

-- CreateIndex
CREATE INDEX "Disponibilidade_profissionalId_diaSemana_idx" ON "Disponibilidade"("profissionalId", "diaSemana");

-- CreateIndex
CREATE INDEX "Bloqueio_profissionalId_data_idx" ON "Bloqueio"("profissionalId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_numero_key" ON "Pedido"("numero");

-- CreateIndex
CREATE INDEX "Pedido_data_status_idx" ON "Pedido"("data", "status");

-- CreateIndex
CREATE INDEX "Pedido_clinicaId_data_idx" ON "Pedido"("clinicaId", "data");

-- CreateIndex
CREATE INDEX "Pedido_profissionalId_data_idx" ON "Pedido"("profissionalId", "data");

-- CreateIndex
CREATE INDEX "Pedido_status_idx" ON "Pedido"("status");

-- CreateIndex
CREATE INDEX "Pedido_faturaId_idx" ON "Pedido"("faturaId");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioAtendimento_pedidoId_key" ON "RelatorioAtendimento"("pedidoId");

-- CreateIndex
CREATE INDEX "RelatorioAtendimento_profissionalId_idx" ON "RelatorioAtendimento"("profissionalId");

-- CreateIndex
CREATE UNIQUE INDEX "Repasse_pedidoId_key" ON "Repasse"("pedidoId");

-- CreateIndex
CREATE INDEX "Repasse_profissionalId_competencia_idx" ON "Repasse"("profissionalId", "competencia");

-- CreateIndex
CREATE INDEX "Repasse_status_competencia_idx" ON "Repasse"("status", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_numero_key" ON "Fatura"("numero");

-- CreateIndex
CREATE INDEX "Fatura_status_vencimento_idx" ON "Fatura"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_clinicaId_competencia_key" ON "Fatura"("clinicaId", "competencia");

-- CreateIndex
CREATE INDEX "MensagemWhatsapp_status_agendadaPara_idx" ON "MensagemWhatsapp"("status", "agendadaPara");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsapp_pedidoId_tipo_key" ON "MensagemWhatsapp"("pedidoId", "tipo");

-- CreateIndex
CREATE INDEX "SincronizacaoExterna_sistema_criadaEm_idx" ON "SincronizacaoExterna"("sistema", "criadaEm");

-- CreateIndex
CREATE INDEX "SincronizacaoExterna_entidade_entidadeId_idx" ON "SincronizacaoExterna"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidade_entidadeId_idx" ON "RegistroAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_criadoEm_idx" ON "RegistroAuditoria"("criadoEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoClinica" ADD CONSTRAINT "PrecoClinica_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoClinica" ADD CONSTRAINT "PrecoClinica_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraRepasse" ADD CONSTRAINT "RegraRepasse_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraRepasse" ADD CONSTRAINT "RegraRepasse_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disponibilidade" ADD CONSTRAINT "Disponibilidade_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioAtendimento" ADD CONSTRAINT "RelatorioAtendimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioAtendimento" ADD CONSTRAINT "RelatorioAtendimento_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsapp" ADD CONSTRAINT "MensagemWhatsapp_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

