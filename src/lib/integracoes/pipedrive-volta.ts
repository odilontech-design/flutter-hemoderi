/**
 * Caminho de volta PipeDrive → sistema (20/11). O PipeDrive avisa (webhook)
 * que um negócio mudou; o sistema relê o negócio pela API — o aviso só diz
 * QUAL negócio, o conteúdo vem da fonte — e aplica no agendamento ligado a ele
 * as mudanças combinadas (regras em pipedrive-volta-regras.ts).
 *
 * O que a própria integração escreve volta como aviso "api" e é ignorado: sem
 * isso, cada envio do sistema voltaria como "mudança" dele mesmo. Cada mudança
 * aplicada fica na auditoria do agendamento; o que as travas seguram vira
 * pendência "volta-pipedrive" na tela de integrações, para alguém conferir.
 */

import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/sessao";
import { acharCampo, type CampoPipedrive } from "./pipedrive-campos";
import { camposDoPipedrive, chamarPipedrive, pipedriveConfigurado } from "./pipedrive";
import { decidirVolta, lerAvisoDoPipedrive, simOuNao, type NegocioLido } from "./pipedrive-volta-regras";
import { descreverErroPipedrive } from "./pipedrive-url";

export const ACAO_VOLTA = "volta-pipedrive";

/** O valor de um campo personalizado como texto (com o rótulo da opção, nos de lista). */
function textoDoCampo(campo: CampoPipedrive | undefined, negocio: Record<string, unknown>): string | null {
  if (!campo) return null;
  const bruto = negocio[campo.key];
  if (bruto === null || bruto === undefined || bruto === "") return null;
  if (campo.field_type === "enum" || campo.field_type === "set") {
    const id = Number(String(bruto).split(",")[0]);
    return campo.options?.find((o) => o.id === id)?.label ?? null;
  }
  return String(bruto);
}

function centavos(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** O que importa do negócio, lido pela API (formato v1, o mesmo que o sistema escreve). */
export async function lerNegocio(negocioId: string): Promise<NegocioLido | null> {
  const json = (await chamarPipedrive(`/deals/${negocioId}`, "GET")) as { data?: Record<string, unknown> | null } | null;
  const d = json?.data;
  if (!d) return null;
  const { negocio: campos } = await camposDoPipedrive();
  const repasse = acharCampo(campos, ["Pagamento do Profissional"]);
  return {
    valorCentavos: centavos(d.value),
    repasseCentavos: repasse ? centavos(d[repasse.key]) : null,
    profissional: textoDoCampo(acharCampo(campos, ["Profissional Hemoderi", "Profissional"]), d),
    paciente: textoDoCampo(acharCampo(campos, ["Nome do Paciente", "Paciente"]), d),
    pago: simOuNao(textoDoCampo(acharCampo(campos, ["Pagamento Realizado"]), d)),
  };
}

async function registrar(pedidoId: string, negocioId: string, sucesso: boolean, erro?: string) {
  await prisma.sincronizacaoExterna.create({
    data: { sistema: "PIPEDRIVE", entidade: "Pedido", entidadeId: pedidoId, acao: ACAO_VOLTA, sucesso, referencia: negocioId, erro },
  });
}

/**
 * Aplica no agendamento o que mudou no negócio. Devolve o que fez e o que
 * ficou para conferir; nunca lança (o webhook responde 200 de qualquer jeito).
 */
export async function aplicarNegocioNoSistema(negocioId: string): Promise<{ feitas: string[]; conflitos: string[]; ignorado?: string }> {
  const pedido = await prisma.pedido.findFirst({
    where: { pipedriveNegocioId: negocioId, apoioDeId: null },
    select: {
      id: true,
      valorServicoCentavos: true,
      valorRepasseCentavos: true,
      profissionalId: true,
      pacienteNome: true,
      pixPagoEm: true,
      cartaoPagoEm: true,
      pagoConfirmadoEm: true,
      faturaId: true,
      fatura: { select: { status: true } },
      profissional: { select: { nome: true } },
      repasse: { select: { id: true, status: true } },
      relatorio: { select: { id: true, pacienteNomeInformado: true, recebimento: true } },
    },
  });
  if (!pedido) return { feitas: [], conflitos: [], ignorado: "negócio sem agendamento no sistema" };

  try {
    const negocio = await lerNegocio(negocioId);
    if (!negocio) return { feitas: [], conflitos: [], ignorado: "o PipeDrive não devolveu o negócio" };

    const [pix, cartao, profissionais] = await Promise.all([
      prisma.cobrancaPix.count({ where: { OR: [{ pedidoId: pedido.id }, { pedidoIds: { has: pedido.id } }], status: { in: ["ATIVA", "CONCLUIDA"] } } }),
      prisma.cobrancaCartao.count({ where: { pedidoIds: { has: pedido.id }, status: { in: ["PENDENTE", "PAGA"] } } }),
      prisma.profissional.findMany({ select: { id: true, nome: true } }),
    ]);
    // Recebido no ato pelo profissional também é pago: o "Sim" que o sistema mandou não vira outra baixa.
    const pagoNoSistema = Boolean(pedido.pixPagoEm || pedido.cartaoPagoEm || pedido.fatura?.status === "PAGA" || pedido.relatorio?.recebimento === "TOTAL");
    const decisao = decidirVolta(
      negocio,
      {
        valorServicoCentavos: pedido.valorServicoCentavos,
        valorRepasseCentavos: pedido.valorRepasseCentavos,
        profissionalId: pedido.profissionalId,
        profissionalNome: pedido.profissional?.nome ?? null,
        paciente: pedido.relatorio?.pacienteNomeInformado ?? pedido.pacienteNome,
        pagoNoSistema,
        baixaPeloPipedrive: Boolean(pedido.pagoConfirmadoEm),
        cobrancaEmitida: pagoNoSistema || Boolean(pedido.faturaId) || pix > 0 || cartao > 0,
        repassePago: pedido.repasse?.status === "PAGO",
      },
      profissionais
    );

    if (decisao.feitas.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.pedido.update({
          where: { id: pedido.id },
          data: {
            ...(decisao.valorServicoCentavos !== undefined ? { valorServicoCentavos: decisao.valorServicoCentavos, valorManual: true } : {}),
            ...(decisao.valorRepasseCentavos !== undefined ? { valorRepasseCentavos: decisao.valorRepasseCentavos } : {}),
            ...(decisao.profissionalId ? { profissionalId: decisao.profissionalId } : {}),
            ...(decisao.paciente && !pedido.relatorio ? { pacienteNome: decisao.paciente } : {}),
            ...(decisao.baixa === true ? { pagoConfirmadoEm: new Date() } : decisao.baixa === false ? { pagoConfirmadoEm: null } : {}),
          },
        });
        if (decisao.paciente && pedido.relatorio) {
          await tx.relatorioAtendimento.update({ where: { id: pedido.relatorio.id }, data: { pacienteNomeInformado: decisao.paciente } });
        }
        if (pedido.repasse && (decisao.valorRepasseCentavos !== undefined || decisao.profissionalId)) {
          await tx.repasse.update({
            where: { id: pedido.repasse.id },
            data: {
              ...(decisao.valorRepasseCentavos !== undefined ? { valorCentavos: decisao.valorRepasseCentavos } : {}),
              ...(decisao.profissionalId ? { profissionalId: decisao.profissionalId } : {}),
            },
          });
        }
      });
      await registrarAuditoria(null, "Pedido", pedido.id, ACAO_VOLTA, `Alterado no PipeDrive (negócio ${negocioId}): ${decisao.feitas.join("; ")}`);
    }

    if (decisao.conflitos.length > 0) {
      await registrar(pedido.id, negocioId, false, `Alterado no PipeDrive, não aplicado: ${decisao.conflitos.join(" ")}`);
    } else if (decisao.feitas.length > 0) {
      await registrar(pedido.id, negocioId, true);
    }
    return { feitas: decisao.feitas, conflitos: decisao.conflitos };
  } catch (erro) {
    const mensagem = descreverErroPipedrive(erro);
    await registrar(pedido.id, negocioId, false, `Não consegui ler o negócio no PipeDrive: ${mensagem}`).catch(() => undefined);
    return { feitas: [], conflitos: [mensagem] };
  }
}

/** O aviso do webhook: só negócio, e só o que uma pessoa mexeu (não a própria integração). */
export async function processarAvisoDoPipedrive(corpo: unknown): Promise<string> {
  const aviso = lerAvisoDoPipedrive(corpo);
  if (!aviso.ehNegocio || !aviso.negocioId) return "ignorado: não é negócio";
  if (aviso.feitoPelaApi) return "ignorado: feito pela integração";
  if (!pipedriveConfigurado()) return "ignorado: PipeDrive não configurado";
  const r = await aplicarNegocioNoSistema(aviso.negocioId);
  return r.ignorado ? `ignorado: ${r.ignorado}` : `${r.feitas.length} mudança(s), ${r.conflitos.length} para conferir`;
}

export const USUARIO_DO_WEBHOOK = "hemoderi";

/**
 * Cadastra no PipeDrive o aviso de "negócio alterado" para o endereço do
 * sistema, com a senha de PIPEDRIVE_WEBHOOK_SENHA. Se já existe um para o
 * mesmo endereço, não duplica.
 */
export async function ativarCaminhoDeVolta(urlDoSistema: string): Promise<{ ok: boolean; mensagem: string }> {
  const senha = process.env.PIPEDRIVE_WEBHOOK_SENHA?.trim();
  if (!senha) return { ok: false, mensagem: "Falta PIPEDRIVE_WEBHOOK_SENHA na Vercel (uma senha que você inventa), com redeploy." };
  if (!pipedriveConfigurado()) return { ok: false, mensagem: "PipeDrive não configurado." };
  const endereco = `${urlDoSistema.replace(/\/$/, "")}/api/pipedrive/webhook`;
  try {
    const existentes = ((await chamarPipedrive("/webhooks", "GET")) as { data?: { id: number; subscription_url?: string; event_object?: string; is_active?: number | boolean }[] | null } | null)?.data ?? [];
    const igual = existentes.find((w) => w.subscription_url === endereco && w.event_object === "deal");
    if (igual) return { ok: true, mensagem: `Já estava ativo (aviso ${igual.id} → ${endereco}).` };
    const criado = (await chamarPipedrive("/webhooks", "POST", {
      subscription_url: endereco,
      event_action: "change",
      event_object: "deal",
      http_auth_user: USUARIO_DO_WEBHOOK,
      http_auth_password: senha,
      version: "2.0",
    })) as { data?: { id?: number } | null } | null;
    return { ok: true, mensagem: `Ativado: o PipeDrive avisa ${endereco} a cada negócio alterado (aviso ${criado?.data?.id ?? "?"}).` };
  } catch (erro) {
    return { ok: false, mensagem: descreverErroPipedrive(erro) };
  }
}

/**
 * O que veio do PipeDrive e as travas seguraram, ainda sem ninguém conferir:
 * vai para a tela Hoje do financeiro. Sai da lista quando alguém marca
 * "conferido" ou quando uma alteração posterior do mesmo negócio passa.
 */
export async function alteracoesDoPipedriveParaConferir(): Promise<
  { pedidoId: string; numero: number; clinica: string; data: Date; erro: string; desde: Date }[]
> {
  const tentativas = await prisma.sincronizacaoExterna.findMany({
    where: { sistema: "PIPEDRIVE", entidade: "Pedido", acao: ACAO_VOLTA, criadaEm: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
    orderBy: { criadaEm: "desc" },
    take: 300,
    select: { entidadeId: true, acao: true, sucesso: true, erro: true, criadaEm: true },
  });
  const ultima = new Map<string, (typeof tentativas)[number]>();
  for (const t of tentativas) if (!ultima.has(t.entidadeId)) ultima.set(t.entidadeId, t);
  const abertas = Array.from(ultima.values()).filter((t) => !t.sucesso);
  if (abertas.length === 0) return [];
  const pedidos = await prisma.pedido.findMany({
    where: { id: { in: abertas.map((t) => t.entidadeId) } },
    select: { id: true, numero: true, data: true, clinica: { select: { nome: true } } },
  });
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  return abertas.flatMap((t) => {
    const p = porId.get(t.entidadeId);
    return p ? [{ pedidoId: p.id, numero: p.numero, clinica: p.clinica.nome, data: p.data, erro: t.erro ?? "", desde: t.criadaEm }] : [];
  });
}

/** Marca como conferida a alteração do PipeDrive que as travas seguraram. */
export async function marcarAlteracaoConferida(pedidoId: string, usuarioId: string): Promise<void> {
  await prisma.sincronizacaoExterna.create({
    data: { sistema: "PIPEDRIVE", entidade: "Pedido", entidadeId: pedidoId, acao: ACAO_VOLTA, sucesso: true, erro: null },
  });
  await registrarAuditoria(usuarioId, "Pedido", pedidoId, `${ACAO_VOLTA}-conferido`, "Alteração do PipeDrive conferida à mão.");
}
