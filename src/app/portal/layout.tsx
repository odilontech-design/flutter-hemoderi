import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirClinica } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { BotaoWhatsapp } from "@/components/BotaoWhatsapp";
import { Aviso } from "@/components/ui";
import { IconeAgendamentos, IconeCatalogo, IconeClinicas, IconeRelatorios } from "@/components/icones/MenuIcones";

export const dynamic = "force-dynamic";

// Catálogo primeiro, histórico depois (ata de 01/10). Não há item "Agendar": o
// botão de agendamento mora nas duas telas, e um terceiro caminho para a mesma
// página era justamente a redundância que a reunião mandou tirar.
const ITENS = [
  { href: "/portal/catalogo", icone: <IconeCatalogo />, rotulo: "Catálogo" },
  { href: "/portal", icone: <IconeAgendamentos />, rotulo: "Meus agendamentos" },
  { href: "/portal/historico", icone: <IconeRelatorios />, rotulo: "Histórico e avaliações" },
  { href: "/portal/enderecos", icone: <IconeClinicas />, rotulo: "Meus endereços" },
];

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const sessao = await exigirClinica();
  const clinica = await prisma.clinica.findUnique({
    where: { id: sessao.clinicaId },
    select: { statusCadastro: true },
  });

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral
          titulo={sessao.clinicaNome}
          subtitulo="Portal da clínica"
          nomeUsuario={sessao.nome}
          itens={ITENS}
        />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">
          {clinica?.statusCadastro === "PENDENTE" && (
            <div className="mb-4">
              <Aviso tom="alerta">
                <div className="font-semibold mb-1">Seu cadastro está em análise.</div>
                Nossa equipe confere o seu perfil e libera o agendamento em seguida. Enquanto isso você
                já pode conhecer o catálogo.
              </Aviso>
            </div>
          )}
          {clinica?.statusCadastro === "RECUSADO" && (
            <div className="mb-4">
              <Aviso tom="erro">
                <div className="font-semibold mb-1">Não foi possível liberar o seu cadastro.</div>
                Fale com a central para conferirmos os seus dados e liberar o agendamento.
              </Aviso>
            </div>
          )}
          {children}
        </main>
      <BotaoWhatsapp contexto="portal da clínica" />
      </div>
    </Provedores>
  );
}
