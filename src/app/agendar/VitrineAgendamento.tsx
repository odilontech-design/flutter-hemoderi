"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { solicitarPublico } from "@/app/actions/publico";
import { Area, Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { CamposEndereco } from "@/components/CamposEndereco";
import { formatarTelefone, linkWhatsapp, mensagemDeUrgencia } from "@/lib/whatsapp-link";
import type { ResultadoSolicitacaoPublica } from "@/app/actions/publico";

const INICIAL: ResultadoSolicitacaoPublica = { ok: false };

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

/**
 * Escolher primeiro, identificar depois.
 *
 * Quatro passos agora, não três — a ata de 21/09 dividiu o antigo passo 1
 * (equipamento e procedimento juntos) e acrescentou identificação de verdade
 * no fim: o equipamento (a "família") vem primeiro, sozinho, para não jogar
 * as duas dezenas de procedimentos na cara de quem ainda nem escolheu o
 * essencial — as opções detalhadas só aparecem depois que o equipamento é
 * escolhido. E o último passo deixou de ser só "deixa seu contato": todo
 * pedido pelo site agora resolve a clínica na hora, por login de quem já é
 * cliente ou por um cadastro novo criado ali mesmo — é o que a ata chamou de
 * "cadastro obrigatório ao final", pensado para barrar robô e curioso vindos
 * de tráfego pago sem voltar a pedir identificação logo de cara.
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
  dataMinima,
  servicoInicialId,
}: {
  grupos: Grupo[];
  horaAbertura: string;
  horaFechamento: string;
  whatsapp: string | null;
  /** ISO, calculada no servidor — regra das 18h da ata de 21/09. */
  dataMinima: string;
  /** Veio do hiperlink da página de detalhe do serviço. */
  servicoInicialId?: string | null;
}) {
  const [estado, enviar] = useFormState(solicitarPublico, INICIAL);
  const [familiaAberta, setFamiliaAberta] = useState<string | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [telefone, setTelefone] = useState("");
  const [modo, setModo] = useState<"novo" | "login">("novo");
  const [clinicaNome, setClinicaNome] = useState("");
  const [doutorNome, setDoutorNome] = useState("");
  const [pacienteNome, setPacienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const horarios = useMemo(
    () => gradeDeHorarios(horaAbertura, horaFechamento),
    [horaAbertura, horaFechamento]
  );

  // Veio de "ver detalhes" de um serviço específico: abre já com a família e
  // o procedimento escolhidos, em vez de mandar a pessoa escolher de novo.
  useEffect(() => {
    if (!servicoInicialId) return;
    for (const grupo of grupos) {
      const achado = grupo.servicos.find((s) => s.id === servicoInicialId);
      if (achado) {
        setFamiliaAberta(grupo.familia);
        setServico(achado);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na primeira renderização
  }, []);

  // Ao escolher o serviço, leva para o passo seguinte sem exigir rolagem —
  // no celular a lista é longa e o próximo passo nasce fora da tela.
  useEffect(() => {
    if (servico) document.getElementById("passo-quando")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [servico]);

  const linkUrgencia = linkWhatsapp(
    whatsapp,
    mensagemDeUrgencia({
      clinica: clinicaNome || "minha clínica",
      servico: servico?.nome ?? null,
      data: data ? data.split("-").reverse().join("/") : null,
      doutor: doutorNome || null,
      paciente: pacienteNome || null,
      observacoes: observacoes || null,
    })
  );

  if (estado.ok) {
    return (
      <div className="mt-8 bg-white border border-green-200 rounded-2xl p-6 sm:p-8 max-w-2xl">
        <div className="font-display font-extrabold text-bordo text-xl mb-2">Pedido recebido.</div>
        <p className="text-sm text-gray-600 leading-relaxed">
          A central vai confirmar o horário e quem vai atender, e entra em contato pelo telefone que
          você informou.
        </p>

        {estado.credencial && (
          <div className="mt-4 bg-bege rounded-xl p-4">
            <div className="text-xs font-semibold text-bordo mb-1">Seu acesso ao portal foi criado</div>
            <div className="text-xs text-gray-600 mb-2">
              Anote — é assim que você entra da próxima vez para acompanhar seus pedidos, sem
              preencher tudo de novo.
            </div>
            <div className="text-sm font-mono bg-white border border-gray-200 rounded-lg px-3 py-2">
              {estado.credencial.email} · {estado.credencial.senha}
            </div>
          </div>
        )}

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
      {/* ── 1. Equipamento ───────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display font-bold text-bordo text-sm mb-1">1 · Qual equipamento você precisa</h2>
        <p className="text-[11px] text-gray-500 mb-4">
          Levamos o profissional e o equipamento até a sua clínica. Escolha o tipo — os
          procedimentos aparecem em seguida.
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
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 transition-colors
                        ${escolhido ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"}`}
                    >
                      <button type="button" onClick={() => setServico(item)} className="text-left w-full">
                        <div className="text-xs font-semibold">{item.nome}</div>
                        <div className={`text-[10px] mt-1 ${escolhido ? "text-white/70" : "text-gray-400"}`}>
                          {item.duracaoMin} min
                        </div>
                      </button>
                      <Link
                        href={`/agendar/servico/${item.id}`}
                        target="_blank"
                        className={`text-[10px] underline mt-1 inline-block ${escolhido ? "text-white/80" : "text-bordo"}`}
                      >
                        ver detalhes
                      </Link>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
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
                min={dataMinima}
                onChange={(e) => setData(e.target.value)}
              />
              <div className="text-[10px] text-gray-400 mt-1">
                Pelo site, a agenda de amanhã fecha às 18h de hoje. Para hoje ou depois desse
                horário, fale direto com a central.
              </div>
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

            {linkUrgencia && (
              <div className="pt-1">
                <a
                  href={linkUrgencia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 hover:underline"
                >
                  Precisa para hoje? Fale com a central no WhatsApp →
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 3. Quem é você ───────────────────────────────────────────────── */}
      {servico && data && horario && (
        <section className="scroll-mt-4">
          <h2 className="font-display font-bold text-bordo text-sm mb-1">3 · Quem é você</h2>
          <p className="text-[11px] text-gray-500 mb-4">
            Já é cliente da Hemoderi? Entre com sua conta. Primeira vez? A gente cria seu acesso
            agora — é rápido e evita repetir tudo isso no próximo pedido.
          </p>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setModo("novo")}
              className={`text-xs font-semibold px-3.5 py-2.5 rounded-lg border ${
                modo === "novo" ? "bg-bordo text-white border-bordo" : "border-gray-300 text-gray-600"
              }`}
            >
              Primeira vez
            </button>
            <button
              type="button"
              onClick={() => setModo("login")}
              className={`text-xs font-semibold px-3.5 py-2.5 rounded-lg border ${
                modo === "login" ? "bg-bordo text-white border-bordo" : "border-gray-300 text-gray-600"
              }`}
            >
              Já sou cliente
            </button>
          </div>

          <form action={enviar} className="bg-white border border-gray-200 rounded-2xl p-4 max-w-2xl space-y-3">
            <input type="hidden" name="servicoId" value={servico.id} />
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="horarioDesejado" value={horario} />
            <input type="hidden" name="modo" value={modo} />

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
                  maxLength={16}
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                />
                <div className="text-[10px] text-gray-400 mt-1">É por aqui que a central responde.</div>
              </div>
            </div>

            {modo === "login" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>E-mail da sua conta</Rotulo>
                  <Campo name="emailLogin" type="email" required autoComplete="email" />
                </div>
                <div>
                  <Rotulo>Senha</Rotulo>
                  <Campo name="senhaLogin" type="password" required autoComplete="current-password" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Nome da clínica</Rotulo>
                  <Campo
                    name="clinicaNome"
                    required
                    value={clinicaNome}
                    onChange={(e) => setClinicaNome(e.target.value)}
                  />
                </div>
                <div>
                  <Rotulo>E-mail</Rotulo>
                  <Campo name="email" type="email" required autoComplete="email" />
                  <div className="text-[10px] text-gray-400 mt-1">
                    Vira o login do portal — a senha a gente sorteia e mostra no fim.
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-gray-100" />

            <CamposEndereco />
            <div>
              <Rotulo>Ponto de referência (opcional)</Rotulo>
              <Campo name="pontoReferencia" placeholder="Perto do mercado X, portão azul…" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Rotulo>Doutor(a) responsável (opcional)</Rotulo>
                <Campo name="doutorNome" value={doutorNome} onChange={(e) => setDoutorNome(e.target.value)} />
              </div>
              <div>
                <Rotulo>Paciente (opcional)</Rotulo>
                <Campo
                  name="pacienteNome"
                  value={pacienteNome}
                  onChange={(e) => setPacienteNome(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Rotulo>Alguma observação?</Rotulo>
              <Area
                name="observacoes"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
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
