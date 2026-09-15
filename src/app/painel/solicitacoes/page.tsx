import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarData, formatarDataCurta } from "@/lib/data";
import { linkWhatsapp } from "@/lib/whatsapp-link";
import { TriarSolicitacao } from "./TriarSolicitacao";

export const dynamic = "force-dynamic";

/**
 * A antessala do agendamento público.
 *
 * Chega aqui quem pediu atendimento sem ter cadastro. A equipe confere e
 * decide: vincula a uma clínica existente (o telefone sugere qual) ou
 * cadastra a clínica nova e vincula depois. Só então vira agendamento na
 * esteira — a clínica é o escopo de preço, sala e fatura, e pedido sem ela é
 * pedido que a operação não consegue executar.
 */
export default async function Solicitacoes() {
  await exigirInterno();

  const [novas, tratadas, clinicas] = await Promise.all([
    prisma.solicitacaoPublica.findMany({
      where: { status: "NOVA" },
      orderBy: { criadaEm: "asc" },
      include: { servico: { select: { nome: true, duracaoMin: true } } },
    }),
    prisma.solicitacaoPublica.findMany({
      where: { status: { not: "NOVA" } },
      orderBy: { tratadaEm: "desc" },
      take: 20,
      include: {
        servico: { select: { nome: true } },
        clinica: { select: { nome: true } },
        pedido: { select: { id: true, numero: true } },
      },
    }),
    prisma.clinica.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, telefone: true },
    }),
  ]);

  // O telefone é a pista, não o veredito: casa pelos últimos oito dígitos
  // para ignorar DDI, nono dígito e formatação.
  const final = (t: string | null) => (t ?? "").replace(/\D/g, "").slice(-8);
  const porTelefone = new Map(clinicas.filter((c) => final(c.telefone).length === 8).map((c) => [final(c.telefone), c.id]));

  return (
    <>
      <Titulo>Pedidos do site</Titulo>

      <Cartao className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <div className="font-display font-bold text-bordo text-sm">
            {novas.length === 0 ? "Nada esperando" : `${novas.length} esperando triagem`}
          </div>
          <Link href="/agendar" target="_blank" className="text-[11px] text-bordo hover:underline">
            ver a página pública →
          </Link>
        </div>
        <div className="text-[11px] text-gray-500 mb-4">
          Quem pediu pelo site ainda não tem cadastro. Vincule à clínica certa — ou cadastre a
          clínica em <Link href="/painel/clinicas" className="text-bordo hover:underline">Clínicas</Link> e
          volte aqui.
        </div>

        {novas.length === 0 ? (
          <Vazio>Nenhum pedido novo pelo site.</Vazio>
        ) : (
          <div className="space-y-3">
            {novas.map((solicitacao) => {
              const sugeridaId = porTelefone.get(final(solicitacao.telefone)) ?? null;
              const whatsapp = linkWhatsapp(
                solicitacao.telefone,
                `Olá, ${solicitacao.solicitante.split(" ")[0]}! Aqui é da Hemoderi, sobre o seu pedido de ${solicitacao.servico.nome}.`
              );
              return (
                <div key={solicitacao.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-display font-bold text-bordo text-sm">
                      {solicitacao.clinicaNome}
                    </span>
                    <span className="text-xs text-gray-600">{solicitacao.solicitante}</span>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-green-700 hover:underline"
                      >
                        {solicitacao.telefone}
                      </a>
                    )}
                    {sugeridaId && (
                      <span className="text-[10px] font-semibold text-green-700">
                        telefone bate com cadastro
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-600 mt-1">
                    {solicitacao.servico.nome} · {formatarDataCurta(solicitacao.dataDesejada)} por volta
                    das {solicitacao.horarioDesejado} · {solicitacao.servico.duracaoMin} min
                  </div>
                  {(solicitacao.doutorNome || solicitacao.pacienteNome || solicitacao.observacoes) && (
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {solicitacao.doutorNome && <>Dr(a). {solicitacao.doutorNome} · </>}
                      {solicitacao.pacienteNome && <>paciente {solicitacao.pacienteNome} · </>}
                      {solicitacao.observacoes}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    recebido em {formatarData(solicitacao.criadaEm)}
                  </div>

                  <div className="mt-2">
                    <TriarSolicitacao
                      solicitacaoId={solicitacao.id}
                      clinicas={clinicas.map(({ id, nome }) => ({ id, nome }))}
                      sugeridaId={sugeridaId}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>

      <Cartao>
        <div className="font-display font-bold text-bordo text-sm mb-3">Já tratados</div>
        {tratadas.length === 0 ? (
          <Vazio>Nada tratado ainda.</Vazio>
        ) : (
          <Tabela cabecalho={["Clínica informada", "Serviço", "Desfecho", "Quando"]}>
            {tratadas.map((solicitacao) => (
              <tr key={solicitacao.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3">
                  <div className="font-semibold text-bordo">{solicitacao.clinicaNome}</div>
                  <div className="text-[10px] text-gray-400">{solicitacao.solicitante}</div>
                </td>
                <td className="py-2 pr-3 text-gray-600">{solicitacao.servico.nome}</td>
                <td className="py-2 pr-3">
                  {solicitacao.status === "VINCULADA" ? (
                    <span className="text-green-700 font-semibold">
                      virou agendamento
                      {solicitacao.clinica && <> · {solicitacao.clinica.nome}</>}
                    </span>
                  ) : (
                    <>
                      <span className="text-red-600 font-semibold">recusado</span>
                      {solicitacao.motivoRecusa && (
                        <div className="text-[10px] text-gray-400">{solicitacao.motivoRecusa}</div>
                      )}
                    </>
                  )}
                </td>
                <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                  {solicitacao.tratadaEm ? formatarData(solicitacao.tratadaEm) : "—"}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
