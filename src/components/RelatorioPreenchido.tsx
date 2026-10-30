import type { Prisma } from "@prisma/client";
import { CAMPOS_CLINICOS, NAO_SE_APLICA } from "@/lib/relatorio";
import { formatarDataHora } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { rotuloDaForma, rotuloDaSituacao } from "@/lib/recebimento";
import { tamanhoLegivel } from "@/lib/anexos-relatorio";

export const INCLUIR_ADICIONAIS = {
  adicionais: { select: { quantidade: true, servico: { select: { nome: true } } } },
  servicoRealizado: { select: { nome: true } },
  // Só o nome: o arquivo sai pela rota autorizada, nunca junto da página.
  comprovante: { select: { nome: true } },
  anexos: { select: { id: true, nome: true, tamanho: true }, orderBy: { criadoEm: "asc" as const } },
} satisfies Prisma.RelatorioAtendimentoInclude;

export type RelatorioCompleto = Prisma.RelatorioAtendimentoGetPayload<{ include: typeof INCLUIR_ADICIONAIS }>;

/**
 * O relatório do profissional exatamente como foi enviado — o que a equipe
 * lê para conferir. Usado na página de detalhe do pedido e, aberto, dentro
 * do cartão da esteira: quem confere não deveria aprovar um repasse sem ter
 * o relatório na frente, nem precisar abrir outra página para vê-lo.
 *
 * Só leitura. As ações (conferir, aprovar) ficam na esteira.
 */
export function RelatorioPreenchido({
  relatorio,
  paraClinica = false,
}: {
  relatorio: RelatorioCompleto;
  /**
   * A cópia que a clínica vê no portal (ata de 20/10): o atendimento como foi
   * feito, sem o que é da operação — ajuda de custo, o que o profissional
   * declarou ter recebido e a localização do envio.
   */
  paraClinica?: boolean;
}) {
  const temCorrecoes =
    relatorio.clinicaNomeInformado || relatorio.enderecoInformado || relatorio.doutorNomeInformado || relatorio.pacienteNomeInformado;

  return (
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
          <div className="text-gray-400">Quantidade feita</div>
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
        {relatorio.servicoRealizado && (
          <div className="sm:col-span-2">
            <div className="text-gray-400">Serviço principal realizado</div>
            <div className="text-amber-800 font-semibold">{relatorio.servicoRealizado.nome} — diferente do agendado</div>
          </div>
        )}
      </div>

      {temCorrecoes && (
        <div className="text-xs">
          <div className="text-gray-400 mb-0.5">Atendimento saiu diferente do agendado</div>
          {relatorio.clinicaNomeInformado && (
            <div className="text-amber-800">
              <strong>Clínica:</strong> {relatorio.clinicaNomeInformado}
            </div>
          )}
          {relatorio.enderecoInformado && (
            <div className="text-amber-800">
              <strong>Endereço:</strong> {relatorio.enderecoInformado}
            </div>
          )}
          {relatorio.doutorNomeInformado && (
            <div className="text-amber-800">
              <strong>Quem recebeu:</strong> {relatorio.doutorNomeInformado}
            </div>
          )}
          {relatorio.pacienteNomeInformado && (
            <div className="text-amber-800">
              <strong>Paciente:</strong> {relatorio.pacienteNomeInformado}
            </div>
          )}
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

      {(relatorio.adicionais.length > 0 || relatorio.servicosAdicionais) && (
        <div className="text-xs">
          <div className="text-gray-400 mb-0.5">Serviços além do agendado</div>
          {relatorio.adicionais.map((a) => (
            <div key={a.servico.nome} className="text-amber-800">
              {a.quantidade}× {a.servico.nome}
            </div>
          ))}
          {relatorio.servicosAdicionais && <div className="text-amber-800">{relatorio.servicosAdicionais}</div>}
        </div>
      )}

      {!paraClinica && relatorio.ajudaCustoCentavos != null && (
        <div className="text-xs">
          <div className="text-gray-400 mb-0.5">Ajuda de custo</div>
          <div className="text-amber-800">
            {formatarReais(relatorio.ajudaCustoCentavos)}
            {relatorio.ajudaCustoJustificativa ? ` · ${relatorio.ajudaCustoJustificativa}` : ""}
          </div>
        </div>
      )}

      {!paraClinica && relatorio.compareceu && (
        <div className="text-xs">
          <div className="text-gray-400 mb-0.5">Recebimento no atendimento</div>
          <div className={relatorio.recebimento === "NAO" ? "text-gray-700" : "text-green-800 font-semibold"}>
            {rotuloDaSituacao(relatorio.recebimento)}
            {relatorio.formaRecebimento && ` · ${rotuloDaForma(relatorio.formaRecebimento)}`}
            {relatorio.valorRecebidoCentavos != null && ` · ${formatarReais(relatorio.valorRecebidoCentavos)}`}
          </div>
          {relatorio.observacaoRecebimento && (
            <div className="text-amber-800 whitespace-pre-line mt-0.5">
              <strong>Fora do habitual:</strong> {relatorio.observacaoRecebimento}
            </div>
          )}
          {relatorio.comprovante && (
            <a
              href={`/api/comprovantes/${relatorio.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bordo hover:underline"
            >
              Ver comprovante ({relatorio.comprovante.nome})
            </a>
          )}
        </div>
      )}

      {/* Só a equipe e o autor: a clínica não vê os anexos (reunião de 28/10). */}
      {!paraClinica && relatorio.anexos.length > 0 && (
        <div className="text-xs">
          <div className="text-gray-400 mb-0.5">Anexos ({relatorio.anexos.length})</div>
          <ul className="space-y-0.5">
            {relatorio.anexos.map((a) => (
              <li key={a.id}>
                <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-bordo hover:underline">
                  📎 {a.nome}
                </a>{" "}
                <span className="text-gray-400">{tamanhoLegivel(a.tamanho)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(relatorio.orcamentoNumero || relatorio.pgNumero) && (
        <div className="text-xs">
          <div className="text-gray-400">Orçamento e PG</div>
          <div className="text-gray-700">
            {relatorio.orcamentoNumero ? `Orçamento ${relatorio.orcamentoNumero}` : ""}
            {relatorio.orcamentoNumero && relatorio.pgNumero ? " · " : ""}
            {relatorio.pgNumero ? `PG ${relatorio.pgNumero}` : ""}
          </div>
        </div>
      )}
      {relatorio.observacoes && (
        <div className="text-xs">
          <div className="text-gray-400 mb-0.5">Observações</div>
          <div className="text-gray-700 whitespace-pre-line">{relatorio.observacoes}</div>
        </div>
      )}

      {!paraClinica && relatorio.latitude != null && relatorio.longitude != null && (
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
    </div>
  );
}
