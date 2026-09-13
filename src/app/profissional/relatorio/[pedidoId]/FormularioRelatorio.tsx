"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { enviarRelatorio } from "@/app/actions/relatorio";
import type { Resultado } from "@/app/actions/pedidos";
import { obterLocalizacao } from "@/lib/geolocalizacao";

const INICIAL: Resultado = { ok: false };

export function FormularioRelatorio({ pedidoId, horaPrevista }: { pedidoId: string; horaPrevista: string }) {
  const router = useRouter();
  const [estado, enviar] = useFormState(enviarRelatorio, INICIAL);
  const [compareceu, setCompareceu] = useState("sim");
  const formRef = useRef<HTMLFormElement>(null);
  const [buscandoLocal, setBuscandoLocal] = useState(false);

  useEffect(() => {
    if (estado.ok) router.push("/profissional");
  }, [estado.ok, router]);

  // Sem action={} no <form>: a submissão inteira passa por aqui, de propósito
  // — é o que permite esperar a localização (assíncrono) ANTES de montar o
  // FormData que vai pro servidor, sem as corridas de tentar reenviar o
  // formulário nativo duas vezes. A localização é pedida só agora, no clique
  // de enviar, nunca antes: pedir permissão sem o profissional ter feito
  // nada ainda é o tipo de coisa que faz gente desconfiar do app. E nunca
  // trava o envio — no máximo alguns segundos de espera, e o relatório sai
  // com ou sem coordenada.
  async function aoSubmeter(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setBuscandoLocal(true);
    const posicao = await obterLocalizacao();
    setBuscandoLocal(false);

    // `evento.currentTarget` some depois do `await` (o React zera o evento
    // sintético assim que o handler original termina) — por isso o form vem
    // do ref, que continua válido.
    const dados = new FormData(formRef.current!);
    if (posicao) {
      dados.set("latitude", String(posicao.latitude));
      dados.set("longitude", String(posicao.longitude));
      dados.set("precisaoMetros", String(posicao.precisaoMetros));
    }
    enviar(dados);
  }

  return (
    <form ref={formRef} onSubmit={aoSubmeter} className="space-y-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />

      <div>
        <Rotulo>O paciente compareceu?</Rotulo>
        <Selecao name="compareceu" value={compareceu} onChange={(e) => setCompareceu(e.target.value)}>
          <option value="sim">Sim, atendimento realizado</option>
          <option value="nao">Não compareceu</option>
        </Selecao>
        {compareceu === "nao" && (
          <div className="text-[10px] text-gray-500 mt-1">
            A falta fica registrada, mas não gera repasse automático. Fale com a central se houve
            deslocamento.
          </div>
        )}
      </div>

      {compareceu === "sim" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Rotulo>Início</Rotulo>
              <Campo name="inicioReal" type="time" defaultValue={horaPrevista} />
            </div>
            <div>
              <Rotulo>Fim</Rotulo>
              <Campo name="fimReal" type="time" />
            </div>
            <div>
              <Rotulo>Quantidade</Rotulo>
              <Campo name="quantidade" type="number" min={1} defaultValue={1} />
            </div>
          </div>

          <div>
            <Rotulo>Houve intercorrência?</Rotulo>
            <Selecao name="intercorrencia" defaultValue="nao">
              <option value="nao">Não</option>
              <option value="sim">Sim — descreva abaixo</option>
            </Selecao>
          </div>
        </>
      )}

      <div>
        <Rotulo>Observações</Rotulo>
        <Area name="observacoes" rows={3} />
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <Botao type="submit" disabled={buscandoLocal}>
        {buscandoLocal ? "Confirmando localização…" : "Enviar relatório"}
      </Botao>
      <div className="text-[10px] text-gray-400">
        Pedimos sua localização só para confirmar que você está no local do atendimento. Se você não
        permitir ou o sinal falhar, o relatório é enviado do mesmo jeito. Depois de enviado, não pode
        ser editado — correção é feita pela central.
      </div>
    </form>
  );
}
