import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { formatarData, instanteDoAtendimento } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { linkAdicionarGoogleAgenda } from "@/lib/google-calendar-link";
import { resumoDoEndereco } from "@/lib/endereco";
import { ROTULO_STATUS_CLIENTE, STATUS_ATIVOS } from "@/lib/pedido";

export const dynamic = "force-dynamic";

/**
 * O resumo do agendamento (ata de 05/10): é a CONFIRMAÇÃO FINAL do cliente. Ele
 * chega aqui logo depois de solicitar e vê tudo o que ficou registrado, com
 * três saídas — OK (volta aos agendamentos), Google Agenda (abre em outra aba,
 * para não interromper o fluxo) e Editar.
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
  const total = membros.reduce((soma, m) => soma + m.valorServicoCentavos, 0);
  const duracaoTotal = membros.reduce((soma, m) => soma + m.duracaoMin, 0);
  const local = primeiro.endereco ?? primeiro.clinica;
  const onde = resumoDoEndereco(local);
  const nomeDoLocal = primeiro.endereco?.rotulo ?? primeiro.clinica.nome;
  const nomes = membros.map((m) => m.servico.nome).join(" + ");

  const linkAgenda = linkAdicionarGoogleAgenda({
    titulo: `${nomes} — Hemoderi`,
    inicio: instanteDoAtendimento(primeiro.data, primeiro.horaInicio),
    duracaoMin: duracaoTotal,
    local: onde || undefined,
    detalhes: primeiro.doutorNome ? `Doutor(a) responsável: ${primeiro.doutorNome}` : undefined,
  });

  return (
    <>
      <Titulo>Resumo do agendamento</Titulo>

      <Cartao className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-display font-bold text-bordo text-base">Agendamento registrado</span>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
            {ROTULO_STATUS_CLIENTE[primeiro.status]}
          </span>
        </div>
        <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
          A central confere a agenda, confirma e avisa pelo WhatsApp. Depois disso, o status passa a Confirmado.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <div>
            <div className="text-gray-400">Quando</div>
            <div className="text-gray-800 font-semibold">
              {formatarData(primeiro.data)} às {primeiro.horaInicio}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Onde</div>
            <div className="text-gray-800">
              <strong>{nomeDoLocal}</strong>
              {onde && <div className="text-gray-500">{onde}</div>}
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="text-gray-400 mb-0.5">
              {membros.length > 1 ? `${membros.length} serviços, um depois do outro` : "Serviço"}
            </div>
            <ul className="space-y-0.5">
              {membros.map((m) => (
                <li key={m.id} className="text-gray-800">
                  {m.servico.nome}
                  {m.quantidade > 1 && <span className="text-gray-400"> × {m.quantidade}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-gray-400">Doutor(a) responsável</div>
            <div className="text-gray-800">{primeiro.doutorNome ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-400">Contato da clínica</div>
            <div className="text-gray-800">{primeiro.contatoClinica ?? "—"}</div>
          </div>
          {primeiro.pacienteNome && (
            <div>
              <div className="text-gray-400">Paciente</div>
              <div className="text-gray-800">{primeiro.pacienteNome}</div>
            </div>
          )}
          <div>
            <div className="text-gray-400">Procedimento no paciente</div>
            <div className="text-gray-800">{primeiro.procedimentoPaciente ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-400">Forma de pagamento</div>
            <div className="text-gray-800">{primeiro.formaPagamento ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-400">Valor</div>
            <div className="text-gray-800 font-semibold">{total > 0 ? formatarReais(total) : "sob consulta"}</div>
          </div>
          {primeiro.observacoes && (
            <div className="sm:col-span-2">
              <div className="text-gray-400">Observações</div>
              <div className="text-gray-700">{primeiro.observacoes}</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-gray-100">
          <Link
            href="/portal"
            className="bg-bordo text-white text-xs font-semibold px-5 py-2.5 min-h-[40px] inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            OK
          </Link>
          {/* Nova aba: a pessoa guarda o horário sem perder esta tela. */}
          <a
            href={linkAgenda}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-300 text-bordo text-xs font-semibold px-4 py-2.5 min-h-[40px] inline-flex items-center rounded-lg hover:bg-gray-50"
          >
            Google Agenda
          </a>
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
