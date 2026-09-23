import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { familiaDoNome } from "@/lib/familia";

export const dynamic = "force-dynamic";

/**
 * A página de detalhe atrás do hiperlink de cada procedimento na vitrine —
 * pedido explícito da ata de 21/09. Existe para servir link de campanha e
 * biografia de rede social direto num procedimento específico, não só na
 * vitrine inteira; o preço continua de fora, pelo mesmo motivo da vitrine:
 * quem cobra é a central, depois de saber a clínica e a condição.
 */
export default async function DetalheServico({ params }: { params: { id: string } }) {
  const servico = await prisma.servico.findFirst({
    where: { id: params.id, ativo: true },
    select: { id: true, nome: true, descricao: true, duracaoMin: true, familia: true, categoria: true },
  });
  if (!servico) notFound();

  const familia = servico.familia?.trim() || familiaDoNome(servico.nome);

  return (
    <div className="min-h-screen bg-bege">
      <header className="bg-bordoEscuro text-white">
        <div className="max-w-3xl mx-auto px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG externo, sem ganho no otimizador */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-10 w-auto object-contain object-left" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 sm:py-12">
        <Link href="/agendar" className="text-[11px] font-semibold text-bordo hover:underline">
          ← voltar para o agendamento
        </Link>

        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-4">{familia}</div>
        <h1 className="font-display font-extrabold text-bordo text-2xl sm:text-3xl mt-1">{servico.nome}</h1>
        <div className="text-xs text-gray-500 mt-1">{servico.duracaoMin} minutos</div>

        <p className="text-sm text-gray-600 mt-4 leading-relaxed max-w-xl">
          {servico.descricao ?? "Profissional e equipamento levados até a sua clínica no dia combinado."}
        </p>

        <Link
          href={`/agendar?servico=${servico.id}`}
          className="mt-6 inline-flex items-center gap-2 bg-bordo text-white text-sm font-semibold px-5 py-3 rounded-lg hover:bg-bordoEscuro"
        >
          Agendar este procedimento →
        </Link>
      </main>

      <footer className="max-w-3xl mx-auto px-5 py-8 text-[11px] text-gray-400 border-t border-gray-200 mt-8">
        Hemoderi · Operações. Feito com ❤️ por Dilon Tech.
      </footer>
    </div>
  );
}
