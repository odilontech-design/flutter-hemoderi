process.env.GOOGLE_CLIENT_EMAIL = "conta-de-servico@exemplo.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY = "chave-falsa";

/**
 * Verificação da sincronização com o Google Agenda, contra o banco de
 * verdade e com o Google substituído por um transporte falso.
 *
 * Os testes de test/google-agenda.test.ts provam a DECISÃO (o que fazer);
 * este prova a EXECUÇÃO: que o id do evento e o id da agenda ficam gravados
 * no pedido, que reagendar atualiza em vez de criar um segundo, que trocar o
 * profissional apaga da agenda de quem saiu, que cancelar limpa tudo, e que
 * uma falha do Google não derruba a operação — só vira registro.
 *
 * O transporte é injetado, então nada aqui fala com a internet: dá para rodar
 * em máquina sem credencial do Google e em CI.
 *
 *   npm run fumaca:agenda
 *
 * ATENÇÃO: cria e apaga um pedido de teste, e mexe no googleAgendaId de dois
 * profissionais do seed (deixando-os nulos ao final). É para ambiente de
 * teste — nunca contra a base de produção da Hemoderi.
 */

import { PrismaClient } from "@prisma/client";
import { sincronizarEvento } from "../src/lib/integracoes/google-agenda";

const prisma = new PrismaClient();
let passos = 0, falhas = 0;
function ok(nome: string, condicao: boolean, extra = "") {
  passos++;
  if (condicao) console.log(`  ok  ${nome}`);
  else { falhas++; console.log(`FALHA ${nome} ${extra}`); }
}

const chamadas: string[] = [];
const eventos = new Map<string, string>(); // "agenda/evento" -> resumo
let proximo = 1;

const falso = {
  async criar(agendaId: string, evento: any) {
    const id = `ev-${proximo++}`;
    eventos.set(`${agendaId}/${id}`, evento.summary);
    chamadas.push(`criar ${agendaId} ${id}`);
    return id;
  },
  async atualizar(agendaId: string, eventoId: string, evento: any) {
    if (!eventos.has(`${agendaId}/${eventoId}`)) throw new Error("evento inexistente");
    eventos.set(`${agendaId}/${eventoId}`, evento.summary);
    chamadas.push(`atualizar ${agendaId} ${eventoId}`);
  },
  async apagar(agendaId: string, eventoId: string) {
    eventos.delete(`${agendaId}/${eventoId}`);
    chamadas.push(`apagar ${agendaId} ${eventoId}`);
  },
};

async function main() {
  const clinica = await prisma.clinica.findFirst({ where: { ativa: true } });
  const servico = await prisma.servico.findFirst({ where: { ativo: true } });
  const profs = await prisma.profissional.findMany({ where: { ativo: true }, take: 2 });
  if (!clinica || !servico || profs.length < 2) throw new Error("seed insuficiente");

  await prisma.profissional.update({ where: { id: profs[0].id }, data: { googleAgendaId: "ana@exemplo.com" } });
  await prisma.profissional.update({ where: { id: profs[1].id }, data: { googleAgendaId: "bruno@exemplo.com" } });

  const p = await prisma.parametros.update({ where: { id: "hemoderi" }, data: { proximoNumeroPedido: { increment: 1 } } });
  const data = new Date(); data.setUTCDate(data.getUTCDate() + 10); data.setUTCHours(0, 0, 0, 0);
  const pedido = await prisma.pedido.create({
    data: {
      numero: p.proximoNumeroPedido, clinicaId: clinica.id, servicoId: servico.id,
      profissionalId: profs[0].id, data, horaInicio: "14:00", duracaoMin: 60,
      status: "SOLICITADO", valorServicoCentavos: 10000,
    },
  });

  // 1. SOLICITADO não vai para agenda nenhuma
  await sincronizarEvento(pedido.id, falso, null);
  ok("solicitação não cria evento", chamadas.length === 0, chamadas.join(" | "));

  // 2. Confirmado cria na agenda do profissional
  await prisma.pedido.update({ where: { id: pedido.id }, data: { status: "CONFIRMADO" } });
  await sincronizarEvento(pedido.id, falso, null);
  let atual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
  ok("confirmar cria na agenda do profissional", chamadas[0] === "criar ana@exemplo.com ev-1", chamadas.join(" | "));
  ok("o pedido guarda evento e agenda", atual?.googleEventoId === "ev-1" && atual?.googleAgendaId === "ana@exemplo.com",
     `${atual?.googleEventoId} / ${atual?.googleAgendaId}`);

  // 3. Reagendar ATUALIZA, não cria um segundo
  const novaData = new Date(data); novaData.setUTCDate(novaData.getUTCDate() + 1);
  await prisma.pedido.update({ where: { id: pedido.id }, data: { data: novaData, horaInicio: "16:00" } });
  await sincronizarEvento(pedido.id, falso, null);
  ok("reagendar atualiza o mesmo evento", chamadas[1] === "atualizar ana@exemplo.com ev-1", chamadas.join(" | "));
  ok("não nasceu um segundo evento", eventos.size === 1, `${eventos.size}`);

  // 4. Trocar o profissional move de agenda
  await prisma.pedido.update({ where: { id: pedido.id }, data: { profissionalId: profs[1].id, status: "ALOCADO" } });
  await sincronizarEvento(pedido.id, falso, null);
  atual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
  ok("cria na agenda de quem entrou", chamadas[2] === "criar bruno@exemplo.com ev-2", chamadas.join(" | "));
  ok("apaga da agenda de quem saiu", chamadas[3] === "apagar ana@exemplo.com ev-1", chamadas.join(" | "));
  ok("só o novo evento sobrevive", eventos.size === 1 && eventos.has("bruno@exemplo.com/ev-2"), [...eventos.keys()].join(","));
  ok("pedido aponta para a agenda nova", atual?.googleAgendaId === "bruno@exemplo.com" && atual?.googleEventoId === "ev-2");

  // 5. Cancelar apaga
  await prisma.pedido.update({ where: { id: pedido.id }, data: { status: "CANCELADO" } });
  await sincronizarEvento(pedido.id, falso, null);
  atual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
  ok("cancelar apaga o evento", chamadas[4] === "apagar bruno@exemplo.com ev-2", chamadas.join(" | "));
  ok("nenhum evento sobra", eventos.size === 0);
  ok("pedido esquece evento e agenda", atual?.googleEventoId === null && atual?.googleAgendaId === null);

  // 6. Sincronizar de novo não faz nada
  const antes = chamadas.length;
  await sincronizarEvento(pedido.id, falso, null);
  ok("sincronizar cancelado de novo é inócuo", chamadas.length === antes);

  // 7. Falha do Google não derruba nada, e fica registrada
  await prisma.pedido.update({ where: { id: pedido.id }, data: { status: "CONFIRMADO" } });
  const quebrado = { ...falso, async criar() { throw new Error("HTTP 403: agenda não compartilhada"); } };
  await sincronizarEvento(pedido.id, quebrado as any, null);
  const falha = await prisma.sincronizacaoExterna.findFirst({
    where: { entidadeId: pedido.id, sucesso: false }, orderBy: { criadaEm: "desc" },
  });
  ok("falha do Google não lança", true);
  ok("falha fica registrada com a causa", !!falha?.erro?.includes("403"), falha?.erro ?? "(sem registro)");

  // 8. Sem agenda nenhuma configurada: não tenta nada
  await prisma.profissional.update({ where: { id: profs[1].id }, data: { googleAgendaId: null } });
  const antes2 = chamadas.length;
  await sincronizarEvento(pedido.id, falso, null);
  ok("sem agenda configurada não chama o Google", chamadas.length === antes2, chamadas.slice(antes2).join(" | "));

  // 9. Cai na agenda da operação quando há uma
  await sincronizarEvento(pedido.id, falso, "operacao@hemoderi.com.br");
  ok("usa a agenda da operação como reserva",
     chamadas[chamadas.length - 1]?.startsWith("criar operacao@hemoderi.com.br"), chamadas.join(" | "));

  // limpeza
  await prisma.sincronizacaoExterna.deleteMany({ where: { entidadeId: pedido.id } });
  await prisma.pedido.delete({ where: { id: pedido.id } });
  await prisma.profissional.update({ where: { id: profs[0].id }, data: { googleAgendaId: null } });
  await prisma.profissional.update({ where: { id: profs[1].id }, data: { googleAgendaId: null } });

  console.log(`\n${passos - falhas}/${passos} OK`);
  if (falhas) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
