import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { inicioDe } from "@/lib/papeis";

export const dynamic = "force-dynamic";

/**
 * A raiz manda cada papel para a casa dele — e quem não tem sessão para o
 * login.
 *
 * Entre as atas de 14/09 e 01/10 a raiz levava à vitrine pública, e o
 * cardápio vinha antes da conta. A de 01/10 inverteu: o cadastro vem primeiro
 * (é ele que traz o endereço e o perfil que decidem o que mostrar) e a
 * equipe administrativa não deve passar por uma tela pública para chegar ao
 * sistema. O login leva o link do cadastro para quem ainda não é cliente.
 */
export default async function Raiz() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) redirect("/login");

  const u = sessao.user as any;
  // Usuário INTERNO com profissionalId = dual-perfil → escolha de ambiente.
  if (u.papel === "INTERNO" && u.profissionalId) redirect("/escolher-perfil");

  redirect(inicioDe(sessao.user.papel));
}
