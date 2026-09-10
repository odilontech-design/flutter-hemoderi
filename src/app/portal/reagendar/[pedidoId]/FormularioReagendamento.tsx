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
  profissionalId,
  profissionalNome,
  antecedenciaHoras,
}: {
  pedidoId: string;
  servicoId: string;
  /** Nulo quando a central ainda não definiu quem vai atender. */
  profissionalId: string | null;
  profissionalNome: string | null;
  antecedenciaHoras: number;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(reagendarPedido, INICIAL);

  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!data) {
      setHorarios([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const parametros = new URLSearchParams({ servicoId, data, ignorarPedidoId: pedidoId });
    if (profissionalId) parametros.set("profissionalId", profissionalId);
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
  }, [data, servicoId, profissionalId, pedidoId]);

  useEffect(() => {
    if (estado.ok) router.push("/portal");
  }, [estado.ok, router]);

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />

      <Aviso>
        {profissionalNome ? (
          <>
            Os horários abaixo são os que <strong>{profissionalNome}</strong> tem livres. O
            profissional continua o mesmo.
          </>
        ) : (
          <>Os horários abaixo são os que a sua clínica tem livres. A central define quem atende.</>
        )}
      </Aviso>

      <div>
        <Rotulo>Nova data</Rotulo>
        <Campo type="date" name="data" value={data} onChange={(e) => setData(e.target.value)} required />
        <div className="text-[10px] text-gray-400 mt-1">
          Remarcação pelo portal exige {antecedenciaHoras}h de antecedência, tanto do horário atual
          quanto do novo.
        </div>
      </div>

      <div>
        <Rotulo>Novo horário</Rotulo>
        {!data ? (
          <div className="text-xs text-gray-400 py-2">Escolha a data.</div>
        ) : buscando ? (
          <div className="text-xs text-gray-400 py-2">Buscando horários…</div>
        ) : horarios.length === 0 ? (
          <Aviso tom="alerta">Sem horário livre nesse dia. Tente outra data.</Aviso>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horarios.map((hora) => (
              <label key={hora} className="cursor-pointer">
                <input type="radio" name="horaInicio" value={hora} required className="peer sr-only" />
                <span className="block text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 peer-checked:bg-navy peer-checked:text-white peer-checked:border-navy">
                  {hora}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <div className="flex gap-2">
        <Botao type="submit" disabled={horarios.length === 0}>
          Confirmar novo horário
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => router.push("/portal")}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}
