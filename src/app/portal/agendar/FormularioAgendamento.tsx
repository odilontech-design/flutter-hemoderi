"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { solicitarPedido, type Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

/**
 * O agendamento em três escolhas: serviço, profissional e horário — a mesma
 * ordem da conversa que hoje acontece no WhatsApp.
 *
 * Os horários vêm do servidor já filtrados pela agenda do profissional, pelas
 * salas da clínica e pela antecedência mínima. A tela não oferece nada que a
 * operação não consiga cumprir; é o que impede a solicitação nascer para ser
 * recusada.
 */
export function FormularioAgendamento({
  servicos,
  profissionais,
  antecedenciaHoras,
}: {
  servicos: { id: string; nome: string; duracaoMin: number }[];
  profissionais: { id: string; nome: string; especialidade: string | null }[];
  antecedenciaHoras: number;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(solicitarPedido, INICIAL);

  const [servicoId, setServicoId] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!servicoId || !profissionalId || !data) {
      setHorarios([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const parametros = new URLSearchParams({ servicoId, profissionalId, data });
    fetch(`/api/horarios?${parametros}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelado) setHorarios(json.horarios ?? []);
      })
      .finally(() => {
        if (!cancelado) setBuscando(false);
      });
    // Cancela a resposta antiga: trocar de data rápido não pode fazer a lista
    // de horários de ontem aparecer para amanhã.
    return () => {
      cancelado = true;
    };
  }, [servicoId, profissionalId, data]);

  useEffect(() => {
    if (estado.ok) router.push("/portal");
  }, [estado.ok, router]);

  return (
    <form action={enviar} className="space-y-4">
      <div>
        <Rotulo>Serviço</Rotulo>
        <Selecao name="servicoId" required value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
          <option value="">Selecione…</option>
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} ({s.duracaoMin} min)
            </option>
          ))}
        </Selecao>
      </div>

      <div>
        <Rotulo>Profissional</Rotulo>
        <Selecao
          name="profissionalId"
          required
          value={profissionalId}
          onChange={(e) => setProfissionalId(e.target.value)}
        >
          <option value="">Selecione…</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.especialidade ? ` · ${p.especialidade}` : ""}
            </option>
          ))}
        </Selecao>
      </div>

      <div>
        <Rotulo>Data</Rotulo>
        <Campo type="date" value={data} onChange={(e) => setData(e.target.value)} required name="data" />
        <div className="text-[10px] text-gray-400 mt-1">
          Agendamentos pelo portal precisam de {antecedenciaHoras}h de antecedência. Para urgências,
          fale com a central.
        </div>
      </div>

      <div>
        <Rotulo>Horário</Rotulo>
        {!servicoId || !profissionalId || !data ? (
          <div className="text-xs text-gray-400 py-2">Escolha serviço, profissional e data.</div>
        ) : buscando ? (
          <div className="text-xs text-gray-400 py-2">Buscando horários…</div>
        ) : horarios.length === 0 ? (
          <Aviso tom="alerta">
            Sem horário livre nesse dia para esse profissional. Tente outra data ou outro profissional.
          </Aviso>
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

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Paciente (opcional)</Rotulo>
          <Campo name="pacienteNome" />
        </div>
        <div>
          <Rotulo>Contato (opcional)</Rotulo>
          <Campo name="pacienteContato" />
        </div>
      </div>

      <div>
        <Rotulo>Observações</Rotulo>
        <Area name="observacoes" rows={2} />
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <Botao type="submit" disabled={horarios.length === 0}>
        Solicitar agendamento
      </Botao>
      <div className="text-[10px] text-gray-400">
        A central confirma a solicitação e avisa pelo WhatsApp.
      </div>
    </form>
  );
}
