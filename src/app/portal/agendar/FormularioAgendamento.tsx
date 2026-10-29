"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { CampoTelefone } from "@/components/CampoTelefone";
import { CampoHora } from "@/components/CampoHora";
import { OutroEndereco } from "@/components/OutroEndereco";
import { FORMAS_DE_PAGAMENTO } from "@/lib/pagamento";
import { OUTRO_PROCEDIMENTO, PROCEDIMENTOS_NO_PACIENTE } from "@/lib/procedimentos";
import { agendarPelaEquipe, solicitarAgendamento, type Resultado } from "@/app/actions/pedidos";
import { linkWhatsapp, mensagemDeUrgencia } from "@/lib/whatsapp-link";
import { formatarReais, lerCentavos } from "@/lib/dinheiro";
import { descricaoDoPreco, quantidadeMinimaDe, totalDoItem, unidadeDoPreco } from "@/lib/cobranca";
import { descritivoDaFamilia } from "@/lib/catalogo-familias";
import type { LocalDeAtendimento } from "@/lib/endereco";
import type { UnidadeCobranca } from "@prisma/client";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

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

/**
 * O mesmo formulário usado pela equipe no painel (ata de 26/10: "todos os
 * campos iguais ao agendamento feito pelo portal"). Muda o que é da equipe: a
 * clínica escolhida antes, sem antecedência mínima, e o profissional opcional
 * para quem aloca.
 */
export type ModoEquipe = {
  clinicaId: string;
  /** Vazio para quem não aloca: o campo some e o agendamento vai para a fila. */
  profissionais: { id: string; nome: string }[];
  /** Onde a equipe cadastra outro endereço da clínica. */
  enderecosHref: string;
  /** Endereço já escolhido (o recém-informado, vindo pela URL). */
  localInicialId?: string;
};
/**
 * Um serviço na visita. `chave` identifica a linha: o mesmo serviço pode
 * entrar mais de uma vez, uma para cada paciente (reunião de 27/10:
 * "agendamento de serviço por paciente").
 */
type Item = {
  chave: string;
  servicoId: string;
  quantidade: number;
  paciente: string;
  /** Valor da linha definido à mão pela equipe (centavos); ausente = o da tabela. */
  valorCentavos?: number | null;
};

let proximaChave = 0;
const novaChave = () => `item-${++proximaChave}`;

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
function FormularioBase({
  modalidade,
  grupos,
  locais,
  precosPorUf,
  antecedenciaHoras,
  clinicaNome,
  whatsappCentral,
  servicoInicialId,
  telefoneClinica,
  doutores,
  equipe,
}: {
  modalidade: Modalidade;
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
  /** Presente quando quem agenda é a equipe, no painel. */
  equipe?: ModoEquipe;
}) {
  const router = useRouter();
  const [estado, enviar] = useFormState(equipe ? agendarPelaEquipe : solicitarAgendamento, INICIAL);
  const avisarSalvo = useConfirmarSalvo();
  useEffect(() => {
    if (estado.ok)
      avisarSalvo("Enviado", {
        tela: true,
        titulo: equipe ? "Agendamento criado" : "Agendamento enviado",
        detalhes: estado.avisos,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avisa uma vez por resposta do servidor, não quando a sessão recarrega.
  }, [estado]);
  const enderecosHref = equipe?.enderecosHref ?? "/portal/enderecos";

  const [localId, setLocalId] = useState(
    equipe?.localInicialId && locais.some((l) => l.id === equipe.localInicialId) ? equipe.localInicialId : (locais[0]?.id ?? "")
  );
  // Endereço informado agora pela equipe: entra na lista quando a página
  // recarrega os locais, e já fica escolhido. Vai também para a URL, para a
  // escolha sobreviver se a página remontar o formulário ao recarregar.
  function escolherLocalNovo(id: string) {
    setLocalId(id);
    setPasso(2);
    if (equipe) router.replace(`/painel/pedidos/novo?clinica=${equipe.clinicaId}&endereco=${id}`, { scroll: false });
  }
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
    return inicial ? [{ chave: novaChave(), servicoId: inicial.id, quantidade: quantidadeMinimaDe(inicial), paciente: "" }] : [];
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
      const parametros = new URLSearchParams({ itens: chaveDosItens, data, hora, ...(equipe ? { clinicaId: equipe.clinicaId } : {}) });
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
  }, [hora, chaveDosItens, data, equipe]);

  useEffect(() => {
    if (!estado.ok) return;
    if (!equipe) {
      router.push(estado.id ? `/portal/resumo/${estado.id}` : "/portal");
      return;
    }
    // Com aviso (a alocação não passou, por exemplo), a equipe lê antes de sair.
    if (!estado.avisos?.length) router.push(estado.id ? `/painel/pedidos/${estado.id}` : "/painel/pedidos");
  }, [estado, router, equipe]);

  function abrirFamilia(familia: string | null) {
    setFamiliaAberta(familia);
    // Leva a tela até os procedimentos da categoria escolhida.
    if (familia) setTimeout(() => document.getElementById("procedimentos-da-familia")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  function adicionar(servico: ServicoDoCarrinho) {
    setItens((atuais) =>
      atuais.some((i) => i.servicoId === servico.id)
        ? atuais
        : [...atuais, { chave: novaChave(), servicoId: servico.id, quantidade: quantidadeMinimaDe(servico), paciente: "" }]
    );
  }
  /** O mesmo serviço para mais um paciente, logo abaixo da linha de origem. */
  function outroPaciente(item: Item, servico: ServicoDoCarrinho) {
    setItens((atuais) => {
      const posicao = atuais.findIndex((i) => i.chave === item.chave);
      const novo = { chave: novaChave(), servicoId: servico.id, quantidade: quantidadeMinimaDe(servico), paciente: "" };
      return [...atuais.slice(0, posicao + 1), novo, ...atuais.slice(posicao + 1)];
    });
  }
  /** Remove todas as linhas do serviço (o botão do catálogo). */
  function remover(servicoId: string) {
    setItens((atuais) => atuais.filter((i) => i.servicoId !== servicoId));
  }
  function removerLinha(chave: string) {
    setItens((atuais) => atuais.filter((i) => i.chave !== chave));
  }
  function mudarQuantidade(item: Item, servico: ServicoDoCarrinho, valor: string) {
    const n = Math.trunc(Number(valor));
    const limitado = Math.min(
      Math.max(Number.isFinite(n) ? n : 1, quantidadeMinimaDe(servico)),
      servico.quantidadeMaxima ?? 99_999
    );
    setItens((atuais) => atuais.map((i) => (i.chave === item.chave ? { ...i, quantidade: limitado } : i)));
  }
  function mudarPaciente(item: Item, nome: string) {
    setItens((atuais) => atuais.map((i) => (i.chave === item.chave ? { ...i, paciente: nome } : i)));
  }

  const precoUnitario = (servicoId: string) => precosPorUf[uf]?.[servicoId] ?? 0;
  const linhas = itens
    .map((item) => ({ item, servico: porId.get(item.servicoId) }))
    .filter((l): l is { item: Item; servico: ServicoDoCarrinho } => Boolean(l.servico));
  const totalDaLinha = (l: { item: Item; servico: ServicoDoCarrinho }) =>
    equipe && l.item.valorCentavos != null
      ? l.item.valorCentavos
      : totalDoItem(precoUnitario(l.servico.id), l.item.quantidade, l.servico);
  const totalCentavos = linhas.reduce((soma, l) => soma + totalDaLinha(l), 0);
  // Serviço que aparece mais de uma vez precisa do paciente em cada linha: é
  // ele que diferencia um atendimento do outro (e o servidor confere de novo).
  const repetidoSemPaciente = linhas.some(
    (l) => !l.item.paciente.trim() && linhas.filter((o) => o.servico.id === l.servico.id).length > 1
  );
  // Paciente (ata de 27/10): obrigatório no curso e quando a visita tem mais de
  // um serviço — aí a primeira pergunta é se é o mesmo paciente para todos.
  const [mesmoPaciente, setMesmoPaciente] = useState<boolean | null>(null);
  // Pacientes diferentes no mesmo horário, um profissional cada (Joyce, 29/10).
  const [simultaneo, setSimultaneo] = useState(false);
  const variosServicos = linhas.length > 1;
  const exigePaciente = modalidade === "CURSO" || variosServicos;
  const perguntaPendente = variosServicos && mesmoPaciente === null;
  const faltaPacienteNaLinha = variosServicos && mesmoPaciente === false && linhas.some((l) => !l.item.paciente.trim());
  const pacienteFaltando = exigePaciente && linhas.some((l) => !(l.item.paciente.trim() || pacienteNome.trim()));
  const algumSobConsulta = linhas.some((l) => precoUnitario(l.servico.id) === 0);

  // A conta é a mesma que o servidor faz ao recusar — feita aqui só para AVISAR
  // antes, em vez de deixar a pessoa preencher tudo para ouvir não no fim.
  const urgente = (() => {
    // A equipe encaixa urgência: o limite do portal não vale para ela.
    if (!data || equipe) return false;
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

  // A equipe não é travada por sobreposição: só recebe o aviso (pedido de 27/10).
  const horaLivre = Boolean(hora) && (situacaoHora === "livre" || (Boolean(equipe) && situacaoHora !== "verificando"));
  const dataLegivel = data ? data.split("-").reverse().join("/") : "";

  return (
    <form action={enviar} className="space-y-3 max-w-4xl">
      <input type="hidden" name="itens" value={JSON.stringify(itens)} />
      <input type="hidden" name="modalidade" value={modalidade} />
      <input type="hidden" name="simultaneo" value={equipe && simultaneo && linhas.length > 1 && mesmoPaciente === false ? "sim" : ""} />
      <input type="hidden" name="enderecoId" value={local?.id ?? ""} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="horaInicio" value={hora} />
      {equipe && <input type="hidden" name="clinicaId" value={equipe.clinicaId} />}

      {equipe && locais.length === 0 && (
        <div className="text-[11px] text-gray-500 px-1">
          A clínica não tem endereço cadastrado. <OutroEndereco clinicaId={equipe.clinicaId} aoCriar={escolherLocalNovo} />
        </div>
      )}

      {/* O endereço em destaque (ata de 27/10): em texto pequeno passava
          despercebido, e o agendamento saía com o local errado. */}
      {!temEtapaDeLocal && local && (
        <div className="rounded-2xl border-2 border-bordo/40 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-bordo">📍 Local do atendimento</div>
          <div className="mt-1 text-sm font-semibold text-gray-800">{local.rotulo}</div>
          {local.resumo && <div className="text-xs text-gray-600">{local.resumo}</div>}
          <div className="mt-1.5 text-[11px] text-gray-500">
            Não é este endereço?{" "}
            <OutroEndereco clinicaId={equipe?.clinicaId} aoCriar={escolherLocalNovo} />
          </div>
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
          <div className="mt-2">
            <OutroEndereco clinicaId={equipe?.clinicaId} aoCriar={escolherLocalNovo} />
          </div>
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
                    {!equipe && (
                      <Link href="/portal/catalogo" target="_blank" className="text-[11px] font-semibold text-bordo hover:underline">
                        Ver descritivo completo no catálogo ↗
                      </Link>
                    )}
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
            <div className="text-[11px] font-semibold text-gray-600 mb-1">{equipe ? "Agendamento" : "Seu agendamento"}</div>
            <ul className="divide-y divide-gray-100">
              {linhas.map(({ item, servico }) => {
                const unitario = precoUnitario(servico.id);
                return (
                  <li key={item.chave} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
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
                      {/* O preço POR PACIENTE (ou por período/hora) fica sob o nome; o total da linha vai
                          em destaque no canto (ata de 29/10: só o montante final assusta). */}
                      {precoUnitario(servico.id) > 0 && (
                        <div className="text-[10px] text-gray-500">
                          {formatarReais(precoUnitario(servico.id))} {unidadeDoPreco(servico)}
                          {item.quantidade > 1 ? ` · ${item.quantidade} ${servico.rotuloQuantidade?.toLowerCase() ?? "unidades"}` : ""}
                        </div>
                      )}
                      {/* O paciente vai para "Informações do atendimento" (ata de 29/10): na linha do
                          equipamento só aparece quando precisa diferenciar pacientes. */}
                      {(variosServicos || linhas.filter((l) => l.servico.id === servico.id).length > 1) && (
                      <input
                        value={item.paciente}
                        onChange={(e) => mudarPaciente(item, e.target.value)}
                        maxLength={120}
                        placeholder={
                          linhas.filter((l) => l.servico.id === servico.id).length > 1 || (variosServicos && mesmoPaciente === false)
                            ? "Paciente (obrigatório)"
                            : modalidade === "CURSO"
                              ? "Paciente (obrigatório)"
                              : "Paciente (opcional)"
                        }
                        aria-label={`Paciente de ${servico.nome}`}
                        className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-2 py-1 text-[11px]"
                      />
                      )}
                      <button
                        type="button"
                        onClick={() => outroPaciente(item, servico)}
                        className="block mt-1 text-[10px] font-semibold text-bordo hover:underline"
                      >
                        + o mesmo serviço para outro paciente
                      </button>
                    </div>
                    {servico.permiteQuantidade && (
                      <label className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span>{servico.rotuloQuantidade ? servico.rotuloQuantidade : "Quantidade"}</span>
                        <input
                          type="number"
                          min={quantidadeMinimaDe(servico)}
                          max={servico.quantidadeMaxima ?? undefined}
                          value={item.quantidade}
                          onChange={(e) => mudarQuantidade(item, servico, e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </label>
                    )}
                    {equipe ? (
                      <ValorDaLinha
                        centavos={totalDaLinha({ item, servico })}
                        daTabela={unitario > 0}
                        editado={item.valorCentavos != null}
                        aoMudar={(valor) => setItens((atuais) => atuais.map((i) => (i.chave === item.chave ? { ...i, valorCentavos: valor } : i)))}
                      />
                    ) : (
                      <div className="text-right w-28">
                        <div className="text-[9px] uppercase tracking-wide text-gray-400">total</div>
                        <div className="text-sm font-bold text-bordo">
                          {unitario > 0 ? formatarReais(totalDaLinha({ item, servico })) : "sob consulta"}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removerLinha(item.chave)}
                      aria-label={`Remover ${servico.nome}${item.paciente ? ` de ${item.paciente}` : ""}`}
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
                <Botao type="button" disabled={repetidoSemPaciente || perguntaPendente || faltaPacienteNaLinha} onClick={() => setPasso(3)}>
                  Continuar
                </Botao>
              </div>
            </div>
            {variosServicos && (
              <fieldset className="mt-3 rounded-xl border border-bordo/30 bg-bege/40 px-3 py-2">
                <legend className="px-1 text-[11px] font-semibold text-bordo">Os serviços são para o mesmo paciente?</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="mesmoPaciente" checked={mesmoPaciente === true} onChange={() => setMesmoPaciente(true)} />
                    Sim, o mesmo paciente
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="mesmoPaciente" checked={mesmoPaciente === false} onChange={() => setMesmoPaciente(false)} />
                    Não, pacientes diferentes (um relatório para cada)
                  </label>
                </div>
                {mesmoPaciente === true && (
                  <div className="mt-1 text-[10px] text-gray-500">O nome do paciente é informado na última etapa.</div>
                )}
                {mesmoPaciente === false && (
                  <div className="mt-1 text-[10px] text-gray-500">Informe o paciente em cada linha da lista acima.</div>
                )}
                {mesmoPaciente === false && equipe && (
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="ordem" checked={!simultaneo} onChange={() => setSimultaneo(false)} />
                      Um depois do outro
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="ordem" checked={simultaneo} onChange={() => setSimultaneo(true)} />
                      Ao mesmo tempo (um profissional para cada paciente)
                    </label>
                  </div>
                )}
                {faltaPacienteNaLinha && (
                  <div className="mt-1 text-[10px] font-semibold text-amber-700">Falta o paciente em alguma linha.</div>
                )}
              </fieldset>
            )}
            <div className="text-[10px] text-gray-400 mt-2">
              Os serviços acontecem um depois do outro, na ordem da lista. Para atender mais de um paciente na mesma
              visita, use &quot;+ o mesmo serviço para outro paciente&quot; e informe o nome de cada um.
              {repetidoSemPaciente && (
                <span className="block text-amber-700 font-semibold mt-1">
                  Informe o paciente em cada linha do serviço repetido para continuar.
                </span>
              )}
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
            {equipe ? (
              <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                Pela equipe vale qualquer data, inclusive hoje: o limite de {antecedenciaHoras}h é só do portal da clínica.
              </div>
            ) : (
            <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              O portal agenda com {antecedenciaHoras}h de antecedência
              {primeiroHorario ? (
                <>
                  : neste momento, o primeiro horário possível é <strong>{primeiroHorario}</strong>
                </>
              ) : null}
              . Para horários antes disso, a central resolve direto pelo WhatsApp.
            </div>
            )}
          </div>


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
                <CampoHora required value={hora} onChange={setHora} />
                <div className="text-[10px] leading-relaxed">
                  {situacaoHora === "verificando" && <span className="text-gray-400">Conferindo a agenda…</span>}
                  {situacaoHora === "livre" && <span className="font-semibold text-green-700">Horário disponível para solicitar.</span>}
                  {situacaoHora === "indisponivel" && (
                    <span className="font-semibold text-amber-700">
                      {equipe
                        ? `Só um aviso, não impede: já existe agendamento nesse horário para ${linhas.length > 1 ? "esses serviços" : "esse serviço"} (sala da clínica ou equipamento). Pode continuar e criar.`
                        : `Esse horário não está disponível para ${linhas.length > 1 ? "esses serviços juntos" : "esse serviço"} (já ocupado, com menos de ${antecedenciaHoras}h de antecedência ou passando da meia-noite). Tente outro horário ou fale com a central.`}
                    </span>
                  )}
                  {situacaoHora === null && (
                    <span className="text-gray-400">
                      {equipe
                        ? "Escolha o horário combinado com a clínica."
                        : "Escolha o horário. A central confere a agenda da equipe e confirma pelo WhatsApp."}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {urgente && (
            <Aviso tom="alerta">
              <div className="font-semibold mb-1">Esse dia está dentro das próximas {antecedenciaHoras}h.</div>
              Para horários antes do limite do portal, a central trata direto — assim consegue remanejar quem já está
              em rota.
              {linkCentral ? (
                // Link discreto e afastado dos botões de avançar: o botão verde grande, colado no
                // "Continuar", gerava cliques acidentais no celular (André, 29/10).
                <a
                  href={linkCentral}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block text-[11px] font-semibold text-green-800 underline"
                >
                  Falar com a central no WhatsApp
                </a>
              ) : (
                <div className="mt-1">Fale com a central — o número não está configurado no sistema.</div>
              )}
            </Aviso>
          )}

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
                {doutores.length > 0
                  ? " Escolha da lista ou digite outro."
                  : equipe
                    ? " A clínica ainda não tem doutores cadastrados: digite o nome."
                    : " Cadastre os doutores em Configurações."}
              </div>
            </div>
            <div>
              <Rotulo>Contato da clínica para confirmação</Rotulo>
              <CampoTelefone name="contatoClinica" inicial={telefoneClinica} obrigatorio />
              <div className="text-[10px] text-gray-400 mt-1">Para onde a central liga ou escreve.</div>
            </div>
            <div>
              <Rotulo>{exigePaciente ? "Paciente (obrigatório)" : "Paciente (opcional)"}</Rotulo>
              <Campo
                name="pacienteNome"
                value={pacienteNome}
                onChange={(e) => setPacienteNome(e.target.value)}
                required={exigePaciente && mesmoPaciente !== false}
              />
              <div className="text-[10px] text-gray-400 mt-1">Vale para os serviços sem paciente informado na lista.</div>
            </div>
          </div>

          {equipe && equipe.profissionais.length > 0 && (
            <div className="max-w-sm">
              <Rotulo>Profissional (opcional)</Rotulo>
              <Selecao name="profissionalId" defaultValue="">
                <option value="">Alocar depois</option>
                {equipe.profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
              <div className="text-[10px] text-gray-400 mt-1">
                Se escolher agora, o agendamento já sai alocado. Sem escolher, vai para a fila &quot;Para alocar&quot;.
              </div>
            </div>
          )}

          <div>
            <Rotulo>Observações do procedimento</Rotulo>
            <Area name="observacoes" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {equipe && estado.ok && estado.avisos?.length ? (
            <Aviso tom="alerta">
              <div className="font-semibold mb-1">Agendamento criado.</div>
              {estado.avisos.join(" ")}
              <div className="mt-2">
                <Link href={estado.id ? `/painel/pedidos/${estado.id}` : "/painel/pedidos"} className="font-semibold underline">
                  Ver o agendamento →
                </Link>
              </div>
            </Aviso>
          ) : null}

          <BotaoDeEnvio desabilitado={!horaLivre || linhas.length === 0 || pacienteFaltando || (Boolean(equipe) && estado.ok)}>
            {equipe ? "Criar agendamento" : "Solicitar agendamento"}
          </BotaoDeEnvio>
          <div className="text-[10px] text-gray-400">
            {equipe
              ? "Já nasce confirmado: a clínica recebe a confirmação pelo WhatsApp."
              : "A central confirma a solicitação e avisa pelo WhatsApp."}
          </div>
        </div>
      </Etapa>
    </form>
  );
}

/** O envio não repete enquanto o servidor ainda responde (o duplo clique duplicava o agendamento). */
function BotaoDeEnvio({ desabilitado, children }: { desabilitado: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={desabilitado || pending}>
      {pending ? "Enviando…" : children}
    </Botao>
  );
}

type Modalidade = "PARTICULAR" | "CURSO";

type PropsDoFormulario = Parameters<typeof FormularioBase>[0];

/**
 * O agendamento, com a escolha entre particular e curso ANTES do serviço (ata
 * de 27/10). A opção só aparece para a clínica liberada para curso (que tem
 * tabela de curso); trocar de modalidade recomeça o formulário, porque o
 * catálogo e os preços são outros.
 */
export function FormularioAgendamento({
  curso,
  ...resto
}: Omit<PropsDoFormulario, "modalidade"> & {
  curso?: { grupos: Grupo[]; precosPorUf: Record<string, Record<string, number>> } | null;
}) {
  const [modalidade, setModalidade] = useState<Modalidade>("PARTICULAR");
  const emCurso = modalidade === "CURSO" && Boolean(curso);

  return (
    <div className="space-y-3">
      {curso && (
        <section className="max-w-4xl rounded-2xl border border-bordo/30 bg-white px-4 py-3">
          <h2 className="font-display font-bold text-sm text-bordo mb-2">Tipo de atendimento</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de atendimento">
            {(["PARTICULAR", "CURSO"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={modalidade === opcao}
                onClick={() => setModalidade(opcao)}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors ${
                  modalidade === opcao ? "border-bordo bg-bordo text-white" : "border-gray-200 bg-white text-gray-700 hover:border-bordo/40"
                }`}
              >
                {opcao === "PARTICULAR" ? "Atendimento particular" : "Curso"}
              </button>
            ))}
          </div>
          {emCurso && (
            <p className="mt-2 text-[10px] text-gray-500">
              Curso usa a tabela de preços e o catálogo próprios, e o nome do paciente é obrigatório.
            </p>
          )}
        </section>
      )}
      <FormularioBase
        key={emCurso ? "curso" : "particular"}
        modalidade={emCurso ? "CURSO" : "PARTICULAR"}
        {...resto}
        grupos={emCurso && curso ? curso.grupos : resto.grupos}
        precosPorUf={emCurso && curso ? curso.precosPorUf : resto.precosPorUf}
      />
    </div>
  );
}

/**
 * O valor da linha, editável pela equipe (pedido de 27/10): um agendamento que
 * foge da tabela — desconto combinado, valor aberto — se acerta na hora, sem
 * passar pela tela de valores depois. "usar o da tabela" desfaz.
 */
function ValorDaLinha({
  centavos,
  daTabela,
  editado,
  aoMudar,
}: {
  centavos: number;
  daTabela: boolean;
  editado: boolean;
  aoMudar: (valor: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  function confirmar() {
    setEditando(false);
    if (texto.trim() === "") return;
    aoMudar(lerCentavos(texto));
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">R$</span>
        <input
          autoFocus
          inputMode="decimal"
          aria-label="Valor do serviço"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmar();
            }
            if (e.key === "Escape") setEditando(false);
          }}
          className="w-24 rounded-lg border border-bordo/50 px-2 py-1 text-right text-xs"
        />
      </div>
    );
  }

  return (
    <div className="w-28 text-right">
      <button
        type="button"
        onClick={() => {
          setTexto(centavos > 0 ? (centavos / 100).toFixed(2).replace(".", ",") : "");
          setEditando(true);
        }}
        title="Alterar o valor deste serviço"
        className={`text-xs font-semibold hover:underline ${editado ? "text-amber-700" : "text-bordo"}`}
      >
        {centavos > 0 || editado ? formatarReais(centavos) : daTabela ? formatarReais(centavos) : "sob consulta"} ✏️
      </button>
      {editado && (
        <button type="button" onClick={() => aoMudar(null)} className="block w-full text-right text-[10px] text-gray-500 hover:underline">
          usar o da tabela
        </button>
      )}
    </div>
  );
}
