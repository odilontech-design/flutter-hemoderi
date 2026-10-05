import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarData, formatarDataHora } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { INCLUIR_ADICIONAIS, RelatorioPreenchido } from "@/components/RelatorioPreenchido";
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
      relatorio: { include: INCLUIR_ADICIONAIS },
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
          {pedido.procedimentoPaciente && (
            <div>
              <div className="text-gray-400">Procedimento no paciente</div>
              <div className="text-gray-700">{pedido.procedimentoPaciente}</div>
            </div>
          )}
          {pedido.formaPagamento && (
            <div>
              <div className="text-gray-400">Forma de pagamento (cliente)</div>
              <div className="text-gray-700">{pedido.formaPagamento}</div>
            </div>
          )}
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
            <RelatorioPreenchido relatorio={relatorio} />

            <div className="pt-3 border-t border-gray-100 text-xs">
              {relatorio.aprovadoEm ? (
                <span className="font-semibold text-green-700">
                  relatório conferido e aprovado em {formatarDataHora(relatorio.aprovadoEm)} · repasse liberado
                </span>
              ) : relatorio.devolvidoEm ? (
                <span className="font-semibold text-red-700">
                  devolvido ao profissional em {formatarDataHora(relatorio.devolvidoEm)}
                  {relatorio.motivoDevolucao ? ` — ${relatorio.motivoDevolucao}` : ""}
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
