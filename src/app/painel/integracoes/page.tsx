import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarData } from "@/lib/data";
import { pendenciasDeSincronizacao } from "@/lib/sincronizacao";
import { reprocessarPipedrive } from "@/app/actions/integracoes";

export const dynamic = "force-dynamic";

const ROTULO_ACAO: Record<string, string> = {
  "criar-negocio": "Criar negócio",
  "marcar-ganho": "Marcar como ganho",
};

/**
 * Saúde da integração com o PipeDrive (ata de 28/09).
 *
 * A ata mandou revisar a integração "por falhas nos registros". A falha real
 * não era o PipeDrive recusar uma escrita — isso acontece e é esperado —, era
 * ninguém ficar sabendo: o erro ia para uma tabela de auditoria que nenhuma
 * tela lia, e o negócio simplesmente não existia lá. Esta tela lê essa tabela,
 * mostra só o que continua quebrado (lib/sincronizacao.ts) e deixa refazer.
 *
 * Restrita ao responsável, como financeiro e acessos: reprocessar escreve num
 * sistema externo e é decisão de quem responde pela operação.
 */
export default async function Integracoes() {
  await exigirResponsavel();

  const tentativas = await prisma.sincronizacaoExterna.findMany({
    where: { sistema: "PIPEDRIVE", entidade: "Pedido" },
    orderBy: { criadaEm: "desc" },
    take: 500,
    select: { entidadeId: true, acao: true, sucesso: true, erro: true, criadaEm: true },
  });

  const pendencias = pendenciasDeSincronizacao(tentativas);
  const totalTentativas = tentativas.length;
  const comSucesso = tentativas.filter((t) => t.sucesso).length;

  // Os dados dos pedidos pendentes, para a linha mostrar o código em vez do id.
  const pedidos = await prisma.pedido.findMany({
    where: { id: { in: pendencias.map((p) => p.entidadeId) } },
    select: {
      id: true,
      numero: true,
      data: true,
      status: true,
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
    },
  });
  const porId = new Map(pedidos.map((p) => [p.id, p]));

  const configurado = Boolean(process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMINIO);

  return (
    <>
      <Titulo>Integração PipeDrive</Titulo>

      {!configurado && (
        <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
          <div className="text-[11px] text-amber-800 leading-relaxed">
            A integração ainda não está configurada (faltam <code>PIPEDRIVE_API_TOKEN</code> e{" "}
            <code>PIPEDRIVE_DOMINIO</code>). Enquanto isso, cada agendamento registra a intenção
            aqui como pendência e a operação segue normalmente — nada trava. Assim que as chaves
            entrarem no ambiente, use &quot;tentar de novo&quot; para sincronizar o que ficou para trás.
          </div>
        </Cartao>
      )}

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Kpi rotulo="Pendências" valor={String(pendencias.length)} sub={pendencias.length ? "precisam de atenção" : "tudo sincronizado"} />
        <Kpi rotulo="Sincronizações" valor={String(comSucesso)} sub="com sucesso" />
        <Kpi rotulo="Tentativas" valor={String(totalTentativas)} sub="últimas 500" />
      </div>

      <Cartao>
        <div className="font-display font-bold text-bordo text-sm mb-3">Pendências</div>
        {pendencias.length === 0 ? (
          <Vazio>Nenhuma sincronização pendente com o PipeDrive.</Vazio>
        ) : (
          <Tabela cabecalho={["Agendamento", "O que faltou", "Desde", "Motivo", "Ação"]}>
            {pendencias.map((p) => {
              const pedido = porId.get(p.entidadeId);
              return (
                <tr key={`${p.entidadeId}-${p.acao}`} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3">
                    {pedido ? (
                      <Link href={`/painel/pedidos/${pedido.id}`} className="font-semibold text-bordo hover:underline">
                        {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)}
                      </Link>
                    ) : (
                      <span className="text-gray-400">pedido removido</span>
                    )}
                    {pedido && (
                      <div className="text-[10px] text-gray-400">{pedido.servico.nome}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{ROTULO_ACAO[p.acao] ?? p.acao}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{formatarData(p.desde)}</td>
                  <td className="py-2 pr-3 text-gray-500 min-w-[160px]">{p.erro ?? "—"}</td>
                  <td className="py-2">
                    {pedido && (
                      <BotaoAcao acao={reprocessarPipedrive.bind(null, pedido.id)}>tentar de novo</BotaoAcao>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>

      <div className="text-[10px] text-gray-400 mt-3 leading-relaxed">
        Só aparece aqui o que continua quebrado: se uma tentativa posterior deu certo, a pendência
        sai da lista sozinha. O histórico completo, sucesso e falha, fica registrado para
        auditoria.
      </div>
    </>
  );
}
