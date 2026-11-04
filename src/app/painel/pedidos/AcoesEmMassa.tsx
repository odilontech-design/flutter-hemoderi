"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao, Campo, Selecao } from "@/components/ui";
import { alocarEmMassa, desalocarEmMassa } from "@/app/actions/em-massa";

export const FORM_EM_MASSA = "acoes-em-massa";

/**
 * A barra das ações em massa da esteira em tabela (ata de 04/11). As caixas de
 * seleção ficam nas linhas da tabela, ligadas a este formulário pelo atributo
 * `form` — assim a tabela continua sendo do servidor.
 */
export function AcoesEmMassa({ profissionais }: { profissionais: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [profissionalId, setProfissionalId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; linhas: string[] } | null>(null);

  function marcados(): string[] {
    const form = document.getElementById(FORM_EM_MASSA) as HTMLFormElement | null;
    return form ? new FormData(form).getAll("ids").map(String) : [];
  }

  function executar(tipo: "alocar" | "desalocar") {
    const ids = marcados();
    if (ids.length === 0) {
      setMensagem({ ok: false, linhas: ["Marque os atendimentos na tabela primeiro."] });
      return;
    }
    const pergunta =
      tipo === "alocar"
        ? `Alocar ${profissionais.find((p) => p.id === profissionalId)?.nome ?? "o profissional"} em ${ids.length} atendimento(s)? Quem estava neles sai e é avisado.`
        : `Desalocar ${ids.length} atendimento(s)? Os profissionais são avisados e os atendimentos voltam para "a alocar".`;
    if (!window.confirm(pergunta)) return;
    setMensagem(null);
    iniciar(async () => {
      const r = tipo === "alocar" ? await alocarEmMassa(ids, profissionalId) : await desalocarEmMassa(ids, motivo);
      setMensagem({ ok: r.ok, linhas: r.ok ? r.avisos ?? [] : [r.erro ?? "Não foi possível concluir."] });
      if (r.ok) {
        const form = document.getElementById(FORM_EM_MASSA) as HTMLFormElement | null;
        form?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form id={FORM_EM_MASSA} onSubmit={(e) => e.preventDefault()} className="mb-3 rounded-2xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-semibold text-bordo mb-2">
        Em massa: marque os atendimentos na tabela e escolha a ação
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Selecao value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)} aria-label="Profissional para alocar">
            <option value="">Profissional para alocar ou realocar…</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
          <Botao type="button" disabled={pendente || !profissionalId} onClick={() => executar("alocar")}>
            Alocar marcados
          </Botao>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Campo value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da desalocação" aria-label="Motivo da desalocação" />
          <Botao type="button" variante="perigo" disabled={pendente || !motivo.trim()} onClick={() => executar("desalocar")}>
            Desalocar marcados
          </Botao>
        </div>
      </div>
      {pendente && <div className="text-[11px] text-gray-500 mt-2">Processando um a um…</div>}
      {mensagem && (
        <ul className={`mt-2 text-[11px] space-y-0.5 ${mensagem.ok ? "text-emerald-700" : "text-red-600"}`}>
          {mensagem.linhas.map((l, i) => (
            <li key={i} className={i > 0 && mensagem.ok ? "text-amber-700" : ""}>
              {l}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
