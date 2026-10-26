"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CamposEndereco } from "@/components/CamposEndereco";
import { adicionarEnderecoPelaEquipe } from "@/app/actions/enderecos";

/**
 * "Usar outro endereço" no agendamento da equipe (reunião de 27/10): a
 * clínica liga dizendo que desta vez é em outro lugar, e a equipe informa o
 * endereço ali mesmo, pelo CEP, sem sair do agendamento.
 *
 * Abre numa janela por cima da tela — fora do formulário do agendamento no
 * DOM (portal), para os campos de um não irem junto com o envio do outro.
 */
export function OutroEndereco({ clinicaId, aoCriar }: { clinicaId: string; aoCriar: (id: string) => void }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="text-[11px] font-semibold text-bordo hover:underline">
        + Usar outro endereço
      </button>
      {aberto &&
        montado &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center overflow-y-auto p-4"
            onClick={(e) => e.target === e.currentTarget && setAberto(false)}
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-bordo text-sm">Outro endereço para o atendimento</h2>
                <button type="button" onClick={() => setAberto(false)} className="text-gray-400 hover:text-bordo text-lg leading-none" aria-label="Fechar">
                  ×
                </button>
              </div>
              <FormularioAcao
                acao={adicionarEnderecoPelaEquipe}
                botao="Salvar e usar neste agendamento"
                aoSalvar={(estado) => {
                  setAberto(false);
                  if (estado.id) aoCriar(estado.id);
                  router.refresh();
                }}
              >
                <input type="hidden" name="clinicaId" value={clinicaId} />
                <div>
                  <Rotulo>Nome do lugar</Rotulo>
                  <Campo name="rotulo" required placeholder="Unidade Moema, consultório do Dr. Fulano…" />
                </div>
                <CamposEndereco />
                <div>
                  <Rotulo>Observações e referências (opcional)</Rotulo>
                  <Area name="observacoes" rows={2} maxLength={500} placeholder="Bloco B, sala 12, estacionamento no subsolo…" />
                </div>
                <div className="text-[10px] text-gray-400">Fica salvo nos endereços da clínica para os próximos agendamentos.</div>
              </FormularioAcao>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
