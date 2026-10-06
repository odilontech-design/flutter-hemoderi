"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { editarAgendamentoPeloPortal } from "@/app/actions/pedidos";
import { FORMAS_DE_PAGAMENTO } from "@/lib/pagamento";
import { OUTRO_PROCEDIMENTO, PROCEDIMENTOS_NO_PACIENTE } from "@/lib/procedimentos";

type Dados = {
  id: string;
  doutorNome: string;
  pacienteNome: string;
  contatoClinica: string;
  procedimentoPaciente: string;
  formaPagamento: string;
  observacoes: string;
};

/** "Outros: Rinoplastia" volta como escolha "Outros" + texto "Rinoplastia". */
function separarProcedimento(salvo: string): { escolha: string; outro: string } {
  if (salvo.startsWith(`${OUTRO_PROCEDIMENTO}: `)) {
    return { escolha: OUTRO_PROCEDIMENTO, outro: salvo.slice(OUTRO_PROCEDIMENTO.length + 2) };
  }
  return { escolha: salvo, outro: "" };
}

export function EditarAgendamentoPortal({ dados }: { dados: Dados }) {
  const router = useRouter();
  const inicial = separarProcedimento(dados.procedimentoPaciente);
  const [procedimento, setProcedimento] = useState(inicial.escolha);

  return (
    <FormularioAcao
      acao={editarAgendamentoPeloPortal}
      botao="Salvar alterações"
      limparAoSalvar={false}
      aoSalvar={() => router.push(`/portal/resumo/${dados.id}`)}
    >
      <input type="hidden" name="pedidoId" value={dados.id} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Doutor(a) responsável</Rotulo>
          <Campo name="doutorNome" required defaultValue={dados.doutorNome} />
        </div>
        <div>
          <Rotulo>Contato da clínica para confirmação</Rotulo>
          <Campo name="contatoClinica" maxLength={40} defaultValue={dados.contatoClinica} />
        </div>
        <div>
          <Rotulo>Paciente (opcional)</Rotulo>
          <Campo name="pacienteNome" defaultValue={dados.pacienteNome} />
        </div>
        <div>
          <Rotulo>Forma de pagamento</Rotulo>
          <Selecao name="formaPagamento" required defaultValue={dados.formaPagamento}>
            <option value="">Selecione…</option>
            {FORMAS_DE_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Selecao>
        </div>
        <div className="sm:col-span-2">
          <Rotulo>Procedimento a ser realizado no paciente</Rotulo>
          <Selecao
            name="procedimentoPaciente"
            required
            value={procedimento}
            onChange={(e) => setProcedimento(e.target.value)}
          >
            <option value="">Selecione…</option>
            {PROCEDIMENTOS_NO_PACIENTE.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={OUTRO_PROCEDIMENTO}>{OUTRO_PROCEDIMENTO}</option>
          </Selecao>
          {procedimento === OUTRO_PROCEDIMENTO && (
            <Campo
              name="procedimentoOutro"
              required
              maxLength={120}
              defaultValue={inicial.outro}
              placeholder="Qual procedimento?"
              className="mt-2"
            />
          )}
        </div>
      </div>
      <div>
        <Rotulo>Observações</Rotulo>
        <Area name="observacoes" rows={2} defaultValue={dados.observacoes} />
      </div>
    </FormularioAcao>
  );
}
