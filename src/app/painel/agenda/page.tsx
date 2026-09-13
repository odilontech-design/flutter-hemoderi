import Link from "next/link";
import type { Prisma, StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { dataDaURL, dataDeISO, formatarData, formatarDataCurta, hojeISO, isoDeData, somarDias } from "@/lib/data";
import { paraMinutos } from "@/lib/data";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { FiltrosAgenda } from "./FiltrosAgenda";
import { urlAgenda, type ValoresFiltro } from "./filtros";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS: StatusPedido[] = [
  "SOLICITADO",
  "CONFIRMADO",
  "ALOCADO",
  "REALIZADO",
  "FALTOU",
  "CANCELADO",
];

/**
 * Traduz o filtro de status da URL para a cláusula do banco.
 *
 * O padrão (vazio) esconde cancelado: quem abre a agenda quer saber o que vai
 * acontecer, e atendimento cancelado não vai. Mas continua alcançável — a
 * equipe precisa conferir o que foi desmarcado quando a clínica reclama.
 */
function filtroDeStatus(status: string): Prisma.PedidoWhereInput {
  if (status === "TUDO") return {};
  if (status === "ATIVOS") return { status: { in: STATUS_ATIVOS } };
  if (STATUS_VALIDOS.includes(status as StatusPedido)) return { status: status as StatusPedido };
  return { status: { notIn: ["CANCELADO"] } };
}

/**
 * A agenda. Responde duas perguntas diferentes, e por isso tem duas caras:
 *
 *   • Um dia só → agrupada por profissional, que é como a equipe pensa na
 *     hora de encaixar alguém ("quem está livre às 14h?"). Só aqui aparecem
 *     janela declarada, ausência e quem está ocioso — são informações do dia,
 *     e espalhá-las por uma quinzena diria coisa errada.
 *   • Um período → em ordem de dia e hora, com os dias vazios à mostra. Aqui
 *     a pergunta é outra ("como está a semana, onde tem buraco"), e o vazio
 *     é justamente o que se procura.
 */
export default async function Agenda({
  searchParams,
}: {
  searchParams: {
    data?: string;
    dias?: string;
    profissional?: string;
    clinica?: string;
    servico?: string;
    status?: string;
    todos?: string;
  };
}) {
  await exigirInterno();

  const dataISO = dataDaURL(searchParams.data);
  const inicio = dataDeISO(dataISO);
  const dias = Math.min(Math.max(Number(searchParams.dias) || 1, 1), 15);
  const fim = somarDias(inicio, dias - 1);
  const umDiaSo = dias === 1;
  const mostrarTodos = searchParams.todos === "1";

  const valores: ValoresFiltro = {
    data: dataISO,
    dias: String(dias),
    profissional: searchParams.profissional ?? "",
    clinica: searchParams.clinica ?? "",
    servico: searchParams.servico ?? "",
    status: searchParams.status ?? "",
    todos: searchParams.todos === "1" ? "1" : "",
  };
  const temFiltroAtivo = Boolean(
    valores.profissional || valores.clinica || valores.servico || valores.status
  );

  const [pedidos, profissionais, clinicas, servicos] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        data: { gte: inicio, lte: fim },
        ...filtroDeStatus(valores.status),
        ...(valores.profissional ? { profissionalId: valores.profissional } : {}),
        ...(valores.clinica ? { clinicaId: valores.clinica } : {}),
        ...(valores.servico ? { servicoId: valores.servico } : {}),
      },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: {
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.profissional.findMany({
      where: { ativo: true, ...(valores.profissional ? { id: valores.profissional } : {}) },
      orderBy: { nome: "asc" },
      include: {
        disponibilidades: true,
        bloqueios: { where: { data: { gte: inicio, lte: fim } } },
      },
    }),
    prisma.clinica.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.servico.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  // Para o seletor, a lista precisa ser de TODOS os profissionais ativos —
  // senão, filtrar por um deles apagaria os outros do próprio seletor e não
  // haveria como trocar de profissional sem limpar o filtro antes.
  const profissionaisDoSeletor = valores.profissional
    ? await prisma.profissional.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      })
    : profissionais.map((p) => ({ id: p.id, nome: p.nome }));

  const semProfissional = pedidos.filter((p) => !p.profissionalId);

  const cabecalho = umDiaSo
    ? `Agenda · ${formatarData(inicio)}`
    : `Agenda · ${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}`;

  return (
    <>
      <Titulo
        acao={
          <div className="flex items-center gap-1 text-xs">
            <Link
              href={urlAgenda(valores, { data: isoDeData(somarDias(inicio, -dias)) })}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ‹ anterior
            </Link>
            <Link
              href={urlAgenda(valores, { data: hojeISO() })}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-bordo font-semibold"
            >
              hoje
            </Link>
            <Link
              href={urlAgenda(valores, { data: isoDeData(somarDias(inicio, dias)) })}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              seguinte ›
            </Link>
          </div>
        }
      >
        {cabecalho}
      </Titulo>

      <FiltrosAgenda
        valores={valores}
        profissionais={profissionaisDoSeletor}
        clinicas={clinicas}
        servicos={servicos}
        temFiltroAtivo={temFiltroAtivo}
      />

      <div className="text-[11px] text-gray-500 mb-3">
        <strong className="text-bordo">{pedidos.length}</strong> atendimento(s)
        {umDiaSo ? " neste dia" : ` em ${dias} dias`}
        {temFiltroAtivo && " · com filtro aplicado"}
        {semProfissional.length > 0 && (
          <>
            {" · "}
            <strong className="text-red-600">{semProfissional.length}</strong> sem profissional
          </>
        )}
      </div>

      {semProfissional.length > 0 && (
        <Cartao className="mb-3 border-red-200">
          <div className="font-display font-bold text-red-600 text-sm mb-2">
            {semProfissional.length} atendimento(s) sem profissional
          </div>
          <div className="space-y-1">
            {semProfissional.map((pedido) => (
              <div key={pedido.id} className="text-xs text-gray-600">
                {!umDiaSo && <span className="text-gray-400">{formatarDataCurta(pedido.data)} · </span>}
                {pedido.horaInicio} · {pedido.clinica.nome} · {pedido.servico.nome}{" "}
                <Link href="/painel/pedidos" className="text-bordo font-semibold">
                  alocar
                </Link>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {umDiaSo ? (
        <PorProfissional
          pedidos={pedidos}
          profissionais={profissionais}
          data={inicio}
          valores={valores}
          mostrarTodos={mostrarTodos}
        />
      ) : (
        <PorDia pedidos={pedidos} inicio={inicio} dias={dias} />
      )}
    </>
  );
}

type PedidoNaAgenda = {
  id: string;
  data: Date;
  horaInicio: string;
  status: StatusPedido;
  profissionalId: string | null;
  clinica: { nome: string };
  servico: { nome: string };
  profissional: { nome: string } | null;
};

/** Visão de um dia, agrupada por profissional. */
function PorProfissional({
  pedidos,
  profissionais,
  data,
  valores,
  mostrarTodos,
}: {
  pedidos: PedidoNaAgenda[];
  profissionais: {
    id: string;
    nome: string;
    disponibilidades: { diaSemana: number; horaInicio: string; horaFim: string }[];
    bloqueios: unknown[];
  }[];
  data: Date;
  valores: ValoresFiltro;
  mostrarTodos: boolean;
}) {
  // Com meia dúzia de profissionais, mostrar todo mundo (mesmo ocioso) é
  // natural; com dezenas, a maioria ociosa vira ruído que esconde quem
  // importa hoje. Fica de fora quem não tem atendimento, não declarou
  // expediente para este dia da semana e não marcou ausência.
  const linhas = profissionais.map((profissional) => {
    const meus = pedidos
      .filter((p) => p.profissionalId === profissional.id)
      .sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio));
    const janelas = profissional.disponibilidades.filter((d) => d.diaSemana === data.getUTCDay());
    const ausente = profissional.bloqueios.length > 0;
    return { profissional, meus, janelas, ausente, relevante: meus.length > 0 || janelas.length > 0 || ausente };
  });

  const visiveis = mostrarTodos ? linhas : linhas.filter((l) => l.relevante);
  const ociosos = linhas.length - linhas.filter((l) => l.relevante).length;

  return (
    <>
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
                  <div key={pedido.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold w-12 shrink-0">{pedido.horaInicio}</span>
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
            <Vazio>Ninguém com agenda ou expediente declarado para este dia.</Vazio>
          </Cartao>
        )}
      </div>

      {profissionais.length > 0 && (
        <div className="text-[11px] text-gray-400 mt-3">
          {mostrarTodos ? (
            <Link href={urlAgenda(valores, { todos: "" })} className="text-bordo font-semibold">
              Mostrar só quem tem agenda neste dia
            </Link>
          ) : ociosos > 0 ? (
            <Link href={urlAgenda(valores, { todos: "1" })} className="text-bordo font-semibold">
              + {ociosos} profissional(is) sem nada e sem expediente declarado — mostrar mesmo assim
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Visão de período, em ordem cronológica, com os dias vazios à mostra. */
function PorDia({ pedidos, inicio, dias }: { pedidos: PedidoNaAgenda[]; inicio: Date; dias: number }) {
  const porDia = new Map<string, PedidoNaAgenda[]>();
  for (const pedido of pedidos) {
    const chave = isoDeData(pedido.data);
    const lista = porDia.get(chave);
    if (lista) lista.push(pedido);
    else porDia.set(chave, [pedido]);
  }

  const doPeriodo = Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(inicio, i);
    return { dia, chave: isoDeData(dia), lista: porDia.get(isoDeData(dia)) ?? [] };
  });

  return (
    <div className="space-y-2">
      {doPeriodo.map(({ dia, chave, lista }) => (
        <Cartao key={chave} className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="font-semibold text-bordo text-sm">{formatarData(dia)}</div>
            <div className="text-[10px] text-gray-400">
              {lista.length === 0 ? "nada marcado" : `${lista.length} atendimento(s)`}
            </div>
          </div>

          {lista.length === 0 ? (
            <div className="text-[11px] text-gray-300">—</div>
          ) : (
            <div className="space-y-1">
              {lista.map((pedido) => (
                <div key={pedido.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold w-12 shrink-0">{pedido.horaInicio}</span>
                  <span className="text-gray-700">{pedido.clinica.nome}</span>
                  <span className="text-gray-400">{pedido.servico.nome}</span>
                  <span className="text-gray-500">
                    {pedido.profissional?.nome ?? <span className="text-red-600 font-semibold">sem profissional</span>}
                  </span>
                  <SeloStatus status={pedido.status} />
                </div>
              ))}
            </div>
          )}
        </Cartao>
      ))}
    </div>
  );
}
