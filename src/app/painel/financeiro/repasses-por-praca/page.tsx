import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarReais } from "@/lib/dinheiro";
import { PRACAS } from "@/lib/praca";
import { ImportarPlanilha } from "./ImportarPlanilha";

export const dynamic = "force-dynamic";

/**
 * Repasses por praça (ata de 20/10): quanto o profissional recebe por
 * serviço em cada praça. Entra pela planilha que o pós-venda preenche; vale
 * para as próximas alocações (o repasse de cada pedido é congelado quando o
 * profissional é alocado). Sem regra na praça, vale a cadeia de sempre:
 * serviço, profissional, grupo e o percentual padrão (lib/repasse.ts).
 */
export default async function RepassesPorPraca() {
  await exigirResponsavel();
  const [servicos, config] = await Promise.all([
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: [{ familia: "asc" }, { valorPadraoCentavos: "asc" }],
      select: {
        id: true,
        nome: true,
        valorPadraoCentavos: true,
        repassesPorPraca: { select: { praca: true, percent: true, fixoCentavos: true } },
      },
    }),
    prisma.parametros.findUnique({ where: { id: "hemoderi" }, select: { repassePercentPadrao: true } }),
  ]);
  const comRegra = servicos.filter((s) => s.repassesPorPraca.length > 0).length;

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/financeiro" className="text-xs font-semibold text-bordo hover:underline">
            ← Financeiro
          </Link>
        }
      >
        Repasses por praça
      </Titulo>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-3 items-start">
        <Cartao>
          <div className="text-[11px] text-gray-500 mb-3">
            {comRegra} de {servicos.length} serviços com tabela por praça. Sem regra na praça, vale o percentual padrão da
            operação ({config?.repassePercentPadrao ?? "—"}%) ou a regra do profissional/grupo.
          </div>
          {servicos.length === 0 ? (
            <Vazio>Nenhum serviço ativo.</Vazio>
          ) : (
            <Tabela cabecalho={["Serviço", "Valor", ...PRACAS.map((p) => p.rotulo)]}>
              {servicos.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3 text-gray-700">{s.nome}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-gray-500">{formatarReais(s.valorPadraoCentavos)}</td>
                  {PRACAS.map((p) => {
                    const r = s.repassesPorPraca.find((x) => x.praca === p.chave);
                    return (
                      <td key={p.chave} className="py-1.5 pr-3 whitespace-nowrap">
                        {!r ? (
                          <span className="text-gray-300">—</span>
                        ) : r.fixoCentavos != null ? (
                          <span className="font-semibold">{formatarReais(r.fixoCentavos)}</span>
                        ) : (
                          <span className="font-semibold">
                            {String(r.percent).replace(".", ",")}%
                            <span className="block text-[10px] font-normal text-gray-400">
                              {formatarReais(Math.round((s.valorPadraoCentavos * (r.percent ?? 0)) / 100))}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Importar planilha</div>
          <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            A planilha &quot;Repasses por praça&quot; preenchida pelo pós-venda: % do valor ou valor fixo de cada serviço em
            cada praça. A praça de cada atendimento sai do endereço: Grande SP (39 municípios), interior de SP, RJ, PR,
            ES ou demais estados.
          </div>
          <ImportarPlanilha />
        </Cartao>
      </div>
    </>
  );
}
