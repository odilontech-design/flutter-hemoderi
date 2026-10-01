"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { enviarRelatorio } from "@/app/actions/relatorio";
import type { Resultado } from "@/app/actions/pedidos";
import { obterLocalizacao } from "@/lib/geolocalizacao";
import { CAMPOS_AGENDAMENTO, CAMPOS_CLINICOS, NAO_SE_APLICA } from "@/lib/relatorio";

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

export type ServicoDoCatalogo = { id: string; nome: string; familia: string | null };
type LinhaAdicional = { chave: number; servicoId: string; quantidade: string };

/**
 * Serviços executados além do agendado: o profissional escolhe no catálogo e
 * informa quantos fez. Cada linha manda um par (serviço, quantidade) — listas
 * paralelas no FormData, lidas por lerServicosAdicionais no servidor.
 */
function ServicosAdicionais({
  catalogo,
  iniciais,
}: {
  catalogo: ServicoDoCatalogo[];
  iniciais: { servicoId: string; quantidade: number }[];
}) {
  const [linhas, setLinhas] = useState<LinhaAdicional[]>(
    iniciais.map((a, i) => ({ chave: i, servicoId: a.servicoId, quantidade: String(a.quantidade) }))
  );
  const proxima = useRef(iniciais.length);

  const porFamilia = new Map<string, ServicoDoCatalogo[]>();
  for (const s of catalogo) {
    const familia = s.familia ?? "Outros";
    porFamilia.set(familia, [...(porFamilia.get(familia) ?? []), s]);
  }

  const alterar = (chave: number, mudanca: Partial<LinhaAdicional>) =>
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)));

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-3">
      <div>
        <div className="font-display font-bold text-bordo text-sm">Realizou mais serviços do que o agendado?</div>
        <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
          Adicione cada serviço feito a mais, com a quantidade. A central confere antes de virar valor.
        </div>
      </div>

      {linhas.map((linha) => (
        <div key={linha.chave} className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <Rotulo>Serviço</Rotulo>
            <Selecao
              name="adicionalServicoId"
              value={linha.servicoId}
              onChange={(e) => alterar(linha.chave, { servicoId: e.target.value })}
            >
              <option value="">Escolha o serviço…</option>
              {Array.from(porFamilia, ([familia, servicos]) => (
                <optgroup key={familia} label={familia}>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Selecao>
          </div>
          <div className="w-20 shrink-0">
            <Rotulo>Qtd.</Rotulo>
            <Campo
              name="adicionalQuantidade"
              type="number"
              min={1}
              max={99}
              value={linha.quantidade}
              onChange={(e) => alterar(linha.chave, { quantidade: e.target.value })}
            />
          </div>
          <button
            type="button"
            aria-label="Remover serviço"
            onClick={() => setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))}
            className="shrink-0 text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setLinhas((atuais) => [...atuais, { chave: proxima.current++, servicoId: "", quantidade: "1" }])}
        className="text-[11px] font-semibold text-bordo hover:underline"
      >
        + Adicionar serviço realizado
      </button>
    </div>
  );
}

export function FormularioRelatorio({
  pedidoId,
  horaPrevista,
  chavePixCadastro,
  jaEnviado,
  valores,
  quantidadeAgendada,
  catalogo,
  adicionaisIniciais,
}: {
  pedidoId: string;
  horaPrevista: string;
  chavePixCadastro: string | null;
  jaEnviado: boolean;
  /** O que já foi enviado, quando é uma correção. */
  valores: ValoresRelatorio;
  quantidadeAgendada: number;
  catalogo: ServicoDoCatalogo[];
  adicionaisIniciais: { servicoId: string; quantidade: number }[];
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

      {/* Os dados do agendamento, abertos para correção (ata de 28/09): o
          atendimento sai numa filial, quem recebe é outro doutor, o endereço
          mudou na véspera. Chegam preenchidos com o que foi marcado — quem
          não mexe não declara divergência nenhuma. */}
      <div className="rounded-xl border border-gray-200 p-3 space-y-3">
        <div className="text-[11px] text-gray-500 leading-relaxed">
          Confira os dados do atendimento. Se algo saiu diferente do agendado, corrija aqui — a
          central confere depois.
        </div>
        {CAMPOS_AGENDAMENTO.map((campo) => (
          <div key={campo.nome}>
            <Rotulo>{campo.rotulo}</Rotulo>
            <Campo name={campo.nome} defaultValue={valores[campo.nome] ?? ""} />
            <div className="text-[10px] text-gray-400 mt-1">{campo.ajuda}</div>
          </div>
        ))}
      </div>

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
              <Rotulo>Quantidade feita</Rotulo>
              <Campo name="quantidade" type="number" min={1} defaultValue={valores.quantidade || quantidadeAgendada} />
            </div>
          </div>

          {quantidadeAgendada > 1 && (
            <div className="text-[10px] text-gray-400 -mt-2">
              Quantidade agendada: {quantidadeAgendada}. Corrija se foi diferente.
            </div>
          )}

          <ServicosAdicionais catalogo={catalogo} iniciais={adicionaisIniciais} />

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
            <Rotulo>Outro serviço ou ajuste fora do catálogo</Rotulo>
            <Area
              name="servicosAdicionais"
              rows={2}
              defaultValue={valores.servicosAdicionais}
              placeholder="Ex.: membrana virou stickybone; 2 membranas a mais"
            />
            <div className="text-[10px] text-gray-400 mt-1">
              Só para o que não está na lista acima. Deixe em branco se não houve.
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
