"use client";

import { useRouter } from "next/navigation";
import { Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CampoDocumento } from "@/components/CampoDocumento";
import { CampoTelefone } from "@/components/CampoTelefone";
import { liberarClinicaParaAgendar } from "@/app/actions/cadastros";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";

/**
 * O que impede a clínica escolhida de agendar, resolvido ali mesmo (ata de
 * 26/10): ativar o cadastro, aprovar o autocadastro e completar o que falta
 * para cobrar. Só pede os campos que de fato faltam.
 */
export function LiberarClinica({
  clinicaId,
  pendencias,
  faltaCnpj,
  faltaTelefone,
  faltaEmail,
  faltaPerfil,
}: {
  clinicaId: string;
  pendencias: string[];
  faltaCnpj: boolean;
  faltaTelefone: boolean;
  faltaEmail: boolean;
  faltaPerfil: boolean;
}) {
  const router = useRouter();

  return (
    <FormularioAcao
      acao={liberarClinicaParaAgendar}
      botao="Ativar e continuar o agendamento"
      limparAoSalvar={false}
      aoSalvar={() => router.refresh()}
    >
      <input type="hidden" name="clinicaId" value={clinicaId} />
      <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="font-semibold mb-1">Esta clínica ainda não pode agendar:</div>
        <ul className="list-disc pl-4 space-y-0.5">
          {pendencias.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      {(faltaCnpj || faltaTelefone || faltaEmail) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {faltaCnpj && <CampoDocumento tipo="cnpj" name="cnpj" rotulo="CNPJ (ou CPF)" obrigatorio />}
          {faltaTelefone && (
            <div>
              <Rotulo>Telefone da clínica</Rotulo>
              <CampoTelefone name="telefone" obrigatorio />
            </div>
          )}
          {faltaEmail && (
            <div>
              <Rotulo>E-mail da clínica</Rotulo>
              <Campo name="email" type="email" required />
            </div>
          )}
        </div>
      )}

      {faltaPerfil && (
        <div>
          <Rotulo>Perfil da clínica</Rotulo>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
            {TODOS_OS_PERFIS.map((perfil) => (
              <label key={perfil} className="flex items-center gap-1.5 text-xs text-gray-700">
                <input type="checkbox" name="perfis" value={perfil} />
                {ROTULO_PERFIL_CLIENTE[perfil]}
              </label>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            Decide o que a clínica enxerga no catálogo do portal dela.
          </div>
        </div>
      )}
    </FormularioAcao>
  );
}
