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

/** Janela em que um pedido feito pela clínica já é "para já" (reunião de 28/10). */
const HORAS_DO_AGENDAMENTO_URGENTE = 24;

/**
 * O local fica aberto desde a alocação quando a clínica agendou pelo portal
 * com até 24h de antecedência (reunião de 28/10): o pedido já nasce dentro da
 * janela de revelação, e esconder o endereço de quem foi chamado em cima da
 * hora só atrapalha. O sigilo continua valendo para o resto — ele existe
 * contra a escolha a dedo, e um pedido urgente não dá tempo de escolher.
 */
export function agendadoDeUltimaHora(pedido: { origem: string; criadoEm: Date; data: Date; horaInicio: string }): boolean {
  if (pedido.origem !== "PORTAL_CLINICA") return false;
  const antecedencia = instanteDoAtendimento(pedido.data, pedido.horaInicio).getTime() - pedido.criadoEm.getTime();
  return antecedencia <= HORAS_DO_AGENDAMENTO_URGENTE * 60 * 60 * 1000;
}

/** A regra completa: a janela de revelação OU o agendamento de última hora. */
export function localVisivel(
  pedido: { origem: string; criadoEm: Date; data: Date; horaInicio: string },
  horasAntes: number,
  agora: Date = new Date()
): boolean {
  return localRevelado(pedido.data, pedido.horaInicio, horasAntes, agora) || agendadoDeUltimaHora(pedido);
}

/** O que aparece no lugar do nome enquanto o local está fechado. */
export const LOCAL_FECHADO = "Clínica informada na véspera";
