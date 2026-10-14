"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { CampoTelefone } from "@/components/CampoTelefone";
import { FORMAS_DE_PAGAMENTO } from "@/lib/pagamento";
import { OUTRO_PROCEDIMENTO, PROCEDIMENTOS_NO_PACIENTE } from "@/lib/procedimentos";
import { solicitarAgendamento, type Resultado } from "@/app/actions/pedidos";
import { linkWhatsapp, mensagemDeUrgencia } from "@/lib/whatsapp-link";
import { formatarReais } from "@/lib/dinheiro";
import { descricaoDoPreco, quantidadeMinimaDe, totalDoItem } from "@/lib/cobranca";
import { descritivoDaFamilia } from "@/lib/catalogo-familias";
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
  quantidadeMinima: number;
  quantidadeIncluida: number | null;
  valorAdicionalCentavos: number;
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
 * Uma etapa do agendamento: aberta, concluída (com resumo e "alterar") ou à
 * frente (apagada). Fica fora do formulário para o React não remontar os
 * campos a cada tecla digitada.
 */
function Etapa({
  numero,
  rotulo,
  titulo,
  passo,
  irPara,
  resumo,
  children,
}: {
  numero: number;
  /** Número exibido — sem a etapa de local, a contagem começa em 1 nos serviços. */
  rotulo: number;
  titulo: string;
  passo: number;
  irPara: (numero: number) => void;
  resumo?: React.ReactNode;
  children: React.ReactNode;
}) {
  const aberta = passo === numero;
  const concluida = passo > numero;
  return (
    <section id={`passo-${numero}`} className={`scroll-mt-4 rounded-2xl border ${aberta ? "border-bordo/30 bg-white" : "border-gray-200 bg-white/60"}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className={`font-display font-bold text-sm ${aberta || concluida ? "text-bordo" : "text-gray-400"}`}>
            {rotulo} · {titulo}
          </h2>
          {concluida && resumo && <div className="text-[11px] text-gray-600 mt-0.5 truncate">{resumo}</div>}
        </div>
        {concluida && (
          <button type="button" onClick={() => irPara(numero)} className="shrink-0 text-[11px] font-semibold text-bordo hover:underline">
            alterar
          </button>
        )}
      </div>
      {aberta && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

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
 *
 * Em ETAPAS sequenciais (ata de 13/10): local, equipamento e serviços, data e
 * horário, informações. Só a etapa da vez fica aberta; as anteriores viram uma
 * linha de resumo com "alterar", e a tela rola sozinha para a próxima — sem a
 * rolagem infinita de antes. Sem minutos (geravam cobrança de "procedimento
 * curto"), sem sugestão de horário livre (quem fecha a agenda é a central) e
 * sem previsão de término.
 */
export function FormularioAgendamento({
  grupos,
  locais,
  precosPorUf,
  antecedenciaHoras,
  clinicaNome,
  whatsappCentral,
  servicoInicialId,
  telefoneClinica,
  doutores,
}: {
  grupos: Grupo[];
  locais: LocalDeAtendimento[];
  precosPorUf: Record<string, Record<string, number>>;
  antecedenciaHoras: number;
  clinicaNome: string;
  whatsappCentral: string | null;
  servicoInicialId: string | null;
  /** O telefone do cadastro, que já vem preenchido no contato da clínica. */
  telefoneClinica: string;
  /** Doutores cadastrados na clínica (Configurações): sugeridos no campo do doutor. */
  doutores: string[];
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

  // A foto da seção do catálogo acompanha a escolha (pedido de 06/10): o
  // equipamento é reconhecido pela imagem antes de ser lido pelo nome.
  const imagemDoServico = useMemo(
    () =>
      new Map(
        gruposVisiveis.flatMap((g) => g.servicos.map((sv) => [sv.id, descritivoDaFamilia(g.familia)?.imagem ?? null] as const))
      ),
    [gruposVisiveis]
  );

  // Etapas: 1 local (só quando há mais de um), 2 serviços, 3 data e horário,
  // 4 informações. Quem chega pelo catálogo com um serviço escolhido já começa
  // nos serviços.
  const temEtapaDeLocal = locais.length > 1;
  const [passo, setPasso] = useState(() => (temEtapaDeLocal && !servicoInicialId ? 1 : 2));
  const [primeiraRenderizacao, setPrimeiraRenderizacao] = useState(true);
  useEffect(() => {
    if (primeiraRenderizacao) {
      setPrimeiraRenderizacao(false);
      return;
    }
    document.getElementById(`passo-${passo}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rola só quando a etapa muda
  }, [passo]);

  const [familiaAberta, setFamiliaAberta] = useState<string | null>(() => {
    if (!servicoInicialId) return null;
    return grupos.find((g) => g.servicos.some((s) => s.id === servicoInicialId))?.familia ?? null;
  });
  const [itens, setItens] = useState<Item[]>(() => {
    const inicial = grupos.flatMap((g) => g.servicos).find((s) => s.id === servicoInicialId);
    return inicial ? [{ servicoId: inicial.id, quantidade: quantidadeMinimaDe(inicial) }] : [];
  });
  const [data, setData] = useState("");
  const [doutorNome, setDoutorNome] = useState("");
  const [procedimento, setProcedimento] = useState("");
  const [pacienteNome, setPacienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [primeiroHorario, setPrimeiroHorario] = useState<string | null>(null);
  // O horário vem do relógio do formulário — qualquer um, não só os da grade
  // (ata de 02/10). `situacaoHora` diz se a agenda comporta esse horário.
  const [hora, setHora] = useState("");
  const [situacaoHora, setSituacaoHora] = useState<"livre" | "indisponivel" | "verificando" | null>(null);

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

  // Confere o horário digitado contra a agenda, com uma pequena espera para não
  // consultar a cada minuto que a pessoa gira no relógio.
  useEffect(() => {
    if (!hora || !chaveDosItens || !data) {
      setSituacaoHora(null);
      return;
    }
    let cancelado = false;
    setSituacaoHora("verificando");
    const espera = setTimeout(() => {
      const parametros = new URLSearchParams({ itens: chaveDosItens, data, hora });
      fetch(`/api/horarios?${parametros}`)
        .then((r) => r.json())
        .then((json) => {
          if (!cancelado) setSituacaoHora((json.horarios ?? []).includes(hora) ? "livre" : "indisponivel");
        })
        .catch(() => {
          // Sem rede: não bloqueia — o servidor confere de novo ao enviar.
          if (!cancelado) setSituacaoHora(null);
        });
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [hora, chaveDosItens, data]);

  useEffect(() => {
    if (estado.ok) router.push(estado.id ? `/portal/resumo/${estado.id}` : "/portal");
  }, [estado.ok, estado.id, router]);

  function abrirFamilia(familia: string | null) {
    setFamiliaAberta(familia);
    // Leva a tela até os procedimentos da categoria escolhida.
    if (familia) setTimeout(() => document.getElementById("procedimentos-da-familia")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  function adicionar(servico: ServicoDoCarrinho) {
    setItens((atuais) =>
      atuais.some((i) => i.servicoId === servico.id)
        ? atuais
        : [...atuais, { servicoId: servico.id, quantidade: quantidadeMinimaDe(servico) }]
    );
  }
  function remover(servicoId: string) {
    setItens((atuais) => atuais.filter((i) => i.servicoId !== servicoId));
  }
  function mudarQuantidade(servico: ServicoDoCarrinho, valor: string) {
    const n = Math.trunc(Number(valor));
    const limitado = Math.min(
      Math.max(Number.isFinite(n) ? n : 1, quantidadeMinimaDe(servico)),
      servico.quantidadeMaxima ?? 99_999
    );
    setItens((atuais) => atuais.map((i) => (i.servicoId === servico.id ? { ...i, quantidade: limitado } : i)));
  }

  const precoUnitario = (servicoId: string) => precosPorUf[uf]?.[servicoId] ?? 0;
  const linhas = itens
    .map((item) => ({ item, servico: porId.get(item.servicoId) }))
    .filter((l): l is { item: Item; servico: ServicoDoCarrinho } => Boolean(l.servico));
  const totalDaLinha = (l: { item: Item; servico: ServicoDoCarrinho }) =>
    totalDoItem(precoUnitario(l.servico.id), l.item.quantidade, l.servico);
  const totalCentavos = linhas.reduce((soma, l) => soma + totalDaLinha(l), 0);
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

  const horaLivre = Boolean(hora) && situacaoHora === "livre";
  const dataLegivel = data ? data.split("-").reverse().join("/") : "";

  return (
    <form action={enviar} className="space-y-3 max-w-4xl">
      <input type="hidden" name="itens" value={JSON.stringify(itens)} />
      <input type="hidden" name="enderecoId" value={local?.id ?? ""} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="horaInicio" value={hora} />

      {!temEtapaDeLocal && local && (
        <div className="text-[11px] text-gray-500 px-1">
          Atendimento em <strong className="text-gray-700">{local.rotulo}</strong>
          {local.resumo ? ` · ${local.resumo}` : ""} ·{" "}
          <Link href="/portal/enderecos" className="font-semibold text-bordo hover:underline">
            cadastrar outro endereço
          </Link>
        </div>
      )}

      {/* ── Local ─────────────────────────────────────────────────────────── */}
      {temEtapaDeLocal && (
        <Etapa numero={1} rotulo={1} passo={passo} irPara={setPasso} titulo="Onde será o atendimento" resumo={local ? `${local.rotulo}${local.resumo ? ` · ${local.resumo}` : ""}` : null}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {locais.map((l) => {
              const escolhido = l.id === (local?.id ?? "");
              return (
                <button
                  key={l.id || "principal"}
                  type="button"
                  onClick={() => {
                    setLocalId(l.id);
                    setPasso(2);
                  }}
                  aria-pressed={escolhido}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    escolhido ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white hover:border-bordo/40"
                  }`}
                >
                  <div className="text-xs font-semibold">{l.rotulo}</div>
                  <div className={`text-[10px] mt-1 ${escolhido ? "text-white/70" : "text-gray-400"}`}>{l.resumo || "—"}</div>
                </button>
              );
            })}
          </div>
          <Link href="/portal/enderecos" className="inline-block text-[11px] font-semibold text-bordo hover:underline mt-2">
            + Cadastrar outro endereço
          </Link>
        </Etapa>
      )}

      {/* ── Equipamento e serviços ────────────────────────────────────────── */}
      <Etapa
        numero={2}
        rotulo={temEtapaDeLocal ? 2 : 1}
        passo={passo}
        irPara={setPasso}
        titulo="Equipamento e serviços"
        resumo={linhas.map((l) => `${l.servico.nome}${l.item.quantidade > 1 ? ` × ${l.item.quantidade}` : ""}`).join(" + ")}
      >
        <p className="text-[11px] text-gray-500 mb-3">
          Escolha o equipamento e adicione os procedimentos — pode juntar mais de um na mesma visita.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {gruposVisiveis.map((grupo) => {
            const aberta = familiaAberta === grupo.familia;
            const noCarrinho = grupo.servicos.filter((s) => itens.some((i) => i.servicoId === s.id)).length;
            const imagem = descritivoDaFamilia(grupo.familia)?.imagem;
            return (
              <button
                key={grupo.familia}
                type="button"
                onClick={() => abrirFamilia(aberta ? null : grupo.familia)}
                aria-expanded={aberta}
                className={`text-left rounded-xl border p-2 transition-colors ${
                  aberta
                    ? "border-bordo bg-bordo text-white"
                    : noCarrinho > 0
                      ? "border-bordo/60 bg-white ring-1 ring-bordo/30"
                      : "border-gray-200 bg-white hover:border-bordo/40"
                }`}
              >
                {imagem && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagem} alt="" loading="lazy" className="mb-1.5 h-14 w-full rounded-lg bg-white object-contain" />
                )}
                <div className="text-[11px] font-semibold leading-tight">{grupo.familia}</div>
              </button>
            );
          })}
        </div>

        {familiaAberta && (
          <div id="procedimentos-da-familia" className="mt-3 bg-bege rounded-xl p-3 scroll-mt-4">
            {(() => {
              const d = descritivoDaFamilia(familiaAberta);
              if (!d) return null;
              return (
                <div className="flex items-center gap-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.imagem} alt={d.legenda} className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain border border-gray-100" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-bordo">{familiaAberta}</div>
                    <div className="text-[11px] text-gray-500 leading-snug">{d.legenda}</div>
                    <Link href="/portal/catalogo" target="_blank" className="text-[11px] font-semibold text-bordo hover:underline">
                      Ver descritivo completo no catálogo ↗
                    </Link>
                  </div>
                </div>
              );
            })()}
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
                        {descricaoDoPreco(valor, item)}
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

        {linhas.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-gray-600 mb-1">Seu agendamento</div>
            <ul className="divide-y divide-gray-100">
              {linhas.map(({ item, servico }) => {
                const unitario = precoUnitario(servico.id);
                return (
                  <li key={servico.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {imagemDoServico.get(servico.id) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagemDoServico.get(servico.id) as string}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-100 bg-white object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="text-xs font-semibold text-bordo">{servico.nome}</div>
                      {!servico.permiteQuantidade && (
                        <div className="text-[10px] text-gray-400 mt-0.5">uma unidade por agendamento</div>
                      )}
                    </div>
                    {servico.permiteQuantidade && (
                      <label className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span>{servico.rotuloQuantidade ? servico.rotuloQuantidade : "Quantidade"}</span>
                        <input
                          type="number"
                          min={quantidadeMinimaDe(servico)}
                          max={servico.quantidadeMaxima ?? undefined}
                          value={item.quantidade}
                          onChange={(e) => mudarQuantidade(servico, e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </label>
                    )}
                    <div className="text-xs font-semibold text-bordo w-24 text-right">
                      {unitario > 0 ? formatarReais(totalDaLinha({ item, servico })) : "sob consulta"}
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
            <div className="border-t border-gray-200 pt-2 mt-1 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-bordo text-sm">
                {totalCentavos > 0 ? formatarReais(totalCentavos) : "sob consulta"}
                {algumSobConsulta && totalCentavos > 0 && <span className="text-[10px] font-normal text-gray-400"> + itens sob consulta</span>}
              </span>
              <div className="flex flex-wrap gap-2">
                <Botao
                  type="button"
                  variante="secundario"
                  onClick={() => {
                    setFamiliaAberta(null);
                    document.getElementById("passo-2")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  + Adicionar outro serviço
                </Botao>
                <Botao type="button" onClick={() => setPasso(3)}>
                  Continuar
                </Botao>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 mt-2">
              Os serviços acontecem um depois do outro, na ordem em que foram adicionados. Para repetir um serviço
              (outro paciente, por exemplo), faça outro agendamento.
            </div>
          </div>
        )}
      </Etapa>

      {/* ── Data e horário ────────────────────────────────────────────────── */}
      <Etapa numero={3} rotulo={temEtapaDeLocal ? 3 : 2} passo={passo} irPara={setPasso} titulo="Data e horário" resumo={data && hora ? `${dataLegivel} às ${hora}` : null}>
        <div className="space-y-4 max-w-xl">
          <div>
            <Rotulo>Data</Rotulo>
            <Campo type="date" value={data} onChange={(e) => setData(e.target.value)} required />
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
              Para horários antes do limite do portal, a central trata direto — assim consegue remanejar quem já está
              em rota.
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
            <Rotulo>Horário agendado com o paciente</Rotulo>
            <div className="text-[10px] text-gray-500 mb-2 leading-relaxed">
              É o horário que o paciente vai chegar. Para locação de equipamento sem operador (motor de implante, laser,
              ultrassom microfocado), considere o horário de entrega.
            </div>
            {!data ? (
              <div className="text-xs text-gray-400 py-2">Escolha a data.</div>
            ) : (
              <div className="space-y-2">
                <Campo type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="!w-40" />
                <div className="text-[10px] leading-relaxed">
                  {situacaoHora === "verificando" && <span className="text-gray-400">Conferindo a agenda…</span>}
                  {situacaoHora === "livre" && <span className="font-semibold text-green-700">Horário disponível para solicitar.</span>}
                  {situacaoHora === "indisponivel" && (
                    <span className="font-semibold text-amber-700">
                      Esse horário não está disponível para {linhas.length > 1 ? "esses serviços juntos" : "esse serviço"}{" "}
                      (já ocupado, com menos de {antecedenciaHoras}h de antecedência ou passando da meia-noite). Tente
                      outro horário ou fale com a central.
                    </span>
                  )}
                  {situacaoHora === null && (
                    <span className="text-gray-400">
                      Escolha o horário. A central confere a agenda da equipe e confirma pelo WhatsApp.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <Botao type="button" disabled={!horaLivre} onClick={() => setPasso(4)}>
            Continuar
          </Botao>
        </div>
      </Etapa>

      {/* ── Informações ───────────────────────────────────────────────────── */}
      <Etapa numero={4} rotulo={temEtapaDeLocal ? 4 : 3} passo={passo} irPara={setPasso} titulo="Informações do atendimento">
        <div className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Rotulo>Procedimento a ser realizado no paciente</Rotulo>
              <Selecao name="procedimentoPaciente" required value={procedimento} onChange={(e) => setProcedimento(e.target.value)}>
                <option value="">Selecione…</option>
                {PROCEDIMENTOS_NO_PACIENTE.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value={OUTRO_PROCEDIMENTO}>{OUTRO_PROCEDIMENTO}</option>
              </Selecao>
              {procedimento === OUTRO_PROCEDIMENTO && (
                <Campo name="procedimentoOutro" required maxLength={120} placeholder="Qual procedimento?" className="mt-2" />
              )}
            </div>
            <div>
              <Rotulo>Forma de pagamento no ato</Rotulo>
              <Selecao name="formaPagamento" required defaultValue="">
                <option value="">Selecione…</option>
                {FORMAS_DE_PAGAMENTO.map((forma) => (
                  <option key={forma} value={forma}>
                    {forma}
                  </option>
                ))}
              </Selecao>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Rotulo>Doutor(a) responsável — nome e sobrenome</Rotulo>
              <Campo
                name="doutorNome"
                required
                list="doutores-da-clinica"
                autoComplete="off"
                value={doutorNome}
                onChange={(e) => setDoutorNome(e.target.value)}
              />
              <datalist id="doutores-da-clinica">
                {doutores.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
              <div className="text-[10px] text-gray-400 mt-1">
                É por este nome que a central pergunta.
                {doutores.length > 0 ? " Escolha da lista ou digite outro." : " Cadastre os doutores em Configurações."}
              </div>
            </div>
            <div>
              <Rotulo>Contato da clínica para confirmação</Rotulo>
              <CampoTelefone name="contatoClinica" inicial={telefoneClinica} obrigatorio />
              <div className="text-[10px] text-gray-400 mt-1">Para onde a central liga ou escreve.</div>
            </div>
            <div>
              <Rotulo>Paciente (opcional)</Rotulo>
              <Campo name="pacienteNome" value={pacienteNome} onChange={(e) => setPacienteNome(e.target.value)} />
            </div>
          </div>

          <div>
            <Rotulo>Observações do procedimento</Rotulo>
            <Area name="observacoes" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

          <Botao type="submit" disabled={!horaLivre || linhas.length === 0}>
            Solicitar agendamento
          </Botao>
          <div className="text-[10px] text-gray-400">A central confirma a solicitação e avisa pelo WhatsApp.</div>
        </div>
      </Etapa>
    </form>
  );
}
