"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { solicitarPublico } from "@/app/actions/publico";
import { Area, Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import type { Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  duracaoMin: number;
  familia: string | null;
};

type Grupo = { familia: string; servicos: Servico[] };

/** Grade de hora em hora dentro do funcionamento da operação. */
function gradeDeHorarios(abertura: string, fechamento: string): string[] {
  const hora = (t: string) => Number(t.split(":")[0]);
  const horas: string[] = [];
  for (let h = hora(abertura); h <= hora(fechamento); h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
  }
  return horas;
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Escolher primeiro, identificar depois.
 *
 * Três passos, e o passo dos dados pessoais é o ÚLTIMO de propósito: quando
 * a pessoa chega nele já escolheu o procedimento e o dia, e o esforço já
 * investido é o que faz valer a pena preencher o telefone. Na ordem
 * invertida — que é a de hoje — ela desiste antes de ver o que existe.
 *
 * O horário aqui é preferência, não reserva: sem saber de qual clínica é, o
 * sistema não tem como conferir sala nem equipamento, e prometer horário
 * seria prometer o que a operação ainda não sabe se cumpre. A tela diz isso
 * com todas as letras em vez de deixar a pessoa descobrir na ligação.
 */
export function VitrineAgendamento({
  grupos,
  horaAbertura,
  horaFechamento,
  whatsapp,
}: {
  grupos: Grupo[];
  horaAbertura: string;
  horaFechamento: string;
  whatsapp: string | null;
}) {
  const [estado, enviar] = useFormState(solicitarPublico, INICIAL);
  const [servico, setServico] = useState<Servico | null>(null);
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [telefone, setTelefone] = useState("");

  const horarios = useMemo(
    () => gradeDeHorarios(horaAbertura, horaFechamento),
    [horaAbertura, horaFechamento]
  );

  // Ao escolher o serviço, leva para o passo seguinte sem exigir rolagem —
  // no celular a lista é longa e o próximo passo nasce fora da tela.
  useEffect(() => {
    if (servico) document.getElementById("passo-quando")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [servico]);

  if (estado.ok) {
    return (
      <div className="mt-8 bg-white border border-green-200 rounded-2xl p-6 sm:p-8 max-w-2xl">
        <div className="font-display font-extrabold text-bordo text-xl mb-2">Pedido recebido.</div>
        <p className="text-sm text-gray-600 leading-relaxed">
          A central vai confirmar o horário e quem vai atender, e entra em contato pelo telefone que
          você informou. Se preferir adiantar, fale com a gente agora:
        </p>
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 bg-[#1EA952] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#178943]"
          >
            Falar com a central no WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {/* ── 1. O que ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display font-bold text-bordo text-sm mb-1">1 · O que você precisa</h2>
        <p className="text-[11px] text-gray-500 mb-4">
          Levamos o profissional e o equipamento até a sua clínica.
        </p>

        <div className="space-y-5">
          {grupos.map((grupo) => (
            <div key={grupo.familia}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {grupo.familia}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {grupo.servicos.map((item) => {
                  const escolhido = servico?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setServico(item)}
                      aria-pressed={escolhido}
                      className={`text-left rounded-xl border p-3 transition-colors min-h-[72px]
                        ${
                          escolhido
                            ? "border-bordo bg-bordo text-white"
                            : "border-gray-200 bg-white hover:border-bordo/40"
                        }`}
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
          ))}
        </div>
      </section>

      {/* ── 2. Quando ────────────────────────────────────────────────────── */}
      {servico && (
        <section id="passo-quando" className="scroll-mt-4">
          <h2 className="font-display font-bold text-bordo text-sm mb-1">2 · Quando</h2>
          <p className="text-[11px] text-gray-500 mb-4">
            Escolha sua preferência. A central confirma o horário exato quando ligar — é ela que
            enxerga a agenda dos profissionais e dos equipamentos.
          </p>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-2xl space-y-4">
            <div className="max-w-xs">
              <Rotulo>Dia</Rotulo>
              <Campo
                type="date"
                value={data}
                min={hojeISO()}
                onChange={(e) => setData(e.target.value)}
              />
            </div>

            <div>
              <Rotulo>Horário preferido</Rotulo>
              <div className="flex flex-wrap gap-2 mt-1">
                {horarios.map((hora) => (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => setHorario(hora)}
                    aria-pressed={horario === hora}
                    className={`text-xs font-semibold px-3 py-2.5 min-h-[40px] rounded-lg border transition-colors
                      ${
                        horario === hora
                          ? "bg-bordo text-white border-bordo"
                          : "border-gray-300 hover:border-bordo/40"
                      }`}
                  >
                    {hora}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Quem ──────────────────────────────────────────────────────── */}
      {servico && data && horario && (
        <section className="scroll-mt-4">
          <h2 className="font-display font-bold text-bordo text-sm mb-1">3 · Quem é você</h2>
          <p className="text-[11px] text-gray-500 mb-4">
            Só o necessário para a central ligar de volta. O cadastro completo a gente faz junto.
          </p>

          <form action={enviar} className="bg-white border border-gray-200 rounded-2xl p-4 max-w-2xl space-y-3">
            <input type="hidden" name="servicoId" value={servico.id} />
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="horarioDesejado" value={horario} />

            <div className="bg-bege rounded-xl p-3 text-[11px] text-gray-600">
              <strong className="text-bordo">{servico.nome}</strong> ·{" "}
              {data.split("-").reverse().join("/")} por volta das {horario} · {servico.duracaoMin} min
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Rotulo>Seu nome</Rotulo>
                <Campo name="solicitante" required autoComplete="name" />
              </div>
              <div>
                <Rotulo>WhatsApp com DDD</Rotulo>
                <Campo
                  name="telefone"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
                <div className="text-[10px] text-gray-400 mt-1">É por aqui que a central responde.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Rotulo>Nome da clínica</Rotulo>
                <Campo name="clinicaNome" required />
              </div>
              <div>
                <Rotulo>E-mail (opcional)</Rotulo>
                <Campo name="email" type="email" autoComplete="email" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Rotulo>Doutor(a) responsável (opcional)</Rotulo>
                <Campo name="doutorNome" />
              </div>
              <div>
                <Rotulo>Paciente (opcional)</Rotulo>
                <Campo name="pacienteNome" />
              </div>
            </div>

            <div>
              <Rotulo>Alguma observação?</Rotulo>
              <Area name="observacoes" rows={2} />
            </div>

            {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

            <Botao type="submit" className="w-full py-3">
              Enviar pedido de agendamento
            </Botao>
            <p className="text-[10px] text-gray-400 text-center">
              Enviar não confirma o horário — a central retorna para fechar.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
