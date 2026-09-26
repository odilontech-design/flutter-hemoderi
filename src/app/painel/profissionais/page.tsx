import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { ImportarProfissionais } from "./ImportarProfissionais";
import { EditarProfissional } from "./EditarProfissional";

export const dynamic = "force-dynamic";

export default async function Profissionais() {
  await exigirInterno();

  // A nota vem de um groupBy separado, não de um include: trazer todas as
  // avaliações de cada profissional só para tirar a média carregaria o
  // histórico inteiro da operação numa tela de lista.
  const notas = await prisma.avaliacao.groupBy({
    by: ["profissionalId"],
    _avg: { nota: true },
    _count: true,
  });

  const [profissionais, gruposRepasse] = await Promise.all([
    prisma.profissional.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: {
        _count: { select: { pedidos: true, disponibilidades: true } },
        // O acesso ao portal faz parte do cadastro, não de outra tela: a
        // pergunta "esse profissional já consegue ver a agenda dele?" nasce
        // aqui, olhando a lista.
        usuarios: {
          select: { id: true, desativadoEm: true, senhaProvisoria: true },
          orderBy: { criadoEm: "asc" },
        },
      },
    }),
    prisma.grupoRepasse.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <>
      <Titulo
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <ImportarProfissionais />
            <Link
              href="/painel/profissionais/novo"
              className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
            >
              + Novo profissional
            </Link>
          </div>
        }
      >
        Profissionais
      </Titulo>

      <Cartao>
        {profissionais.length === 0 ? (
            <Vazio>Nenhum profissional cadastrado.</Vazio>
          ) : (
            <Tabela
              cabecalho={[
                "Profissional",
                { texto: "Conselho", ocultoMovel: true },
                { texto: "Repasse", ocultoMovel: true },
                { texto: "Avaliação", ocultoMovel: true },
                { texto: "Disponibilidade", ocultoMovel: true },
                "Acesso ao portal",
                "Ações",
              ]}
            >
              {profissionais.map((profissional) => {
                const nota = notas.find((n) => n.profissionalId === profissional.id);
                const media = nota?._avg.nota != null ? Math.round(nota._avg.nota * 10) / 10 : null;
                return (
                  <EditarProfissional
                    key={profissional.id}
                    profissional={profissional}
                    notaMedia={media}
                    notaQtd={nota?._count ?? 0}
                    gruposRepasse={gruposRepasse}
                  />
                );
              })}
            </Tabela>
          )}
      </Cartao>
    </>
  );
}
