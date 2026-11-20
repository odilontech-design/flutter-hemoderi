/**
 * PipeDrive.
 *
 * Por decisão do cliente (14/09), o PipeDrive continua sendo a fonte central
 * do histórico comercial até a migração completa (1º/01). Desde a ata de
 * 03/11 o negócio nasce SÓ depois que o pós-venda aprova o relatório, já como
 * GANHO, com o relatório em texto numa nota e os campos que a Stephanie
 * confere (paciente, profissional, procedimento, forma de pagamento e
 * recebimento do profissional). Cancelado só marca PERDIDO o negócio que já
 * existia (os criados antes dessa regra).
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
import { acharCampo, escolherOrganizacao, montarCamposPersonalizados, nucleoDoNome, numeroDoClienteNosTitulos, tituloNoPadraoDoCliente, type CampoPipedrive, type EspecificacaoDeCampo } from "./pipedrive-campos";
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

async function chamar(caminho: string, metodo: "GET" | "POST" | "PUT" | "DELETE", corpo?: unknown): Promise<unknown> {
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

/** Para o caminho de volta (pipedrive-volta.ts) ler o negócio e registrar o aviso. */
export const chamarPipedrive = chamar;

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


/** Os campos personalizados do PipeDrive (de negócio e de organização), guardados por 10 minutos. */
let camposEmCache: { negocio: CampoPipedrive[]; organizacao: CampoPipedrive[]; em: number } | null = null;

export async function camposDoPipedrive(): Promise<{ negocio: CampoPipedrive[]; organizacao: CampoPipedrive[] }> {
  if (camposEmCache && Date.now() - camposEmCache.em < 10 * 60 * 1000) return camposEmCache;
  const ler = async (caminho: string) =>
    (((await chamar(`${caminho}?limit=500`, "GET")) as { data?: CampoPipedrive[] | null } | null)?.data ?? []).map((c) => ({
      key: c.key,
      name: c.name,
      field_type: c.field_type,
      options: c.options,
    }));
  const [negocio, organizacao] = await Promise.all([ler("/dealFields"), ler("/organizationFields")]);
  camposEmCache = { negocio, organizacao, em: Date.now() };
  return camposEmCache;
}

/** Os campos do PipeDrive em texto, para a tela de integrações mostrar o que existe lá. */
export async function descreverCamposDoPipedrive(): Promise<string[]> {
  camposEmCache = null;
  const { negocio, organizacao } = await camposDoPipedrive();
  const linha = (c: CampoPipedrive) => `${c.name} [${c.field_type}${c.options?.length ? `, ${c.options.length} opções` : ""}]`;
  const proprios = (campos: CampoPipedrive[]) => campos.filter((c) => /^[0-9a-f]{40}$/.test(c.key));
  return [
    `Negócio — campos personalizados: ${proprios(negocio).map(linha).join(" · ") || "nenhum"}`,
    `Organização — campos personalizados: ${proprios(organizacao).map(linha).join(" · ") || "nenhum"}`,
  ];
}

type ItemDeBusca = { data?: { items?: { item: { id: number; name?: string } }[] } } | null;

/** Nomes pelos quais o campo "número do cliente" pode aparecer na organização. */
const NOMES_DO_NUMERO_DO_CLIENTE = ["Numero do cliente", "Numero cliente", "N do cliente", "Codigo do cliente", "Codigo cliente", "ID do cliente", "Numero", "Codigo", "Cliente numero"];

/**
 * O cliente do negócio: a organização que JÁ existe no PipeDrive (e o número
 * dela), nunca uma nova (17/11: cada negócio ganho criava um cliente
 * duplicado). Sem achar uma só organização com o nome da clínica, devolve
 * null e o negócio nasce sem cliente — a Stephanie preenche.
 */
type ClienteAchado = { orgId: number; numeroDoCliente: string | null; fonte: string };

/** O id de um campo de ligação do PipeDrive v1 (org_id/person_id vem como objeto {value, name}). */
function idDaLigacao(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const n = Number((v as { value?: unknown }).value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Onde achar o cliente, na ordem (18/11: negócios nascendo sem organização):
 *  1. o que o sistema já aprendeu para esta clínica;
 *  2. a organização de um negócio anterior da mesma clínica — se a Sthefany
 *     ligou à mão uma vez, os próximos seguem;
 *  3. a busca pelo nome (com duplicados, o original);
 *  4. a organização do doutor, se ele já é contato cadastrado lá.
 * O achado fica gravado na clínica. Nunca cria organização.
 */
async function acharOrganizacao(clinicaId: string, nomeDaClinica: string, doutor: string | null): Promise<{ orgId: number; fonte: string } | null> {
  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, select: { pipedriveOrganizacaoId: true } });
  const aprendido = Number(clinica?.pipedriveOrganizacaoId);
  if (Number.isInteger(aprendido) && aprendido > 0) return { orgId: aprendido, fonte: "já ligado a esta clínica" };

  const anteriores = await prisma.pedido.findMany({
    where: { clinicaId, apoioDeId: null, pipedriveNegocioId: { not: null } },
    orderBy: { atualizadoEm: "desc" },
    take: 4,
    select: { pipedriveNegocioId: true },
  });
  for (const a of anteriores) {
    try {
      const negocio = (await chamar(`/deals/${a.pipedriveNegocioId}`, "GET")) as { data?: { org_id?: unknown } } | null;
      const id = idDaLigacao(negocio?.data?.org_id);
      if (id) return { orgId: id, fonte: `negócio anterior ${a.pipedriveNegocioId}` };
    } catch {
      // negócio apagado ou arquivado: tenta o próximo
    }
  }

  const termos = Array.from(new Set([nomeDaClinica.trim(), nucleoDoNome(nomeDaClinica)].filter((t) => t.length >= 2)));
  const candidatas = new Map<number, { id: number; name: string }>();
  for (const termo of termos) {
    const busca = (await chamar(`/organizations/search?term=${encodeURIComponent(termo)}&fields=name&limit=20`, "GET")) as ItemDeBusca;
    for (const r of busca?.data?.items ?? []) candidatas.set(r.item.id, { id: r.item.id, name: r.item.name ?? "" });
  }
  const porNome = escolherOrganizacao(Array.from(candidatas.values()), nomeDaClinica);
  if (porNome) return { orgId: porNome, fonte: "nome da clínica" };

  const nomeDoDoutor = doutor?.trim();
  if (nomeDoDoutor && nomeDoDoutor.length >= 3) {
    const busca = (await chamar(`/persons/search?term=${encodeURIComponent(nomeDoDoutor)}&fields=name&exact_match=true&limit=10`, "GET")) as {
      data?: { items?: { item: { id: number; organization?: { id?: number } | null } }[] };
    } | null;
    const orgs = new Set((busca?.data?.items ?? []).map((r) => r.item.organization?.id).filter((x): x is number => Boolean(x)));
    if (orgs.size === 1) return { orgId: Array.from(orgs)[0], fonte: "organização do contato do doutor" };
  }
  return null;
}

async function clienteDoNegocio(clinicaId: string, nomeDaClinica: string, doutor: string | null): Promise<ClienteAchado | null> {
  const achado = await acharOrganizacao(clinicaId, nomeDaClinica, doutor);
  if (!achado) return null;
  const { orgId, fonte } = achado;
  await prisma.clinica.update({ where: { id: clinicaId }, data: { pipedriveOrganizacaoId: String(orgId) } }).catch(() => undefined);

  let numeroDoCliente: string | null = null;
  try {
    const chaveFixa = process.env.PIPEDRIVE_CAMPO_NUMERO_CLIENTE?.trim();
    const chave = chaveFixa || acharCampo((await camposDoPipedrive()).organizacao, NOMES_DO_NUMERO_DO_CLIENTE)?.key;
    if (chave) {
      const org = (await chamar(`/organizations/${orgId}`, "GET")) as { data?: Record<string, unknown> } | null;
      const valor = org?.data?.[chave];
      if (valor !== null && valor !== undefined && String(valor).trim()) numeroDoCliente = String(valor).trim();
    }
  } catch {
    // sem o número, o título usa o código do agendamento
  }
  // Sem campo de número na organização (hoje não há nenhum), o número é o que a
  // equipe escreve no título dos negócios da organização ("2026 4186 …"). O id
  // da organização NÃO é o número do cliente (18/11: Galavini é 2714, número 4186).
  if (!numeroDoCliente) numeroDoCliente = await numeroDoClienteDaOrganizacao(orgId, clinicaId).catch(() => null);
  return { orgId, numeroDoCliente, fonte };
}

/** O número do cliente nos títulos dos negócios que a organização já tem. */
async function numeroDoClienteDaOrganizacao(orgId: number, clinicaId: string): Promise<string | null> {
  const json = (await chamar(`/organizations/${orgId}/deals?status=all_not_deleted&limit=100`, "GET")) as { data?: { title?: string }[] | null } | null;
  const titulos = (json?.data ?? []).map((d) => d.title ?? "");
  const pedidos = await prisma.pedido.findMany({ where: { clinicaId }, select: { numero: true } });
  return numeroDoClienteNosTitulos(titulos, new Set([orgId, ...pedidos.map((p) => p.numero)]));
}

/**
 * A pessoa de contato (o doutor) só se já existir na organização: nada de
 * cadastro novo. Primeiro pelo nome exato; senão, se a organização tiver UM
 * contato só, é ele.
 */
async function pessoaExistente(nome: string | null, orgId: number): Promise<number | null> {
  if (nome?.trim()) {
    const busca = (await chamar(
      `/persons/search?term=${encodeURIComponent(nome.trim())}&fields=name&exact_match=true&organization_id=${orgId}&limit=1`,
      "GET"
    )) as ItemDeBusca;
    const id = busca?.data?.items?.[0]?.item.id;
    if (id) return id;
  }
  const contatos = (await chamar(`/organizations/${orgId}/persons?limit=2`, "GET").catch(() => null)) as { data?: { id: number }[] | null } | null;
  return contatos?.data?.length === 1 ? contatos.data[0].id : null;
}

/** Põe no corpo do negócio o cliente, o contato e o título no padrão; devolve o que achou. */
async function ligarCliente(
  corpo: Record<string, unknown>,
  p: { clinicaId: string; clinica: string; doutor: string | null; ano: number; numeroDoPedido: number }
): Promise<ClienteAchado | null> {
  const cliente = await clienteDoNegocio(p.clinicaId, p.clinica, p.doutor);
  if (!cliente) return null;
  corpo.org_id = cliente.orgId;
  corpo.title = tituloNoPadraoDoCliente({ ano: p.ano, numeroDoCliente: cliente.numeroDoCliente, numeroDoPedido: p.numeroDoPedido, clinica: p.clinica });
  const pessoa = await pessoaExistente(p.doutor, cliente.orgId).catch(() => null);
  if (pessoa) corpo.person_id = pessoa;
  return cliente;
}

/** Quem é dono de todos os negócios (pedido de 05/11): a Sthefany, ou quem a variável apontar. */
const DONO_PADRAO = "sthefany@hemoderi.com.br";
const NOME_PADRAO = "sthefany";
let donoEmCache: { chave: string; id: number } | null = null;

/**
 * O dono de todo negócio gerado pelo sistema. PIPEDRIVE_DONO_ID (o número do
 * usuário) vale direto; senão busca o usuário por PIPEDRIVE_DONO_EMAIL (padrão:
 * a Sthefany). Sem achar, o negócio nasce com o dono do token — nunca com quem
 * agendou, que era a regra antiga.
 */
export async function donoDosNegocios(): Promise<number | null> {
  const fixo = Number(process.env.PIPEDRIVE_DONO_ID?.trim());
  if (Number.isInteger(fixo) && fixo > 0) return fixo;
  const email = (process.env.PIPEDRIVE_DONO_EMAIL?.trim() || DONO_PADRAO).toLowerCase();
  const nome = (process.env.PIPEDRIVE_DONO_NOME?.trim() || NOME_PADRAO).toLowerCase();
  const chave = `${email}|${nome}`;
  if (donoEmCache?.chave === chave) return donoEmCache.id;
  const usuarios = await usuariosDoPipedrive();
  const id = escolherDono(usuarios, email, nome);
  if (id) donoEmCache = { chave, id };
  return id;
}

export type UsuarioPipedrive = { id: number; name?: string; email?: string; active_flag?: boolean };

/** Todos os usuários da conta do PipeDrive. */
export async function usuariosDoPipedrive(): Promise<UsuarioPipedrive[]> {
  const json = (await chamar("/users", "GET")) as { data?: UsuarioPipedrive[] | null } | null;
  return json?.data ?? [];
}

/**
 * O e-mail exato vale primeiro. Se o e-mail dela no PipeDrive for outro, o
 * nome decide — mas só quando há UM usuário ativo com aquele nome: dois
 * "Sthefany" é ambiguidade, e adivinhar o dono errado é pior que avisar.
 */
export function escolherDono(usuarios: UsuarioPipedrive[], email: string, nome: string): number | null {
  const ativos = usuarios.filter((u) => u.active_flag !== false);
  const porEmail = ativos.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (porEmail) return porEmail.id;
  const porNome = ativos.filter((u) => u.name?.toLowerCase().includes(nome.toLowerCase()));
  return porNome.length === 1 ? porNome[0].id : null;
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
      clinicaId: true,
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
      // Só o cliente que já existe no PipeDrive (17/11); sem ele, fica em branco.
      await ligarCliente(corpo, { clinicaId: pedido.clinicaId, clinica: pedido.clinica.nome, doutor: pedido.doutorNome, ano: pedido.data.getUTCFullYear(), numeroDoPedido: pedido.numero });
    } catch {
      // Sem cliente o negócio ainda nasce — o título já traz a clínica.
    }
    try {
      const dono = await donoDosNegocios();
      if (dono) corpo.user_id = dono;
    } catch {
      // Sem achar a Sthefany no PipeDrive, fica com o dono do token.
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
    select: { id: true, pipedriveNegocioId: true, apoioDeId: true },
  });
  // Profissional adicional não é venda: não tem negócio no PipeDrive.
  if (!pedido || pedido.apoioDeId) return;

  // Cancelado sem negócio não cria nada (ata de 03/11): o negócio só nasce
  // na aprovação do relatório.
  if (!pedido.pipedriveNegocioId && desfecho === "lost") return;
  if (!pedido.pipedriveNegocioId && configurado()) {
    await criarNegocio(pedido.id);
    pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, pipedriveNegocioId: true, apoioDeId: true },
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
    const dono = await donoDosNegocios().catch(() => null);
    await chamar(`/deals/${pedido.pipedriveNegocioId}`, "PUT", {
      ...(dono ? { user_id: dono } : {}),
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

// ─── Negócio após a aprovação do relatório (ata de 03/11) ────────────────────

/** Palavras que não entram no nome do negócio (ata de 03/11). */
const FORA_DO_TITULO = /\b(instituto|light\s*touch|litetouch|remo[cç][aã]o de lentes)\b/gi;

/**
 * "2026-0073 - Dra. Maria Gabriela - Daimed": ano, número, doutor e clínica — o
 * padrão que a equipe lança à mão, sem "instituto" nem o nome do serviço.
 * Quando a clínica tem o nome do próprio doutor, ele não se repete.
 */
export function tituloDoNegocio(d: { ano: number; numero: number; doutor: string | null; clinica: string }): string {
  const limpar = (t: string) => t.replace(FORA_DO_TITULO, " ").replace(/\s+/g, " ").trim();
  const doutor = limpar(d.doutor ?? "");
  const clinica = limpar(d.clinica);
  const normal = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/^(dr|dra)\.?\s+/i, "")
      .toLowerCase();
  // Mesmo padrão do código na tela (04/11): "2026-0055 - Doutor - Clínica".
  const partes = [`${d.ano}-${String(d.numero).padStart(4, "0")}`, doutor];
  if (clinica && (!doutor || !normal(clinica).includes(normal(doutor)))) partes.push(clinica);
  return partes.filter(Boolean).join(" - ");
}

/** O que o profissional declarou ter recebido no atendimento, em texto. */
export function situacaoDoRecebimento(recebimento: string | null | undefined, compareceu: boolean): string {
  if (!compareceu) return "Paciente não compareceu";
  if (recebimento === "TOTAL") return "Recebeu o valor total";
  if (recebimento === "PARCIAL") return "Recebeu parte do valor";
  if (recebimento) return "Não recebeu";
  return "Não informado";
}

/**
 * Cria (ou completa, se for de antes da regra nova) o negócio do atendimento
 * aprovado: GANHO, com título no padrão, campos personalizados e o relatório
 * em texto numa nota. Nunca lança.
 */
export async function registrarNegocioAprovado(pedidoId: string, textoDoRelatorio: string | null): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      numero: true,
      data: true,
      valorServicoCentavos: true,
      valorRepasseCentavos: true,
      pipedriveNegocioId: true,
      clinicaId: true,
      doutorNome: true,
      pacienteNome: true,
      procedimentoPaciente: true,
      formaPagamento: true,
      contatoClinica: true,
      clinica: { select: { nome: true, uf: true, perfis: true } },
      endereco: { select: { uf: true } },
      servico: { select: { nome: true } },
      pixPagoEm: true,
      cartaoPagoEm: true,
      pagoConfirmadoEm: true,
      profissional: { select: { nome: true } },
      criadoPor: { select: { email: true } },
      relatorio: { select: { compareceu: true, recebimento: true, pacienteNomeInformado: true, doutorNomeInformado: true, procedimentoInformado: true } },
      apoioDeId: true,
    },
  });
  // Profissional adicional não é venda: o negócio é o do atendimento principal.
  if (!pedido || pedido.apoioDeId) return;
  if (!configurado()) {
    await registrarSincronizacao(pedido.id, "negocio-aprovado", false, undefined, "Integração não configurada.");
    return;
  }

  const doutor = pedido.relatorio?.doutorNomeInformado ?? pedido.doutorNome;
  const corpo: Record<string, unknown> = {
    title: tituloDoNegocio({ ano: pedido.data.getUTCFullYear(), numero: pedido.numero, doutor, clinica: pedido.clinica.nome }),
    value: pedido.valorServicoCentavos / 100,
    currency: "BRL",
    status: "won",
    expected_close_date: isoDeData(pedido.data),
  };
  // Campos personalizados: achados pelo NOME que a equipe vê no PipeDrive (17/11:
  // antes dependiam de chaves em variáveis de ambiente que não existiam e os
  // negócios nasciam vazios). Uma variável com a chave ainda vence a busca.
  const pago = Boolean(pedido.pixPagoEm || pedido.cartaoPagoEm || pedido.pagoConfirmadoEm || pedido.relatorio?.recebimento === "TOTAL");
  const especificacoes: EspecificacaoDeCampo[] = [
    { nomes: ["Numero do pedido", "Numero do agendamento"], chaveFixa: process.env.PIPEDRIVE_CAMPO_NUMERO_PEDIDO, valor: String(pedido.numero) },
    { nomes: ["Nome do Paciente", "Paciente"], chaveFixa: process.env.PIPEDRIVE_CAMPO_PACIENTE, valor: pedido.relatorio?.pacienteNomeInformado ?? pedido.pacienteNome },
    { nomes: ["Profissional Hemoderi", "Profissional"], chaveFixa: process.env.PIPEDRIVE_CAMPO_PROFISSIONAL, valor: pedido.profissional?.nome },
    { nomes: ["Procedimento Realizado", "Procedimento"], chaveFixa: process.env.PIPEDRIVE_CAMPO_PROCEDIMENTO, valor: pedido.relatorio?.procedimentoInformado ?? pedido.procedimentoPaciente },
    { nomes: ["Forma de Pagamento"], chaveFixa: process.env.PIPEDRIVE_CAMPO_FORMA_PAGAMENTO, valor: pedido.formaPagamento },
    { nomes: ["Pagamento Realizado"], chaveFixa: process.env.PIPEDRIVE_CAMPO_PAGAMENTO_REALIZADO, valor: pago ? "Sim" : "Não" },
    { nomes: ["Produto Hemoderi", "Produto"], chaveFixa: process.env.PIPEDRIVE_CAMPO_PRODUTO, valor: pedido.servico.nome },
    { nomes: ["Data do Procedimento"], chaveFixa: process.env.PIPEDRIVE_CAMPO_DATA_PROCEDIMENTO, valor: isoDeData(pedido.data) },
    { nomes: ["Estado", "UF"], chaveFixa: process.env.PIPEDRIVE_CAMPO_ESTADO, valor: pedido.endereco?.uf ?? pedido.clinica.uf },
    // No PipeDrive este campo é de dinheiro: o valor que o profissional recebe.
    { nomes: ["Pagamento do Profissional"], valor: pedido.valorRepasseCentavos / 100 },
  ];
  try {
    const { negocio: camposDoNegocio } = await camposDoPipedrive();
    Object.assign(corpo, montarCamposPersonalizados(camposDoNegocio, especificacoes));
  } catch {
    // Sem ler os campos, só as chaves fixas valem; o relatório na nota continua.
    Object.assign(corpo, montarCamposPersonalizados([], especificacoes));
  }
  // O cliente que já existe no PipeDrive, com o número dele no título (17/11).
  try {
    await ligarCliente(corpo, { clinicaId: pedido.clinicaId, clinica: pedido.clinica.nome, doutor, ano: pedido.data.getUTCFullYear(), numeroDoPedido: pedido.numero });
  } catch {
    // Sem cliente, o negócio nasce em branco nesse campo e a Stephanie preenche.
  }

  try {
    let negocioId = pedido.pipedriveNegocioId;
    if (negocioId) {
      // Negócio que já existia (criado antes da regra): passa para o dono certo.
      const dono = await donoDosNegocios().catch(() => null);
      await chamar(`/deals/${negocioId}`, "PUT", { ...(dono ? { user_id: dono } : {}), ...corpo });
    } else {
      const funil = await resolverFunil();
      Object.assign(corpo, { pipeline_id: funil.pipelineId, stage_id: funil.stageId });
      try {
        const dono = await donoDosNegocios();
        if (dono) corpo.user_id = dono;
      } catch {
        // Sem achar a Sthefany no PipeDrive, fica com o dono do token.
      }
      const json = (await chamar("/deals", "POST", corpo)) as { data?: { id?: number } } | null;
      if (!json?.data?.id) throw new Error("Resposta do PipeDrive sem id do negócio.");
      negocioId = String(json.data.id);
      await prisma.pedido.update({ where: { id: pedido.id }, data: { pipedriveNegocioId: negocioId } });
    }
    if (textoDoRelatorio) {
      // Nota em texto (ata de 03/11): quebra de linha vira <br>, que é o que o PipeDrive mostra.
      const conteudo = textoDoRelatorio.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
      await chamar("/notes", "POST", { deal_id: Number(negocioId), content: conteudo });
    }
    await registrarSincronizacao(pedido.id, "negocio-aprovado", true, negocioId);
  } catch (erro) {
    await registrarSincronizacao(pedido.id, "negocio-aprovado", false, pedido.pipedriveNegocioId ?? undefined, descreverErroPipedrive(erro));
  }
}

/**
 * Passa para o dono certo (a Sthefany) os negócios que já existem no PipeDrive
 * e foram criados em nome de quem agendou. Em lotes, do mais antigo ao mais
 * novo; `reatribuidoEm` não existe — o PUT é idempotente, e `a partir` marca
 * de onde continuar.
 */
export async function reatribuirNegocios(limite = 40, aPartirDe?: string): Promise<{ feitos: number; falhas: string[]; ultimo: string | null; restam: number }> {
  if (!configurado()) return { feitos: 0, falhas: ["PipeDrive não configurado."], ultimo: null, restam: 0 };
  const dono = await donoDosNegocios();
  if (!dono) return { feitos: 0, falhas: ["Não achei o usuário da Sthefany no PipeDrive (confira o e-mail em PIPEDRIVE_DONO_EMAIL)."], ultimo: null, restam: 0 };
  const pedidos = await prisma.pedido.findMany({
    where: { apoioDeId: null, pipedriveNegocioId: { not: null }, ...(aPartirDe ? { numero: { gt: Number(aPartirDe) } } : {}) },
    orderBy: { numero: "asc" },
    take: limite,
    select: { id: true, numero: true, pipedriveNegocioId: true },
  });
  let feitos = 0;
  const falhas: string[] = [];
  for (const p of pedidos) {
    try {
      await chamar(`/deals/${p.pipedriveNegocioId}`, "PUT", { user_id: dono });
      feitos++;
    } catch (erro) {
      falhas.push(`nº ${p.numero}: ${descreverErroPipedrive(erro)}`);
    }
  }
  const ultimo = pedidos.at(-1)?.numero ?? null;
  const restam = ultimo
    ? await prisma.pedido.count({ where: { apoioDeId: null, pipedriveNegocioId: { not: null }, numero: { gt: ultimo } } })
    : 0;
  return { feitos, falhas, ultimo: ultimo ? String(ultimo) : null, restam };
}


/**
 * Apaga no PipeDrive os negócios nascidos de agendamentos de CLÍNICA DE TESTE
 * (reunião de 16/11: limpar o que o André criou ao testar). Só mexe em pedidos
 * de clínica marcada como conta de teste; o negócio sai do PipeDrive e o pedido
 * perde o vínculo, mas continua no sistema. Em lotes; 404 conta como feito.
 */
export async function apagarNegociosDeTeste(limite = 30): Promise<{ feitos: number; falhas: string[]; restam: number }> {
  if (!configurado()) return { feitos: 0, falhas: ["PipeDrive não configurado."], restam: 0 };
  const filtro = { pipedriveNegocioId: { not: null }, clinica: { contaDeTeste: true } };
  const pedidos = await prisma.pedido.findMany({ where: filtro, orderBy: { numero: "asc" }, take: limite, select: { id: true, numero: true, pipedriveNegocioId: true } });
  let feitos = 0;
  const falhas: string[] = [];
  for (const p of pedidos) {
    try {
      try {
        await chamar(`/deals/${p.pipedriveNegocioId}`, "DELETE");
      } catch (erro) {
        if (!/404/.test(erro instanceof Error ? erro.message : "")) throw erro;
      }
      await prisma.pedido.update({ where: { id: p.id }, data: { pipedriveNegocioId: null } });
      feitos++;
    } catch (erro) {
      falhas.push(`nº ${p.numero}: ${descreverErroPipedrive(erro)}`);
    }
  }
  const restam = Math.max(0, (await prisma.pedido.count({ where: filtro })) - falhas.length);
  return { feitos, falhas, restam };
}


/**
 * Completa o cliente dos negócios que já nasceram sem organização (18/11).
 * Só mexe no negócio SEM organização: o que a Sthefany já ligou à mão fica
 * como está (e ensina o sistema qual é o cliente daquela clínica). Nunca cria
 * organização nem contato. Em lotes, do agendamento mais novo para o mais
 * antigo; `antesDe` marca de onde continuar.
 */
export async function completarClientesDosNegocios(
  limite = 15,
  antesDe?: number
): Promise<{ ligados: number; jaTinham: number; titulosCorrigidos: number; semCliente: string[]; falhas: string[]; ultimo: number | null; restam: number }> {
  const vazio = { ligados: 0, jaTinham: 0, titulosCorrigidos: 0, semCliente: [], falhas: [], ultimo: null, restam: 0 };
  if (!configurado()) return { ...vazio, falhas: ["PipeDrive não configurado."] };
  const filtro = {
    apoioDeId: null,
    pipedriveNegocioId: { not: null },
    clinica: { contaDeTeste: false },
    criadoEm: { gte: new Date("2026-10-01T00:00:00Z") },
  };
  const pedidos = await prisma.pedido.findMany({
    where: { ...filtro, ...(antesDe ? { numero: { lt: antesDe } } : {}) },
    orderBy: { numero: "desc" },
    take: limite,
    select: {
      numero: true,
      data: true,
      clinicaId: true,
      pipedriveNegocioId: true,
      doutorNome: true,
      clinica: { select: { nome: true, pipedriveOrganizacaoId: true } },
      relatorio: { select: { doutorNomeInformado: true } },
    },
  });
  let ligados = 0;
  let jaTinham = 0;
  let titulosCorrigidos = 0;
  const semCliente: string[] = [];
  const falhas: string[] = [];
  for (const p of pedidos) {
    try {
      const negocio = (await chamar(`/deals/${p.pipedriveNegocioId}`, "GET")) as { data?: { org_id?: unknown; person_id?: unknown; title?: string } } | null;
      const orgAtual = idDaLigacao(negocio?.data?.org_id);
      if (orgAtual) {
        jaTinham++;
        if (!p.clinica.pipedriveOrganizacaoId) {
          await prisma.clinica.update({ where: { id: p.clinicaId }, data: { pipedriveOrganizacaoId: String(orgAtual) } });
        }
        // Título que o sistema montou com o id da organização no lugar do número
        // do cliente (0.39.2–0.39.5): refaz com o número certo, ou o código do agendamento.
        const ano = p.data.getUTCFullYear();
        if ((negocio?.data?.title ?? "").startsWith(`${ano} ${orgAtual} `)) {
          const numeroDoCliente = await numeroDoClienteDaOrganizacao(orgAtual, p.clinicaId).catch(() => null);
          const title = tituloNoPadraoDoCliente({ ano, numeroDoCliente, numeroDoPedido: p.numero, clinica: p.clinica.nome });
          await chamar(`/deals/${p.pipedriveNegocioId}`, "PUT", { title });
          titulosCorrigidos++;
        }
        continue;
      }
      const corpo: Record<string, unknown> = {};
      const doutor = p.relatorio?.doutorNomeInformado ?? p.doutorNome;
      const cliente = await ligarCliente(corpo, { clinicaId: p.clinicaId, clinica: p.clinica.nome, doutor, ano: p.data.getUTCFullYear(), numeroDoPedido: p.numero });
      if (!cliente) {
        semCliente.push(`nº ${p.numero} (${p.clinica.nome})`);
        continue;
      }
      if (idDaLigacao(negocio?.data?.person_id)) delete corpo.person_id;
      await chamar(`/deals/${p.pipedriveNegocioId}`, "PUT", corpo);
      ligados++;
    } catch (erro) {
      falhas.push(`nº ${p.numero}: ${descreverErroPipedrive(erro)}`);
    }
  }
  const ultimo = pedidos.at(-1)?.numero ?? null;
  const restam = ultimo ? await prisma.pedido.count({ where: { ...filtro, numero: { lt: ultimo } } }) : 0;
  return { ligados, jaTinham, titulosCorrigidos, semCliente, falhas, ultimo, restam };
}

/**
 * O negócio de um agendamento como está no PipeDrive agora, em texto: título,
 * situação, dono, cliente e cada campo personalizado preenchido (com o rótulo
 * da opção, não o id). Para quem não tem acesso ao PipeDrive conferir o que o
 * sistema mandou. Só leitura.
 */
export async function descreverNegocioDoPedido(numeroDoPedido: number): Promise<string[]> {
  const pedido = await prisma.pedido.findUnique({
    where: { numero: numeroDoPedido },
    select: { pipedriveNegocioId: true, clinicaId: true, doutorNome: true, clinica: { select: { nome: true } } },
  });
  if (!pedido) return [`Não há agendamento nº ${numeroDoPedido}.`];
  if (!pedido.pipedriveNegocioId) return [`O agendamento nº ${numeroDoPedido} ainda não tem negócio no PipeDrive.`];
  const json = (await chamar(`/deals/${pedido.pipedriveNegocioId}`, "GET")) as { data?: Record<string, unknown> } | null;
  const d = json?.data;
  if (!d) return [`O PipeDrive não devolveu o negócio ${pedido.pipedriveNegocioId}.`];
  const nome = (v: unknown): string => {
    if (v && typeof v === "object") {
      const o = v as { name?: string; value?: number };
      return o.name ? `${o.name}${o.value ? ` (id ${o.value})` : ""}` : String(o.value ?? "");
    }
    return v ? String(v) : "em branco";
  };
  const { negocio } = await camposDoPipedrive();
  const campos: string[] = [];
  for (const c of negocio) {
    if (!/^[0-9a-f]{40}$/.test(c.key)) continue;
    const bruto = d[c.key];
    if (bruto === null || bruto === undefined || bruto === "") {
      campos.push(`${c.name}: em branco`);
      continue;
    }
    if (c.field_type === "enum" || c.field_type === "set") {
      const ids = String(bruto).split(",").map((x) => Number(x.trim()));
      const rotulos = ids.map((id) => c.options?.find((o) => o.id === id)?.label ?? `opção ${id}`);
      campos.push(`${c.name}: ${rotulos.join(", ")}`);
    } else {
      campos.push(`${c.name}: ${String(bruto)}`);
    }
  }
  return [
    `Negócio ${pedido.pipedriveNegocioId} — título: ${String(d.title ?? "")}`,
    `Situação: ${String(d.status ?? "")} · valor: ${String(d.value ?? "")} · dono: ${nome(d.user_id)}`,
    `Cliente (organização): ${nome(d.org_id)} · Pessoa de contato: ${nome(d.person_id)}`,
    await (async () => {
      try {
        const achado = await acharOrganizacao(pedido.clinicaId, pedido.clinica.nome, pedido.doutorNome);
        return achado
          ? `Cliente que o sistema liga para "${pedido.clinica.nome}": organização ${achado.orgId} (achada por: ${achado.fonte}) · número do cliente nos títulos: ${(await numeroDoClienteDaOrganizacao(achado.orgId, pedido.clinicaId).catch(() => null)) ?? "nenhum"}`
          : `O sistema NÃO acha cliente para "${pedido.clinica.nome}" no PipeDrive — ligue à mão uma vez e os próximos seguem.`;
      } catch (erro) {
        return `Busca do cliente falhou: ${descreverErroPipedrive(erro)}`;
      }
    })(),
    ...campos,
  ];
}
