import { prisma } from "@/lib/prisma";
import { formatarData } from "@/lib/data";
import { numeroDoPedido } from "@/lib/numeracao";
import { montarAssertion, normalizarChave } from "@/lib/integracoes/google-api";
import type { TipoMensagem } from "@prisma/client";

/**
 * Notificações push dos apps (proposta do app, 04/11 e 16/11).
 *
 * O envio é pelo Firebase Cloud Messaging (FCM v1), que entrega no Android e,
 * com a chave do APNs cadastrada no Firebase, também no iPhone. Gratuito.
 *
 * Duas regras valem em tudo aqui:
 * 1. NUNCA lança. Push é um canal a mais; falhar não pode derrubar o
 *    agendamento, a alocação ou o relatório que o disparou.
 * 2. O texto não carrega dado sensível. A notificação aparece na tela de
 *    bloqueio: só serviço, dia e hora — sem endereço, doutor ou paciente.
 *
 * Variáveis (Vercel): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e
 * FIREBASE_PRIVATE_KEY (conta de serviço do projeto Firebase).
 */

const ESCOPO_FCM = "https://www.googleapis.com/auth/firebase.messaging";
const URL_TOKEN = "https://oauth2.googleapis.com/token";

export function pushConfigurado(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

export type MensagemPush = { titulo: string; corpo: string; /** Caminho dentro do app, aberto ao tocar. */ url: string };

/** O corpo que o FCM v1 espera. Puro, para ter teste. */
export function montarMensagemFcm(token: string, m: MensagemPush) {
  return {
    message: {
      token,
      notification: { title: m.titulo, body: m.corpo },
      data: { url: m.url },
      android: { priority: "HIGH" as const, notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
    },
  };
}

/** O FCM diz que o token não vale mais (app desinstalado, token trocado). */
export function tokenInvalidoNoFcm(status: number, corpo: string): boolean {
  if (status === 404) return true;
  return /UNREGISTERED|registration-token-not-registered|Requested entity was not found/i.test(corpo) ||
    (status === 400 && /INVALID_ARGUMENT/i.test(corpo) && /token/i.test(corpo));
}

let tokenEmCache: { valor: string; expiraEm: number } | null = null;

async function tokenDeAcesso(): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenEmCache && tokenEmCache.expiraEm > agora + 120) return tokenEmCache.valor;
  const assertion = montarAssertion(
    process.env.FIREBASE_CLIENT_EMAIL ?? "",
    normalizarChave(process.env.FIREBASE_PRIVATE_KEY ?? ""),
    agora,
    ESCOPO_FCM
  );
  const resposta = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const dados = (await resposta.json()) as { access_token?: string; error_description?: string };
  if (!resposta.ok || !dados.access_token) throw new Error(`Firebase recusou a conta de serviço: ${dados.error_description ?? resposta.status}`);
  tokenEmCache = { valor: dados.access_token, expiraEm: agora + 3600 };
  return dados.access_token;
}

/** Envia para todos os aparelhos dos usuários. Remove o que o FCM diz não existir mais. */
export async function enviarPushParaUsuarios(usuarioIds: string[], mensagem: MensagemPush): Promise<{ enviados: number; removidos: number }> {
  const resultado = { enviados: 0, removidos: 0 };
  try {
    if (!pushConfigurado() || usuarioIds.length === 0) return resultado;
    const aparelhos = await prisma.dispositivoPush.findMany({ where: { usuarioId: { in: usuarioIds } }, select: { id: true, token: true } });
    if (aparelhos.length === 0) return resultado;
    const acesso = await tokenDeAcesso();
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(process.env.FIREBASE_PROJECT_ID ?? "")}/messages:send`;
    for (const a of aparelhos) {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
        body: JSON.stringify(montarMensagemFcm(a.token, mensagem)),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        resultado.enviados++;
        continue;
      }
      const corpo = await r.text().catch(() => "");
      if (tokenInvalidoNoFcm(r.status, corpo)) {
        await prisma.dispositivoPush.delete({ where: { id: a.id } }).catch(() => undefined);
        resultado.removidos++;
      } else {
        console.error("push: FCM recusou", r.status, corpo.slice(0, 200));
      }
    }
  } catch (erro) {
    console.error("push", erro);
  }
  return resultado;
}

type DadosDoPush = { servico: string; data: Date; hora: string; codigo: string };

/**
 * O que cada tipo de mensagem vira em push, e para quem. Os tipos que são só
 * texto interno ou pedido manual da equipe não geram push.
 */
export function pushDoTipo(tipo: TipoMensagem, d: DadosDoPush, pedidoId: string): (MensagemPush & { para: "clinica" | "profissional" }) | null {
  const quando = `${formatarData(d.data)} às ${d.hora}`;
  switch (tipo) {
    case "CONFIRMACAO":
      return { para: "clinica", titulo: "Agendamento confirmado", corpo: `${d.servico}, ${quando}. Agendamento ${d.codigo}.`, url: `/portal/resumo/${pedidoId}` };
    case "ALOCACAO":
      return { para: "profissional", titulo: "Novo atendimento para você", corpo: `${d.servico}, ${quando}. Toque para aceitar ou recusar.`, url: "/profissional" };
    case "LEMBRETE":
      return { para: "clinica", titulo: "Lembrete de atendimento", corpo: `${d.servico} amanhã, ${quando}.`, url: `/portal/resumo/${pedidoId}` };
    case "LEMBRETE_CHEGADA":
      return { para: "profissional", titulo: "Registre sua chegada", corpo: `${d.servico} às ${d.hora}. Toque em "Cheguei" ao chegar.`, url: "/profissional" };
    case "COBRANCA_RELATORIO":
      return { para: "profissional", titulo: "Relatório pendente", corpo: `${d.servico} de ${formatarData(d.data)}. Envie o relatório para liberar o pagamento.`, url: "/profissional/relatorios" };
    case "RESULTADO":
      return { para: "clinica", titulo: "Atendimento finalizado", corpo: `${d.servico}, ${quando}. Obrigado!`, url: `/portal/resumo/${pedidoId}` };
    default:
      return null;
  }
}

/** Dispara o push que corresponde à mensagem de WhatsApp enfileirada. Nunca lança. */
export async function empurrarPorTipo(pedidoId: string, tipo: TipoMensagem): Promise<void> {
  try {
    if (!pushConfigurado()) return;
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { numero: true, data: true, horaInicio: true, clinicaId: true, profissionalId: true, servico: { select: { nome: true } } },
    });
    if (!pedido) return;
    const push = pushDoTipo(tipo, { servico: pedido.servico.nome, data: pedido.data, hora: pedido.horaInicio, codigo: numeroDoPedido(pedido.numero, pedido.data) }, pedidoId);
    if (!push) return;
    const usuarios =
      push.para === "profissional"
        ? pedido.profissionalId ? await prisma.usuario.findMany({ where: { profissionalId: pedido.profissionalId, desativadoEm: null }, select: { id: true } }) : []
        : await prisma.usuario.findMany({ where: { clinicaId: pedido.clinicaId, desativadoEm: null }, select: { id: true } });
    await enviarPushParaUsuarios(usuarios.map((u) => u.id), { titulo: push.titulo, corpo: push.corpo, url: push.url });
  } catch (erro) {
    console.error("push por tipo", erro);
  }
}

/** Aviso ao profissional (cancelamento, troca de horário): o mesmo texto do WhatsApp, curto. */
export async function empurrarAvisoAoProfissional(profissionalId: string, texto: string): Promise<void> {
  try {
    if (!pushConfigurado()) return;
    const usuarios = await prisma.usuario.findMany({ where: { profissionalId, desativadoEm: null }, select: { id: true } });
    await enviarPushParaUsuarios(usuarios.map((u) => u.id), { titulo: "Atendimento alterado", corpo: texto.replace(/^Olá, [^!]+!\s*/, "").slice(0, 160), url: "/profissional" });
  } catch (erro) {
    console.error("push aviso ao profissional", erro);
  }
}
