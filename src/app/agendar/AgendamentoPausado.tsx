import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parametros } from "@/lib/alocacao";
import { linkWhatsapp } from "@/lib/whatsapp-link";

/**
 * O endereço público de agendamento enquanto está pausado (ata de 01/10).
 *
 * Quem chega por um link antigo — campanha, QR Code, e-mail — não pode cair
 * numa página quebrada nem num formulário que a equipe não está atendendo.
 * Cai aqui, com os dois caminhos que existem agora: entrar, se já é cliente,
 * ou criar o cadastro, que é a nova porta de entrada.
 */
export async function AgendamentoPausado() {
  const config = await parametros();
  const whatsapp = linkWhatsapp(config.whatsapp, "Olá! Quero conhecer os serviços da Hemoderi.");

  return (
    <div className="min-h-screen bg-bordoEscuro flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno, sem ganho no otimizador. */}
        <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-16 w-auto mx-auto" />
        <div className="bg-white rounded-2xl p-6 mt-6 text-left">
          <h1 className="font-display font-extrabold text-bordo text-lg">O agendamento agora é pelo portal</h1>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            Para mostrar só o que atendemos na sua região, com o valor certo para o seu perfil, o agendamento
            passou a ser feito dentro do portal do cliente.
          </p>
          <div className="flex flex-col gap-2 mt-5">
            <Link
              href="/cadastro"
              className="bg-bordo text-white text-xs font-semibold text-center px-4 py-3 rounded-lg hover:bg-bordoEscuro"
            >
              Criar cadastro
            </Link>
            <Link
              href="/login"
              className="border border-gray-300 text-bordo text-xs font-semibold text-center px-4 py-3 rounded-lg hover:bg-gray-50"
            >
              Já sou cliente — entrar
            </Link>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-gray-500 hover:text-bordo text-center py-2"
              >
                Prefiro falar com a central
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
