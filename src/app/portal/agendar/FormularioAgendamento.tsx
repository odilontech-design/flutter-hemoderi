"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { solicitarPedido, type Resultado } from "@/app/actions/pedidos";
import { linkWhatsapp, mensagemDeUrgencia } from "@/lib/whatsapp-link";

const INICIAL: Resultado = { ok: false };

/**
 * O agendamento em três escolhas: serviço, data e horário — a mesma ordem da
 * conversa que hoje acontece no WhatsApp.
 *
 * Os horários vêm do servidor já filtrados pela agenda dos profissionais,
 * pelas salas da clínica e pela antecedência mínima. A tela não oferece nada
 * que a operação não consiga cumprir; é o que impede a solicitação nascer
 * para ser recusada.
 *
 * A escolha de profissional saiu da tela (ata de 14/09): quem decide quem
 * atende é a central, e escolher preferência vai voltar como serviço com
 * acréscimo, em fase própria. O campo continua no formulário, vazio, para
 * que reativá-lo seja tirar um `hidden` — não refazer a tela.
 */
export function FormularioAgendamento({
  servicos,
  profissionais,
  antecedenciaHoras,
  clinicaNome,
  whatsappCentral,
}: {
  servicos: { id: string; nome: string; duracaoMin: number }[];
  profissionais: { id: string; nome: string; especialidade: string | null }[];
  antecedenciaHoras: number;
  clinicaNome: string;
  whatsappCentral: string | null;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(solicitarPedido, INICIAL);

  const [servicoId, setServicoId] = useState("");
  // Sem seleção na tela: fica vazio e o servidor escolhe entre quem está
  // disponível. `profissionais` continua na assinatura para a fase em que a
  // preferência volta.
  const [profissionalId, setProfissionalId] = useState("");
  const [data, setData] = useState("");
  const [doutorNome, setDoutorNome] = useState("");
  const [pacienteNome, setPacienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!servicoId || !data) {
      setHorarios([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const parametros = new URLSearchParams({ servicoId, data });
    if (profissionalId) parametros.set("profissionalId", profissionalId);
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

  // A data escolhida cai dentro da janela de antecedência? A conta é a mesma
  // que o servidor faz ao recusar — feita aqui só para AVISAR antes, em vez
  // de deixar a pessoa preencher tudo para ouvir não no fim.
  const urgente = (() => {
    if (!data) return false;
    const escolhida = new Date(`${data}T23:59:59-03:00`);
    return escolhida.getTime() - Date.now() < antecedenciaHoras * 60 * 60 * 1000;
  })();

  const linkUrgencia = urgente
    ? linkWhatsapp(
        whatsappCentral,
        mensagemDeUrgencia({
          clinica: clinicaNome,
          servico: servicos.find((s) => s.id === servicoId)?.nome ?? null,
          data: data ? data.split("-").reverse().join("/") : null,
          doutor: doutorNome || null,
          paciente: pacienteNome || null,
          observacoes: observacoes || null,
        })
      )
    : null;

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

      {/* Oculto por decisão da operação, não removido: a preferência por
          profissional volta como serviço com acréscimo. */}
      <input type="hidden" name="profissionalId" value={profissionalId} />

      <div>
        <Rotulo>Data</Rotulo>
        <Campo type="date" value={data} onChange={(e) => setData(e.target.value)} required name="data" />
        <div className="text-[10px] text-gray-400 mt-1">
          O portal agenda com {antecedenciaHoras}h de antecedência. Para antes disso, a central
          resolve pelo WhatsApp.
        </div>
      </div>

      {urgente && (
        <Aviso tom="alerta">
          <div className="font-semibold mb-1">Isso é para menos de {antecedenciaHoras}h.</div>
          Urgência a central trata direto, para conseguir remanejar quem já está em rota.
          {linkUrgencia ? (
            <a
              href={linkUrgencia}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 bg-[#1EA952] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#178943]"
            >
              Falar com a central no WhatsApp →
            </a>
          ) : (
            <div className="mt-1">Fale com a central — o número não está configurado no sistema.</div>
          )}
        </Aviso>
      )}

      <div>
        <Rotulo>Horário</Rotulo>
        {!servicoId || !data ? (
          <div className="text-xs text-gray-400 py-2">Escolha o serviço e a data.</div>
        ) : buscando ? (
          <div className="text-xs text-gray-400 py-2">Buscando horários…</div>
        ) : horarios.length === 0 ? (
          <Aviso tom="alerta">
            Nenhum horário livre nesse dia. Tente outra data — ou fale com a central pelo WhatsApp.
          </Aviso>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horarios.map((hora) => (
              <label key={hora} className="cursor-pointer">
                <input type="radio" name="horaInicio" value={hora} required className="peer sr-only" />
                <span className="block text-xs font-semibold px-3.5 py-2.5 rounded-lg border border-gray-300 peer-checked:bg-bordo peer-checked:text-white peer-checked:border-bordo">
                  {hora}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <Rotulo>Doutor(a) responsável</Rotulo>
        <Campo name="doutorNome" required value={doutorNome} onChange={(e) => setDoutorNome(e.target.value)} />
        <div className="text-[10px] text-gray-400 mt-1">
          Quem responde pelo caso na clínica. É por este nome que a central pergunta.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Paciente (opcional)</Rotulo>
          <Campo name="pacienteNome" value={pacienteNome} onChange={(e) => setPacienteNome(e.target.value)} />
        </div>
        <div>
          <Rotulo>Contato (opcional)</Rotulo>
          <Campo name="pacienteContato" />
        </div>
      </div>

      <div>
        <Rotulo>Observações do procedimento</Rotulo>
        <Area name="observacoes" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
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
