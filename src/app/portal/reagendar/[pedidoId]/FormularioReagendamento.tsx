"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { reagendarPedido, type Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

export function FormularioReagendamento({
  pedidoId,
  servicoId,
  jaConfirmado,
  dataMinima,
  antecedenciaHoras,
}: {
  pedidoId: string;
  servicoId: string;
  /** Confirmado ou alocado: remarcar devolve o pedido para a aprovação da central. */
  jaConfirmado: boolean;
  /** ISO — regra das 18h do dia anterior, a mesma do agendamento novo. */
  dataMinima: string;
  /** Antecedência mínima do portal, em horas. */
  antecedenciaHoras: number;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(reagendarPedido, INICIAL);

  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  // O horário vem do relógio do formulário — qualquer um, não só os da grade.
  const [hora, setHora] = useState("");
  const [situacaoHora, setSituacaoHora] = useState<"livre" | "indisponivel" | "verificando" | null>(null);

  useEffect(() => {
    if (!data) {
      setHorarios([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const parametros = new URLSearchParams({ servicoId, data, ignorarPedidoId: pedidoId });
    fetch(`/api/horarios?${parametros}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelado) setHorarios(json.horarios ?? []);
      })
      .finally(() => {
        if (!cancelado) setBuscando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [data, servicoId, pedidoId]);

  // Confere o horário digitado contra a agenda, com uma pequena espera para não
  // consultar a cada minuto que a pessoa gira no relógio.
  useEffect(() => {
    if (!hora || !data) {
      setSituacaoHora(null);
      return;
    }
    let cancelado = false;
    setSituacaoHora("verificando");
    const espera = setTimeout(() => {
      const parametros = new URLSearchParams({ servicoId, data, ignorarPedidoId: pedidoId, hora });
      fetch(`/api/horarios?${parametros}`)
        .then((r) => r.json())
        .then((json) => {
          if (!cancelado) setSituacaoHora((json.horarios ?? []).includes(hora) ? "livre" : "indisponivel");
        })
        .catch(() => {
          // Sem rede: não bloqueia — o servidor confere de novo ao enviar.
          if (!cancelado) setSituacaoHora(null);
        });
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [hora, data, servicoId, pedidoId]);

  useEffect(() => {
    if (estado.ok) router.push("/portal");
  }, [estado.ok, router]);

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />

      <Aviso>
        Os horários abaixo são os que a sua clínica tem livres.{" "}
        {jaConfirmado
          ? "Ao remarcar, o atendimento volta para a confirmação da central, que reorganiza a equipe para a nova data."
          : "A central confirma o novo horário."}
      </Aviso>

      <div>
        <Rotulo>Nova data</Rotulo>
        <Campo
          type="date"
          name="data"
          min={dataMinima}
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <div className="text-[10px] text-gray-400 mt-1">
          Remarcação pelo portal fecha às 18h do dia anterior — a mesma regra de um agendamento
          novo. Para menos que isso, fale com a central.
        </div>
      </div>

      <div>
        <Rotulo>Novo horário</Rotulo>
        {!data ? (
          <div className="text-xs text-gray-400 py-2">Escolha a data.</div>
        ) : (
          <div className="space-y-2">
            <Campo
              type="time"
              name="horaInicio"
              required
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="!w-40"
            />
            <div className="text-[10px] leading-relaxed">
              {situacaoHora === "verificando" && <span className="text-gray-400">Conferindo a agenda…</span>}
              {situacaoHora === "livre" && <span className="font-semibold text-green-700">Horário disponível.</span>}
              {situacaoHora === "indisponivel" && (
                <span className="font-semibold text-amber-700">
                  Esse horário não está disponível (já ocupado, com menos de {antecedenciaHoras}h de antecedência ou
                  passando da meia-noite). Tente outro horário ou fale com a central.
                </span>
              )}
              {situacaoHora === null && (
                <span className="text-gray-400">
                  Escolha qualquer horário do dia, com {antecedenciaHoras}h de antecedência. Antes disso, só pela
                  central.
                </span>
              )}
            </div>

            {buscando ? (
              <div className="text-[11px] text-gray-400">Buscando sugestões…</div>
            ) : horarios.length === 0 ? (
              <Aviso tom="alerta">Sem horário livre nesse dia. Tente outra data.</Aviso>
            ) : (
              <div>
                <div className="text-[10px] text-gray-400 mb-1">Sugestões de horários livres:</div>
                <div className="flex flex-wrap gap-1.5">
                  {horarios.map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => setHora(sugestao)}
                      className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border ${
                        hora === sugestao
                          ? "bg-bordo text-white border-bordo"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <div className="flex gap-2">
        <Botao type="submit" disabled={!hora || situacaoHora === "indisponivel" || situacaoHora === "verificando"}>
          Confirmar novo horário
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => router.push("/portal")}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}
