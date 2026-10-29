"use client";

import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { SeletorDeLocal } from "@/components/SeletorDeLocal";
import { CampoTelefone } from "@/components/CampoTelefone";
import { CampoHora } from "@/components/CampoHora";
import { editarVisita } from "@/app/actions/pedidos";
import { FORMAS_DE_PAGAMENTO } from "@/lib/pagamento";
import { PROCEDIMENTOS_NO_PACIENTE } from "@/lib/procedimentos";

export type DadosDaVisita = {
  grupoId: string;
  data: string; // ISO (yyyy-mm-dd)
  horaInicio: string;
  enderecoId: string;
  doutorNome: string;
  contatoClinica: string;
  procedimentoPaciente: string;
  formaPagamento: string;
  observacoes: string;
  confirmada: boolean;
  servicos: { horaInicio: string; nome: string; paciente: string | null }[];
};

/**
 * Editar o agendamento inteiro — a visita com todos os serviços (reunião de
 * 27/10). Fica no topo do detalhe e abre sozinho quando a pessoa chega pelo
 * "Editar agendamento" da esteira.
 */
export function EditarVisita({
  dados,
  locais,
  clinicaId,
  aberto,
}: {
  dados: DadosDaVisita;
  locais: { id: string; rotulo: string }[];
  clinicaId: string;
  aberto: boolean;
}) {
  const router = useRouter();
  return (
    <details open={aberto} className="mb-3 bg-white rounded-2xl border border-bordo/30 px-5 py-3">
      <summary className="cursor-pointer select-none text-xs font-semibold text-bordo">
        Editar o agendamento inteiro ({dados.servicos.length} serviços)
      </summary>
      <div className="mt-3">
        <div className="text-[11px] text-gray-500 mb-2 leading-relaxed">
          Vale para todos os serviços da visita. Os serviços seguem em sequência a partir do novo horário:
          <ul className="mt-1 list-disc pl-4">
            {dados.servicos.map((s) => (
              <li key={`${s.horaInicio}-${s.nome}`}>
                {s.horaInicio} · {s.nome}
                {s.paciente ? ` · ${s.paciente}` : ""}
              </li>
            ))}
          </ul>
          {dados.confirmada && (
            <div className="mt-1 text-amber-700">
              Mudar <strong>data, horário ou local</strong> mantém a visita confirmada e os profissionais; conflito de agenda aparece como aviso.
            </div>
          )}
          O paciente e o serviço de cada item se editam no próprio serviço.
        </div>
        <FormularioAcao acao={editarVisita} botao="Salvar o agendamento" limparAoSalvar={false} aoSalvar={() => router.refresh()}>
          <input type="hidden" name="grupoId" value={dados.grupoId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Rotulo>Data</Rotulo>
              <Campo name="data" type="date" required defaultValue={dados.data} />
            </div>
            <div>
              <Rotulo>Horário de início</Rotulo>
              <CampoHora name="horaInicio" required defaultValue={dados.horaInicio} />
            </div>
            <div className="sm:col-span-2">
              <Rotulo>Local do atendimento</Rotulo>
              <SeletorDeLocal clinicaId={clinicaId} inicial={dados.enderecoId} locais={locais} />
            </div>
            <div>
              <Rotulo>Doutor(a) responsável</Rotulo>
              <Campo name="doutorNome" defaultValue={dados.doutorNome} />
            </div>
            <div>
              <Rotulo>Contato da clínica</Rotulo>
              <CampoTelefone name="contatoClinica" inicial={dados.contatoClinica} />
            </div>
            <div>
              <Rotulo>Procedimento no paciente</Rotulo>
              <Campo name="procedimentoPaciente" list="procedimentos-visita" defaultValue={dados.procedimentoPaciente} />
              <datalist id="procedimentos-visita">
                {PROCEDIMENTOS_NO_PACIENTE.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <Rotulo>Forma de pagamento</Rotulo>
              <Selecao name="formaPagamento" defaultValue={dados.formaPagamento}>
                <option value="">Não informada</option>
                {FORMAS_DE_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Selecao>
            </div>
          </div>
          <div>
            <Rotulo>Observações</Rotulo>
            <Area name="observacoes" rows={2} defaultValue={dados.observacoes} />
          </div>
        </FormularioAcao>
      </div>
    </details>
  );
}
