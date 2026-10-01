"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { solicitarAgendamento, type Resultado } from "@/app/actions/pedidos";
import { linkWhatsapp, mensagemDeUrgencia } from "@/lib/whatsapp-link";
import { formatarReais } from "@/lib/dinheiro";
import { ROTULO_UNIDADE } from "@/lib/cobranca";
import type { LocalDeAtendimento } from "@/lib/endereco";
import type { UnidadeCobranca } from "@prisma/client";

const INICIAL: Resultado = { ok: false };

export type ServicoDoCarrinho = {
  id: string;
  nome: string;
  duracaoMin: number;
  familia: string | null;
  unidadeCobranca: UnidadeCobranca;
  permiteQuantidade: boolean;
  rotuloQuantidade: string | null;
  quantidadeMaxima: number | null;
  ufsIndisponiveis: string[];
};
type Grupo = { familia: string; servicos: ServicoDoCarrinho[] };
type Item = { servicoId: string; quantidade: number };

const HORARIO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * O agendamento pelo portal (atas de 14/09 e 01/10).
 *
 * Equipamento primeiro, procedimento em seguida — e agora VÁRIOS procedimentos
 * numa visita só: a clínica monta o agendamento como um carrinho, informa a
 * quantidade onde o serviço permite (dentes, pacientes, horas) e escolhe um
 * horário que comporta o bloco inteiro. Cada serviço vira um pedido; eles
 * acontecem em sequência.
 *
 * A clínica que atende em mais de um lugar escolhe o endereço antes: o que
 * está disponível e quanto custa dependem da UF dele.
 *
 * A escolha de profissional continua fora da tela (ata de 14/09): quem
 * decide quem atende é a central.
 */
export function FormularioAgendamento({
  grupos,
  locais,
  precosPorUf,
  antecedenciaHoras,
  clinicaNome,
  whatsappCentral,
  servicoInicialId,
}: {
  grupos: Grupo[];
  locais: LocalDeAtendimento[];
  precosPorUf: Record<string, Record<string, number>>;
  antecedenciaHoras: number;
  clinicaNome: string;
  whatsappCentral: string | null;
  servicoInicialId: string | null;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(solicitarAgendamento, INICIAL);

  const [localId, setLocalId] = useState(locais[0]?.id ?? "");
  const local = locais.find((l) => l.id === localId) ?? locais[0];
  const uf = (local?.uf ?? "").toUpperCase();

  // Só o que é atendido na UF do endereço escolhido. Some do seletor em vez de
  // virar recusa no fim — a clínica não perde tempo montando o impossível.
  const gruposVisiveis = useMemo(
    () =>
      grupos
        .map((g) => ({
          ...g,
          servicos: g.servicos.filter((s) => !uf || !s.ufsIndisponiveis.map((u) => u.toUpperCase()).includes(uf)),
        }))
        .filter((g) => g.servicos.length > 0),
    [grupos, uf]
  );
  const porId = useMemo(
    () => new Map(gruposVisiveis.flatMap((g) => g.servicos).map((s) => [s.id, s])),
    [gruposVisiveis]
  );

  const [familiaAberta, setFamiliaAberta] = useState<string | null>(() => {
    if (!servicoInicialId) return null;
    return grupos.find((g) => g.servicos.some((s) => s.id === servicoInicialId))?.familia ?? null;
  });
  const [itens, setItens] = useState<Item[]>(() =>
    servicoInicialId && grupos.some((g) => g.servicos.some((s) => s.id === servicoInicialId))
      ? [{ servicoId: servicoInicialId, quantidade: 1 }]
      : []
  );
  const [data, setData] = useState("");
  const [doutorNome, setDoutorNome] = useState("");
  const [pacienteNome, setPacienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [duracaoTotal, setDuracaoTotal] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [primeiroHorario, setPrimeiroHorario] = useState<string | null>(null);

  // Trocar de endereço pode tirar da lista o que a UF nova não atende.
  useEffect(() => {
    setItens((atuais) => atuais.filter((i) => porId.has(i.servicoId)));
  }, [porId]);

  // Calculado no navegador: depende do relógio de quem está olhando, e no
  // servidor daria um instante diferente do que a pessoa vê.
  useEffect(() => {
    setPrimeiroHorario(HORARIO.format(new Date(Date.now() + antecedenciaHoras * 60 * 60 * 1000)));
  }, [antecedenciaHoras]);

  const chaveDosItens = itens.map((i) => `${i.servicoId}:${i.quantidade}`).join(",");

  useEffect(() => {
    if (!chaveDosItens || !data) {
      setHorarios([]);
      setDuracaoTotal(0);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const parametros = new URLSearchParams({ itens: chaveDosItens, data });
    fetch(`/api/horarios?${parametros}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelado) return;
        setHorarios(json.horarios ?? []);
        setDuracaoTotal(json.duracaoTotalMin ?? 0);
      })
      .finally(() => {
        if (!cancelado) setBuscando(false);
      });
    // Cancela a resposta antiga: trocar de data (ou de serviço) rápido não pode
    // fazer a lista de horários de antes aparecer para o pedido de agora.
    return () => {
      cancelado = true;
    };
  }, [chaveDosItens, data]);

  useEffect(() => {
    if (estado.ok) router.push("/portal");
  }, [estado.ok, router]);

  function adicionar(servico: ServicoDoCarrinho) {
    setItens((atuais) =>
      atuais.some((i) => i.servicoId === servico.id) ? atuais : [...atuais, { servicoId: servico.id, quantidade: 1 }]
    );
  }
  function remover(servicoId: string) {
    setItens((atuais) => atuais.filter((i) => i.servicoId !== servicoId));
  }
  function mudarQuantidade(servico: ServicoDoCarrinho, valor: string) {
    const n = Math.trunc(Number(valor));
    const limitado = Math.min(Math.max(Number.isFinite(n) ? n : 1, 1), servico.quantidadeMaxima ?? 999);
    setItens((atuais) => atuais.map((i) => (i.servicoId === servico.id ? { ...i, quantidade: limitado } : i)));
  }

  const precoUnitario = (servicoId: string) => precosPorUf[uf]?.[servicoId] ?? 0;
  const linhas = itens
    .map((item) => ({ item, servico: porId.get(item.servicoId) }))
    .filter((l): l is { item: Item; servico: ServicoDoCarrinho } => Boolean(l.servico));
  const totalCentavos = linhas.reduce((soma, l) => soma + precoUnitario(l.servico.id) * l.item.quantidade, 0);
  const algumSobConsulta = linhas.some((l) => precoUnitario(l.servico.id) === 0);

  // A conta é a mesma que o servidor faz ao recusar — feita aqui só para AVISAR
  // antes, em vez de deixar a pessoa preencher tudo para ouvir não no fim.
  const urgente = (() => {
    if (!data) return false;
    const escolhida = new Date(`${data}T23:59:59-03:00`);
    return escolhida.getTime() - Date.now() < antecedenciaHoras * 60 * 60 * 1000;
  })();

  const nomesDosServicos = linhas.map((l) => l.servico.nome).join(" + ");
  const linkCentral = linkWhatsapp(
    whatsappCentral,
    mensagemDeUrgencia({
      clinica: clinicaNome,
      servico: nomesDosServicos || null,
      data: data ? data.split("-").reverse().join("/") : null,
      doutor: doutorNome || null,
      paciente: pacienteNome || null,
      observacoes: observacoes || null,
    })
  );

  return (
    <div className="space-y-8">
      {/* ── 1. Endereço ──────────────────────────────────────────────────── */}
      {locais.length > 0 && (
        <section>
          <h2 className="font-display font-bold text-bordo text-sm mb-1">1 · Onde será o atendimento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
            {locais.map((l) => {
              const escolhido = l.id === (local?.id ?? "");
              return (
                <button
                  key={l.id || "principal"}
                  type="button"
                  onClick={() => setLocalId(l.id)}
                  aria-pressed={escolhido}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    escolhido ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"
                  }`}
                >
                  <div className="text-xs font-semibold">{l.rotulo}</div>
                  <div className={`text-[10px] mt-1 ${escolhido ? "text-white/70" : "text-gray-400"}`}>
                    {l.resumo || "—"}
                  </div>
                </button>
              );
            })}
          </div>
          <Link href="/portal/enderecos" className="inline-block text-[11px] font-semibold text-bordo hover:underline mt-2">
            + Cadastrar outro endereço
          </Link>
        </section>
      )}

      {/* ── 2. Serviços ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display font-bold text-bordo text-sm mb-1">2 · O que você precisa</h2>
        <p className="text-[11px] text-gray-500 mb-4">
          Escolha o equipamento e adicione os procedimentos — pode juntar mais de um na mesma visita.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {gruposVisiveis.map((grupo) => {
            const aberta = familiaAberta === grupo.familia;
            const noCarrinho = grupo.servicos.filter((s) => itens.some((i) => i.servicoId === s.id)).length;
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
                  {noCarrinho > 0 ? ` · ${noCarrinho} escolhido${noCarrinho === 1 ? "" : "s"}` : ""}
                </div>
              </button>
            );
          })}
        </div>

        {familiaAberta && (
          <div className="mt-4 bg-bege rounded-xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {gruposVisiveis
                .find((g) => g.familia === familiaAberta)
                ?.servicos.map((item) => {
                  const escolhido = itens.some((i) => i.servicoId === item.id);
                  const valor = precoUnitario(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => (escolhido ? remover(item.id) : adicionar(item))}
                      aria-pressed={escolhido}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        escolhido ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"
                      }`}
                    >
                      <div className="text-xs font-semibold">{item.nome}</div>
                      <div className={`text-[10px] mt-1 ${escolhido ? "text-white/70" : "text-gray-400"}`}>
                        {item.duracaoMin} min ·{" "}
                        {valor > 0 ? `${formatarReais(valor)} ${ROTULO_UNIDADE[item.unidadeCobranca]}` : "sob consulta"}
                      </div>
                      <div className={`text-[10px] mt-1 font-semibold ${escolhido ? "text-white" : "text-bordo"}`}>
                        {escolhido ? "✓ no agendamento · tocar para remover" : "+ adicionar"}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </section>

      {/* ── 3. Resumo ────────────────────────────────────────────────────── */}
      {linhas.length > 0 && (
        <section id="passo-resumo" className="scroll-mt-4">
          <h2 className="font-display font-bold text-bordo text-sm mb-3">3 · Seu agendamento</h2>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-2xl">
            <ul className="divide-y divide-gray-100">
              {linhas.map(({ item, servico }) => {
                const unitario = precoUnitario(servico.id);
                return (
                  <li key={servico.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="text-xs font-semibold text-bordo">{servico.nome}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {servico.permiteQuantidade
                          ? `${servico.duracaoMin} min${servico.unidadeCobranca === "HORA" ? " por hora contratada" : ""}`
                          : `${servico.duracaoMin} min · uma unidade por agendamento`}
                      </div>
                    </div>

                    {servico.permiteQuantidade && (
                      <label className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span>{servico.rotuloQuantidade ? servico.rotuloQuantidade : "Quantidade"}</span>
                        <input
                          type="number"
                          min={1}
                          max={servico.quantidadeMaxima ?? undefined}
                          value={item.quantidade}
                          onChange={(e) => mudarQuantidade(servico, e.target.value)}
                          className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </label>
                    )}

                    <div className="text-xs font-semibold text-bordo w-24 text-right">
                      {unitario > 0 ? formatarReais(unitario * item.quantidade) : "sob consulta"}
                    </div>
                    <button
                      type="button"
                      onClick={() => remover(servico.id)}
                      aria-label={`Remover ${servico.nome}`}
                      className="text-[11px] font-semibold text-red-600 hover:underline py-2"
                    >
                      remover
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-gray-200 pt-3 mt-1 flex items-baseline justify-between text-xs">
              <span className="text-gray-500">
                {linhas.length} serviço{linhas.length === 1 ? "" : "s"}
                {duracaoTotal > 0 ? ` · ${duracaoTotal} min no total` : ""}
              </span>
              <span className="font-bold text-bordo text-sm">
                {totalCentavos > 0 ? formatarReais(totalCentavos) : "sob consulta"}
                {algumSobConsulta && totalCentavos > 0 && (
                  <span className="text-[10px] font-normal text-gray-400"> + itens sob consulta</span>
                )}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-2">
              Os serviços acontecem um depois do outro, na ordem em que foram adicionados. Para repetir
              um serviço (outro paciente, por exemplo), faça outro agendamento.
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Quando e detalhes ─────────────────────────────────────────── */}
      {linhas.length > 0 && (
        <section id="passo-quando" className="scroll-mt-4">
          <h2 className="font-display font-bold text-bordo text-sm mb-3">4 · Quando</h2>

          <form action={enviar} className="bg-white border border-gray-200 rounded-2xl p-4 max-w-2xl space-y-4">
            <input type="hidden" name="itens" value={JSON.stringify(itens)} />
            <input type="hidden" name="enderecoId" value={local?.id ?? ""} />

            <div>
              <Rotulo>Data</Rotulo>
              <Campo type="date" value={data} onChange={(e) => setData(e.target.value)} required name="data" />
              <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                O portal agenda com {antecedenciaHoras}h de antecedência
                {primeiroHorario ? (
                  <>
                    : neste momento, o primeiro horário possível é <strong>{primeiroHorario}</strong>
                  </>
                ) : null}
                . Para horários antes disso, a central resolve direto pelo WhatsApp.
              </div>
            </div>

            {urgente && (
              <Aviso tom="alerta">
                <div className="font-semibold mb-1">Esse dia está dentro das próximas {antecedenciaHoras}h.</div>
                Para horários antes do limite do portal, a central trata direto — assim consegue remanejar
                quem já está em rota.
                {linkCentral ? (
                  <a
                    href={linkCentral}
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
              <Rotulo>Horário de início</Rotulo>
              {!data ? (
                <div className="text-xs text-gray-400 py-2">Escolha a data.</div>
              ) : buscando ? (
                <div className="text-xs text-gray-400 py-2">Buscando horários…</div>
              ) : horarios.length === 0 ? (
                <Aviso tom="alerta">
                  Nenhum horário livre nesse dia para {linhas.length > 1 ? "esses serviços juntos" : "esse serviço"}.
                  Tente outra data — ou fale com a central pelo WhatsApp.
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
