import type { PerfilInterno } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ETAPAS, etapaPorChave } from "@/lib/esteira";
import { perfilPermite } from "@/lib/papeis";
import { contar, contarAgendamentos, type Aviso } from "@/lib/avisos";

const maisRecente = (datas: Date[]) => new Date(Math.max(...datas.map((d) => d.getTime()))).toISOString();

/**
 * O que o painel avisa a cada perfil da equipe.
 *
 *   • Nova solicitação de agendamento: para TODA a equipe — é o evento que
 *     abre a operação, e chega poucas vezes por dia. A marca é o `criadoEm`:
 *     mudar de etapa não é "nova solicitação".
 *   • Relatório recebido: para o pós-venda (e quem responde pela operação), que
 *     é quem confere. A marca é o `atualizadoEm` do pedido, que o envio e o
 *     REenvio de um relatório devolvido atualizam.
 *   • Chegou trabalho na fila de alocação: só para a logística, dona dela.
 */
export async function avisosDoPainel(perfil: PerfilInterno): Promise<Aviso[]> {
  const conferir = etapaPorChave("conferir")!;
  const alocar = ETAPAS.find((e) => e.dono === "LOGISTICA")!;
  const avisos: Aviso[] = [];

  const solicitados = await prisma.pedido.findMany({
    where: { status: "SOLICITADO" },
    select: { id: true, grupoId: true, criadoEm: true },
  });
  if (solicitados.length > 0) {
    const n = contarAgendamentos(solicitados);
    avisos.push({
      chave: "solicitacao",
      titulo: "Nova solicitação de agendamento",
      texto: `${contar(n, "agendamento aguarda", "agendamentos aguardam")} confirmação.`,
      href: "/painel/pedidos?filtro=triagem",
      rotuloLink: "Ver solicitações →",
      marca: maisRecente(solicitados.map((p) => p.criadoEm)),
    });
  }

  if (perfilPermite(perfil, "POS_VENDA")) {
    const relatorios = await prisma.pedido.findMany({
      where: conferir.onde,
      select: { atualizadoEm: true },
    });
    if (relatorios.length > 0) {
      avisos.push({
        chave: "relatorio",
        titulo: "Relatório recebido",
        texto: `${contar(relatorios.length, "relatório aguarda", "relatórios aguardam")} conferência.`,
        href: "/painel/pedidos?filtro=conferir",
        rotuloLink: "Conferir →",
        marca: maisRecente(relatorios.map((p) => p.atualizadoEm)),
      });
    }
  }

  if (perfil === "LOGISTICA") {
    const paraAlocar = await prisma.pedido.findMany({
      where: alocar.onde,
      select: { id: true, grupoId: true, atualizadoEm: true },
    });
    if (paraAlocar.length > 0) {
      const n = contarAgendamentos(paraAlocar);
      avisos.push({
        chave: "fila-alocar",
        titulo: "Chegou trabalho na sua fila",
        texto: `${contar(n, "agendamento", "agendamentos")} em ${alocar.rotulo}.`,
        href: `/painel/pedidos?filtro=${alocar.chave}`,
        rotuloLink: "Ver a fila →",
        marca: maisRecente(paraAlocar.map((p) => p.atualizadoEm)),
      });
    }
  }

  return avisos;
}

/**
 * O que o portal avisa ao profissional: atendimento novo esperando o aceite
 * dele e relatório que a central devolveu. Sem clínica nem endereço no texto —
 * o sigilo do local (lib/sigilo.ts) vale também para o pop-up.
 */
export async function avisosDoProfissional(profissionalId: string): Promise<Aviso[]> {
  const avisos: Aviso[] = [];

  const aguardandoAceite = await prisma.pedido.findMany({
    where: { profissionalId, status: "ALOCADO", aceitoEm: null },
    select: { id: true, grupoId: true, atualizadoEm: true },
  });
  if (aguardandoAceite.length > 0) {
    const n = contarAgendamentos(aguardandoAceite);
    avisos.push({
      chave: "alocacao",
      titulo: "Novo atendimento para você",
      texto: `${contar(n, "atendimento aguarda", "atendimentos aguardam")} o seu aceite.`,
      href: "/profissional",
      rotuloLink: "Ver e aceitar →",
      marca: maisRecente(aguardandoAceite.map((p) => p.atualizadoEm)),
    });
  }

  const devolvidos = await prisma.relatorioAtendimento.findMany({
    where: { profissionalId, aprovadoEm: null, devolvidoEm: { not: null } },
    select: { devolvidoEm: true },
  });
  if (devolvidos.length > 0) {
    avisos.push({
      chave: "relatorio-devolvido",
      titulo: "Relatório devolvido para correção",
      texto: `${contar(devolvidos.length, "relatório precisa", "relatórios precisam")} de ajuste.`,
      href: "/profissional/relatorios",
      rotuloLink: "Ver o que corrigir →",
      marca: maisRecente(devolvidos.map((r) => r.devolvidoEm!)),
    });
  }

  return avisos;
}
