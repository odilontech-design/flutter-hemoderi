import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inicioDe } from "@/lib/papeis";
import { CLAUSULAS_DO_TERMO, TITULO_DO_TERMO, VERSAO_DO_TERMO } from "@/lib/termo-aceite";
import { FormularioTermo } from "./FormularioTermo";

export const dynamic = "force-dynamic";

/**
 * O termo de aceite do cliente — fora das guardas de lib/sessao.ts pelo mesmo
 * motivo da troca de senha: a guarda da clínica manda para cá, e usá-la aqui
 * fecharia o laço de redirect.
 */
export default async function TermoDeAceite() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) redirect("/login");
  if (sessao.user.papel !== "CLINICA") redirect(inicioDe(sessao.user.papel));

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { desativadoEm: true, senhaProvisoria: true, termoVersao: true },
  });
  if (!usuario || usuario.desativadoEm) redirect("/login");
  if (usuario.senhaProvisoria) redirect("/trocar-senha");
  if (usuario.termoVersao === VERSAO_DO_TERMO) redirect(inicioDe(sessao.user.papel));

  return (
    <div className="min-h-screen flex items-center justify-center bg-bordoEscuro px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno, sem ganho no otimizador. */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-20 w-auto mx-auto" />
        </div>
        <div className="bg-white rounded-2xl p-6">
          <h1 className="font-display font-bold text-bordo text-sm mb-1">{TITULO_DO_TERMO}</h1>
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            Antes de usar o portal, leia e confirme as regras abaixo. Elas valem para todos os agendamentos da sua clínica.
          </p>
          <ol className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto pr-1">
            {CLAUSULAS_DO_TERMO.map((c, i) => (
              <li key={c.titulo} className="text-xs text-gray-700 leading-relaxed">
                <strong className="text-bordo">
                  {i + 1}. {c.titulo}.
                </strong>{" "}
                {c.texto}
              </li>
            ))}
          </ol>
          <FormularioTermo inicio={inicioDe(sessao.user.papel)} />
        </div>
      </div>
    </div>
  );
}
