"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { aprovarRelatorio, validarItemRelatorio } from "@/app/actions/financeiro";
import type { ItemValidacao } from "@/lib/relatorio";

const ITENS: { chave: ItemValidacao; rotulo: string }[] = [
  { chave: "servico", rotulo: "Serviço executado confere" },
  { chave: "valor", rotulo: "Valor confere" },
  { chave: "ajudaCusto", rotulo: "Ajuda de custo confere" },
];

/**
 * A conferência do relatório, item a item, antes da aprovação geral.
 *
 * Os três itens existem separados porque são três perguntas diferentes (o
 * que foi feito, quanto custa, quanto de deslocamento) e a ata de 21/09
 * pediu que cada uma tivesse resposta própria. O botão de aprovar só
 * habilita com as três marcadas — um "aprovar" que ignora as conferências
 * transformaria as três num enfeite.
 */
export function ConferenciaRelatorio({
  pedidoId,
  servicoValidado,
  valorValidado,
  ajudaCustoValidada,
}: {
  pedidoId: string;
  servicoValidado: boolean;
  valorValidado: boolean;
  ajudaCustoValidada: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [marcados, setMarcados] = useState<Record<ItemValidacao, boolean>>({
    servico: servicoValidado,
    valor: valorValidado,
    ajudaCusto: ajudaCustoValidada,
  });

  const tudoConferido = ITENS.every((item) => marcados[item.chave]);

  return (
    <div className="mt-2 bg-bege/50 rounded-lg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Conferir antes de liberar o repasse
      </div>
      <div className="space-y-1.5 mb-2.5">
        {ITENS.map((item) => (
          <label key={item.chave} className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={marcados[item.chave]}
              disabled={pendente}
              onChange={(e) => {
                const valor = e.target.checked;
                const anterior = marcados[item.chave];
                setMarcados((atual) => ({ ...atual, [item.chave]: valor }));
                setErro("");
                iniciar(async () => {
                  const resultado = await validarItemRelatorio(pedidoId, item.chave, valor);
                  if (!resultado.ok) {
                    setMarcados((atual) => ({ ...atual, [item.chave]: anterior }));
                    setErro(resultado.erro ?? "Não foi possível marcar.");
                  }
                });
              }}
              className="accent-bordo w-4 h-4"
            />
            <span className={marcados[item.chave] ? "text-gray-700" : "text-gray-500"}>{item.rotulo}</span>
          </label>
        ))}
      </div>

      <Botao
        disabled={pendente || !tudoConferido}
        onClick={() => {
          setErro("");
          iniciar(async () => {
            const resultado = await aprovarRelatorio(pedidoId);
            if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível aprovar.");
          });
        }}
      >
        Aprovar e liberar repasse
      </Botao>
      {erro && <div className="text-[10px] text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
