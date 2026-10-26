import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Instalar o app · Hemoderi",
  description: "Passo a passo para instalar o app Hemoderi no celular (Android e iPhone) e fazer o primeiro acesso.",
};

/** Um passo numerado do guia. */
function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-bordo text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-800">{titulo}</div>
        <div className="text-[13px] text-gray-600 leading-relaxed mt-0.5">{children}</div>
      </div>
    </li>
  );
}

/**
 * Guia de instalação do app (ata de 20/10: "enviar até sexta o passo a passo
 * com o link para os profissionais", treinamento de sábado). Pública, sem
 * login: é o link que vai no WhatsApp — app.hemoderi.com.br/instalar.
 * Não é app de loja: o site instalado na tela inicial abre em tela cheia.
 */
export default function Instalar() {
  return (
    <main className="min-h-screen bg-bege px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático */}
          <img src="/icones/icone-192.png" alt="" className="mx-auto w-16 h-16 rounded-2xl" />
          <h1 className="font-display font-extrabold text-bordo text-xl mt-3">Instale o app Hemoderi</h1>
          <p className="text-[13px] text-gray-600 mt-1">
            Sua agenda, a chegada na clínica, o relatório e os seus ganhos, direto da tela inicial do celular. Não
            precisa de loja de aplicativos: leva menos de um minuto.
          </p>
        </div>

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-bordo text-sm mb-3">Android (Chrome)</h2>
          <ol className="space-y-3">
            <Passo n={1} titulo="Abra o link no Chrome">
              <strong>app.hemoderi.com.br</strong> — se abriu dentro do WhatsApp, toque nos três pontinhos e em{" "}
              <em>Abrir no Chrome</em>.
            </Passo>
            <Passo n={2} titulo="Toque em Instalar">
              Aparece o aviso <em>Instale o app Hemoderi</em>. Se não aparecer, toque nos três pontinhos do Chrome e em{" "}
              <em>Instalar app</em> (ou <em>Adicionar à tela inicial</em>).
            </Passo>
            <Passo n={3} titulo="Pronto">O ícone da Hemoderi fica na tela inicial, junto com os outros apps.</Passo>
          </ol>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-bordo text-sm mb-3">iPhone (Safari)</h2>
          <ol className="space-y-3">
            <Passo n={1} titulo="Abra o link no Safari">
              <strong>app.hemoderi.com.br</strong> — no iPhone a instalação só funciona pelo Safari. Se abriu dentro
              do WhatsApp, toque no ícone da bússola ou em <em>Abrir no Safari</em>.
            </Passo>
            <Passo n={2} titulo="Toque em Compartilhar">É o quadrado com a seta para cima, na barra de baixo.</Passo>
            <Passo n={3} titulo="Adicionar à Tela de Início">
              Role a lista, toque em <em>Adicionar à Tela de Início</em> e depois em <em>Adicionar</em>.
            </Passo>
          </ol>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-bordo text-sm mb-3">Primeiro acesso</h2>
          <ol className="space-y-3">
            <Passo n={1} titulo="Entre com o e-mail e a senha provisória">
              A central envia os dois pelo WhatsApp. Na primeira entrada, o app pede para você criar a sua senha.
            </Passo>
            <Passo n={2} titulo="Confira seus dados">
              Em <em>Meus dados</em>: e-mail, telefone e, se quiser, a sua agenda do Google — aí cada atendimento vira
              compromisso no seu celular.
            </Passo>
            <Passo n={3} titulo="Declare sua disponibilidade">
              Em <em>Disponibilidade</em>, marque os dias e turnos em que você pode atender e as ausências.
            </Passo>
            <Passo n={4} titulo="No dia do atendimento">
              Aceite o atendimento, toque em <em>Cheguei no local</em> ao chegar e preencha o relatório no fim. Depois,
              use <em>Compartilhar no WhatsApp</em> para mandar o relatório no grupo da equipe.
            </Passo>
          </ol>
        </section>

        <div className="text-center space-y-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-bordo text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-bordoEscuro"
          >
            Entrar no Hemoderi
          </Link>
          <p className="text-[12px] text-gray-500">Dúvidas? Fale com a central pelo WhatsApp.</p>
        </div>
      </div>
    </main>
  );
}
