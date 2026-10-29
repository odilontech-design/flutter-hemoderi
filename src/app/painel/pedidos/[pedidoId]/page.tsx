import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { comEnderecoDoPedido, locaisDaClinica, resumoDoEndereco } from "@/lib/endereco";
import { AgendaDaEquipe } from "@/components/AgendaDaEquipe";
import { BotaoAcao } from "@/components/BotaoAcao";
import { enviarAvisoAoProfissional, enviarConfirmacoesWhatsapp, enviarResumoWhatsapp } from "@/app/actions/pedidos";
import { eventoParaEquipe } from "@/lib/evento-equipe";
import { agruparPorFamilia } from "@/lib/familia";
import { isoDeData } from "@/lib/data";
import { EditarAgendamento } from "./EditarAgendamento";
import { EditarVisita } from "./EditarVisita";
import { AlterarLocal } from "./AlterarLocal";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarData, formatarDataHora } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { INCLUIR_ADICIONAIS, RelatorioPreenchido } from "@/components/RelatorioPreenchido";
import { MostrarEstrelas } from "@/components/Estrelas";
import { respostasEscritas } from "@/lib/avaliacao";

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
export default async function DetalheDoPedido({
  params,
  searchParams,
}: {
  params: { pedidoId: string };
  searchParams: { editar?: string };
}) {
  const sessao = await exigirInterno();

  const pedido = await prisma.pedido.findUnique({
    where: { id: params.pedidoId },
    include: {
      clinica: { select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
      servico: { select: { nome: true } },
      endereco: { select: { rotulo: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, observacoes: true } },
      profissional: { select: { nome: true } },
      relatorio: { include: INCLUIR_ADICIONAIS },
      avaliacao: { select: { nota: true, comentario: true, pontosPositivos: true, pontosNegativos: true, sugestoes: true } },
    },
  });
  if (!pedido) notFound();

  const relatorio = pedido.relatorio;

  // Edição do resumo (ata de 02/10): só para quem atende o telefone e só
  // enquanto o atendimento ainda está de pé.
  const podeEditar = perfilPermite(sessao.perfil, "COMERCIAL", "ATENDENTE", "POS_VENDA", "LOGISTICA") && STATUS_ATIVOS.includes(pedido.status);
  // A logística só corrige o local (ata de 27/10); o resto é do comercial.
  const podeAlterarLocal = !podeEditar && perfilPermite(sessao.perfil, "LOGISTICA") && STATUS_ATIVOS.includes(pedido.status);
  const [servicosDoCatalogo, locais] = podeEditar || podeAlterarLocal
    ? await Promise.all([
        prisma.servico.findMany({
          where: { ativo: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true, familia: true },
        }),
        locaisDaClinica(pedido.clinicaId),
      ])
    : [[], []];
  // Os outros serviços da mesma visita, para a edição do agendamento inteiro.
  const visita = pedido.grupoId
    ? await prisma.pedido.findMany({
        where: { grupoId: pedido.grupoId, status: { in: STATUS_ATIVOS } },
        orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
        select: { data: true, horaInicio: true, status: true, pacienteNome: true, servico: { select: { nome: true } } },
      })
    : [];
  const gruposDeServicos = agruparPorFamilia(servicosDoCatalogo, { fundirSolitarias: false, ordemDoCatalogo: true });

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
          {pedido.modalidade === "CURSO" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-bordo bg-bordo/10 rounded-full px-2 py-0.5">Curso</span>
          )}
          {pedido.origem === "PORTAL_CLINICA" && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">veio do portal</span>
          )}
          {(pedido.status === "CONFIRMADO" || pedido.status === "ALOCADO") && (
            <>
              <BotaoAcao tela
                acao={enviarConfirmacoesWhatsapp.bind(null, pedido.id)}
                confirmar="Enviar o texto curto de confirmação pelo WhatsApp para a clínica (e o aviso ao profissional, se já alocado)?"
              >
                Enviar confirmação curta
              </BotaoAcao>
              <BotaoAcao tela
                acao={enviarResumoWhatsapp.bind(null, pedido.id)}
                confirmar="Enviar o resumo detalhado (data, horário, endereço, clínica, doutor e profissional) para a clínica?"
              >
                Enviar resumo detalhado
              </BotaoAcao>
              {pedido.status === "ALOCADO" && (
                <BotaoAcao tela
                acao={enviarAvisoAoProfissional.bind(null, pedido.id)}
                confirmar="Enviar o aviso de alocação ao profissional pelo WhatsApp?"
              >
                Enviar aviso ao profissional
              </BotaoAcao>
              )}
            </>
          )}
          {/* Alocado, vai para a agenda de quem acompanha (pedido do André, 26/10). */}
          {pedido.status === "ALOCADO" && (
            <span className="ml-auto">
              <AgendaDaEquipe
                        pedidoId={pedido.id}
                        salvaEm={pedido.agendaSalvaEm}
                        salvaPor={pedido.agendaSalvaPor}
                evento={eventoParaEquipe({
                  id: pedido.id,
                  data: pedido.data,
                  horaInicio: pedido.horaInicio,
                  duracaoMin: pedido.duracaoMin,
                  clinicaNome: pedido.clinica.nome,
                  servicoNome: pedido.servico.nome,
                  profissionalNome: pedido.profissional?.nome,
                  doutorNome: pedido.doutorNome,
                  contatoClinica: pedido.contatoClinica,
                  pacienteNome: pedido.pacienteNome,
                  procedimentoPaciente: pedido.procedimentoPaciente,
                  local: resumoDoEndereco(comEnderecoDoPedido(pedido.clinica, pedido.endereco)),
                })}
              />
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <div className="text-gray-400">Quando</div>
            <div className="text-gray-700">
              {formatarData(pedido.data)} às {pedido.horaInicio}
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
          <div className="sm:col-span-2">
            <div className="text-gray-400">Local do atendimento</div>
            <div className="text-gray-700">
              {pedido.endereco ? (
                <>
                  <strong>{pedido.endereco.rotulo}</strong> — {resumoDoEndereco(pedido.endereco)}
                  {pedido.endereco.observacoes && <span className="text-gray-500"> · Obs.: {pedido.endereco.observacoes}</span>}
                </>
              ) : (
                resumoDoEndereco(pedido.clinica) || "endereço não informado"
              )}
            </div>
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
              <div className="text-gray-700">
                {pedido.formaPagamento}
                {pedido.pixPagoEm && (
                  <span className="ml-2 text-[10px] font-semibold text-green-700">
                    Pix pago em {formatarDataHora(pedido.pixPagoEm)}
                  </span>
                )}
              </div>
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

      {podeAlterarLocal && (
        <AlterarLocal
          pedidoId={pedido.id}
          clinicaId={pedido.clinicaId}
          enderecoId={pedido.enderecoId ?? ""}
          locais={locais.map((l) => ({ id: l.id, rotulo: l.rotulo }))}
        />
      )}

      {/* A visita inteira, quando tem mais de um serviço (reunião de 27/10). */}
      {podeEditar && visita.length > 1 && (
        <EditarVisita
          clinicaId={pedido.clinicaId}
          aberto={searchParams.editar === "1"}
          locais={locais.map((l) => ({ id: l.id, rotulo: l.rotulo }))}
          dados={{
            grupoId: pedido.grupoId as string,
            data: isoDeData(visita[0].data),
            horaInicio: visita[0].horaInicio,
            enderecoId: pedido.enderecoId ?? "",
            doutorNome: pedido.doutorNome ?? "",
            contatoClinica: pedido.contatoClinica ?? "",
            procedimentoPaciente: pedido.procedimentoPaciente ?? "",
            formaPagamento: pedido.formaPagamento ?? "",
            observacoes: pedido.observacoes ?? "",
            confirmada: visita.some((m) => m.status !== "SOLICITADO"),
            servicos: visita.map((m) => ({ horaInicio: m.horaInicio, nome: m.servico.nome, paciente: m.pacienteNome })),
          }}
        />
      )}

      {podeEditar && (
        <EditarAgendamento
          clinicaId={pedido.clinicaId}
          aberto={searchParams.editar === "1" && visita.length <= 1}
          rotulo={visita.length > 1 ? `Editar só este serviço (${pedido.servico.nome})` : "Editar agendamento"}
          dados={{
            id: pedido.id,
            data: isoDeData(pedido.data),
            horaInicio: pedido.horaInicio,
            servicoId: pedido.servicoId,
            quantidade: pedido.quantidade,
            enderecoId: pedido.enderecoId ?? "",
            doutorNome: pedido.doutorNome ?? "",
            pacienteNome: pedido.pacienteNome ?? "",
            pacienteContato: pedido.pacienteContato ?? "",
            procedimentoPaciente: pedido.procedimentoPaciente ?? "",
            formaPagamento: pedido.formaPagamento ?? "",
            observacoes: pedido.observacoes ?? "",
            status: pedido.status,
          }}
          grupos={gruposDeServicos}
          locais={locais.map((l) => ({ id: l.id, rotulo: l.rotulo }))}
        />
      )}

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
          {respostasEscritas(pedido.avaliacao).map((r) => (
            <div key={r.rotulo} className="text-xs text-gray-600 mt-2">
              <span className="font-semibold text-gray-500">{r.rotulo}:</span> {r.texto}
            </div>
          ))}
        </Cartao>
      )}
    </>
  );
}
