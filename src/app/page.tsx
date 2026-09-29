import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { inicioDe } from "@/lib/papeis";

export const dynamic = "force-dynamic";

/**
 * A raiz manda cada papel para a casa dele — e quem ainda não é cliente para
 * a vitrine, não para o login.
 *
 * Era o contrário até a ata de 14/09: a porta de entrada pedia senha antes de
 * mostrar o que existe, e clínica nova desistia ali. Agora o cardápio vem
 * antes da conta; o login continua a um clique, para quem já tem acesso.
 */
export default async function Raiz() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) redirect("/agendar");

  const u = sessao.user as any;
  // Usuário INTERNO com profissionalId = dual-perfil → escolha de ambiente.
  if (u.papel === "INTERNO" && u.profissionalId) redirect("/escolher-perfil");

  redirect(inicioDe(sessao.user.papel));
}
