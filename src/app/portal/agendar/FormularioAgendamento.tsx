"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { solicitarPedido, type Resultado } from "@/app/actions/pedidos";
import { linkWhatsapp, mensagemDeUrgencia } from "@/lib/whatsapp-link";

const INICIAL: Resultado = { ok: false };

type Servico = { id: string; nome: string; duracaoMin: number };
type Grupo = { familia: string; servicos: Servico[] };

/**
 * O agendamento pelo portal, na mesma vitrine por equipamento da página
 * pública — equipamento primeiro, procedimento em seguida — em vez da lista
 * alfabética achatada que a clínica já conhecida tinha antes.
 *
 * A diferença para a vitrine pública fica só no que o sistema já sabe: aqui
 * a clínica já está identificada, então o passo "quem é você" não existe e o
 * horário mostrado é disponibilidade real (checada contra agenda, sala e
 * equipamento pelo `/api/horarios`), não uma preferência a confirmar depois.
 *
 * A escolha de profissional continua fora da tela (ata de 14/09): quem
 * decide quem atende é a central.
 */
export function FormularioAgendamento({
  grupos,
  antecedenciaHoras,
  clinicaNome,
  whatsappCentral,
}: {
  grupos: Grupo[];
  antecedenciaHoras: number;
  clinicaNome: string;
  whatsappCentral: string | null;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(solicitarPedido, INICIAL);

  const [familiaAberta, setFamiliaAberta] = useState<string | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const [data, setData] = useState("");
  const [doutorNome, setDoutorNome] = useState("");
  const [pacienteNome, setPacienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Ao escolher o serviço, leva para o passo seguinte sem exigir rolagem —
  // mesmo comportamento da vitrine pública.
  useEffect(() => {
    if (servico) document.getElementById("passo-quando")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [servico]);

  useEffect(() => {
    if (!servico || !data) {
      setHorarios([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const parametros = new URLSearchParams({ servicoId: servico.id, data });
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
  }, [servico, data]);

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
          servico: servico?.nome ?? null,
          data: data ? data.split("-").reverse().join("/") : null,
          doutor: doutorNome || null,
          paciente: pacienteNome || null,
          observacoes: observacoes || null,
        })
      )
    : null;

  return (
    <div className="space-y-8">
      {/* ── 1. Equipamento ───────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display font-bold text-bordo text-sm mb-1">1 · Qual equipamento você precisa</h2>
        <p className="text-[11px] text-gray-500 mb-4">
          Escolha o tipo — os procedimentos aparecem em seguida.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {grupos.map((grupo) => {
            const aberta = familiaAberta === grupo.familia;
            return (
              <button
                key={grupo.familia}
                type="button"
                onClick={() => setFamiliaAberta(aberta ? null : grupo.familia)}
                aria-expanded={aberta}
                className={`text-left rounded-xl border p-3 transition-colors min-h-[72px]
                  ${aberta ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"}`}
              >
                <div className="text-xs font-semibold">{grupo.familia}</div>
                <div className={`text-[10px] mt-1 ${aberta ? "text-white/70" : "text-gray-400"}`}>
                  {grupo.servicos.length} opç{grupo.servicos.length === 1 ? "ão" : "ões"}
                </div>
              </button>
            );
          })}
        </div>

        {familiaAberta && (
          <div className="mt-4 bg-bege rounded-xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {grupos
                .find((g) => g.familia === familiaAberta)!
                .servicos.map((item) => {
                  const escolhido = servico?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setServico(item)}
                      className={`text-left rounded-xl border p-3 transition-colors
                        ${escolhido ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"}`}
                    >
                      <div className="text-xs font-semibold">{item.nome}</div>
                      <div className={`text-[10px] mt-1 ${escolhido ? "text-white/70" : "text-gray-400"}`}>
                        {item.duracaoMin} min
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </section>

      {/* ── 2. Quando e detalhes ────────────────────────────────────────── */}
      {servico && (
        <section id="passo-quando" className="scroll-mt-4">
          <h2 className="font-display font-bold text-bordo text-sm mb-1">2 · Quando</h2>
          <p className="text-[11px] text-gray-500 mb-4">
            <strong className="text-bordo">{servico.nome}</strong> · {servico.duracaoMin} min
          </p>

          <form action={enviar} className="bg-white border border-gray-200 rounded-2xl p-4 max-w-2xl space-y-4">
            <input type="hidden" name="servicoId" value={servico.id} />
            {/* Oculto por decisão da operação, não removido: a preferência
                por profissional volta como serviço com acréscimo. */}
            <input type="hidden" name="profissionalId" value="" />

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
              {!data ? (
                <div className="text-xs text-gray-400 py-2">Escolha a data.</div>
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
        </section>
      )}
    </div>
  );
}
