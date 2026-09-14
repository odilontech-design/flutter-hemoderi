import { instanteDoAtendimento } from "./data";

/**
 * Quando o profissional passa a ver a clínica e o doutor do atendimento.
 *
 * Decisão de imparcialidade da operação: com o endereço à vista desde a
 * alocação, atendimento longe é recusado e sobra sempre para os mesmos. Antes
 * da janela, o portal mostra data, horário, serviço e quanto ele recebe — o
 * bastante para se planejar, sem o bastante para escolher a dedo.
 *
 * O local NÃO é segredo permanente: ele precisa saber onde ir. A janela é o
 * mesmo prazo do lembrete, então a revelação chega junto com o aviso.
 */
export function localRevelado(
  data: Date,
  horaInicio: string,
  horasAntes: number,
  agora: Date = new Date()
): boolean {
  const inicio = instanteDoAtendimento(data, horaInicio);
  // Atendimento que já passou fica visível: o profissional precisa do dado
  // para preencher o relatório e para conferir o próprio pagamento.
  if (inicio.getTime() <= agora.getTime()) return true;
  return inicio.getTime() - agora.getTime() <= horasAntes * 60 * 60 * 1000;
}

/** O que aparece no lugar do nome enquanto o local está fechado. */
export const LOCAL_FECHADO = "Clínica informada na véspera";
