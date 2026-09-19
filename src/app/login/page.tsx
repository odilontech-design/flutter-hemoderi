import { FormularioLogin } from "./FormularioLogin";

export const dynamic = "force-dynamic";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bordoEscuro px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno, sem ganho no otimizador. */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-20 w-auto mx-auto" />
          <div className="text-[11px] text-white/50 mt-2">Operações · Dilon Saúde</div>
        </div>
        <div className="bg-white rounded-2xl p-6">
          <FormularioLogin />
        </div>
        <div className="text-center text-[10px] text-white/30 mt-6">Dilon Tech</div>
      </div>
    </div>
  );
}
