import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { competenciaAtual, formatarData } from "@/lib/data";
import { perfilEfetivo } from "@/lib/papeis";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * Exportação mensal para a contabilidade (Módulo 04).
 *
 * Uma linha por atendimento realizado, com o valor da clínica e o repasse do
 * profissional na mesma linha. O contador recebe o mês inteiro conferível
 * sem precisar cruzar duas planilhas — e a margem sai da subtração, à vista.
 *
 * Ponto e vírgula como separador e valores com vírgula decimal: é o que o
 * Excel em português abre sem pedir importação.
 */
export async function GET(requisicao: Request) {
  const sessao = await getServerSession(authOptions);
  if (sessao?.user?.papel !== "INTERNO") {
    return new Response("Não autorizado", { status: 401 });
  }

  // A planilha leva CPF e repasse por profissional linha a linha — a mesma
  // informação que o menu já esconde do perfil Atendente. Sem esta conferência
  // aqui, bastaria montar a URL de cor para contornar o que a tela nega.
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { perfilInterno: true },
  });
  if (!usuario || perfilEfetivo(usuario.perfilInterno) !== "RESPONSAVEL") {
    return new Response("Não autorizado", { status: 401 });
  }

  const url = new URL(requisicao.url);
  const competencia = url.searchParams.get("competencia") ?? competenciaAtual();
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return new Response("Competência inválida", { status: 400 });

  const pedidos = await prisma.pedido.findMany({
    where: {
      status: "REALIZADO",
      data: { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) },
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    include: {
      clinica: { select: { nome: true, cnpj: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true, cpf: true } },
      repasse: { select: { status: true, pagoEm: true } },
      fatura: { select: { numero: true, status: true } },
    },
  });

  const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
  const limpo = (texto: string | null | undefined) => (texto ?? "").replace(/;/g, ",");

  const linhas = [
    [
      "Pedido",
      "Data",
      "Hora",
      "Clinica",
      "CNPJ",
      "Servico",
      "Profissional",
      "CPF",
      "Valor servico",
      "Repasse",
      "Margem",
      "Fatura",
      "Status fatura",
      "Status repasse",
      "Pago em",
    ].join(";"),
    ...pedidos.map((pedido) =>
      [
        pedido.numero,
        formatarData(pedido.data),
        pedido.horaInicio,
        limpo(pedido.clinica.nome),
        limpo(pedido.clinica.cnpj),
        limpo(pedido.servico.nome),
        limpo(pedido.profissional?.nome),
        limpo(pedido.profissional?.cpf),
        reais(pedido.valorServicoCentavos),
        reais(pedido.valorRepasseCentavos),
        reais(pedido.valorServicoCentavos - pedido.valorRepasseCentavos),
        pedido.fatura?.numero ?? "",
        pedido.fatura?.status ?? "NAO_FATURADO",
        pedido.repasse?.status ?? "",
        pedido.repasse?.pagoEm ? formatarData(pedido.repasse.pagoEm) : "",
      ].join(";")
    ),
  ];

  // BOM na frente para o Excel reconhecer o UTF-8 e não quebrar os acentos.
  return new Response(`﻿${linhas.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hemoderi-${competencia}.csv"`,
    },
  });
}
