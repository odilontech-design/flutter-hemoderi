import { CAMPOS_CLINICOS, NAO_SE_APLICA } from "@/lib/relatorio";
import { rotuloDaForma, rotuloDaSituacao } from "@/lib/recebimento";

/**
 * O relatório em texto corrido, para colar no grupo de WhatsApp da equipe
 * (ata de 20/10: na transição, o relatório vai para o sistema E para o grupo).
 * Sem nome nem contato do paciente — o grupo não precisa deles, e dado de
 * saúde de paciente circulando em grupo é o que a LGPD manda evitar.
 */
export type DadosTextoRelatorio = {
  codigo: string;
  data: string;
  hora: string;
  profissional: string;
  clinica: string;
  doutor: string | null;
  servico: string;
  quantidade: number;
  adicionais: { nome: string; quantidade: number }[];
  justificativaAdicionais: string | null;
  compareceu: boolean;
  inicioReal: string | null;
  fimReal: string | null;
  intercorrencia: boolean;
  sinais: Record<string, string | null>;
  recebimento: string | null;
  formaRecebimento: string | null;
  valorRecebido: string | null;
  observacaoRecebimento: string | null;
  observacoes: string | null;
};

export function textoDoRelatorio(d: DadosTextoRelatorio): string {
  const linhas: string[] = [
    `*Relatório Hemoderi — ${d.codigo}*`,
    `Data: ${d.data} às ${d.hora}`,
    `Profissional: ${d.profissional}`,
    `Clínica: ${d.clinica}`,
  ];
  if (d.doutor) linhas.push(`Doutor(a): ${d.doutor}`);
  linhas.push(`Serviço: ${d.servico}${d.quantidade > 1 ? ` × ${d.quantidade}` : ""}`);
  for (const a of d.adicionais) linhas.push(`+ ${a.quantidade}× ${a.nome}`);
  if (d.justificativaAdicionais) linhas.push(`Justificativa: ${d.justificativaAdicionais}`);
  linhas.push(`Paciente compareceu: ${d.compareceu ? "sim" : "não"}`);
  if (d.compareceu) {
    if (d.inicioReal || d.fimReal) linhas.push(`Horário real: ${d.inicioReal ?? "—"} até ${d.fimReal ?? "—"}`);
    const sinais = CAMPOS_CLINICOS.map((c) => [c.rotulo, d.sinais[c.nome]] as const).filter(
      // "não se aplica" (o botão N/A) e um "N/A" digitado à mão ficam de fora.
      ([, v]) => v && v !== NAO_SE_APLICA && !/^n\/?a$/i.test(v.trim())
    );
    if (sinais.length > 0) linhas.push(`Sinais vitais: ${sinais.map(([r, v]) => `${r} ${v}`).join("; ")}`);
    linhas.push(`Intercorrência: ${d.intercorrencia ? "sim" : "não"}`);
    const recebeu = [rotuloDaSituacao(d.recebimento), d.formaRecebimento ? rotuloDaForma(d.formaRecebimento) : null, d.valorRecebido]
      .filter(Boolean)
      .join(" · ");
    linhas.push(`Recebimento: ${recebeu}`);
    if (d.observacaoRecebimento) linhas.push(`Pagamento fora do habitual: ${d.observacaoRecebimento}`);
  }
  if (d.observacoes) linhas.push(`Observações: ${d.observacoes}`);
  return linhas.join("\n");
}
