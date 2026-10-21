/**
 * PipeDrive.
 *
 * Por decisão do cliente (14/09), o PipeDrive continua sendo a fonte central
 * do histórico comercial. Na transição (ata de 21/10), todo agendamento vira
 * um negócio lá, com clínica e contato, para nada se perder. As
 * escritas são só estas: criar o negócio quando o pedido nasce (21/09,
 * "automatizar a criação de negócios entre as plataformas"), marcar como
 * GANHO quando o atendimento é realizado e PERDIDO quando é cancelado.
 *
 * O sistema só escreve; não lê de volta o que a equipe edita lá. Duas fontes
 * editáveis do mesmo dado divergem em semanas — a do agendamento é esta.
 *
 * A CONFIGURAR (Andre Miguel, ata de 21/09 — "criar funil de teste e
 * coletar as chaves de API"):
 *   PIPEDRIVE_API_TOKEN, PIPEDRIVE_DOMINIO — sem os dois, toda chamada vira
 *     um registro em SincronizacaoExterna e a operação segue sem travar.
 *     O domínio é o subdomínio da conta ("hemoderi-5c2c36"); o endereço
 *     inteiro também é aceito (lib/integracoes/pipedrive-url.ts).
 *   PIPEDRIVE_CAMPO_NUMERO_PEDIDO — a chave (hash) do campo personalizado
 *     onde o número do pedido deve entrar (pergunta 36 do questionário
 *     técnico). Sem ela, o número ainda aparece no TÍTULO do negócio — só
 *     não fica num campo pesquisável separado.
 *   Funil: o negócio nasce no funil "Dilon Saúde" (ata de 21/10), achado pelo
 *     nome, na primeira etapa. PIPEDRIVE_NOME_FUNIL troca o nome;
 *     PIPEDRIVE_ID_FUNIL / PIPEDRIVE_ID_ETAPA fixam os ids e vencem o nome.
 */

import { prisma } from "@/lib/prisma";
import { isoDeData } from "@/lib/data";
import {
  FUNIL_PADRAO,
  escolherFunil,
  primeiraEtapa,
  descreverErroPipedrive,
  mensagemDeHttpPipedrive,
  subdominioDoPipedrive,
  urlDaApiPipedrive,
} from "./pipedrive-url";

/** Sem resposta em 15 s, desiste: a criação do pedido não pode ficar esperando. */
const TEMPO_LIMITE_MS = 15_000;

export function pipedriveConfigurado(): boolean {
  return Boolean(process.env.PIPEDRIVE_API_TOKEN?.trim() && subdominioDoPipedrive(process.env.PIPEDRIVE_DOMINIO));
}
const configurado = pipedriveConfigurado;

function urlBase(caminho: string): string {
  return urlDaApiPipedrive(
    subdominioDoPipedrive(process.env.PIPEDRIVE_DOMINIO) ?? "",
    process.env.PIPEDRIVE_API_TOKEN ?? "",
    caminho
  );
}

async function chamar(caminho: string, metodo: "GET" | "POST" | "PUT", corpo?: unknown): Promise<unknown> {
  const resposta = await fetch(urlBase(caminho), {
    method: metodo,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    cache: "no-store",
  });
  const json = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(mensagemDeHttpPipedrive(resposta.status, json));
  return json;
}

type Funil = { pipelineId: number; stageId: number; descricao: string };

/** Por processo: o funil não muda de id entre um agendamento e outro. */
let funilEmCache: Funil | null = null;

/**
 * O funil e a etapa onde o negócio nasce: "Dilon Saúde" (ata de 21/10),
 * achado pelo nome. PIPEDRIVE_ID_FUNIL / PIPEDRIVE_ID_ETAPA, se existirem,
 * vencem o nome; PIPEDRIVE_NOME_FUNIL troca o nome procurado. Sem funil
 * encontrado é erro — negócio no funil errado é pior que pendência visível.
 */
async function resolverFunil(): Promise<Funil> {
  if (funilEmCache) return funilEmCache;

  const idFunilFixo = Number(process.env.PIPEDRIVE_ID_FUNIL) || null;
  const idEtapaFixa = Number(process.env.PIPEDRIVE_ID_ETAPA) || null;
  const nome = process.env.PIPEDRIVE_NOME_FUNIL?.trim() || FUNIL_PADRAO;

  const funis = ((await chamar("/pipelines", "GET")) as { data?: { id: number; name: string; active?: boolean }[] } | null)
    ?.data ?? [];
  const funil = idFunilFixo ? funis.find((f) => f.id === idFunilFixo) ?? null : escolherFunil(funis, nome);
  if (!funil) {
    const existentes = funis.map((f) => f.name).join(", ") || "nenhum";
    throw new Error(
      idFunilFixo
        ? `Funil ${idFunilFixo} (PIPEDRIVE_ID_FUNIL) não existe no PipeDrive. Funis: ${existentes}.`
        : `Funil "${nome}" não encontrado no PipeDrive. Funis: ${existentes}.`
    );
  }

  const etapas =
    ((await chamar(`/stages?pipeline_id=${funil.id}`, "GET")) as {
      data?: { id: number; name: string; order_nr?: number; active_flag?: boolean }[];
    } | null)?.data ?? [];
  const etapa = idEtapaFixa ? etapas.find((e) => e.id === idEtapaFixa) ?? null : primeiraEtapa(etapas);
  if (!etapa) throw new Error(`O funil "${funil.name}" não tem a etapa configurada.`);

  funilEmCache = { pipelineId: funil.id, stageId: etapa.id, descricao: `${funil.name} › ${etapa.name}` };
  return funilEmCache;
}

/**
 * Confere token, domínio e funil sem escrever nada. É o botão "testar
 * conexão" da tela de integrações.
 */
export async function testarConexao(): Promise<{ ok: true; descricao: string } | { ok: false; erro: string }> {
  if (!configurado()) {
    return { ok: false, erro: "Faltam PIPEDRIVE_API_TOKEN e/ou PIPEDRIVE_DOMINIO (só o subdomínio da conta)." };
  }
  try {
    const json = (await chamar("/users/me", "GET")) as {
      data?: { name?: string; company_name?: string; company_domain?: string };
    };
    const d = json.data ?? {};
    funilEmCache = null;
    const funil = await resolverFunil();
    return {
      ok: true,
      descricao: `Conectado como ${d.name ?? "?"} em ${d.company_name ?? "?"} (${d.company_domain ?? "?"}). Negócios nascem em: ${funil.descricao}.`,
    };
  } catch (erro) {
    return { ok: false, erro: descreverErroPipedrive(erro) };
  }
}

type ItemDeBusca = { data?: { items?: { item: { id: number; name?: string } }[] } } | null;

/** A organização da clínica: a que já existe com o mesmo nome, ou uma nova. */
async function organizacaoDaClinica(nome: string): Promise<number> {
  const busca = (await chamar(
    `/organizations/search?term=${encodeURIComponent(nome)}&fields=name&exact_match=true&limit=1`,
    "GET"
  )) as ItemDeBusca;
  const existente = busca?.data?.items?.[0]?.item.id;
  if (existente) return existente;
  const criada = (await chamar("/organizations", "POST", { name: nome })) as { data?: { id?: number } } | null;
  if (!criada?.data?.id) throw new Error("Resposta do PipeDrive sem id da organização.");
  return criada.data.id;
}

/** A pessoa de contato (o doutor do agendamento) dentro da organização. */
async function pessoaDeContato(nome: string, orgId: number, telefone: string | null): Promise<number> {
  const busca = (await chamar(
    `/persons/search?term=${encodeURIComponent(nome)}&fields=name&exact_match=true&organization_id=${orgId}&limit=1`,
    "GET"
  )) as ItemDeBusca;
  const existente = busca?.data?.items?.[0]?.item.id;
  if (existente) return existente;
  const criada = (await chamar("/persons", "POST", {
    name: nome,
    org_id: orgId,
    ...(telefone ? { phone: [{ value: telefone, primary: true, label: "work" }] } : {}),
  })) as { data?: { id?: number } } | null;
  if (!criada?.data?.id) throw new Error("Resposta do PipeDrive sem id da pessoa.");
  return criada.data.id;
}

/** Quem agendou vira dono do negócio, se tiver usuário no PipeDrive com o mesmo e-mail. */
async function usuarioPorEmail(email: string): Promise<number | null> {
  const json = (await chamar(`/users/find?term=${encodeURIComponent(email)}&search_by_email=1`, "GET")) as {
    data?: { id: number; email?: string; active_flag?: boolean }[] | null;
  } | null;
  const usuario = (json?.data ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase() && u.active_flag !== false);
  return usuario?.id ?? null;
}

async function registrarSincronizacao(
  pedidoId: string,
  acao: string,
  sucesso: boolean,
  referencia?: string,
  erro?: string
): Promise<void> {
  await prisma.sincronizacaoExterna.create({
    data: { sistema: "PIPEDRIVE", entidade: "Pedido", entidadeId: pedidoId, acao, sucesso, referencia, erro },
  });
}

/**
 * Cria o negócio no PipeDrive quando o pedido nasce no sistema.
 *
 * Todo agendamento vira um negócio no funil "Dilon Saúde" (ata de 21/10): na
 * transição, o André quer a mesma informação nos dois lugares para não perder
 * histórico. Vai com organização (a clínica), pessoa de contato (o doutor),
 * dono (quem agendou, se tiver usuário lá), valor e data do atendimento.
 *
 * Idempotente por `pipedriveNegocioId`: um pedido só ganha um negócio uma
 * vez. É side-effect de fora e nunca derruba a criação do pedido; contato e
 * dono são melhor esforço — se falharem, o negócio nasce sem eles.
 */
export async function criarNegocio(pedidoId: string): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      numero: true,
      data: true,
      horaInicio: true,
      quantidade: true,
      valorServicoCentavos: true,
      pipedriveNegocioId: true,
      doutorNome: true,
      contatoClinica: true,
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
      criadoPor: { select: { email: true } },
    },
  });
  if (!pedido || pedido.pipedriveNegocioId) return;

  // No padrão que a equipe já usa ao lançar à mão ("2026 3463 Amitat"), com o
  // serviço no fim para o negócio se explicar sozinho na lista.
  const titulo = `${pedido.data.getUTCFullYear()} ${pedido.numero} ${pedido.clinica.nome} — ${pedido.servico.nome}${pedido.quantidade > 1 ? ` × ${pedido.quantidade}` : ""}`;

  if (!configurado()) {
    await registrarSincronizacao(pedido.id, "criar-negocio", false, undefined, "Integração não configurada.");
    return;
  }

  try {
    const funil = await resolverFunil();

    const corpo: Record<string, unknown> = {
      title: titulo,
      value: pedido.valorServicoCentavos / 100,
      currency: "BRL",
      pipeline_id: funil.pipelineId,
      stage_id: funil.stageId,
      expected_close_date: isoDeData(pedido.data),
    };
    // Campos personalizados do PipeDrive são endereçados pela própria chave
    // hash no corpo do negócio — não existe um envelope "custom_fields": {}.
    const campoNumero = process.env.PIPEDRIVE_CAMPO_NUMERO_PEDIDO;
    if (campoNumero) corpo[campoNumero] = String(pedido.numero);

    try {
      const orgId = await organizacaoDaClinica(pedido.clinica.nome);
      corpo.org_id = orgId;
      if (pedido.doutorNome?.trim()) {
        corpo.person_id = await pessoaDeContato(pedido.doutorNome.trim(), orgId, pedido.contatoClinica);
      }
    } catch {
      // Sem organização/pessoa o negócio ainda nasce — o título já traz a clínica.
    }
    try {
      const dono = pedido.criadoPor?.email ? await usuarioPorEmail(pedido.criadoPor.email) : null;
      if (dono) corpo.user_id = dono;
    } catch {
      // Sem dono, fica com o dono do token.
    }

    const json = (await chamar("/deals", "POST", corpo)) as { data?: { id?: number } } | null;
    const negocioId = json?.data?.id;
    if (!negocioId) throw new Error("Resposta do PipeDrive sem id do negócio.");

    await prisma.pedido.update({ where: { id: pedido.id }, data: { pipedriveNegocioId: String(negocioId) } });
    await registrarSincronizacao(pedido.id, "criar-negocio", true, String(negocioId));
  } catch (erro) {
    await registrarSincronizacao(pedido.id, "criar-negocio", false, undefined, descreverErroPipedrive(erro));
  }
}

/**
 * Fecha o negócio: GANHO quando o atendimento é realizado (14/09), PERDIDO
 * quando é cancelado (21/10 — com os dados nos dois lugares, um cancelado que
 * ficasse aberto lá inflaria o funil).
 *
 * Se o negócio nunca chegou a nascer — a criação falhou, ou o pedido é
 * anterior à integração — cria agora antes de fechar. Era esta a "falha no
 * registro" da ata de 28/09: sem negócio, o fechamento saía em silêncio.
 * Agora, ou o negócio é criado e fechado, ou a lacuna fica gravada.
 */
async function fecharNegocio(pedidoId: string, desfecho: "won" | "lost", motivo?: string | null): Promise<void> {
  const acao = desfecho === "won" ? "marcar-ganho" : "marcar-perdido";
  let pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, pipedriveNegocioId: true },
  });
  if (!pedido) return;

  if (!pedido.pipedriveNegocioId && configurado()) {
    await criarNegocio(pedido.id);
    pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, pipedriveNegocioId: true },
    });
  }
  if (!pedido) return;

  if (!pedido.pipedriveNegocioId) {
    await registrarSincronizacao(
      pedido.id,
      acao,
      false,
      undefined,
      configurado() ? "Sem negócio no PipeDrive para fechar — a criação falhou." : "Integração não configurada."
    );
    return;
  }

  try {
    await chamar(`/deals/${pedido.pipedriveNegocioId}`, "PUT", {
      status: desfecho,
      ...(desfecho === "lost" && motivo ? { lost_reason: motivo.slice(0, 250) } : {}),
    });
    await registrarSincronizacao(pedido.id, acao, true, pedido.pipedriveNegocioId);
  } catch (erro) {
    await registrarSincronizacao(pedido.id, acao, false, pedido.pipedriveNegocioId, descreverErroPipedrive(erro));
  }
}

export async function marcarNegocioGanho(pedidoId: string): Promise<void> {
  await fecharNegocio(pedidoId, "won");
}

export async function marcarNegocioPerdido(pedidoId: string, motivo?: string | null): Promise<void> {
  await fecharNegocio(pedidoId, "lost", motivo);
}
