import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { formatarData, hojeUTC } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarReais } from "@/lib/dinheiro";
import { CAMPOS_CLINICOS, enderecoEmUmaLinha } from "@/lib/relatorio";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { precosDosServicos, tabelasDaClinica } from "@/lib/preco";
import { descricaoDoPreco } from "@/lib/cobranca";
import { parametros } from "@/lib/alocacao";
import { localVisivel } from "@/lib/sigilo";
import { ResumoDoAtendimento } from "@/components/ResumoDoAtendimento";
import { INCLUIR_ADICIONAIS, RelatorioPreenchido } from "@/components/RelatorioPreenchido";
import { BotaoCheckin } from "../../AcoesAtendimento";
import { houveAtraso } from "@/lib/atraso";
import { CompartilharWhatsapp } from "@/components/CompartilharWhatsapp";
import { textoDoRelatorio } from "@/lib/relatorio-texto";
import { FormularioRelatorio } from "./FormularioRelatorio";

export const dynamic = "force-dynamic";

export default async function Relatorio({
  params,
  searchParams,
}: {
  params: { pedidoId: string };
  searchParams: { enviado?: string };
}) {
  const sessao = await exigirProfissional();

  // O filtro por profissionalId é o que impede abrir o atendimento de outra
  // pessoa trocando o id na URL.
  const pedido = await prisma.pedido.findFirst({
    where: { id: params.pedidoId, profissionalId: sessao.profissionalId },
    include: {
      clinica: {
        select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true },
      },
      endereco: {
        select: { endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, observacoes: true },
      },
      servico: { select: { id: true, nome: true } },
      relatorio: {
        include: {
          adicionais: { select: { servicoId: true, quantidade: true } },
          // Só o nome: o arquivo em si nunca vem junto da página.
          comprovante: { select: { nome: true } },
          // Anexos: nome e tamanho; o arquivo sai por /api/anexos, com sessão.
          anexos: { select: { id: true, nome: true, tamanho: true }, orderBy: { criadoEm: "asc" } },
        },
      },
    },
  });
  if (!pedido) notFound();

  const config = await parametros();
  const revelado = localVisivel(pedido, config.horasRevelarLocal);
  // Relatório aprovado: a página vira a leitura do que foi enviado (ata de
  // 13/10 — "resumo detalhado ao clicar no relatório"), sem formulário. Já
  // enviado (aprovado ou não): também vira o texto para o grupo de WhatsApp.
  const enviado = pedido.relatorio
    ? await prisma.relatorioAtendimento.findUnique({ where: { pedidoId: pedido.id }, include: INCLUIR_ADICIONAIS })
    : null;
  const textoParaOGrupo = enviado
    ? textoDoRelatorio({
        codigo: codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data),
        data: formatarData(pedido.data),
        hora: pedido.horaInicio,
        profissional: sessao.profissionalNome,
        clinica: enviado.clinicaNomeInformado ?? pedido.clinica.nome,
        doutor: enviado.doutorNomeInformado ?? pedido.doutorNome,
        servico: enviado.servicoRealizado?.nome ?? pedido.servico.nome,
        quantidade: enviado.quantidade,
        adicionais: enviado.adicionais.map((a) => ({ nome: a.servico.nome, quantidade: a.quantidade })),
        justificativaAdicionais: enviado.servicosAdicionais,
        compareceu: enviado.compareceu,
        inicioReal: enviado.inicioReal,
        fimReal: enviado.fimReal,
        intercorrencia: enviado.intercorrencia,
        sinais: Object.fromEntries(
          CAMPOS_CLINICOS.map((c) => [c.nome, (enviado as unknown as Record<string, string | null>)[c.nome] ?? null])
        ),
        recebimento: enviado.recebimento,
        formaRecebimento: enviado.formaRecebimento,
        valorRecebido: enviado.valorRecebidoCentavos != null ? formatarReais(enviado.valorRecebidoCentavos) : null,
        observacaoRecebimento: enviado.observacaoRecebimento,
        observacoes: enviado.observacoes,
      })
    : null;

  // Todo o catálogo ativo, sem filtro de perfil ou praça: o que vale aqui é o
  // que a pessoa de fato executou, não o que a clínica poderia pedir.
  const catalogo = await prisma.servico.findMany({
    where: { ativo: true },
    orderBy: [{ familia: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      familia: true,
      valorPadraoCentavos: true,
      unidadeCobranca: true,
      quantidadeIncluida: true,
      valorAdicionalCentavos: true,
      rotuloQuantidade: true,
    },
  });

  // O preço de TABELA de cada serviço para o cliente deste atendimento (ata de
  // 02/10): negociado, tabela do perfil, praça ou padrão — o mesmo que o
  // cliente vê. É só referência: o relatório reflete o que aconteceu e não
  // altera o cadastro de preços de ninguém.
  const ufDoAtendimento = comEnderecoDoPedido(pedido.clinica, pedido.endereco).uf;
  const precosResolvidos = await precosDosServicos(prisma, {
    clinicaId: pedido.clinicaId,
    uf: ufDoAtendimento,
    servicos: catalogo,
    tabelaIds: await tabelasDaClinica(prisma, pedido.clinicaId, pedido.modalidade),
  });
  const precos: Record<string, string> = {};
  for (const servico of catalogo) {
    const valor = precosResolvidos.get(servico.id)?.valorCentavos ?? servico.valorPadraoCentavos;
    precos[servico.id] = descricaoDoPreco(valor, servico);
  }

  // O formulário é controlado por texto (o "N/A" preenche o campo), então os
  // valores já enviados chegam como string — inclusive os que no banco são
  // número ou booleano.
  const r = pedido.relatorio;
  const valores: Record<string, string> = {
    compareceu: r ? (r.compareceu ? "sim" : "nao") : "",
    inicioReal: r?.inicioReal ?? "",
    fimReal: r?.fimReal ?? "",
    // Primeira vez: já vem a quantidade agendada, que é o que costuma acontecer.
    quantidade: String(r ? r.quantidade : pedido.quantidade),
    intercorrencia: r ? (r.intercorrencia ? "sim" : "nao") : "",
    observacoes: r?.observacoes ?? "",
    frequenciaCardiaca: r?.frequenciaCardiaca ?? "",
    saturacaoOxigenio: r?.saturacaoOxigenio ?? "",
    pressaoArterial: r?.pressaoArterial ?? "",
    glicemia: r?.glicemia ?? "",
    oxidoNitroso: r?.oxidoNitroso ?? "",
    oxigenio: r?.oxigenio ?? "",
    servicosAdicionais: r?.servicosAdicionais ?? "",
    // Primeira vez: já vem a ajuda de custo que a logística combinou na
    // alocação (ata de 05/10). Relatório já enviado mostra o que foi declarado.
    ajudaCusto: (() => {
      const centavos = r ? r.ajudaCustoCentavos : pedido.ajudaCustoCentavos;
      return centavos != null ? (centavos / 100).toFixed(2).replace(".", ",") : "";
    })(),
    ajudaCustoJustificativa: r?.ajudaCustoJustificativa ?? "",
    recebimento: r?.recebimento ?? "",
    formaRecebimento: r?.formaRecebimento ?? "",
    valorRecebido:
      r?.valorRecebidoCentavos != null ? (r.valorRecebidoCentavos / 100).toFixed(2).replace(".", ",") : "",
    observacaoRecebimento: r?.observacaoRecebimento ?? "",
    // O agendado é o ponto de partida; a correção já declarada, quando
    // existe, tem precedência — reabrir o relatório precisa mostrar o que a
    // pessoa escreveu, não jogá-la de volta ao valor que ela corrigiu.
    clinicaNomeInformado: r?.clinicaNomeInformado ?? pedido.clinica.nome,
    enderecoInformado: r?.enderecoInformado ?? enderecoEmUmaLinha(comEnderecoDoPedido(pedido.clinica, pedido.endereco)),
    doutorNomeInformado: r?.doutorNomeInformado ?? pedido.doutorNome ?? "",
  };

  return (
    <>
      <Titulo>Relatório do atendimento</Titulo>
      <Cartao className="max-w-xl">
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="font-display font-bold text-bordo text-sm">
            {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)} · {pedido.servico.nome}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {pedido.clinica.nome} · {formatarData(pedido.data)} às {pedido.horaInicio}
          </div>
          <div className="text-xs text-gray-500">
            Valor do profissional: <strong>{formatarReais(pedido.valorRepasseCentavos)}</strong>
          </div>
          {pedido.ajudaCustoCentavos != null && (
            <div className="text-xs text-gray-500">
              Ajuda de custo prevista pela logística: <strong>{formatarReais(pedido.ajudaCustoCentavos)}</strong>
            </div>
          )}
        </div>
        {/* Relatório no grupo de WhatsApp (ata de 20/10): na transição, o
            relatório vai para o sistema e para o grupo da equipe. */}
        {textoParaOGrupo && (
          <div className={`mb-4 rounded-xl border p-3 ${searchParams.enviado ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
            <div className="text-xs font-semibold text-gray-800 mb-1">
              {searchParams.enviado ? "Relatório enviado ✓ Agora compartilhe no grupo da equipe." : "Compartilhar este relatório no grupo da equipe"}
            </div>
            <div className="text-[11px] text-gray-500 mb-2">
              Durante a transição o relatório também vai para o grupo de WhatsApp. O texto já sai pronto, sem dados do
              paciente.
            </div>
            <CompartilharWhatsapp texto={textoParaOGrupo} />
          </div>
        )}
        {/* Quem abre direto o relatório também registra a chegada (ata de
            20/10): o botão não fica só no cartão de hoje da agenda. */}
        {pedido.status === "ALOCADO" && !pedido.checkinEm && pedido.data.getTime() === hojeUTC().getTime() && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-bordo/30 bg-bege/50 p-3">
            <div className="text-[11px] text-gray-600 flex-1 min-w-[12rem]">
              Ainda sem chegada registrada. Registre ao chegar na clínica, antes do relatório.
            </div>
            <BotaoCheckin pedidoId={pedido.id} atrasado={houveAtraso(pedido.data, pedido.horaInicio, new Date())} />
          </div>
        )}
        {revelado && (
          <div className="mb-4">
            <ResumoDoAtendimento
              dados={{
                ...pedido,
                onde: comEnderecoDoPedido(pedido.clinica, pedido.endereco),
                referencias: pedido.endereco?.observacoes ?? null,
              }}
            />
          </div>
        )}
        {pedido.relatorio?.devolvidoEm && !pedido.relatorio.aprovadoEm && (
          <div className="mb-4">
            <Aviso tom="erro">
              <div className="font-semibold mb-0.5">A central devolveu este relatório para correção.</div>
              {pedido.relatorio.motivoDevolucao ?? "Confira os dados e reenvie."}
            </Aviso>
          </div>
        )}
        {pedido.relatorio?.aprovadoEm ? (
          <div className="space-y-4">
            <Aviso tom="info">
              Este relatório já foi conferido pela central e o valor do profissional está liberado. Para corrigir
              alguma coisa, fale com a central.
            </Aviso>
            {enviado && <RelatorioPreenchido relatorio={enviado} />}
          </div>
        ) : (
          <FormularioRelatorio
            pedidoId={pedido.id}
            horaPrevista={pedido.horaInicio}
            jaEnviado={pedido.relatorio != null}
            valores={valores}
            quantidadeAgendada={pedido.quantidade}
            catalogo={catalogo.map(({ id, nome, familia }) => ({ id, nome, familia }))}
            servicoAgendado={{ id: pedido.servico.id, nome: pedido.servico.nome }}
            servicoRealizadoInicial={r?.servicoRealizadoId ?? pedido.servico.id}
            precos={precos}
            adicionaisIniciais={r?.adicionais ?? []}
            comprovanteAtual={r?.comprovante?.nome ?? null}
            anexosGuardados={r?.anexos ?? []}
          />
        )}
      </Cartao>
    </>
  );
}
