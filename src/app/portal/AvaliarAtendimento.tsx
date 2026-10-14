"use client";

import { useState } from "react";
import { avaliarAtendimento } from "@/app/actions/avaliacoes";
import { FormularioAcao } from "@/components/FormularioAcao";
import { EscolherEstrelas, MostrarEstrelas } from "@/components/Estrelas";
import { Area, Rotulo } from "@/components/ui";
import { LIMITE_COMENTARIO, PERGUNTAS_ABERTAS } from "@/lib/avaliacao";

export type AvaliacaoAtual = { nota: number } | null;

/**
 * O formulário de avaliação de um atendimento — uma vez só.
 *
 * As estrelas aparecem direto, sem botão "Avaliar" no meio (ata de 13/10): a
 * clínica clica na nota e só então abrem as três perguntas opcionais e o
 * botão de enviar. Assim a linha do histórico continua curta até alguém
 * decidir avaliar, e avaliar custa um clique a menos.
 *
 * Definitiva (ata de 21/09): já avaliado, só mostra a nota.
 * `avaliarAtendimento` recusa o reenvio no servidor; aqui é só o reflexo
 * disso na tela.
 */
export function AvaliarAtendimento({ pedidoId, atual }: { pedidoId: string; atual: AvaliacaoAtual }) {
  const [nota, setNota] = useState(0);

  if (atual) {
    return (
      <span className="inline-flex items-center gap-2">
        <MostrarEstrelas nota={atual.nota} />
      </span>
    );
  }

  if (!nota) {
    return <EscolherEstrelas inicial={0} aoMudar={setNota} />;
  }

  return (
    <FormularioAcao acao={avaliarAtendimento} botao="Enviar avaliação" limparAoSalvar={false}>
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <EscolherEstrelas inicial={nota} aoMudar={setNota} />
      <div className="text-[10px] text-gray-400">As perguntas abaixo são opcionais.</div>
      {PERGUNTAS_ABERTAS.map(({ campo, pergunta }) => (
        <div key={campo}>
          <Rotulo>{pergunta}</Rotulo>
          <Area name={campo} rows={2} maxLength={LIMITE_COMENTARIO} />
        </div>
      ))}
    </FormularioAcao>
  );
}
