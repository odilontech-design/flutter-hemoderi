import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inicioDe } from "@/lib/papeis";
import { FormularioTrocarSenha } from "./FormularioTrocarSenha";

export const dynamic = "force-dynamic";

/**
 * Troca de senha — a única página do sistema que não usa as guardas de
 * lib/sessao.ts.
 *
 * Não pode: as três guardas mandam para cá quem está com senha provisória, e
 * usá-las aqui fecharia o laço de redirect em cima da própria pessoa que
 * precisa sair dele. Em troca, a página faz o mínimo de guarda por conta
 * própria — exige sessão e reconfere que o acesso não foi suspenso enquanto
 * a aba estava aberta.
 */
export default async function TrocarSenha() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { nome: true, email: true, desativadoEm: true, senhaProvisoria: true },
  });
  if (!usuario || usuario.desativadoEm) redirect("/login");

  const inicio = inicioDe(sessao.user.papel);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bordoEscuro px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno, sem ganho no otimizador. */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-20 w-auto mx-auto" />
          <div className="text-[11px] text-white/50 mt-2">Operações · Dilon Saúde</div>
        </div>

        <div className="bg-white rounded-2xl p-6">
          <div className="font-display font-bold text-bordo text-sm mb-1">
            {usuario.senhaProvisoria ? "Escolha a sua senha" : "Trocar senha"}
          </div>
          <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            {usuario.senhaProvisoria ? (
              <>
                A senha que você recebeu foi gerada pela equipe e vale só para esta
                primeira entrada. Escolha agora uma senha que só você conhece — ninguém
                da Hemoderi consegue vê-la.
              </>
            ) : (
              <>Entrando como {usuario.email}.</>
            )}
          </div>

          <FormularioTrocarSenha
            inicio={inicio}
            obrigatoria={usuario.senhaProvisoria}
            email={usuario.email}
          />
        </div>
      </div>
    </div>
  );
}
