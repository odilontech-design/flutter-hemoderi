import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { inicioDe } from "@/lib/papeis";

export const dynamic = "force-dynamic";

/**
 * Destino do link e do QR Code de divulgação.
 *
 * Não é uma página: é um desvio. Confere que a clínica existe e está ativa,
 * e manda para o lugar certo conforme quem está do outro lado — a própria
 * clínica vai para o agendamento, quem não está logado passa pelo login e
 * volta para lá.
 */
export default async function EntradaDaClinica({ params }: { params: { slug: string } }) {
  const clinica = await prisma.clinica.findUnique({
    where: { slug: params.slug },
    select: { id: true, ativa: true },
  });

  // Slug desconhecido ou clínica desativada caem no login sem dizer qual dos
  // dois é: um QR antigo não deve servir para descobrir a carteira de
  // clientes da Hemoderi.
  if (!clinica?.ativa) redirect("/login");

  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/portal/agendar")}`);
  }

  if (sessao.user.papel === "CLINICA" && sessao.user.clinicaId === clinica.id) {
    redirect("/portal/agendar");
  }

  // Logado como outra pessoa (equipe, profissional, ou outra clínica): vai
  // para a própria casa, não para o portal de quem gerou o QR.
  redirect(inicioDe(sessao.user.papel));
}
