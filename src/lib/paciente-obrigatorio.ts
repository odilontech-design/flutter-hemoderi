/**
 * Quando o nome do paciente é exigido ao agendar.
 *
 * Curso sempre exige. Numa visita com mais de um serviço o nome é o que separa
 * o relatório de cada atendimento — mas só quando os pacientes são DIFERENTES.
 * Para o mesmo paciente em todos os serviços não há o que separar, e a equipe
 * muitas vezes agenda por telefone sem saber o nome ainda (Joyce, 12/11): o
 * profissional informa o paciente no relatório. A clínica, que conhece o
 * paciente, continua informando.
 */
export function pacienteObrigatorio(d: {
  modalidade: "PARTICULAR" | "CURSO";
  servicos: number;
  pelaEquipe: boolean;
  /** Resposta a "Os serviços são para o mesmo paciente?": true, false ou ainda sem resposta. */
  mesmoPaciente: boolean | null;
}): boolean {
  if (d.modalidade === "CURSO") return true;
  if (d.servicos <= 1) return false;
  return !(d.pelaEquipe && d.mesmoPaciente === true);
}
