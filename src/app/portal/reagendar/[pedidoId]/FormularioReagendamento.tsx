"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { CampoHora } from "@/components/CampoHora";
import { useRouter } from "next/navigation";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { reagendarPedido, type Resultado } from "@/app/actions/pedidos";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

const INICIAL: Resultado = { ok: false };

/** Os parâmetros da consulta de horários: um serviço só, ou o bloco todo de uma visita. */
function parametros_de({
  servicoId,
  data,
  pedidoId,
  grupoId,
  itens,
  hora,
}: {
  servicoId: string;
  data: string;
  pedidoId: string;
  grupoId: string | null;
  itens: string | null;
  hora?: string;
}) {
  const p = grupoId && itens ? new URLSearchParams({ itens, data, ignorarGrupoId: grupoId }) : new URLSearchParams({ servicoId, data, ignorarPedidoId: pedidoId });
  if (hora) p.set("hora", hora);
  return p;
}

export function FormularioReagendamento({
  pedidoId,
  servicoId,
  grupoId,
  itens,
  jaConfirmado,
  dataMinima,
  antecedenciaHoras,
  locais,
  enderecoAtualId,
}: {
  pedidoId: string;
  servicoId: string;
  /** Agendamento com vários serviços: o bloco inteiro é conferido de uma vez. */
  grupoId: string | null;
  itens: string | null;
  /** Confirmado ou alocado: remarcar devolve o pedido para a aprovação da central. */
  jaConfirmado: boolean;
  /** ISO — regra das 18h do dia anterior, a mesma do agendamento novo. */
  dataMinima: string;
  /** Antecedência mínima do portal, em horas. */
  antecedenciaHoras: number;
  /** Endereços da clínica: o local também pode mudar na remarcação (ata de 13/10). */
  locais: { id: string; rotulo: string; resumo: string }[];
  enderecoAtualId: string;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(reagendarPedido, INICIAL);
  const avisarSalvo = useConfirmarSalvo();
  useEffect(() => {
    if (estado.ok) avisarSalvo("Enviado", { tela: true, titulo: "Reagendamento enviado", detalhes: ["A central confirma o novo horário e avisa pelo WhatsApp."] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avisa uma vez por resposta do servidor, não quando a sessão recarrega.
  }, [estado]);

  const [data, setData] = useState("");
  const [enderecoId, setEnderecoId] = useState(enderecoAtualId);
  const mudaLocal = enderecoId !== enderecoAtualId;
  // O horário vem do relógio do formulário — qualquer um, não só os da grade.
  const [hora, setHora] = useState("");
  const [situacaoHora, setSituacaoHora] = useState<"livre" | "indisponivel" | "verificando" | null>(null);

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
      const parametros = parametros_de({ servicoId, data, pedidoId, grupoId, itens, hora });
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
  }, [hora, data, servicoId, pedidoId, grupoId, itens]);

  useEffect(() => {
    if (estado.ok) router.push("/portal");
  }, [estado.ok, router]);

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />

      <Aviso>
        {jaConfirmado
          ? "Ao remarcar ou mudar o local, o atendimento volta para a confirmação da central, que reorganiza a equipe."
          : "A central confirma o novo horário e o local."}
      </Aviso>

      {locais.length > 1 && (
        <div>
          <Rotulo>Local do atendimento</Rotulo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {locais.map((l) => {
              const escolhido = l.id === enderecoId;
              return (
                <button
                  key={l.id || "principal"}
                  type="button"
                  onClick={() => setEnderecoId(l.id)}
                  aria-pressed={escolhido}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    escolhido ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"
                  }`}
                >
                  <div className="text-xs font-semibold">
                    {l.rotulo}
                    {l.id === enderecoAtualId && <span className="font-normal opacity-70"> · atual</span>}
                  </div>
                  <div className={`text-[10px] mt-1 ${escolhido ? "text-white/70" : "text-gray-400"}`}>{l.resumo || "—"}</div>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="enderecoId" value={enderecoId} />
        </div>
      )}

      <div>
        <Rotulo>Nova data</Rotulo>
        <Campo
          type="date"
          name="data"
          min={dataMinima}
          value={data}
          onChange={(e) => setData(e.target.value)}
          required={!mudaLocal}
        />
        <div className="text-[10px] text-gray-400 mt-1">
          Remarcação pelo portal fecha às 18h do dia anterior — a mesma regra de um agendamento
          novo. Para menos que isso, fale com a central.
          {mudaLocal && " Só vai mudar o local? Deixe a data e o horário em branco."}
        </div>
      </div>

      <div>
        <Rotulo>Novo horário</Rotulo>
        {!data ? (
          <div className="text-xs text-gray-400 py-2">{mudaLocal ? "Mantém o horário atual." : "Escolha a data."}</div>
        ) : (
          <div className="space-y-2">
            <CampoHora name="horaInicio" required value={hora} onChange={setHora} />
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

          </div>
        )}
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <div className="flex gap-2">
        <Botao
          type="submit"
          disabled={
            mudaLocal && !data
              ? false
              : !hora || situacaoHora === "indisponivel" || situacaoHora === "verificando"
          }
        >
          {mudaLocal && !data ? "Confirmar novo local" : "Confirmar remarcação"}
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => router.push("/portal")}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}
