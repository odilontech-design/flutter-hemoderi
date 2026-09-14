/**
 * Link de conversa com a central, com a mensagem já escrita.
 *
 * A urgência não pode virar um beco: quando o portal recusa um agendamento
 * por antecedência, a clínica precisa cair na conversa com a central já
 * levando o que tinha preenchido — e não recomeçar do zero em outro
 * aplicativo, que é onde o pedido se perde.
 */

/** wa.me quer só dígitos, com o código do país na frente. */
export function numeroParaWhatsapp(bruto: string | null | undefined): string | null {
  const digitos = (bruto ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  // Número brasileiro digitado sem o 55 ainda é o caso mais comum no
  // cadastro; completar aqui evita um link que abre em branco.
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

export function linkWhatsapp(numero: string | null | undefined, mensagem: string): string | null {
  const destino = numeroParaWhatsapp(numero);
  if (!destino) return null;
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`;
}

export type PedidoUrgente = {
  clinica: string;
  servico?: string | null;
  data?: string | null;
  hora?: string | null;
  doutor?: string | null;
  paciente?: string | null;
  observacoes?: string | null;
};

/**
 * A mensagem que a clínica manda quando o horário é para menos de 24h.
 *
 * Escrita em primeira pessoa da clínica, e não como um relatório do sistema:
 * é ela quem vai apertar enviar, e uma mensagem que parece automática recebe
 * resposta automática.
 */
export function mensagemDeUrgencia(pedido: PedidoUrgente): string {
  const linhas = [
    `Olá! Preciso de um agendamento com urgência (menos de 24h).`,
    "",
    `Clínica: ${pedido.clinica}`,
    pedido.servico ? `Serviço: ${pedido.servico}` : null,
    pedido.data ? `Data: ${pedido.data}${pedido.hora ? ` às ${pedido.hora}` : ""}` : null,
    pedido.doutor ? `Doutor(a): ${pedido.doutor}` : null,
    pedido.paciente ? `Paciente: ${pedido.paciente}` : null,
    pedido.observacoes ? `Observações: ${pedido.observacoes}` : null,
  ];
  return linhas.filter((l) => l !== null).join("\n");
}
