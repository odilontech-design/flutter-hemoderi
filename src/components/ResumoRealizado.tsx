/**
 * O resumo de um atendimento que já aconteceu, com o endereço onde foi
 * realizado (pedido de 26/10). Nas listas de realizados aparecia só data e
 * serviço; para conferir uma cobrança ou um repasse, a primeira pergunta é
 * "onde foi?". Abre num toque, sem JavaScript, para caber em tabela.
 */
export function ResumoRealizado({
  local,
  horaInicio,
  doutorNome,
  pacienteNome,
  procedimentoPaciente,
  formaPagamento,
  observacoes,
}: {
  local: string;
  horaInicio?: string | null;
  doutorNome?: string | null;
  pacienteNome?: string | null;
  procedimentoPaciente?: string | null;
  formaPagamento?: string | null;
  observacoes?: string | null;
}) {
  const linhas: [string, string | null | undefined][] = [
    ["Local", local || "endereço não informado"],
    ["Horário", horaInicio],
    ["Doutor(a)", doutorNome],
    ["Paciente", pacienteNome],
    ["Procedimento", procedimentoPaciente],
    ["Pagamento", formaPagamento],
    ["Observações", observacoes],
  ];
  return (
    <details className="group mt-0.5">
      <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[10px] font-semibold text-bordo hover:underline">
        Resumo <span className="group-open:hidden">▾</span>
        <span className="hidden group-open:inline">▴</span>
      </summary>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-gray-600">
        {linhas
          .filter(([, valor]) => valor)
          .map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="text-gray-400">{rotulo}</dt>
              <dd className="whitespace-pre-line">{valor}</dd>
            </div>
          ))}
      </dl>
    </details>
  );
}
