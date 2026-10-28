import { NAO_SE_APLICA } from "@/lib/relatorio";
import { rotuloDaForma } from "@/lib/recebimento";

/**
 * O relatório em texto, para colar no grupo de WhatsApp da equipe.
 *
 * Segue o modelo que a equipe já usa à mão no grupo (pedido do André, 28/10:
 * "igual ao que fazem hoje"): Data, Horário, Endereço, Clínica, Cirurgião,
 * Paciente, Procedimento, Serviços, Profissional, Valor, Pagamento e os sinais
 * (FC, SatO2, PA, Destro). O nome do paciente entra porque o modelo de hoje o
 * traz e é com ele que a equipe confere o lançamento; o contato dele não.
 * Orçamento e PG são números de atendimento Mandic: entram só para eles.
 */
export type DadosTextoRelatorio = {
  codigo: string;
  data: string;
  hora: string;
  profissional: string;
  clinica: string;
  endereco: string | null;
  doutor: string | null;
  paciente: string | null;
  procedimento: string | null;
  servico: string;
  quantidade: number;
  adicionais: { nome: string; quantidade: number }[];
  justificativaAdicionais: string | null;
  /** O valor do serviço, em reais, como a equipe escreve ("350,00"). */
  valor: string | null;
  compareceu: boolean;
  inicioReal: string | null;
  fimReal: string | null;
  intercorrencia: boolean;
  sinais: Record<string, string | null>;
  recebimento: string | null;
  formaRecebimento: string | null;
  formaDoCliente: string | null;
  valorRecebido: string | null;
  observacaoRecebimento: string | null;
  observacoes: string | null;
  /** Só atendimento Mandic: os números de orçamento e PG. Ausente nos demais clientes. */
  mandic?: { orcamento: string | null; pg: string | null } | null;
};

/** "não se aplica" (o botão N/A) e um "N/A" digitado à mão ficam em branco, como no modelo à mão. */
function valorDoSinal(v: string | null | undefined): string {
  if (!v || v === NAO_SE_APLICA || /^n\/?a$/i.test(v.trim())) return "";
  return v.trim();
}

export function textoDoRelatorio(d: DadosTextoRelatorio): string {
  const linhas: string[] = [`Data: ${d.data}`, `Horário: ${d.hora}`];
  if (d.compareceu && (d.inicioReal || d.fimReal)) linhas.push(`Horário real: ${d.inicioReal ?? "—"} até ${d.fimReal ?? "—"}`);
  if (d.endereco) linhas.push(`Endereço: ${d.endereco}`);
  linhas.push(`Nome da Clínica: ${d.clinica}`);
  linhas.push(`Cirurgião: ${d.doutor ?? ""}`);
  linhas.push(`Paciente: ${d.paciente ?? ""}`);
  if (!d.compareceu) linhas.push("Paciente não compareceu");
  linhas.push(`Procedimento que foi realizado no paciente: ${d.procedimento ?? ""}`);
  const servicos = [`${d.servico}${d.quantidade > 1 ? ` × ${d.quantidade}` : ""}`, ...d.adicionais.map((a) => `${a.quantidade}× ${a.nome}`)];
  linhas.push(`Serviços Hemoderi: ${servicos.join(" + ")}`);
  if (d.justificativaAdicionais) linhas.push(`Justificativa dos adicionais: ${d.justificativaAdicionais}`);
  linhas.push(`Profissional Hemoderi: ${d.profissional}`);
  linhas.push(`Valor: ${d.valor ?? ""}`);
  if (d.compareceu) {
    const recebeu = d.recebimento === "TOTAL" ? "sim" : d.recebimento === "PARCIAL" ? "parcial" : d.recebimento ? "não" : "";
    linhas.push(`Pagamento (Sim/Não): ${recebeu}`);
    const forma = d.formaRecebimento ? rotuloDaForma(d.formaRecebimento) : (d.formaDoCliente ?? "");
    linhas.push(`Forma de Pagamento: ${forma}`);
    if (d.valorRecebido) linhas.push(`Valor recebido: ${d.valorRecebido}`);
    if (d.observacaoRecebimento) linhas.push(`Pagamento fora do habitual: ${d.observacaoRecebimento}`);
    const sinal = (nome: string) => valorDoSinal(d.sinais[nome]);
    linhas.push(`FC=${sinal("frequenciaCardiaca")}`);
    linhas.push(`Sato2=${sinal("saturacaoOxigenio")}`);
    linhas.push(`PA=${sinal("pressaoArterial")}`);
    linhas.push(`Destro=${sinal("glicemia")}`);
    // Orçamento e PG são números de atendimento Mandic: só entram para eles.
    if (d.mandic) {
      linhas.push(`Orçamento =${d.mandic.orcamento ?? ""}`);
      linhas.push(`PG=${d.mandic.pg ?? ""}`);
    }
    if (sinal("oxidoNitroso")) linhas.push(`N2O=${sinal("oxidoNitroso")}`);
    if (sinal("oxigenio")) linhas.push(`O2=${sinal("oxigenio")}`);
    if (d.intercorrencia) linhas.push("Intercorrência: sim");
  }
  linhas.push(`Obs: ${d.observacoes ?? ""}`);
  linhas.push(`Agendamento: ${d.codigo}`);
  return linhas.join("\n");
}
