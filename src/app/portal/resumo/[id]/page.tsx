import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { formatarData, instanteDoAtendimento } from "@/lib/data";
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
 * Só o essencial (ata de 13/10): clínica, endereço, data, horário, serviço e
 * status, numa faixa horizontal. Pagamento e paciente saíram — repetir esses
 * dados aqui gerava insegurança em quem confere de relance; continuam no Editar.
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
  const duracaoTotal = membros.reduce((soma, m) => soma + m.duracaoMin, 0);
  const local = primeiro.endereco ?? primeiro.clinica;
  const onde = resumoDoEndereco(local);
  const nomeDoLocal = primeiro.endereco?.rotulo ?? primeiro.clinica.nome;
  const nomes = membros.map((m) => m.servico.nome).join(" + ");

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

      <Cartao className="max-w-4xl">
        <div className="font-display font-bold text-bordo text-base mb-1">Agendamento registrado</div>
        <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
          A central confere a agenda, confirma e avisa pelo WhatsApp. Depois disso, o status passa a Confirmado.
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-6 gap-x-6 gap-y-4 text-xs">
          <div className="col-span-2 lg:col-span-1">
            <dt className="text-gray-400">Clínica</dt>
            <dd className="text-gray-800 font-semibold">{nomeDoLocal}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-400">Endereço</dt>
            <dd className="text-gray-800">{onde || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Data</dt>
            <dd className="text-gray-800 font-semibold">{formatarData(primeiro.data)}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Horário</dt>
            <dd className="text-gray-800 font-semibold">{primeiro.horaInicio}</dd>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <dt className="text-gray-400">Status</dt>
            <dd>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                {ROTULO_STATUS_CLIENTE[primeiro.status]}
              </span>
            </dd>
          </div>
          <div className="col-span-2 lg:col-span-6">
            <dt className="text-gray-400 mb-0.5">{membros.length > 1 ? `Serviços (${membros.length}, um depois do outro)` : "Serviço"}</dt>
            <dd>
              <ul className="space-y-0.5">
                {membros.map((m) => (
                  <li key={m.id} className="text-gray-800">
                    {m.servico.nome}
                    {m.quantidade > 1 && <span className="text-gray-400"> × {m.quantidade}</span>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
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
