import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirProfissional } from "@/lib/sessao";
import { BotaoWhatsapp } from "@/components/BotaoWhatsapp";
import { CentralDeAvisos } from "@/components/CentralDeAvisos";
import { IconeAgenda, IconeDisponibilidade, IconeFinanceiro, IconeRelatorios } from "@/components/icones/MenuIcones";

export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/profissional", icone: <IconeAgenda />, rotulo: "Minha agenda" },
  { href: "/profissional/disponibilidade", icone: <IconeDisponibilidade />, rotulo: "Disponibilidade" },
  { href: "/profissional/relatorios", icone: <IconeRelatorios />, rotulo: "Relatórios" },
  { href: "/profissional/ganhos", icone: <IconeFinanceiro />, rotulo: "Meus ganhos" },
];

export default async function LayoutProfissional({ children }: { children: React.ReactNode }) {
  const sessao = await exigirProfissional();

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral
          titulo={sessao.profissionalNome}
          subtitulo="Portal do profissional"
          nomeUsuario={sessao.nome}
          itens={ITENS}
          trocaPerfil={
            sessao.dualPerfil
              ? { href: "/painel", rotulo: "Ir para equipe Hemoderi" }
              : undefined
          }
        />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
      <BotaoWhatsapp contexto="portal do profissional" />
        <CentralDeAvisos area="profissional" />
      </div>
    </Provedores>
  );
}
