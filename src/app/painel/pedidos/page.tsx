import Link from "next/link";
import type { StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { STATUS_PENDENTES } from "@/lib/pedido";
import { AcoesPedido } from "./AcoesPedido";

export const dynamic = "force-dynamic";

const FILTROS: { chave: string; rotulo: string; status?: StatusPedido[] }[] = [
  { chave: "pendentes", rotulo: "Aguardando ação", status: STATUS_PENDENTES },
  { chave: "alocados", rotulo: "Alocados", status: ["ALOCADO"] },
  { chave: "fechados", rotulo: "Fechados", status: ["REALIZADO", "FALTOU"] },
  { chave: "cancelados", rotulo: "Cancelados", status: ["CANCELADO"] },
  { chave: "todos", rotulo: "Todos" },
];

/**
 * A esteira. É a tela de trabalho da equipe, e abre no filtro do que está
 * parado — não na lista completa: com 1.500 atendimentos por mês, uma lista
 * ordenada por data é um arquivo, não uma fila de trabalho.
 */
export default async function Esteira({ searchParams }: { searchParams: { filtro?: string } }) {
  await exigirInterno();

  const filtro = FILTROS.find((f) => f.chave === searchParams.filtro) ?? FILTROS[0];

  const [pedidos, profissionais] = await Promise.all([
    prisma.pedido.findMany({
      where: filtro.status ? { status: { in: filtro.status } } : {},
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: 200,
      include: {
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/painel/pedidos/novo"
            className="bg-navy text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-navyDeep"
          >
            + Novo pedido
          </Link>
        }
      >
        Esteira de pedidos
      </Titulo>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTROS.map((f) => (
          <Link
            key={f.chave}
            href={`/painel/pedidos?filtro=${f.chave}`}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
              f.chave === filtro.chave
                ? "bg-navy text-white border-navy"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <Cartao>
          <Vazio>Nada em {filtro.rotulo.toLowerCase()}.</Vazio>
        </Cartao>
      ) : (
        <div className="space-y-2">
          {pedidos.map((pedido) => (
            <Cartao key={pedido.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-bold text-navy text-sm">#{pedido.numero}</span>
                    <SeloStatus status={pedido.status} />
                    {pedido.origem === "PORTAL_CLINICA" && (
                      <span className="text-[9px] uppercase tracking-wide text-gray-400">portal</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-700">
                    {formatarDataCurta(pedido.data)} às {pedido.horaInicio} · {pedido.servico.nome}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {pedido.clinica.nome} ·{" "}
                    {pedido.profissional ? (
                      pedido.profissional.nome
                    ) : (
                      <span className="text-hemo font-semibold">sem profissional</span>
                    )}
                  </div>
                  {pedido.observacoes && (
                    <div className="text-[11px] text-gray-400 mt-1">{pedido.observacoes}</div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-navy">
                    {formatarReais(pedido.valorServicoCentavos)}
                  </div>
                  {pedido.valorRepasseCentavos > 0 && (
                    <div className="text-[10px] text-gray-400">
                      repasse {formatarReais(pedido.valorRepasseCentavos)}
                    </div>
                  )}
                </div>
              </div>

              <AcoesPedido
                pedidoId={pedido.id}
                status={pedido.status}
                profissionais={profissionais}
              />
            </Cartao>
          ))}
        </div>
      )}

      {pedidos.length === 200 && (
        <div className="text-[10px] text-gray-400 mt-4">
          Mostrando os 200 primeiros. Use os filtros para chegar no que importa.
        </div>
      )}
    </>
  );
}
