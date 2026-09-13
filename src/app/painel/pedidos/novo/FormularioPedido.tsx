"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { criarPedido, type Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

export function FormularioPedido({
  clinicas,
  servicos,
  profissionais,
}: {
  clinicas: { id: string; nome: string }[];
  servicos: { id: string; nome: string; duracaoMin: number; exigeEquipamento: boolean }[];
  profissionais: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(criarPedido, INICIAL);
  const [servicoId, setServicoId] = useState("");

  useEffect(() => {
    if (estado.ok) router.push("/painel/pedidos");
  }, [estado.ok, router]);

  const servico = servicos.find((s) => s.id === servicoId);

  return (
    <form action={enviar} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Clínica contratante</Rotulo>
          <Selecao name="clinicaId" required>
            <option value="">Selecione…</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </div>
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
          {servico?.exigeEquipamento && (
            <div className="text-[10px] text-gray-500 mt-1">
              Este serviço reserva um equipamento na alocação.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Rotulo>Data</Rotulo>
          <Campo name="data" type="date" required />
        </div>
        <div>
          <Rotulo>Hora de início</Rotulo>
          <Campo name="horaInicio" type="time" required step={900} />
        </div>
        <div>
          <Rotulo>Profissional</Rotulo>
          <Selecao name="profissionalId">
            <option value="">Alocar depois</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Paciente (opcional)</Rotulo>
          <Campo name="pacienteNome" placeholder="Como a clínica identifica o atendimento" />
        </div>
        <div>
          <Rotulo>Contato do paciente (opcional)</Rotulo>
          <Campo name="pacienteContato" />
        </div>
      </div>

      <div>
        <Rotulo>Observações</Rotulo>
        <Area name="observacoes" rows={2} />
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado.avisos?.length ? <Aviso tom="alerta">{estado.avisos.join(" ")}</Aviso> : null}

      <div className="flex gap-2">
        <Botao type="submit">Criar pedido</Botao>
        <Botao type="button" variante="secundario" onClick={() => router.back()}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}
