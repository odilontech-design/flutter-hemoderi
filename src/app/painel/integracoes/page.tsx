import { envioAutomaticoLigado } from "@/lib/integracoes/whatsapp";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { registrarAvisoDePagamentoBradesco, testarConexaoBradesco } from "@/app/actions/cobrancas";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarData, formatarDataHora } from "@/lib/data";
import { pendenciasDeSincronizacao } from "@/lib/sincronizacao";
import { reenviarFalhasWhatsapp, reprocessarPipedrive, reprocessarTodasPipedrive, testarConexaoPipedrive } from "@/app/actions/integracoes";
import { integracaoConfigurada as googleConfigurado, agendaDaOperacao } from "@/lib/integracoes/google-api";
import { configuradoBradesco } from "@/lib/integracoes/bradesco-pix";
import { pipedriveConfigurado } from "@/lib/integracoes/pipedrive";

export const dynamic = "force-dynamic";

const ROTULO_ACAO: Record<string, string> = {
  "criar-negocio": "Criar negócio",
  "marcar-ganho": "Marcar como ganho",
  "marcar-perdido": "Marcar como perdido",
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

  const configurado = pipedriveConfigurado();

  // A situação das outras integrações (revisão de 25/10): a fila do WhatsApp
  // não aparecia em tela nenhuma, e as três primeiras mensagens reais falharam
  // sem ninguém ver.
  const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [porStatusWhatsapp, ultimaFalhaWhatsapp, ultimaEnviada, falhasGoogle, ultimoSucessoPipedrive] = await Promise.all([
    prisma.mensagemWhatsapp.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.mensagemWhatsapp.findFirst({
      where: { OR: [{ status: "FALHA" }, { status: "PENDENTE", erro: { not: null } }] },
      orderBy: { criadaEm: "desc" },
      select: { erro: true, criadaEm: true },
    }),
    prisma.mensagemWhatsapp.findFirst({ where: { status: "ENVIADA" }, orderBy: { enviadaEm: "desc" }, select: { enviadaEm: true } }),
    prisma.sincronizacaoExterna.count({ where: { sistema: "GOOGLE_AGENDA", sucesso: false, criadaEm: { gte: umDiaAtras } } }),
    prisma.sincronizacaoExterna.findFirst({
      where: { sistema: "PIPEDRIVE", sucesso: true },
      orderBy: { criadaEm: "desc" },
      select: { criadaEm: true },
    }),
  ]);
  const whatsapp = Object.fromEntries(porStatusWhatsapp.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const whatsappLigado = Boolean(process.env.WHATSAPP_API_URL);

  const situacoes: { nome: string; ligado: boolean; linhas: string[]; alerta?: string | null }[] = [
    {
      nome: "PipeDrive",
      ligado: configurado,
      linhas: [
        `${pendencias.length} pendência(s)`,
        ultimoSucessoPipedrive ? `último sucesso: ${formatarDataHora(ultimoSucessoPipedrive.criadaEm)}` : "nenhum sucesso ainda",
      ],
    },
    {
      nome: "WhatsApp (Dilon Zap)",
      ligado: whatsappLigado,
      linhas: [
        envioAutomaticoLigado() ? "envio automático: ligado" : "envio automático ao cliente: SUSPENSO (profissional segue automático; botões da equipe enviam)",
        `${whatsapp.ENVIADA ?? 0} enviada(s) · ${whatsapp.PENDENTE ?? 0} na fila · ${whatsapp.FALHA ?? 0} falha(s)`,
        ultimaEnviada?.enviadaEm ? `último envio: ${formatarDataHora(ultimaEnviada.enviadaEm)}` : "nenhuma mensagem entregue ainda",
      ],
      alerta: ultimaFalhaWhatsapp?.erro ?? null,
    },
    {
      nome: "Google Agenda",
      ligado: googleConfigurado() && Boolean(agendaDaOperacao()),
      linhas: [`${falhasGoogle} falha(s) nas últimas 24h`],
    },
    {
      nome: "Pix Bradesco",
      ligado: configuradoBradesco(),
      linhas: ["cobrança Pix dinâmica por fatura", process.env.BRADESCO_AMBIENTE === "producao" ? "ambiente: produção" : "ambiente: homologação (testes)"],
      alerta: configuradoBradesco() ? null : "Aguardando as credenciais e o certificado do Bradesco (variáveis BRADESCO_* na Vercel).",
    },
  ];

  return (
    <>
      <Titulo>Integrações</Titulo>

      {configuradoBradesco() && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="mr-auto text-xs">
            <div className="font-semibold text-bordo">Pix Bradesco</div>
            <div className="text-[10px] text-gray-500">Teste a conexão e cadastre o aviso de pagamento (só o responsável).</div>
          </div>
          <BotaoAcao tela acao={testarConexaoBradesco}>Testar conexão</BotaoAcao>
          <BotaoAcao tela acao={registrarAvisoDePagamentoBradesco} confirmar="Cadastrar no Bradesco o endereço que avisa quando um Pix é pago?">
            Registrar aviso de pagamento
          </BotaoAcao>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {situacoes.map((i) => (
          <Cartao key={i.nome}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-display font-bold text-bordo text-sm">{i.nome}</div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${i.ligado ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}
              >
                {i.ligado ? "ligada" : "desligada"}
              </span>
            </div>
            {i.linhas.map((l) => (
              <div key={l} className="text-[11px] text-gray-600">{l}</div>
            ))}
            {i.alerta && <div className="text-[11px] text-amber-700 mt-1">{i.alerta}</div>}
            {i.nome.startsWith("WhatsApp") && whatsappLigado && (whatsapp.FALHA ?? 0) > 0 && (
              <div className="mt-2">
                <BotaoAcao tela acao={reenviarFalhasWhatsapp}>Reenviar falhas</BotaoAcao>
              </div>
            )}
          </Cartao>
        ))}
      </div>

      <div className="font-display font-bold text-bordo text-base mb-2">PipeDrive</div>

      {!configurado && (
        <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
          <div className="text-[11px] text-amber-800 leading-relaxed">
            A integração ainda não está configurada (faltam <code>PIPEDRIVE_API_TOKEN</code> e{" "}
            <code>PIPEDRIVE_DOMINIO</code>, que é só o subdomínio da conta — ex.: <code>hemoderi-5c2c36</code>). Enquanto isso, cada agendamento registra a intenção
            aqui como pendência e a operação segue normalmente — nada trava. Assim que as chaves
            entrarem no ambiente, use &quot;tentar de novo&quot; para sincronizar o que ficou para trás.
          </div>
        </Cartao>
      )}

      {configurado && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <BotaoAcao acao={testarConexaoPipedrive}>Testar conexão</BotaoAcao>
          {pendencias.length > 0 && (
            <BotaoAcao
              acao={reprocessarTodasPipedrive}
              variante="primario"
              confirmar="Criar no PipeDrive os negócios que ficaram pendentes (até 20 por clique)?"
            >
              Reprocessar pendências
            </BotaoAcao>
          )}
        </div>
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
