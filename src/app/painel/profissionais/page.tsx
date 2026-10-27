import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { ImportarProfissionais } from "./ImportarProfissionais";
import { EditarProfissional } from "./EditarProfissional";
import { agruparPorFamilia } from "@/lib/familia";
import { situacaoDoAcesso } from "@/lib/profissionais-acesso";

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

  const [profissionais, gruposRepasse, servicosDoCatalogo] = await Promise.all([
    prisma.profissional.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: {
        servicosAptos: { select: { id: true } },
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
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, familia: true },
    }),
  ]);
  const servicos = agruparPorFamilia(servicosDoCatalogo, { fundirSolitarias: false, ordemDoCatalogo: true });

  return (
    <>
      <Titulo
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/painel/profissionais/atrasos"
              className="border border-gray-300 text-bordo text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-gray-50"
            >
              Atrasos de chegada
            </Link>
            {/* O download tem que ser navegação, não link do Next: é um arquivo. */}
            <a
              href="/painel/profissionais/inativos"
              className="border border-gray-300 text-bordo text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-gray-50"
            >
              Baixar inativos (Excel)
            </a>
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

      {(() => {
        // Os números grandes (ata de 27/10): quantos profissionais, quantos já
        // entraram e quantos estão habilitados para algum serviço.
        const ativos = profissionais.filter((p) => p.ativo);
        const situacoes = ativos.map((p) => situacaoDoAcesso(p.usuarios));
        const indicadores: [string, number][] = [
          ["Cadastrados", ativos.length],
          ["Acesso ativado", situacoes.filter((x) => x === "ativo").length],
          ["Ainda não entraram", situacoes.filter((x) => x === "nunca-entrou").length],
          ["Sem acesso criado", situacoes.filter((x) => x === "sem-acesso" || x === "desativado").length],
          ["Habilitados (com serviços)", ativos.filter((p) => p.servicosAptos.length > 0).length],
        ];
        return (
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {indicadores.map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                <div className="font-display text-xl font-bold text-bordo">{valor}</div>
                <div className="text-[10px] text-gray-500">{rotulo}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {(() => {
        // Prontidão para o lançamento (revisão de 25/10): sem telefone o aviso
        // de alocação não chega, sem Pix não há repasse, e quem nunca entrou
        // não vê a própria agenda.
        const ativos = profissionais.filter((p) => p.ativo);
        const semTelefone = ativos.filter((p) => !p.telefone).length;
        const semPix = ativos.filter((p) => !p.chavePix).length;
        const nuncaEntraram = ativos.filter((p) => p.usuarios.some((u) => !u.desativadoEm && u.senhaProvisoria)).length;
        if (!semTelefone && !semPix && !nuncaEntraram) return null;
        return (
          <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
            <div className="text-[11px] text-amber-900 leading-relaxed">
              <strong>Cadastros incompletos</strong> entre {ativos.length} ativos: {semTelefone} sem telefone · {semPix} sem
              chave Pix · {nuncaEntraram} nunca entraram no portal. O próprio profissional completa telefone e Pix em
              &quot;Meus dados&quot; no primeiro acesso.
            </div>
          </Cartao>
        );
      })()}

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
                    servicos={servicos}
                  />
                );
              })}
            </Tabela>
          )}
      </Cartao>
    </>
  );
}
