import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { parametros } from "@/lib/alocacao";
import { agruparPorFamilia } from "@/lib/familia";
import { locaisDaClinica } from "@/lib/endereco";
import { precosDosServicos, tabelasDaClinica } from "@/lib/preco";
import { camposFaltando } from "@/lib/cadastro-completo";
import { perfilPermite } from "@/lib/papeis";
import { formatarTelefone } from "@/lib/whatsapp-link";
import { FormularioAgendamento, type ServicoDoCarrinho } from "@/app/portal/agendar/FormularioAgendamento";
import { EscolherClinica, type ClinicaDaLista } from "./EscolherClinica";
import { LiberarClinica } from "./LiberarClinica";

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
            podeLiberar={perfilPermite(sessao.perfil, "COMERCIAL", "ATENDENTE", "POS_VENDA")}
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
  podeLiberar,
  podeAlocar,
  localInicialId,
}: {
  clinicaId: string;
  podeLiberar: boolean;
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

  const faltando = camposFaltando(clinica);
  const pendencias = [
    clinica.preCadastro ? "é um pré-cadastro do CRM: precisa ser ativada" : null,
    !clinica.preCadastro && !clinica.ativa ? "está desativada: precisa ser ativada" : null,
    clinica.statusCadastro === "PENDENTE" ? "o autocadastro ainda está em análise: precisa ser aprovado" : null,
    clinica.statusCadastro === "RECUSADO" ? "o cadastro foi recusado: liberar aprova o cadastro" : null,
    faltando.length > 0 ? `faltam dados para cobrar: ${faltando.join(", ")}` : null,
  ].filter((p): p is string => Boolean(p));

  if (pendencias.length > 0) {
    return (
      <Cartao>
        {podeLiberar ? (
          <LiberarClinica
            clinicaId={clinicaId}
            pendencias={pendencias}
            faltaCnpj={!clinica.cnpj?.replace(/\D/g, "")}
            faltaTelefone={!clinica.telefone?.replace(/\D/g, "")}
            faltaEmail={!clinica.email?.trim()}
            faltaPerfil={clinica.perfis.length === 0}
          />
        ) : (
          <Aviso tom="alerta">
            <div className="font-semibold mb-1">Esta clínica ainda não pode agendar:</div>
            {pendencias.join("; ")}. Peça ao comercial para liberar o cadastro.
          </Aviso>
        )}
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

  return (
    <>
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
