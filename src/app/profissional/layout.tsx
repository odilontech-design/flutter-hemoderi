import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirProfissional } from "@/lib/sessao";
import { BotaoWhatsapp } from "@/components/BotaoWhatsapp";
import { IconeAgenda, IconeDisponibilidade, IconeFinanceiro } from "@/components/icones/MenuIcones";

export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/profissional", icone: <IconeAgenda />, rotulo: "Minha agenda" },
  { href: "/profissional/disponibilidade", icone: <IconeDisponibilidade />, rotulo: "Disponibilidade" },
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
        />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
      <BotaoWhatsapp contexto="portal do profissional" />
      </div>
    </Provedores>
  );
}
