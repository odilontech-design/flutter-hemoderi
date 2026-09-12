import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { inicioDe } from "@/lib/papeis";

export const dynamic = "force-dynamic";

/** A raiz não tem tela própria: manda cada papel para a casa dele. */
export default async function Raiz() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) redirect("/login");
  redirect(inicioDe(sessao.user.papel));
}
