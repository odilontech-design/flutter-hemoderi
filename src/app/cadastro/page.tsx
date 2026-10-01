import Link from "next/link";
import { FormularioCadastro } from "./FormularioCadastro";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar cadastro | Hemoderi",
  description: "Cadastre a sua clínica ou consultório para agendar atendimentos com a Hemoderi.",
};

/**
 * A porta de entrada de quem ainda não é cliente (ata de 01/10).
 *
 * Inverte o fluxo anterior: primeiro o cadastro, depois o agendamento. É o
 * cadastro que dá à Hemoderi o endereço e o perfil — e com eles o que
 * mostrar e quanto cobrar, sem criar agendamento que vira cancelamento.
 */
export default function Cadastro() {
  return (
    <div className="min-h-screen bg-bege">
      <header className="bg-bordoEscuro text-white">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno, sem ganho no otimizador. */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-10 w-auto object-contain object-left" />
          <Link
            href="/login"
            className="border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-white/10"
          >
            Já sou cliente
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
        <h1 className="font-display font-extrabold text-bordo text-2xl">Crie o cadastro da sua clínica</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl leading-relaxed">
          Com o cadastro você vê o catálogo e os valores do seu perfil e agenda profissional e equipamento
          direto no portal. Nossa equipe confere os dados antes de liberar o agendamento.
        </p>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-6">
          <FormularioCadastro />
        </div>
      </main>
    </div>
  );
}
