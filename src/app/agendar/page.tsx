import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parametros } from "@/lib/alocacao";
import { agruparPorFamilia } from "@/lib/familia";
import { linkWhatsapp } from "@/lib/whatsapp-link";
import { dataMinimaAgendamentoPublico } from "@/lib/data";
import { VitrineAgendamento } from "./VitrineAgendamento";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agendar atendimento | Hemoderi",
  description:
    "Escolha o procedimento e a data. A central confirma o horário e o profissional — sem cadastro para começar.",
};

/**
 * A porta de entrada pública.
 *
 * Decisão da ata de 14/09: quem chega escolhe o procedimento e a data ANTES
 * de se identificar. O cadastro acontece no fim, e só com o que a central
 * precisa para ligar de volta. Pedir login antes de mostrar o que existe é
 * onde a clínica nova desiste — a comparação que o André fez foi com pedir
 * comida: o cardápio vem antes da conta.
 */
export default async function AgendamentoPublico({ searchParams }: { searchParams: { servico?: string } }) {
  const [servicos, config] = await Promise.all([
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, descricao: true, duracaoMin: true, familia: true, categoria: true },
    }),
    parametros(),
  ]);

  const grupos = agruparPorFamilia(servicos);
  const whatsapp = linkWhatsapp(
    config.whatsapp,
    "Olá! Quero agendar um atendimento da Hemoderi."
  );

  return (
    <div className="min-h-screen bg-bege">
      <header className="bg-bordoEscuro text-white">
        <div className="max-w-5xl mx-auto px-5 py-5 flex flex-wrap items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- mesma razão
              do menu lateral: SVG externo, sem ganho no otimizador. */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-10 w-auto object-contain object-left" />
          <div className="flex items-center gap-3 text-xs">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white/80 hover:text-white"
              >
                Falar com a central
              </a>
            )}
            <Link
              href="/login"
              className="border border-white/25 rounded-lg px-3 py-2 font-semibold hover:bg-white/10"
            >
              Já sou cliente
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 sm:py-12">
        <h1 className="font-display font-extrabold text-bordo text-2xl sm:text-3xl max-w-2xl">
          Profissional e equipamento na sua clínica, no dia que você marcar.
        </h1>
        <p className="text-sm text-gray-600 mt-3 max-w-2xl leading-relaxed">
          Escolha o procedimento e o dia. A central confirma o horário e quem vai atender —
          você só precisa se identificar no fim, e o cadastro é feito junto.
        </p>

        <VitrineAgendamento
          grupos={grupos}
          horaAbertura={config.horaAbertura}
          horaFechamento={config.horaFechamento}
          whatsapp={whatsapp}
          dataMinima={dataMinimaAgendamentoPublico()}
          servicoInicialId={searchParams.servico ?? null}
        />
      </main>

      <footer className="max-w-5xl mx-auto px-5 py-8 text-[11px] text-gray-400 border-t border-gray-200 mt-8">
        Hemoderi · Operações. Feito com ❤️ por Dilon Tech.
      </footer>
    </div>
  );
}
