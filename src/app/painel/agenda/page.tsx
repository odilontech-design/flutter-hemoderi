import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { dataDeISO, formatarData, hojeISO, isoDeData, somarDias } from "@/lib/data";
import { paraMinutos } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * A agenda do dia, agrupada por profissional — que é como a equipe pensa
 * quando precisa encaixar alguém: "quem está livre às 14h?".
 */
export default async function Agenda({ searchParams }: { searchParams: { data?: string; todos?: string } }) {
  await exigirInterno();

  const dataISO = searchParams.data ?? hojeISO();
  const data = dataDeISO(dataISO);
  const mostrarTodos = searchParams.todos === "1";

  const [pedidos, profissionais] = await Promise.all([
    prisma.pedido.findMany({
      where: { data, status: { notIn: ["CANCELADO"] } },
      orderBy: { horaInicio: "asc" },
      include: {
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
      },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      include: {
        disponibilidades: true,
        bloqueios: { where: { data } },
      },
    }),
  ]);

  const semProfissional = pedidos.filter((p) => !p.profissionalId);

  // "Quem está livre às 14h" só é uma pergunta respondível olhando a lista
  // quando ela cabe na tela. Com meia dúzia de profissionais, mostrar todo
  // mundo (mesmo ocioso) é natural; com dezenas, a maioria ociosa vira ruído
  // que esconde quem realmente importa hoje. Fica de fora quem não tem
  // atendimento, não declarou expediente para este dia da semana e não
  // marcou ausência — não há nada ali para a equipe decidir a partir de.
  const linhas = profissionais.map((profissional) => {
    const meus = pedidos
      .filter((p) => p.profissionalId === profissional.id)
      .sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio));
    const janelas = profissional.disponibilidades.filter((d) => d.diaSemana === data.getUTCDay());
    const ausente = profissional.bloqueios.length > 0;
    const relevante = meus.length > 0 || janelas.length > 0 || ausente;
    return { profissional, meus, janelas, ausente, relevante };
  });

  const visiveis = mostrarTodos ? linhas : linhas.filter((l) => l.relevante);
  const ociosos = linhas.length - linhas.filter((l) => l.relevante).length;

  return (
    <>
      <Titulo
        acao={
          <div className="flex items-center gap-2 text-xs">
            <Link href={`/painel/agenda?data=${isoDeData(somarDias(data, -1))}`} className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500">
              ‹ anterior
            </Link>
            <Link href="/painel/agenda" className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-bordo font-semibold">
              hoje
            </Link>
            <Link href={`/painel/agenda?data=${isoDeData(somarDias(data, 1))}`} className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500">
              seguinte ›
            </Link>
          </div>
        }
      >
        Agenda · {formatarData(data)}
      </Titulo>

      {semProfissional.length > 0 && (
        <Cartao className="mb-3 border-red-200">
          <div className="font-display font-bold text-red-600 text-sm mb-2">
            {semProfissional.length} atendimento(s) sem profissional neste dia
          </div>
          <div className="space-y-1">
            {semProfissional.map((pedido) => (
              <div key={pedido.id} className="text-xs text-gray-600">
                {pedido.horaInicio} · {pedido.clinica.nome} · {pedido.servico.nome}{" "}
                <Link href="/painel/pedidos" className="text-bordo font-semibold">
                  alocar
                </Link>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <div className="space-y-2">
        {visiveis.map(({ profissional, meus, janelas, ausente }) => (
          <Cartao key={profissional.id} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="font-semibold text-bordo text-sm">{profissional.nome}</div>
              <div className="text-[10px] text-gray-400">
                {ausente
                  ? "ausência marcada"
                  : janelas.length > 0
                    ? janelas.map((j) => `${j.horaInicio}–${j.horaFim}`).join(", ")
                    : "sem disponibilidade declarada"}
              </div>
            </div>

            {meus.length === 0 ? (
              <div className="text-[11px] text-gray-400">Livre.</div>
            ) : (
              <div className="space-y-1">
                {meus.map((pedido) => (
                  <div key={pedido.id} className="flex items-center gap-2 text-xs">
                    <span className="font-semibold w-12">{pedido.horaInicio}</span>
                    <span className="text-gray-700">{pedido.clinica.nome}</span>
                    <span className="text-gray-400">{pedido.servico.nome}</span>
                    <SeloStatus status={pedido.status} />
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        ))}
        {profissionais.length === 0 && (
          <Cartao>
            <Vazio>Nenhum profissional ativo.</Vazio>
          </Cartao>
        )}
        {profissionais.length > 0 && visiveis.length === 0 && (
          <Cartao>
            <Vazio>Ninguém com agenda ou expediente declarado para hoje.</Vazio>
          </Cartao>
        )}
      </div>

      {profissionais.length > 0 && (
        <div className="text-[11px] text-gray-400 mt-3">
          {mostrarTodos ? (
            <Link href={`/painel/agenda?data=${dataISO}`} className="text-bordo font-semibold">
              Mostrar só quem tem agenda hoje
            </Link>
          ) : ociosos > 0 ? (
            <Link href={`/painel/agenda?data=${dataISO}&todos=1`} className="text-bordo font-semibold">
              + {ociosos} profissional(is) sem nada hoje e sem expediente declarado — mostrar mesmo assim
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}
