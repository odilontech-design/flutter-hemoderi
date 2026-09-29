import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Kpi, Titulo } from "@/components/ui";
import { ListaCupons } from "./ListaCupons";

export const dynamic = "force-dynamic";

/**
 * Gestão de cupons de desconto (decisão do André).
 *
 * A equipe cria cupons configuráveis: tipo (% ou R$), serviços elegíveis,
 * validade por data e/ou quantidade. O cupom é aplicado na fatura pelo
 * financeiro/pós-venda, DEPOIS que a fatura é fechada e ANTES de gerar a
 * cobrança Pix — o preço do serviço não muda; o que muda é quanto a clínica
 * paga naquela competência.
 *
 * Restrita ao responsável: criar desconto é decisão comercial.
 */
export default async function Cupons() {
  await exigirResponsavel();

  const [cupons, servicos] = await Promise.all([
    prisma.cupomDesconto.findMany({
      orderBy: [{ ativo: "desc" }, { criadoEm: "desc" }],
    }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const ativos = cupons.filter((c) => c.ativo).length;
  const totalUsos = cupons.reduce((s, c) => s + c.usosRealizados, 0);

  return (
    <>
      <Titulo>Cupons de desconto</Titulo>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Kpi rotulo="Cupons ativos" valor={String(ativos)} />
        <Kpi rotulo="Total de cupons" valor={String(cupons.length)} />
        <Kpi rotulo="Usos realizados" valor={String(totalUsos)} />
      </div>

      <Cartao>
        <div className="font-display font-bold text-bordo text-sm mb-3">Cupons</div>
        <div className="text-[11px] text-gray-500 mb-3">
          Crie cupons com desconto em % ou valor fixo (R$). Selecione os serviços elegíveis, defina
          validade e limite de usos. O cupom é aplicado na fatura pelo financeiro, depois do
          fechamento do mês.
        </div>
        <ListaCupons cupons={cupons} servicos={servicos} />
      </Cartao>
    </>
  );
}
