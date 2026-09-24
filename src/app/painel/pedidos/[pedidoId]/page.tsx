import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarData, formatarDataHora } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { CAMPOS_CLINICOS, NAO_SE_APLICA } from "@/lib/relatorio";
import { MostrarEstrelas } from "@/components/Estrelas";

export const dynamic = "force-dynamic";

/**
 * O relatório de atividades por inteiro — ata de 21/09: "abrir o relatório
 * detalhado ao clicar no registro de atendimento". A esteira mostra só o
 * essencial (serviço adicional, ajuda de custo, conferência); aqui está o
 * atendimento inteiro, sinais vitais incluídos, para quem precisa conferir
 * tudo de uma vez — um contestação da clínica, uma dúvida do financeiro.
 *
 * Só leitura de propósito: as ações que mudam o relatório (conferir,
 * aprovar) continuam na esteira, onde a equipe já trabalha em fila. Duplicar
 * os mesmos botões aqui criaria dois lugares para o mesmo clique.
 */
export default async function DetalheDoPedido({ params }: { params: { pedidoId: string } }) {
  await exigirInterno();

  const pedido = await prisma.pedido.findUnique({
    where: { id: params.pedidoId },
    include: {
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true } },
      relatorio: true,
      avaliacao: { select: { nota: true, comentario: true } },
    },
  });
  if (!pedido) notFound();

  const relatorio = pedido.relatorio;

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/pedidos" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para a esteira
          </Link>
        }
      >
        {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)}
      </Titulo>

      <Cartao className="mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SeloStatus status={pedido.status} />
          {pedido.origem === "PORTAL_CLINICA" && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">veio do portal</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <div className="text-gray-400">Quando</div>
            <div className="text-gray-700">
              {formatarData(pedido.data)} às {pedido.horaInicio} · {pedido.duracaoMin} min
            </div>
          </div>
          <div>
            <div className="text-gray-400">Serviço</div>
            <div className="text-gray-700">{pedido.servico.nome}</div>
          </div>
          <div>
            <div className="text-gray-400">Clínica</div>
            <div className="text-gray-700">{pedido.clinica.nome}</div>
          </div>
          <div>
            <div className="text-gray-400">Profissional</div>
            <div className="text-gray-700">{pedido.profissional?.nome ?? "sem profissional"}</div>
          </div>
          {pedido.doutorNome && (
            <div>
              <div className="text-gray-400">Doutor(a)</div>
              <div className="text-gray-700">{pedido.doutorNome}</div>
            </div>
          )}
          {pedido.pacienteNome && (
            <div>
              <div className="text-gray-400">Paciente</div>
              <div className="text-gray-700">{pedido.pacienteNome}</div>
            </div>
          )}
          <div>
            <div className="text-gray-400">Valor do serviço</div>
            <div className="text-gray-700">{formatarReais(pedido.valorServicoCentavos)}</div>
          </div>
          <div>
            <div className="text-gray-400">Repasse</div>
            <div className="text-gray-700">{formatarReais(pedido.valorRepasseCentavos)}</div>
          </div>
          <div>
            <div className="text-gray-400">Condição de pagamento</div>
            <div className="text-gray-700">{pedido.condicaoPagamento ?? "a definir"}</div>
          </div>
          {pedido.observacoes && (
            <div className="sm:col-span-2">
              <div className="text-gray-400">Observações do pedido</div>
              <div className="text-gray-700">{pedido.observacoes}</div>
            </div>
          )}
        </div>
      </Cartao>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">Relatório de atendimento</div>

        {!relatorio ? (
          <Vazio>Nenhum relatório enviado ainda.</Vazio>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <div className="text-gray-400">Compareceu</div>
                <div className="text-gray-700">{relatorio.compareceu ? "Sim" : "Não"}</div>
              </div>
              {relatorio.compareceu && (
                <div>
                  <div className="text-gray-400">Horário real</div>
                  <div className="text-gray-700">
                    {relatorio.inicioReal ?? "—"} até {relatorio.fimReal ?? "—"}
                  </div>
                </div>
              )}
              <div>
                <div className="text-gray-400">Quantidade</div>
                <div className="text-gray-700">{relatorio.quantidade}</div>
              </div>
              <div>
                <div className="text-gray-400">Intercorrência</div>
                <div className={relatorio.intercorrencia ? "text-amber-700 font-semibold" : "text-gray-700"}>
                  {relatorio.intercorrencia ? "Sim" : "Não"}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Enviado em</div>
                <div className="text-gray-700">{formatarDataHora(relatorio.enviadoEm)}</div>
              </div>
              {relatorio.chavePixConfirmada && (
                <div>
                  <div className="text-gray-400">Chave PIX confirmada</div>
                  <div className="text-gray-700">{relatorio.chavePixConfirmada}</div>
                </div>
              )}
            </div>

            {relatorio.observacoes && (
              <div className="text-xs">
                <div className="text-gray-400 mb-0.5">Observações</div>
                <div className="text-gray-700">{relatorio.observacoes}</div>
              </div>
            )}

            {relatorio.compareceu && (
              <div>
                <div className="text-gray-400 text-xs mb-1.5">Sinais vitais</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CAMPOS_CLINICOS.map((campo) => {
                    const valor = relatorio[campo.nome as keyof typeof relatorio] as string | null;
                    return (
                      <div key={campo.nome} className="bg-bege rounded-lg px-2.5 py-1.5">
                        <div className="text-[10px] text-gray-500">{campo.rotulo}</div>
                        <div
                          className={`text-xs font-semibold ${
                            !valor || valor === NAO_SE_APLICA ? "text-gray-400" : "text-bordo"
                          }`}
                        >
                          {valor ?? "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {relatorio.servicosAdicionais && (
              <div className="text-xs">
                <div className="text-gray-400 mb-0.5">Serviços adicionais</div>
                <div className="text-amber-800">{relatorio.servicosAdicionais}</div>
              </div>
            )}

            {relatorio.ajudaCustoCentavos != null && (
              <div className="text-xs">
                <div className="text-gray-400 mb-0.5">Ajuda de custo</div>
                <div className="text-amber-800">
                  {formatarReais(relatorio.ajudaCustoCentavos)}
                  {relatorio.ajudaCustoJustificativa ? ` · ${relatorio.ajudaCustoJustificativa}` : ""}
                </div>
              </div>
            )}

            {relatorio.latitude != null && relatorio.longitude != null && (
              <div className="text-xs">
                <div className="text-gray-400 mb-0.5">Local no envio do relatório</div>
                <a
                  href={`https://www.google.com/maps?q=${relatorio.latitude},${relatorio.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-green-700 hover:underline"
                >
                  📍 ver no mapa
                  {relatorio.precisaoMetros != null && ` · precisão de ${Math.round(relatorio.precisaoMetros)}m`}
                </a>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 text-xs">
              {relatorio.aprovadoEm ? (
                <span className="font-semibold text-green-700">
                  relatório conferido e aprovado em {formatarDataHora(relatorio.aprovadoEm)} · repasse liberado
                </span>
              ) : (
                <span className="font-semibold text-amber-700">
                  aguardando conferência do pós-venda — vá até a esteira para aprovar
                </span>
              )}
            </div>
          </div>
        )}
      </Cartao>

      {pedido.avaliacao && (
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-2">Avaliação da clínica</div>
          <MostrarEstrelas nota={pedido.avaliacao.nota} />
          {pedido.avaliacao.comentario && (
            <div className="text-xs text-gray-600 mt-2">{pedido.avaliacao.comentario}</div>
          )}
        </Cartao>
      )}
    </>
  );
}
