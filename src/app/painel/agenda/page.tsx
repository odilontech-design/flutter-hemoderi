import Link from "next/link";
import type { Prisma, StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { dataDaURL, dataDeISO, formatarData, formatarDataCurta, hojeISO, isoDeData, somarDias } from "@/lib/data";
import { paraMinutos } from "@/lib/data";
import { parametros } from "@/lib/alocacao";
import { COR_STATUS, ROTULO_STATUS, STATUS_ATIVOS } from "@/lib/pedido";
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

  const [pedidos, profissionais, clinicas, servicos, config] = await Promise.all([
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
    parametros(),
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
        <GradeCalendario
          pedidos={pedidos}
          inicio={inicio}
          dias={dias}
          horaAbertura={config.horaAbertura}
          horaFechamento={config.horaFechamento}
        />
      )}
    </>
  );
}

type PedidoNaAgenda = {
  id: string;
  data: Date;
  horaInicio: string;
  duracaoMin: number;
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

/**
 * Visão de período no formato de calendário (ata de 28/09): horas na vertical,
 * dias em colunas, cada atendimento é um bloco posicionado pela hora e com
 * altura proporcional à duração — o "modelo Google Agenda" que o André pediu.
 *
 * A lista cronológica anterior respondia "o que tem", mas não "onde tem
 * buraco de duas horas na quarta": para achar folga a pessoa somava horários
 * de cabeça. Na grade o vazio é espaço em branco, que é como a operação já
 * lê uma agenda.
 *
 * A faixa de horas vem do funcionamento da operação (Parametros), não fixa:
 * mostrar 00h–23h encheria a tela de vazio onde ninguém atende. Um bloco que
 * comece antes da abertura (raro, um dado antigo) é fixado no topo em vez de
 * escapar para cima da grade.
 */
const ALTURA_HORA_PX = 48;

function GradeCalendario({
  pedidos,
  inicio,
  dias,
  horaAbertura,
  horaFechamento,
}: {
  pedidos: PedidoNaAgenda[];
  inicio: Date;
  dias: number;
  horaAbertura: string;
  horaFechamento: string;
}) {
  const minInicio = paraMinutos(horaAbertura);
  const minFim = paraMinutos(horaFechamento);
  const horas: number[] = [];
  for (let h = Math.floor(minInicio / 60); h <= Math.ceil(minFim / 60); h++) horas.push(h);
  const alturaTotal = ((minFim - minInicio) / 60) * ALTURA_HORA_PX;

  const hojeIso = hojeISO();
  const colunas = Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(inicio, i);
    const iso = isoDeData(dia);
    return {
      iso,
      dia,
      hoje: iso === hojeIso,
      lista: pedidos
        .filter((p) => isoDeData(p.data) === iso)
        .sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio)),
    };
  });

  return (
    <Cartao className="!p-0 overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Cabeçalho dos dias, alinhado à faixa de horas da esquerda. */}
        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="w-12 shrink-0" />
          {colunas.map((c) => (
            <div
              key={c.iso}
              className={`flex-1 min-w-[80px] px-2 py-2 text-center border-l border-gray-100 ${
                c.hoje ? "bg-bordo/5" : ""
              }`}
            >
              <div className={`text-[11px] font-semibold ${c.hoje ? "text-bordo" : "text-gray-600"}`}>
                {c.dia.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" }).replace(".", "")}
              </div>
              <div className="text-[10px] text-gray-400">
                {c.dia.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Coluna das horas. */}
          <div className="w-12 shrink-0 relative" style={{ height: alturaTotal }}>
            {horas.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400"
                style={{ top: ((h * 60 - minInicio) / 60) * ALTURA_HORA_PX }}
              >
                {String(h).padStart(2, "0")}h
              </div>
            ))}
          </div>

          {/* Uma coluna por dia, com os blocos posicionados. */}
          {colunas.map((c) => (
            <div
              key={c.iso}
              className={`flex-1 min-w-[80px] relative border-l border-gray-100 ${c.hoje ? "bg-bordo/5" : ""}`}
              style={{ height: alturaTotal }}
            >
              {/* Linhas de hora, para o olho ancorar. */}
              {horas.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: ((h * 60 - minInicio) / 60) * ALTURA_HORA_PX }}
                />
              ))}

              {c.lista.map((pedido) => {
                const inicioMin = paraMinutos(pedido.horaInicio);
                const top = Math.max(((inicioMin - minInicio) / 60) * ALTURA_HORA_PX, 0);
                const altura = Math.max((pedido.duracaoMin / 60) * ALTURA_HORA_PX, 22);
                const semProfissional = !pedido.profissionalId;
                return (
                  <Link
                    key={pedido.id}
                    href={`/painel/pedidos/${pedido.id}`}
                    title={`${pedido.horaInicio} · ${pedido.clinica.nome} · ${pedido.servico.nome} · ${
                      pedido.profissional?.nome ?? "sem profissional"
                    } · ${ROTULO_STATUS[pedido.status]}`}
                    className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden border-l-2 ${
                      semProfissional ? "border-red-500 bg-red-50" : "border-bordo/40"
                    } ${COR_STATUS[pedido.status]}`}
                    style={{ top, height: altura }}
                  >
                    <div className="text-[10px] font-semibold leading-tight truncate">
                      {pedido.horaInicio} {pedido.clinica.nome}
                    </div>
                    <div className="text-[9px] leading-tight truncate opacity-80">{pedido.servico.nome}</div>
                    {semProfissional && (
                      <div className="text-[9px] font-semibold leading-tight text-red-600 truncate">
                        sem profissional
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Cartao>
  );
}
