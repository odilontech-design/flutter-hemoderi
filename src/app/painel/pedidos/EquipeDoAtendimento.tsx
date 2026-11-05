"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StatusPedido } from "@prisma/client";
import { Botao, Selecao, SeloStatus } from "@/components/ui";
import { alocarEmMassa } from "@/app/actions/em-massa";
import { desalocarPedido, type Resultado } from "@/app/actions/pedidos";
import { adicionarProfissional, removerProfissionalAdicional } from "@/app/actions/apoio";
import { AcaoComMotivo } from "./AcoesPedido";

export type LinhaDaEquipe = {
  id: string;
  codigo: string;
  status: StatusPedido;
  apoio: boolean;
  profissional: { id: string; nome: string } | null;
};

const EM_ABERTO: StatusPedido[] = ["SOLICITADO", "CONFIRMADO", "ALOCADO"];

/**
 * Os profissionais do atendimento (pedido da Joyce, 05/11): o principal e os
 * adicionais, com alocar, trocar, desalocar, adicionar e retirar — também na
 * tela do agendamento, não só na esteira. Cada troca segue as regras da
 * alocação (aptidão, conflito de agenda) e avisa quem entra e quem sai.
 */
export function EquipeDoAtendimento({
  principalId,
  linhas,
  profissionais,
  podeAlocar,
}: {
  principalId: string;
  linhas: LinhaDaEquipe[];
  profissionais: { id: string; nome: string }[];
  podeAlocar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  function rodar(acao: () => Promise<Resultado>) {
    setMensagem(null);
    iniciar(async () => {
      const r = await acao();
      setMensagem({ ok: r.ok, texto: r.ok ? (r.avisos ?? ["Feito."]).join(" ") : r.erro ?? "Não foi possível concluir." });
      if (r.ok) router.refresh();
    });
  }

  const principal = linhas.find((l) => !l.apoio);
  const podeAdicionar = podeAlocar && principal && EM_ABERTO.includes(principal.status);
  const jaNoAtendimento = new Set(linhas.filter((l) => l.status !== "CANCELADO").map((l) => l.profissional?.id).filter(Boolean));

  return (
    <div>
      <div className="space-y-2">
        {linhas.map((l, i) => {
          const aberto = EM_ABERTO.includes(l.status);
          // Confirmado com nome = profissional pedido pela clínica, ainda não alocado.
          const alocado = l.status !== "SOLICITADO" && l.status !== "CONFIRMADO" && Boolean(l.profissional);
          const valor = escolha[l.id] ?? (!alocado && l.profissional ? l.profissional.id : "");
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
              <div className="min-w-[180px] flex-1">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  {l.apoio ? `Profissional adicional ${i}` : "Profissional principal"} · {l.codigo}
                </div>
                <div className={`text-sm font-semibold ${alocado ? "text-gray-800" : "text-red-600"}`}>
                  {alocado ? l.profissional?.nome : l.profissional ? `a alocar · pedido: ${l.profissional.nome}` : "sem profissional"}
                </div>
              </div>
              <SeloStatus status={l.status} />
              {podeAlocar && aberto && (
                <>
                  <Selecao
                    value={valor}
                    onChange={(e) => setEscolha((atual) => ({ ...atual, [l.id]: e.target.value }))}
                    aria-label="Profissional"
                    className="max-w-[240px]"
                  >
                    <option value="">{alocado ? "Trocar por…" : "Escolher profissional…"}</option>
                    {profissionais
                      .filter((p) => p.id === l.profissional?.id || !jaNoAtendimento.has(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                  </Selecao>
                  <Botao
                    disabled={pendente || !valor || (alocado && valor === l.profissional?.id)}
                    onClick={() => rodar(() => alocarEmMassa([l.id], valor))}
                  >
                    {alocado ? "Trocar" : "Alocar"}
                  </Botao>
                  {alocado && !l.apoio && (
                    <AcaoComMotivo
                      rotulo="Desalocar"
                      variante="perigo"
                      disabled={pendente}
                      placeholder="Motivo"
                      onConfirmar={(motivo) => rodar(() => desalocarPedido(l.id, motivo))}
                    />
                  )}
                  {l.apoio && (
                    <Botao
                      variante="perigo"
                      disabled={pendente}
                      onClick={() => {
                        if (window.confirm("Retirar este profissional do atendimento? Ele é avisado pelo WhatsApp.")) {
                          rodar(() => removerProfissionalAdicional(l.id));
                        }
                      }}
                    >
                      Retirar
                    </Botao>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {podeAdicionar && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Selecao value={novo} onChange={(e) => setNovo(e.target.value)} aria-label="Profissional adicional" className="max-w-[280px]">
            <option value="">Mais um profissional neste atendimento…</option>
            {profissionais
              .filter((p) => !jaNoAtendimento.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
          </Selecao>
          <Botao
            disabled={pendente || !novo}
            onClick={() => {
              const nome = profissionais.find((p) => p.id === novo)?.nome ?? "o profissional";
              if (window.confirm(`Adicionar ${nome} a este atendimento? Ele recebe o aviso de alocação pelo WhatsApp.`)) {
                rodar(() => adicionarProfissional(principalId, novo));
                setNovo("");
              }
            }}
          >
            + Adicionar profissional
          </Botao>
        </div>
      )}
      {pendente && <div className="text-[11px] text-gray-500 mt-2">Salvando…</div>}
      {mensagem && <div className={`text-[11px] mt-2 ${mensagem.ok ? "text-emerald-700" : "text-red-600"}`}>{mensagem.texto}</div>}
    </div>
  );
}
