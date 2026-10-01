import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { parametros } from "@/lib/alocacao";
import { agruparPorFamilia } from "@/lib/familia";
import { locaisDaClinica } from "@/lib/endereco";
import { precosDosServicos, tabelasDaClinica } from "@/lib/preco";
import { servicoVisivel } from "@/lib/visibilidade";
import { Aviso, Titulo } from "@/components/ui";
import { FormularioAgendamento, type ServicoDoCarrinho } from "./FormularioAgendamento";

export const dynamic = "force-dynamic";

export default async function Agendar({ searchParams }: { searchParams: { servico?: string } }) {
  const sessao = await exigirClinica();

  const [clinica, locais, tabelaIds, config] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: sessao.clinicaId },
      select: { perfis: true, statusCadastro: true },
    }),
    locaisDaClinica(sessao.clinicaId),
    tabelasDaClinica(prisma, sessao.clinicaId),
    parametros(),
  ]);

  // Cadastro em triagem vê o catálogo, mas ainda não agenda: a tabela de preço
  // e os serviços dependem do perfil que a equipe vai confirmar.
  if (clinica?.statusCadastro !== "APROVADO") {
    return (
      <>
        <Titulo>Agendar atendimento</Titulo>
        <div className="max-w-xl">
          <Aviso tom="alerta">
            <div className="font-semibold mb-1">Seu cadastro ainda está em análise.</div>
            Nossa equipe confere o seu perfil e libera o agendamento em seguida. Enquanto isso, o{" "}
            <Link href="/portal/catalogo" className="font-semibold underline">
              catálogo
            </Link>{" "}
            já está disponível.
          </Aviso>
        </div>
      </>
    );
  }

  const todos = await prisma.servico.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      duracaoMin: true,
      familia: true,
      valorPadraoCentavos: true,
      unidadeCobranca: true,
      permiteQuantidade: true,
      rotuloQuantidade: true,
      quantidadeMaxima: true,
      perfis: true,
      ufsIndisponiveis: true,
    },
  });
  // O perfil filtra aqui; a UF filtra na tela, porque muda com o endereço escolhido.
  const servicos = todos.filter((s) => servicoVisivel({ ...s, ufsIndisponiveis: [] }, { perfis: clinica.perfis }));

  // Um mapa de preços por UF: cada endereço pode cair numa praça diferente.
  const ufs = [...new Set(locais.map((l) => l.uf).filter((uf): uf is string => Boolean(uf)))];
  const precosPorUf: Record<string, Record<string, number>> = {};
  for (const uf of ufs) {
    const precos = await precosDosServicos(prisma, { clinicaId: sessao.clinicaId, uf, servicos, tabelaIds });
    precosPorUf[uf] = Object.fromEntries([...precos.entries()].map(([id, p]) => [id, p.valorCentavos]));
  }

  const lista: ServicoDoCarrinho[] = servicos.map((s) => ({
    id: s.id,
    nome: s.nome,
    duracaoMin: s.duracaoMin,
    familia: s.familia,
    unidadeCobranca: s.unidadeCobranca,
    permiteQuantidade: s.permiteQuantidade,
    rotuloQuantidade: s.rotuloQuantidade,
    quantidadeMaxima: s.quantidadeMaxima,
    ufsIndisponiveis: s.ufsIndisponiveis,
  }));
  const grupos = agruparPorFamilia(lista, { fundirSolitarias: false });

  return (
    <>
      <Titulo>Agendar atendimento</Titulo>
      <FormularioAgendamento
        grupos={grupos}
        locais={locais}
        precosPorUf={precosPorUf}
        antecedenciaHoras={config.antecedenciaMinimaHoras}
        clinicaNome={sessao.clinicaNome}
        whatsappCentral={config.whatsapp}
        servicoInicialId={searchParams.servico ?? null}
      />
    </>
  );
}
