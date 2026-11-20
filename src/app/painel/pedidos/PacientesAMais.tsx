"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Botao, Campo } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";
import { acrescentarPacienteAoRelatorio, criarAtendimentoDoPacienteExtra } from "@/app/actions/pacientes-extras";

export type PacienteAMais = { id: string; nome: string; procedimento: string; pedidoGeradoId: string | null; numeroGerado: number | null; acrescentadoPelaEquipe: boolean };

/**
 * Os pacientes a mais de um atendimento (Joyce, 19/11), com o que a equipe pode
 * fazer sem devolver o relatório: acrescentar um paciente que o profissional
 * não informou e criar o atendimento de cada um (cobrança, repasse e relatório
 * próprios). Aparece só para quem pode agir; os demais já veem a lista no relatório.
 */
export function PacientesAMais({
  pedidoId,
  pacientes,
  podeCriar,
}: {
  pedidoId: string;
  pacientes: PacienteAMais[];
  /** O atendimento principal já foi realizado: só então dá para gerar o atendimento do paciente. */
  podeCriar: boolean;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [nome, setNome] = useState("");
  const [procedimento, setProcedimento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisarSalvo = useConfirmarSalvo();

  function acrescentar() {
    setErro(null);
    iniciar(async () => {
      const r = await acrescentarPacienteAoRelatorio(pedidoId, nome, procedimento);
      if (!r.ok) setErro(r.erro ?? "Não foi possível acrescentar.");
      else {
        setNome("");
        setProcedimento("");
        setAdicionando(false);
        avisarSalvo();
      }
    });
  }

  return (
    <div className="mt-2 max-w-2xl rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
      <div className="font-semibold text-amber-900">Pacientes a mais neste atendimento</div>
      {pacientes.length === 0 ? (
        <div className="mt-1 text-gray-500">Nenhum informado. Se o profissional atendeu alguém que não estava na agenda, acrescente aqui — não precisa devolver o relatório.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {pacientes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-[180px] text-gray-800">
                <strong>{p.nome}</strong> — {p.procedimento}
                {p.acrescentadoPelaEquipe && <span className="text-gray-400"> (acrescentado pela equipe)</span>}
              </span>
              {p.pedidoGeradoId ? (
                <Link href={`/painel/pedidos/${p.pedidoGeradoId}`} className="font-semibold text-bordo hover:underline">
                  atendimento nº {p.numeroGerado} →
                </Link>
              ) : podeCriar ? (
                <BotaoAcao
                  acao={criarAtendimentoDoPacienteExtra.bind(null, p.id)}
                  confirmar={`Criar o atendimento de ${p.nome}? Entra na cobrança da clínica e no repasse do profissional, e o relatório dele vai para a conferência.`}
                >
                  Criar atendimento
                </BotaoAcao>
              ) : (
                <span className="text-gray-400">o atendimento principal ainda não foi realizado</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {adicionando ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Campo aria-label="Nome do paciente" placeholder="Nome do paciente" value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} />
          <Campo aria-label="Procedimento realizado" placeholder="O que foi feito" value={procedimento} maxLength={150} onChange={(e) => setProcedimento(e.target.value)} />
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <Botao disabled={pendente} onClick={acrescentar}>
              Acrescentar
            </Botao>
            <Botao variante="secundario" disabled={pendente} onClick={() => setAdicionando(false)}>
              Cancelar
            </Botao>
            {erro && <span className="text-[11px] text-red-600">{erro}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <Botao variante="secundario" onClick={() => setAdicionando(true)}>
            + Acrescentar paciente
          </Botao>
        </div>
      )}
    </div>
  );
}
