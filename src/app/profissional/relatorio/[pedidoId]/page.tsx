import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { formatarData } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarReais } from "@/lib/dinheiro";
import { enderecoEmUmaLinha } from "@/lib/relatorio";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { precosDosServicos, tabelasDaClinica } from "@/lib/preco";
import { descricaoDoPreco } from "@/lib/cobranca";
import { FormularioRelatorio } from "./FormularioRelatorio";

export const dynamic = "force-dynamic";

export default async function Relatorio({ params }: { params: { pedidoId: string } }) {
  const sessao = await exigirProfissional();

  // O filtro por profissionalId é o que impede abrir o atendimento de outra
  // pessoa trocando o id na URL.
  const pedido = await prisma.pedido.findFirst({
    where: { id: params.pedidoId, profissionalId: sessao.profissionalId },
    include: {
      clinica: {
        select: { nome: true, endereco: true, numero: true, bairro: true, cidade: true, uf: true },
      },
      endereco: { select: { endereco: true, numero: true, bairro: true, cidade: true, uf: true } },
      servico: { select: { id: true, nome: true } },
      relatorio: { include: { adicionais: { select: { servicoId: true, quantidade: true } } } },
    },
  });
  if (!pedido) notFound();

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
    tabelaIds: await tabelasDaClinica(prisma, pedido.clinicaId),
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
    ajudaCusto: r?.ajudaCustoCentavos != null ? (r.ajudaCustoCentavos / 100).toFixed(2).replace(".", ",") : "",
    ajudaCustoJustificativa: r?.ajudaCustoJustificativa ?? "",
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
            Repasse previsto: <strong>{formatarReais(pedido.valorRepasseCentavos)}</strong>
          </div>
        </div>
        {pedido.relatorio?.devolvidoEm && !pedido.relatorio.aprovadoEm && (
          <div className="mb-4">
            <Aviso tom="erro">
              <div className="font-semibold mb-0.5">A central devolveu este relatório para correção.</div>
              {pedido.relatorio.motivoDevolucao ?? "Confira os dados e reenvie."}
            </Aviso>
          </div>
        )}
        {pedido.relatorio?.aprovadoEm ? (
          <Aviso tom="info">
            Este relatório já foi conferido pela central e o repasse está liberado. Para corrigir
            alguma coisa, fale com a central.
          </Aviso>
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
          />
        )}
      </Cartao>
    </>
  );
}
