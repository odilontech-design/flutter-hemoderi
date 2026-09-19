import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirInterno } from "@/lib/sessao";

// Tudo aqui depende da sessão e do banco: nada pode ser pré-renderizado.
export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/painel", icone: "◈", rotulo: "Hoje" },
  { href: "/painel/pedidos", icone: "◉", rotulo: "Agendamentos" },
  { href: "/painel/solicitacoes", icone: "✉", rotulo: "Pedidos do site" },
  { href: "/painel/agenda", icone: "📅", rotulo: "Agenda" },
  { href: "/painel/clinicas", icone: "🏥", rotulo: "Clínicas" },
  { href: "/painel/profissionais", icone: "👤", rotulo: "Profissionais" },
  { href: "/painel/catalogo", icone: "📦", rotulo: "Serviços e equipamentos" },
  { href: "/painel/financeiro", icone: "◐", rotulo: "Financeiro" },
  { href: "/painel/acessos", icone: "🔑", rotulo: "Acessos" },
];

// As duas telas que expõem repasse por profissional e gestão de acesso —
// exatamente o que a reunião de 14/09 pediu para tirar do dia a dia de quem
// é só atendente. Tirar do menu não substitui a guarda (`exigirResponsavel`
// em cada página e ação): é só o que evita a pessoa clicar em algo que a
// própria tela vai recusar.
const ITENS_SO_RESPONSAVEL = new Set(["/painel/financeiro", "/painel/acessos"]);

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await exigirInterno();
  const itens = sessao.perfil === "RESPONSAVEL" ? ITENS : ITENS.filter((item) => !ITENS_SO_RESPONSAVEL.has(item.href));

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral titulo="Hemoderi" nomeUsuario={sessao.nome} itens={itens} />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
      </div>
    </Provedores>
  );
}
