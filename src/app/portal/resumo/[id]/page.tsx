import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { formatarData, instanteDoAtendimento, nomeDoProfissionalVisivel } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { resumoDoEndereco } from "@/lib/endereco";
import { AdicionarAgenda } from "@/components/AdicionarAgenda";
import { ROTULO_STATUS_CLIENTE, STATUS_ATIVOS } from "@/lib/pedido";

export const dynamic = "force-dynamic";

/**
 * O resumo do agendamento (ata de 05/10): é a CONFIRMAÇÃO FINAL do cliente. Ele
 * chega aqui logo depois de solicitar, com três saídas — OK (volta aos
 * agendamentos), Adicionar à sua agenda (Google ou .ics, sem sair desta tela)
 * e Editar.
 *
 * Em lista (ata de 20/10), na ordem em que a clínica confere: data, horário,
 * endereço, clínica, doutor, serviço, profissional Hemoderi, valor, quem
 * agendou e o telefone de contato — legível de relance também no celular. O
 * valor voltou (ata de 20/10) para a clínica conferir o que vai pagar; o
 * paciente continua fora. O profissional só aparece 24h antes, como no resto
 * do portal.
 *
 * Os serviços de uma mesma visita aparecem juntos, na ordem em que acontecem.
 */
export default async function ResumoDoAgendamento({ params }: { params: { id: string } }) {
  const sessao = await exigirClinica();

  const pedido = await prisma.pedido.findFirst({
    where: { id: params.id, clinicaId: sessao.clinicaId },
    select: { id: true, grupoId: true },
  });
  if (!pedido) notFound();

  const membros = await prisma.pedido.findMany({
    where: { clinicaId: sessao.clinicaId, ...(pedido.grupoId ? { grupoId: pedido.grupoId } : { id: pedido.id }) },
    orderBy: [{ horaInicio: "asc" }, { numero: "asc" }],
    include: {
      servico: { select: { nome: true } },
      profissional: { select: { nome: true } },
      criadoPor: { select: { nome: true } },
      endereco: {
        select: { rotulo: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true },
      },
      clinica: {
        select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true },
      },
    },
  });
  if (membros.length === 0) notFound();

  const primeiro = membros[0];
  const aindaAtivo = membros.some((m) => STATUS_ATIVOS.includes(m.status));
  const duracaoTotal = membros.reduce((soma, m) => soma + m.duracaoMin, 0);
  const local = primeiro.endereco ?? primeiro.clinica;
  const onde = resumoDoEndereco(local);
  const nomeDoLocal = primeiro.endereco?.rotulo ?? primeiro.clinica.nome;
  const nomes = membros.map((m) => m.servico.nome).join(" + ");

  const totalCentavos = membros.reduce((soma, m) => soma + m.valorServicoCentavos, 0);
  const profissionais = Array.from(
    new Set(membros.map((m) => m.profissional?.nome).filter((n): n is string => Boolean(n)))
  );
  const profissionalVisivel = nomeDoProfissionalVisivel(primeiro.data, primeiro.horaInicio);

  const linhas: [string, React.ReactNode][] = [
    ["Data", <strong key="d">{formatarData(primeiro.data)}</strong>],
    ["Horário", <strong key="h">{primeiro.horaInicio}</strong>],
    ["Endereço", onde || "—"],
    ["Clínica", nomeDoLocal],
    ["Doutor(a)", primeiro.doutorNome ?? "—"],
    [
      membros.length > 1 ? `Serviços (${membros.length})` : "Serviço",
      <ul key="s" className="space-y-0.5">
        {membros.map((m) => (
          <li key={m.id}>
            {m.servico.nome}
            {m.quantidade > 1 && <span className="text-gray-400"> × {m.quantidade}</span>}
            {membros.length > 1 && m.valorServicoCentavos > 0 && (
              <span className="text-gray-400"> · {formatarReais(m.valorServicoCentavos)}</span>
            )}
          </li>
        ))}
      </ul>,
    ],
    [
      "Profissional Hemoderi",
      !profissionalVisivel ? (
        <span key="p" className="text-gray-400">aparece 24h antes do atendimento</span>
      ) : profissionais.length > 0 ? (
        profissionais.join(", ")
      ) : (
        <span key="p" className="text-gray-400">a definir pela central</span>
      ),
    ],
    ["Valor", <strong key="v">{totalCentavos > 0 ? formatarReais(totalCentavos) : "sob consulta"}</strong>],
    ["Agendado por", primeiro.criadoPor?.nome ?? "Central Hemoderi"],
    ["Telefone de contato", primeiro.contatoClinica ?? "—"],
    [
      "Status",
      <span key="st" className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
        {ROTULO_STATUS_CLIENTE[primeiro.status]}
      </span>,
    ],
  ];

  const evento = {
    id: primeiro.id,
    titulo: `${nomes} — Hemoderi`,
    inicio: instanteDoAtendimento(primeiro.data, primeiro.horaInicio),
    duracaoMin: duracaoTotal,
    local: onde || undefined,
    detalhes: primeiro.doutorNome ? `Doutor(a) responsável: ${primeiro.doutorNome}` : undefined,
  };

  return (
    <>
      <Titulo>Resumo do agendamento</Titulo>

      <Cartao className="max-w-2xl">
        <div className="font-display font-bold text-bordo text-base mb-1">Agendamento registrado</div>
        <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
          A central confere a agenda, confirma e avisa pelo WhatsApp. Depois disso, o status passa a Confirmado.
        </div>

        <dl className="divide-y divide-gray-100 text-xs">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="grid grid-cols-[8.5rem_1fr] sm:grid-cols-[11rem_1fr] gap-3 py-2.5">
              <dt className="text-gray-400">{rotulo}</dt>
              <dd className="text-gray-800">{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-gray-100">
          <Link
            href="/portal"
            className="bg-bordo text-white text-xs font-semibold px-5 py-2.5 min-h-[40px] inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            OK
          </Link>
          {/* Google em nova aba ou .ics: a pessoa guarda o horário sem perder esta tela. */}
          <AdicionarAgenda evento={evento} />
          {aindaAtivo && (
            <Link
              href={`/portal/editar/${primeiro.id}`}
              className="border border-gray-300 text-bordo text-xs font-semibold px-4 py-2.5 min-h-[40px] inline-flex items-center rounded-lg hover:bg-gray-50"
            >
              Editar
            </Link>
          )}
        </div>
      </Cartao>
    </>
  );
}
