import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { comEnderecoDoPedido, locaisDaClinica, resumoDoEndereco } from "@/lib/endereco";
import { AgendaDaEquipe } from "@/components/AgendaDaEquipe";
import { agendaDaEquipe } from "@/lib/integracoes/google-api";
import { BotaoAcao } from "@/components/BotaoAcao";
import { BotoesWhatsapp } from "../BotoesWhatsapp";
import { EquipeDoAtendimento, type LinhaDaEquipe } from "../EquipeDoAtendimento";
import { aptoParaServico } from "@/lib/aptidao";
import { eventoParaEquipe } from "@/lib/evento-equipe";
import { agruparPorFamilia } from "@/lib/familia";
import { isoDeData, paraHora, paraMinutos } from "@/lib/data";
import { EditarAgendamento } from "./EditarAgendamento";
import { AdicionarServico } from "./AdicionarServico";
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
  const agendaNativa = Boolean(agendaDaEquipe());

  const pedido = await prisma.pedido.findUnique({
    where: { id: params.pedidoId },
    include: {
      clinica: { select: { nome: true, telefone: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
      servico: { select: { nome: true } },
      endereco: { select: { rotulo: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, observacoes: true } },
      profissional: { select: { nome: true, telefone: true } },
      relatorio: { include: INCLUIR_ADICIONAIS },
      avaliacao: { select: { nota: true, comentario: true, pontosPositivos: true, pontosNegativos: true, sugestoes: true } },
    },
  });
  if (!pedido) notFound();

  const relatorio = pedido.relatorio;

  // Edição do resumo (ata de 02/10): só para quem atende o telefone e só
  // enquanto o atendimento ainda está de pé.
  // Profissional adicional segue o atendimento principal: edita-se o principal.
  const podeEditar = !pedido.apoioDeId && perfilPermite(sessao.perfil, "COMERCIAL", "ATENDENTE", "POS_VENDA", "LOGISTICA") && STATUS_ATIVOS.includes(pedido.status);
  // A logística só corrige o local (ata de 27/10); o resto é do comercial.
  const podeAlterarLocal = !pedido.apoioDeId && !podeEditar && perfilPermite(sessao.perfil, "LOGISTICA") && STATUS_ATIVOS.includes(pedido.status);
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
        select: { data: true, horaInicio: true, duracaoMin: true, status: true, pacienteNome: true, servico: { select: { nome: true } } },
      })
    : [];
  const gruposDeServicos = agruparPorFamilia(servicosDoCatalogo, { fundirSolitarias: false, ordemDoCatalogo: true });
  // Sugestão de horário para um serviço a mais: quando o último da visita termina.
  const fimDaVisita = Math.max(
    ...(visita.length ? visita : [pedido]).map((m) => paraMinutos(m.horaInicio) + m.duracaoMin)
  );
  const horaSugerida = paraHora(Math.min(fimDaVisita, 23 * 60 + 59));

  // A equipe do atendimento: o principal e os profissionais adicionais (apoios).
  const principal = await prisma.pedido.findUniqueOrThrow({
    where: { id: pedido.apoioDeId ?? pedido.id },
    select: {
      id: true,
      numero: true,
      data: true,
      status: true,
      servicoId: true,
      clinica: { select: { nome: true } },
      profissional: { select: { id: true, nome: true } },
      apoios: {
        where: { status: { not: "CANCELADO" } },
        orderBy: { numero: "asc" },
        select: { id: true, numero: true, data: true, status: true, profissional: { select: { id: true, nome: true } } },
      },
    },
  });
  const linhasDaEquipe: LinhaDaEquipe[] = [
    { id: principal.id, codigo: codigoDoPedido(principal.numero, principal.clinica.nome, principal.data), status: principal.status, apoio: false, profissional: principal.profissional },
    ...principal.apoios.map((a) => ({
      id: a.id,
      codigo: codigoDoPedido(a.numero, principal.clinica.nome, a.data),
      status: a.status,
      apoio: true,
      profissional: a.profissional,
    })),
  ];
  const profissionaisAptos = (
    await prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, servicosAptos: { select: { id: true } } },
    })
  )
    .filter((p) => aptoParaServico(p.servicosAptos.map((x) => x.id), principal.servicoId))
    .map(({ id, nome }) => ({ id, nome }));

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
          {pedido.apoioDeId && (
            <Link href={`/painel/pedidos/${pedido.apoioDeId}`} className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5 hover:underline">
              profissional adicional · ver atendimento principal
            </Link>
          )}
          {pedido.modalidade === "CURSO" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-bordo bg-bordo/10 rounded-full px-2 py-0.5">Curso</span>
          )}
          {pedido.origem === "PORTAL_CLINICA" && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">veio do portal</span>
          )}
        </div>
        <div className="mb-3">
          <BotoesWhatsapp
            pedidoId={pedido.id}
            status={pedido.status}
            clinicaNome={pedido.clinica.nome}
            telefoneClinica={pedido.contatoClinica || pedido.clinica.telefone}
            profissional={pedido.profissional}
            apoio={Boolean(pedido.apoioDeId)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Alocado, vai para a agenda de quem acompanha (pedido do André, 26/10). */}
          {pedido.status === "ALOCADO" && (
            <span className="ml-auto">
              {agendaNativa ? (
                <span className="text-[10px] font-semibold text-green-700">📅 na agenda da equipe</span>
              ) : (
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
              )}
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
                {pedido.cartaoPagoEm && (
                  <span className="ml-2 text-[10px] font-semibold text-green-700">
                    Cartão pago em {formatarDataHora(pedido.cartaoPagoEm)}
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
      {/* Profissionais do atendimento (Joyce, 05/11): alocar, trocar e
          adicionar mais de um profissional, também aqui na edição. */}
      <Cartao className="mb-3" id="equipe">
        <div className="font-display font-bold text-bordo text-sm mb-1">Profissionais do atendimento</div>
        <div className="text-[11px] text-gray-500 mb-3">
          Precisa de mais de uma pessoa? Adicione aqui: cada profissional recebe o próprio aviso, faz o check-in e o
          relatório e tem o próprio repasse. A clínica não é cobrada a mais.
        </div>
        <EquipeDoAtendimento
          principalId={principal.id}
          linhas={linhasDaEquipe}
          profissionais={profissionaisAptos}
          podeAlocar={perfilPermite(sessao.perfil, "LOGISTICA")}
        />
      </Cartao>

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

      {podeEditar && ["SOLICITADO", "CONFIRMADO", "ALOCADO"].includes(pedido.status) && (
        <Cartao className="mb-3">
          <AdicionarServico pedidoId={pedido.id} grupos={gruposDeServicos} horaSugerida={horaSugerida} />
        </Cartao>
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
