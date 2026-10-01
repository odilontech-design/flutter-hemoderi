/**
 * O agendamento público (a página /agendar, sem cadastro) está ligado?
 *
 * Fica desligado enquanto o foco é o portal do cliente cadastrado (reunião de
 * 01/10). Liga com AGENDAMENTO_PUBLICO_ATIVO=1 no ambiente, sem mexer no
 * código — e junto com ele volta o item "Pedidos do site" do painel, que só
 * existe para tratar o que chega por essa página.
 */
export function agendamentoPublicoAtivo(): boolean {
  return process.env.AGENDAMENTO_PUBLICO_ATIVO === "1";
}
