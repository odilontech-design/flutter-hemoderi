/**
 * O termo de aceite do cliente (ata de 27/10): "li e concordei" no primeiro
 * login, vinculando a clínica às regras de cobrança da plataforma.
 *
 * Mudou o texto? Troque a VERSAO: quem aceitou a anterior volta a ser
 * perguntado no próximo acesso. O que cada cláusula diz vem da própria ata —
 * antes de valer como contrato, vale a revisão do jurídico/comercial.
 */
export const VERSAO_DO_TERMO = "2026-10-27";

export const TITULO_DO_TERMO = "Termo de aceite — regras de agendamento e cobrança";

export const CLAUSULAS_DO_TERMO: { titulo: string; texto: string }[] = [
  {
    titulo: "Valor do agendamento",
    texto:
      "O valor mostrado no agendamento é o do serviço escolhido. Se, no atendimento, for utilizado outro serviço do catálogo, o valor poderá ser alterado para o da tabela vigente desse serviço.",
  },
  {
    titulo: "Tempo adicional",
    texto:
      "Atendimentos que ultrapassem o tempo contratado — como sedações que passem de 15 minutos além do previsto — podem gerar a cobrança de horas inteiras adicionais.",
  },
  {
    titulo: "Deslocamento",
    texto:
      "Endereços a partir de 151 km da base da Hemoderi têm cobrança de taxa de deslocamento ou podem não ser atendidos, conforme avaliação da central.",
  },
  {
    titulo: "Pagamento por Pix",
    texto: "O pagamento por Pix tem desconto de 5% em relação ao valor no cartão de crédito.",
  },
  {
    titulo: "Cancelamento e reagendamento",
    texto:
      "Cancelamentos e reagendamentos são registrados com o motivo e ficam no histórico do agendamento. A central pode propor novo horário quando necessário.",
  },
  {
    titulo: "Dados dos pacientes",
    texto:
      "Os nomes e dados de pacientes informados no agendamento são usados somente para a execução e o registro do atendimento.",
  },
];
