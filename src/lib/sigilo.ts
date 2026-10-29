import { instanteDoAtendimento } from "./data";
import { semExpediente } from "./feriados";

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
  agora: Date = new Date(),
  /** UF do atendimento: fora de São Paulo o local aparece desde a alocação (ata de 29/10). */
  uf?: string | null
): boolean {
  const inicio = instanteDoAtendimento(data, horaInicio);
  // Atendimento que já passou fica visível: o profissional precisa do dado
  // para preencher o relatório e para conferir o próprio pagamento.
  if (inicio.getTime() <= agora.getTime()) return true;

  // Fora de São Paulo o endereço é liberado já na alocação (ata de 29/10). O
  // sigilo existe contra a escolha a dedo na capital, onde o profissional
  // recusa o que é longe — nos outros estados quase não há o que escolher.
  const estado = (uf ?? "").trim().toUpperCase();
  if (estado && estado !== "SP") return true;

  return agora.getTime() >= instanteDeAbertura(inicio, horasAntes).getTime();
}

const BRT_MS = 3 * 60 * 60 * 1000;

/**
 * Quando o local abre: `horasAntes` antes do atendimento — e, se esse instante
 * cai em fim de semana ou feriado, no último dia útil antes, às 8h (ata de
 * 29/10: o atendimento de segunda se programa na sexta, não no domingo).
 */
export function instanteDeAbertura(inicio: Date, horasAntes: number): Date {
  const abertura = new Date(inicio.getTime() - horasAntes * 60 * 60 * 1000);
  const brt = new Date(abertura.getTime() - BRT_MS); // relógio de Brasília lido com getUTC*
  let dia = brt.toISOString().slice(0, 10);
  if (!semExpediente(dia)) return abertura;
  let d = new Date(`${dia}T00:00:00Z`);
  while (semExpediente(dia)) {
    d = new Date(d.getTime() - 86_400_000);
    dia = d.toISOString().slice(0, 10);
  }
  return new Date(Date.parse(`${dia}T08:00:00Z`) + BRT_MS);
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

/** A regra completa: a janela de revelação (ou a UF fora de SP) OU o agendamento de última hora. */
export function localVisivel(
  pedido: {
    origem: string;
    criadoEm: Date;
    data: Date;
    horaInicio: string;
    clinica?: { uf?: string | null } | null;
    endereco?: { uf?: string | null } | null;
  },
  horasAntes: number,
  agora: Date = new Date()
): boolean {
  const uf = pedido.endereco?.uf ?? pedido.clinica?.uf ?? null;
  return localRevelado(pedido.data, pedido.horaInicio, horasAntes, agora, uf) || agendadoDeUltimaHora(pedido);
}

/** O que aparece no lugar do nome enquanto o local está fechado. */
export const LOCAL_FECHADO = "Clínica informada na véspera";
