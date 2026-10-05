"use client";

import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { editarAgendamento } from "@/app/actions/pedidos";
import { FORMAS_DE_PAGAMENTO } from "@/lib/pagamento";
import { PROCEDIMENTOS_NO_PACIENTE } from "@/lib/procedimentos";

export type DadosEditaveis = {
  id: string;
  data: string; // ISO (yyyy-mm-dd)
  horaInicio: string;
  servicoId: string;
  quantidade: number;
  enderecoId: string;
  doutorNome: string;
  pacienteNome: string;
  pacienteContato: string;
  procedimentoPaciente: string;
  formaPagamento: string;
  observacoes: string;
  status: string;
};

/**
 * A correção do resumo do agendamento pela equipe (ata de 02/10): todos os
 * campos editáveis. Mudar data, horário, local ou serviço devolve o pedido
 * confirmado para a aprovação — o aviso no topo diz isso antes de a pessoa
 * salvar, e não depois.
 */
export function EditarAgendamento({
  dados,
  grupos,
  locais,
}: {
  dados: DadosEditaveis;
  grupos: { familia: string; servicos: { id: string; nome: string }[] }[];
  locais: { id: string; rotulo: string }[];
}) {
  const router = useRouter();
  const jaConfirmado = dados.status !== "SOLICITADO";

  return (
    <details className="mb-3 bg-white rounded-2xl border border-gray-200 px-5 py-3">
      <summary className="cursor-pointer select-none text-xs font-semibold text-bordo">Editar agendamento</summary>
      <div className="mt-3">
        <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
          Mudar <strong>data, horário, local ou serviço</strong>
          {jaConfirmado ? " devolve o pedido para a aprovação (solicitado) e libera profissional e equipamento." : " refaz a checagem de agenda."}{" "}
          Os demais campos salvam direto.
        </div>
        <FormularioAcao acao={editarAgendamento} botao="Salvar alterações" limparAoSalvar={false} aoSalvar={() => router.refresh()}>
          <input type="hidden" name="pedidoId" value={dados.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Rotulo>Data</Rotulo>
              <Campo name="data" type="date" required defaultValue={dados.data} />
            </div>
            <div>
              <Rotulo>Horário agendado com o paciente</Rotulo>
              <Campo name="horaInicio" type="time" required step={900} defaultValue={dados.horaInicio} />
            </div>
            <div>
              <Rotulo>Serviço</Rotulo>
              <Selecao name="servicoId" defaultValue={dados.servicoId}>
                {grupos.map((g) => (
                  <optgroup key={g.familia} label={g.familia}>
                    {g.servicos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Selecao>
            </div>
            <div>
              <Rotulo>Quantidade</Rotulo>
              <Campo name="quantidade" type="number" min={1} defaultValue={dados.quantidade} />
            </div>
            <div className="sm:col-span-2">
              <Rotulo>Local do atendimento</Rotulo>
              <Selecao name="enderecoId" defaultValue={dados.enderecoId}>
                {locais.map((l) => (
                  <option key={l.id || "principal"} value={l.id}>
                    {l.rotulo}
                  </option>
                ))}
              </Selecao>
            </div>
            <div>
              <Rotulo>Doutor(a) responsável</Rotulo>
              <Campo name="doutorNome" defaultValue={dados.doutorNome} />
            </div>
            <div>
              <Rotulo>Paciente</Rotulo>
              <Campo name="pacienteNome" defaultValue={dados.pacienteNome} />
            </div>
            <div>
              <Rotulo>Contato do paciente</Rotulo>
              <Campo name="pacienteContato" defaultValue={dados.pacienteContato} />
            </div>
            <div>
              <Rotulo>Procedimento no paciente</Rotulo>
              <Campo name="procedimentoPaciente" list="procedimentos-lista" defaultValue={dados.procedimentoPaciente} />
              <datalist id="procedimentos-lista">
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
