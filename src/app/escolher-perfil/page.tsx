import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function IconeEquipe() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconeProfissional() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v4" />
      <path d="M10 13h4" />
    </svg>
  );
}

/**
 * Seletor de ambiente para usuários com duplo perfil (INTERNO + profissional).
 * Aparece após o login no lugar do redirect direto para /painel.
 */
export default async function EscolherPerfil() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) redirect("/login");

  const u = sessao.user as any;

  // Só usuários INTERNO com profissionalId chegam aqui naturalmente.
  // Os demais são devolvidos para a casa deles.
  if (u.papel !== "INTERNO" || !u.profissionalId) {
    redirect(u.papel === "PROFISSIONAL" ? "/profissional" : u.papel === "CLINICA" ? "/portal" : "/painel");
  }

  const primeiroNome = (sessao.user.name ?? "").split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bordoEscuro px-4 py-10">
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-16 w-auto mx-auto mb-4" />
        <h1 className="text-white text-xl font-display font-bold">
          Olá, {primeiroNome}!
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Como você quer entrar hoje?
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
        <Link
          href="/painel"
          className="flex-1 bg-white rounded-2xl p-6 flex flex-col items-center gap-3 text-center
            hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="text-bordo group-hover:scale-110 transition-transform">
            <IconeEquipe />
          </div>
          <div>
            <div className="font-display font-bold text-bordo text-base">Equipe Hemoderi</div>
            <div className="text-gray-500 text-xs mt-1">
              Painel de operações, agenda,<br />financeiro e cadastros
            </div>
          </div>
        </Link>

        <Link
          href="/profissional"
          className="flex-1 bg-white rounded-2xl p-6 flex flex-col items-center gap-3 text-center
            hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="text-bordo group-hover:scale-110 transition-transform">
            <IconeProfissional />
          </div>
          <div>
            <div className="font-display font-bold text-bordo text-base">Portal Profissional</div>
            <div className="text-gray-500 text-xs mt-1">
              Minha agenda, disponibilidade<br />e meus ganhos
            </div>
          </div>
        </Link>
      </div>

      <p className="text-white/30 text-[11px] mt-8 text-center">
        Você pode trocar de ambiente a qualquer momento pelo menu lateral.
      </p>
    </div>
  );
}
