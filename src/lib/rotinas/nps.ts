import { prisma } from "@/lib/prisma";
import { hojeUTC, inicioDoDiaUTC, somarDias } from "@/lib/data";
import { JANELA_NPS_DIAS, elegivelParaNps } from "@/lib/nps";

/**
 * Gera a pesquisa de NPS de 60 em 60 dias (reunião de 14/09).
 *
 * Chamada pela própria rotina de mensagens (`/api/rotinas/mensagens`), que já
 * tem o único cron diário que o plano Hobby da Vercel permite — e também
 * exposta em `/api/rotinas/nps`, pronta para virar seu cron dedicado se a
 * operação migrar de plano. As janelas são calculadas, nunca guardadas como
 * "próxima data": cada clínica tem janelas de 60 dias consecutivas contadas
 * a partir do próprio cadastro (`criadaEm`), e a pesquisa mais recente diz
 * apenas até onde a clínica já foi coberta.
 *
 * Só entra quem NÃO teve múltiplos atendimentos na janela — decisão de
 * propósito: o volume de uso já é sinal de satisfação de quem atende toda
 * semana; o NPS mira em quem está esfriando, que é quem tem o que dizer.
 *
 * Idempotente por natureza, não por trava: se a janela não é elegível, a
 * rotina simplesmente não cria nada, e o cálculo do dia seguinte — baseado
 * só no tempo decorrido desde `criadaEm` — não reprocessa a mesma janela
 * duas vezes nem fica presa nela. A unicidade (clinicaId, janelaInicio) no
 * banco é só o cinto de segurança contra corrida entre duas execuções.
 */
export async function gerarPesquisasNps(): Promise<{ avaliadas: number; geradas: number }> {
  const hoje = hojeUTC();

  const clinicas = await prisma.clinica.findMany({
    where: { ativa: true },
    select: { id: true, criadaEm: true },
  });

  let avaliadas = 0;
  let geradas = 0;

  for (const clinica of clinicas) {
    const ancora = inicioDoDiaUTC(clinica.criadaEm);
    const diasDesdeCriacao = Math.floor((hoje.getTime() - ancora.getTime()) / 86_400_000);
    const periodosCompletos = Math.floor(diasDesdeCriacao / JANELA_NPS_DIAS);
    // Clínica ainda não completou nem a primeira janela de 60 dias.
    if (periodosCompletos < 1) continue;

    const janelaInicio = somarDias(ancora, (periodosCompletos - 1) * JANELA_NPS_DIAS);
    const janelaFim = somarDias(ancora, periodosCompletos * JANELA_NPS_DIAS);

    const jaExiste = await prisma.pesquisaNps.findUnique({
      where: { clinicaId_janelaInicio: { clinicaId: clinica.id, janelaInicio } },
      select: { id: true },
    });
    if (jaExiste) continue;

    avaliadas++;
    const atendimentosNoPeriodo = await prisma.pedido.count({
      where: { clinicaId: clinica.id, status: "REALIZADO", data: { gte: janelaInicio, lt: janelaFim } },
    });
    if (!elegivelParaNps(atendimentosNoPeriodo)) continue;

    try {
      await prisma.pesquisaNps.create({
        data: { clinicaId: clinica.id, janelaInicio, janelaFim, atendimentosNoPeriodo },
      });
      geradas++;
    } catch {
      // P2002 de uma corrida com outra execução da rotina no mesmo instante
      // — a pesquisa já existe, o resultado é o mesmo. Não é erro a tratar.
    }
  }

  return { avaliadas, geradas };
}
