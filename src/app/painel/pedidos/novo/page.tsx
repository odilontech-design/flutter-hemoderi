import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { parametros } from "@/lib/alocacao";
import { agruparPorFamilia } from "@/lib/familia";
import { locaisDaClinica } from "@/lib/endereco";
import { precosDosServicos, tabelasDaClinica } from "@/lib/preco";
import { precosDeCurso } from "@/lib/curso-catalogo";
import { camposFaltando } from "@/lib/cadastro-completo";
import { perfilPermite } from "@/lib/papeis";
import { formatarTelefone } from "@/lib/whatsapp-link";
import { FormularioAgendamento, type ServicoDoCarrinho } from "@/app/portal/agendar/FormularioAgendamento";
import { EscolherClinica, type ClinicaDaLista } from "./EscolherClinica";

export const dynamic = "force-dynamic";

/**
 * Agendamento pela equipe (ata de 26/10): o MESMO formulário do portal da
 * clínica — local, equipamento e serviços (vários na mesma visita), data e
 * horário, procedimento, forma de pagamento, doutor, contato, paciente e
 * observações —, precedido da escolha da clínica. Antes, a equipe tinha um
 * formulário próprio, mais curto, e o pedido feito por telefone chegava à
 * operação sem os dados que o da clínica trazia.
 *
 * A clínica que ainda não pode agendar (desativada, pré-cadastro do CRM, em
 * análise ou com o cadastro incompleto) é liberada aqui mesmo; a que não
 * existe se cadastra e volta direto para cá.
 */
export default async function NovoPedido({ searchParams }: { searchParams: { clinica?: string; endereco?: string } }) {
  const sessao = await exigirInterno();

  const todas = await prisma.clinica.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      cidade: true,
      uf: true,
      ativa: true,
      preCadastro: true,
      statusCadastro: true,
      cnpj: true,
      telefone: true,
      email: true,
    },
  });

  const situacaoDe = (c: (typeof todas)[number]): string => {
    if (c.preCadastro) return "pré-cadastro";
    if (!c.ativa) return "desativada";
    if (c.statusCadastro === "PENDENTE") return "cadastro em análise";
    if (c.statusCadastro === "RECUSADO") return "cadastro recusado";
    if (camposFaltando(c).length > 0) return "cadastro incompleto";
    return "";
  };
  // Título de negócio do PipeDrive ("2021 0334 Dr Fulano") que entrou na
  // importação do CRM como se fosse clínica: não é cadastro, fica de fora.
  const tituloDeNegocio = (nome: string) => /^\d{4}\s+\d{3,5}\s/.test(nome);
  const lista: ClinicaDaLista[] = todas
    .filter((c) => !(c.preCadastro && tituloDeNegocio(c.nome)))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      local: [c.cidade, c.uf].filter(Boolean).join(" / "),
      situacao: situacaoDe(c),
      doCrm: c.preCadastro,
    }));

  const escolhidaId = todas.some((c) => c.id === searchParams.clinica) ? searchParams.clinica! : null;

  return (
    <>
      <Titulo>Novo agendamento</Titulo>
      <div className="space-y-3 max-w-4xl">
        <section className="rounded-2xl border border-bordo/30 bg-white px-4 py-3">
          <h2 className="font-display font-bold text-sm text-bordo mb-2">Clínica</h2>
          <EscolherClinica clinicas={lista} escolhidaId={escolhidaId} />
        </section>

        {escolhidaId && (
          <Agendamento
            clinicaId={escolhidaId}
            podeAlocar={perfilPermite(sessao.perfil, "LOGISTICA")}
            localInicialId={searchParams.endereco}
          />
        )}
      </div>
    </>
  );
}

async function Agendamento({
  clinicaId,
  podeAlocar,
  localInicialId,
}: {
  clinicaId: string;
  podeAlocar: boolean;
  localInicialId?: string;
}) {
  const clinica = await prisma.clinica.findUniqueOrThrow({
    where: { id: clinicaId },
    select: {
      nome: true,
      ativa: true,
      preCadastro: true,
      statusCadastro: true,
      perfis: true,
      cnpj: true,
      telefone: true,
      email: true,
    },
  });

  // Não bloqueia (pedido de 27/10): a Joyce ativa e agenda as clínicas do CRM
  // mesmo com dados faltando. A tela só lembra do que completar depois.
  const faltando = camposFaltando(clinica);
  const lembretes = [
    clinica.preCadastro ? "é um pré-cadastro do CRM (será ativada ao agendar)" : null,
    !clinica.preCadastro && !clinica.ativa ? "está desativada (será ativada ao agendar)" : null,
    clinica.statusCadastro === "PENDENTE" ? "o autocadastro ainda está em análise" : null,
    faltando.length > 0 ? `faltam dados para cobrar: ${faltando.join(", ")}` : null,
  ].filter((p): p is string => Boolean(p));

  if (clinica.statusCadastro === "RECUSADO") {
    return (
      <Cartao>
        <Aviso tom="alerta">O cadastro desta clínica foi recusado. Reveja o cadastro antes de agendar.</Aviso>
      </Cartao>
    );
  }

  const [locais, tabelaIds, config, doutores, servicos, profissionais] = await Promise.all([
    locaisDaClinica(clinicaId),
    tabelasDaClinica(prisma, clinicaId),
    parametros(),
    prisma.vinculoPessoaClinica.findMany({
      where: { clinicaId },
      orderBy: { pessoa: { nome: "asc" } },
      select: { pessoa: { select: { nome: true } } },
    }),
    // O catálogo inteiro: o perfil filtra o que a CLÍNICA vê sozinha, não o
    // que a equipe pode agendar para ela. A UF filtra na tela, por endereço.
    prisma.servico.findMany({
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
        quantidadeMinima: true,
        quantidadeIncluida: true,
        valorAdicionalCentavos: true,
        ufsIndisponiveis: true,
      },
    }),
    podeAlocar
      ? prisma.profissional.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
      : Promise.resolve([]),
  ]);

  // Um mapa de preços por UF: cada endereço pode cair numa praça diferente.
  const ufs = [...new Set(locais.map((l) => l.uf).filter((uf): uf is string => Boolean(uf)))];
  const precosPorUf: Record<string, Record<string, number>> = {};
  for (const uf of ufs) {
    const precos = await precosDosServicos(prisma, { clinicaId, uf, servicos, tabelaIds });
    precosPorUf[uf] = Object.fromEntries([...precos.entries()].map(([id, p]) => [id, p.valorCentavos]));
  }

  const paraOCarrinho = (s: (typeof servicos)[number]): ServicoDoCarrinho => ({
    id: s.id,
    nome: s.nome,
    duracaoMin: s.duracaoMin,
    familia: s.familia,
    unidadeCobranca: s.unidadeCobranca,
    permiteQuantidade: s.permiteQuantidade,
    rotuloQuantidade: s.rotuloQuantidade,
    quantidadeMaxima: s.quantidadeMaxima,
    quantidadeMinima: s.quantidadeMinima,
    quantidadeIncluida: s.quantidadeIncluida,
    valorAdicionalCentavos: s.valorAdicionalCentavos,
    ufsIndisponiveis: s.ufsIndisponiveis,
  });
  const grupos = agruparPorFamilia(servicos, { fundirSolitarias: false, ordemDoCatalogo: true }).map((g) => ({
    familia: g.familia,
    servicos: g.servicos.map(paraOCarrinho),
  }));

  const dadosDeCurso = await precosDeCurso(prisma, clinicaId, ufs);
  const curso = dadosDeCurso
    ? {
        precosPorUf: dadosDeCurso.precosPorUf,
        grupos: agruparPorFamilia(
          servicos.filter((s) => dadosDeCurso.precos.has(s.id)),
          { fundirSolitarias: false, ordemDoCatalogo: true }
        ).map((g) => ({ familia: g.familia, servicos: g.servicos.map(paraOCarrinho) })),
      }
    : null;

  return (
    <>
      {lembretes.length > 0 && (
        <Aviso tom="info">
          Pode agendar mesmo assim — {lembretes.join("; ")}.{" "}
          <a href={`/painel/clinicas/${clinicaId}`} className="font-semibold underline">
            Completar o cadastro
          </a>
        </Aviso>
      )}
      {locais.length === 0 && (
        <Aviso tom="alerta">
          A clínica não tem endereço cadastrado: os preços aparecem como &quot;sob consulta&quot; e o profissional não
          recebe o local.{" "}
          <a href={`/painel/clinicas/${clinicaId}`} className="font-semibold underline">
            Cadastrar o endereço
          </a>
        </Aviso>
      )}
      <FormularioAgendamento
        curso={curso}
        // Trocar de clínica remonta o formulário: o carrinho de uma não vale para a outra.
        key={clinicaId}
        grupos={grupos}
        locais={locais}
        precosPorUf={precosPorUf}
        antecedenciaHoras={config.antecedenciaMinimaHoras}
        clinicaNome={clinica.nome}
        whatsappCentral={config.whatsapp}
        servicoInicialId={null}
        telefoneClinica={formatarTelefone(clinica.telefone ?? "")}
        doutores={doutores.map((d) => d.pessoa.nome)}
        equipe={{ clinicaId, profissionais, enderecosHref: `/painel/clinicas/${clinicaId}`, localInicialId }}
      />
    </>
  );
}
