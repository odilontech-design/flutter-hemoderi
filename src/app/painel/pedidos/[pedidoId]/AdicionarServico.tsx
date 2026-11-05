"use client";

import { useRouter } from "next/navigation";
import { Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CampoHora } from "@/components/CampoHora";
import { adicionarServicoAoAgendamento } from "@/app/actions/pedidos";

/**
 * Mais um serviço no mesmo agendamento (pedido de 05/11). Fica na mesma
 * visita: mesma clínica, data, local, doutor e forma de pagamento; o preço
 * sai da tabela da clínica. O horário sugerido é o fim do último serviço.
 */
export function AdicionarServico({
  pedidoId,
  grupos,
  horaSugerida,
}: {
  pedidoId: string;
  grupos: { familia: string; servicos: { id: string; nome: string }[] }[];
  horaSugerida: string;
}) {
  const router = useRouter();
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-bordo">+ Adicionar serviço a este agendamento</summary>
      <div className="mt-3">
        <FormularioAcao acao={adicionarServicoAoAgendamento} botao="Adicionar serviço" aoSalvar={() => router.refresh()}>
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Rotulo>Serviço</Rotulo>
              <Selecao name="servicoId" defaultValue="" required>
                <option value="" disabled>
                  Escolha o serviço…
                </option>
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
              <Rotulo>Horário</Rotulo>
              <CampoHora name="horaInicio" required defaultValue={horaSugerida} />
            </div>
            <div>
              <Rotulo>Quantidade</Rotulo>
              <Campo name="quantidade" type="number" min={1} defaultValue={1} />
            </div>
            <div className="sm:col-span-2">
              <Rotulo>Paciente (se for outro)</Rotulo>
              <Campo name="pacienteNome" placeholder="Em branco: o mesmo paciente do agendamento" />
            </div>
          </div>
          <div className="text-[10px] text-gray-400">
            Entra na mesma visita, com o preço da tabela desta clínica. Depois é só alocar o profissional dele.
          </div>
        </FormularioAcao>
      </div>
    </details>
  );
}
