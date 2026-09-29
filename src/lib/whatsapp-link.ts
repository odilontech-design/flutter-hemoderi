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

/**
 * "(11) 99999-0000" enquanto a pessoa digita — decisão da ata de 21/09: o
 * campo precisa chegar com DDD, em formato que o disparo automático de
 * confirmação reconheça, e a máscara é o que deixa isso óbvio antes do envio
 * em vez de só recusar depois.
 */
export function formatarTelefone(valor: string): string {
  const d = (valor ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
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

/**
 * A mensagem que o pós-venda manda à clínica depois de aprovar o relatório
 * (ata de 28/09).
 *
 * Diferente da urgência, esta é a Hemoderi falando com o cliente, não o
 * contrário — então a voz é da operação. Junta duas coisas que a Stephanie
 * hoje faz em duas mensagens: avisar que o relatório do atendimento está
 * pronto e pedir a avaliação. Texto padrão de propósito: é o que ela
 * dispara dezenas de vezes por semana, e reescrever a cada vez é onde o
 * pedido de feedback deixa de acontecer.
 *
 * O nome de quem atendeu NÃO entra: entre a clínica e a Hemoderi o
 * atendimento é da Hemoderi, e pôr o profissional aqui abriria a porta para
 * a clínica pedir "manda o mesmo de novo" por fora — a mesma imparcialidade
 * que esconde o profissional no portal até 24h antes (ata de 14/09).
 */
export function mensagemDeFeedback(pedido: {
  clinica: string;
  servico?: string | null;
  data?: string | null;
}): string {
  const oQue = pedido.servico ? `o atendimento de ${pedido.servico}` : "o atendimento";
  const quando = pedido.data ? ` do dia ${pedido.data}` : "";
  return [
    `Olá! Aqui é da Hemoderi.`,
    "",
    `O relatório ${oQue}${quando} já está fechado e disponível no seu portal.`,
    "",
    `Como foi a experiência? Sua avaliação ajuda a gente a mandar sempre o melhor profissional para a ${pedido.clinica}. É rapidinho, e você pode responder por aqui mesmo ou lá no portal.`,
  ].join("\n");
}
