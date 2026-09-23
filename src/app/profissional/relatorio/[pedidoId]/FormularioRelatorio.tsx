"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { enviarRelatorio } from "@/app/actions/relatorio";
import type { Resultado } from "@/app/actions/pedidos";
import { obterLocalizacao } from "@/lib/geolocalizacao";
import { CAMPOS_CLINICOS, NAO_SE_APLICA } from "@/lib/relatorio";

const INICIAL: Resultado = { ok: false };

/**
 * Um sinal vital, com o atalho de "não se aplica" ao lado.
 *
 * O atalho é um botão e não um checkbox porque o que ele faz é PREENCHER o
 * campo, não marcar uma condição à parte: no fim das contas o relatório
 * guarda um texto só, e "não se aplica" é um dos textos possíveis. Clicar de
 * novo limpa, para quem errou o clique não ficar preso.
 */
function CampoClinico({
  nome,
  rotulo,
  exemplo,
  valorInicial,
}: {
  nome: string;
  rotulo: string;
  exemplo: string;
  valorInicial: string;
}) {
  const [valor, setValor] = useState(valorInicial);
  const naoSeAplica = valor === NAO_SE_APLICA;

  return (
    <div>
      <Rotulo>{rotulo}</Rotulo>
      <div className="flex items-center gap-2">
        {/* readOnly, nunca disabled: campo desabilitado não entra no
            FormData, e "não se aplica" PRECISA chegar ao servidor — é uma
            resposta, não a ausência de uma. */}
        <Campo
          name={nome}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={exemplo}
          readOnly={naoSeAplica}
          className={naoSeAplica ? "!text-gray-400 !italic" : ""}
        />
        <button
          type="button"
          onClick={() => setValor(naoSeAplica ? "" : NAO_SE_APLICA)}
          className={`shrink-0 text-[10px] font-semibold px-2 py-2 min-h-[40px] sm:min-h-0 rounded-lg border transition-colors ${
            naoSeAplica
              ? "bg-bordo text-white border-bordo"
              : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
          }`}
        >
          N/A
        </button>
      </div>
    </div>
  );
}

export type ValoresRelatorio = Record<string, string>;

export function FormularioRelatorio({
  pedidoId,
  horaPrevista,
  chavePixCadastro,
  jaEnviado,
  valores,
}: {
  pedidoId: string;
  horaPrevista: string;
  chavePixCadastro: string | null;
  jaEnviado: boolean;
  /** O que já foi enviado, quando é uma correção. */
  valores: ValoresRelatorio;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(enviarRelatorio, INICIAL);
  const [compareceu, setCompareceu] = useState(valores.compareceu || "sim");
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
              <Campo name="inicioReal" type="time" defaultValue={valores.inicioReal || horaPrevista} />
            </div>
            <div>
              <Rotulo>Fim</Rotulo>
              <Campo name="fimReal" type="time" defaultValue={valores.fimReal} />
            </div>
            <div>
              <Rotulo>Quantidade</Rotulo>
              <Campo name="quantidade" type="number" min={1} defaultValue={valores.quantidade || 1} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="font-display font-bold text-bordo text-sm mb-1">Sinais vitais</div>
            <div className="text-[10px] text-gray-500 mb-3">
              Todos obrigatórios. Use <strong>N/A</strong> no que não se aplica a este procedimento —
              em branco o relatório não envia.
            </div>
            <div className="space-y-3">
              {CAMPOS_CLINICOS.map((campo) => (
                <CampoClinico
                  key={campo.nome}
                  nome={campo.nome}
                  rotulo={campo.rotulo}
                  exemplo={campo.exemplo}
                  valorInicial={valores[campo.nome] ?? ""}
                />
              ))}
            </div>
          </div>

          <div>
            <Rotulo>Houve intercorrência?</Rotulo>
            <Selecao name="intercorrencia" defaultValue={valores.intercorrencia || "nao"}>
              <option value="nao">Não</option>
              <option value="sim">Sim — descreva abaixo</option>
            </Selecao>
          </div>

          <div>
            <Rotulo>Serviço executado além do contratado</Rotulo>
            <Area
              name="servicosAdicionais"
              rows={2}
              defaultValue={valores.servicosAdicionais}
              placeholder="Ex.: membrana virou stickybone; 2 membranas a mais"
            />
            <div className="text-[10px] text-gray-400 mt-1">
              Deixe em branco se foi exatamente o que estava contratado. O que entrar aqui é
              conferido pela central antes de virar valor.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Rotulo>Ajuda de custo (R$)</Rotulo>
              <Campo
                name="ajudaCusto"
                inputMode="decimal"
                defaultValue={valores.ajudaCusto}
                placeholder="150,00"
              />
            </div>
            <div>
              <Rotulo>Por quê?</Rotulo>
              <Campo
                name="ajudaCustoJustificativa"
                defaultValue={valores.ajudaCustoJustificativa}
                placeholder="210 km, carro"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <Rotulo>Observações</Rotulo>
        <Area name="observacoes" rows={3} defaultValue={valores.observacoes} />
      </div>

      <div>
        <Rotulo>Chave PIX para este repasse</Rotulo>
        <Campo name="chavePixConfirmada" defaultValue={chavePixCadastro ?? ""} placeholder="CPF, e-mail ou telefone" />
        <div className="text-[10px] text-gray-400 mt-1">
          Vem do seu cadastro. Se mudou de conta, corrija aqui — vale para este pagamento.
        </div>
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <Botao type="submit" disabled={buscandoLocal}>
        {buscandoLocal
          ? "Confirmando localização…"
          : jaEnviado
            ? "Salvar correção"
            : "Enviar relatório"}
      </Botao>
      <div className="text-[10px] text-gray-400">
        Pedimos sua localização só para confirmar que você está no local do atendimento. Se você não
        permitir ou o sinal falhar, o relatório é enviado do mesmo jeito. Dá para corrigir o que
        você mandou até a central conferir — depois disso, a correção é feita por lá.
      </div>
    </form>
  );
}
