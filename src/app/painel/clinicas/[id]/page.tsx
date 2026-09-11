import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Area, Campo, Cartao, Rotulo, Titulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CartaoDivulgacao } from "@/components/CartaoDivulgacao";
import { salvarClinica } from "@/app/actions/cadastros";
import { TabelaPrecos } from "./TabelaPrecos";

export const dynamic = "force-dynamic";

export default async function DetalheClinica({ params }: { params: { id: string } }) {
  await exigirInterno();

  const [clinica, servicos] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: params.id },
      include: { precos: true },
    }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, valorPadraoCentavos: true },
    }),
  ]);
  if (!clinica) notFound();

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/clinicas" className="text-xs text-gray-500 px-2 py-1">
            ‹ voltar
          </Link>
        }
      >
        {clinica.nome}
      </Titulo>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="space-y-3">
          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-3">Cadastro</div>
            <FormularioAcao acao={salvarClinica} botao="Salvar alterações" limparAoSalvar={false}>
              <input type="hidden" name="id" value={clinica.id} />
              <div>
                <Rotulo>Nome</Rotulo>
                <Campo name="nome" defaultValue={clinica.nome} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Rotulo>CNPJ</Rotulo>
                  <Campo name="cnpj" defaultValue={clinica.cnpj ?? ""} />
                </div>
                <div>
                  <Rotulo>Telefone</Rotulo>
                  <Campo name="telefone" defaultValue={clinica.telefone ?? ""} />
                </div>
              </div>
              <div>
                <Rotulo>E-mail</Rotulo>
                <Campo name="email" type="email" defaultValue={clinica.email ?? ""} />
              </div>
              <div>
                <Rotulo>Endereço</Rotulo>
                <Campo name="endereco" defaultValue={clinica.endereco ?? ""} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Rotulo>Cidade</Rotulo>
                  <Campo name="cidade" defaultValue={clinica.cidade ?? ""} />
                </div>
                <div>
                  <Rotulo>UF</Rotulo>
                  <Campo name="uf" maxLength={2} defaultValue={clinica.uf ?? ""} />
                </div>
              </div>
              <div>
                <Rotulo>Salas de atendimento simultâneo</Rotulo>
                <Campo name="salas" type="number" min={1} defaultValue={clinica.salas} />
              </div>
              <div>
                <Rotulo>Observações</Rotulo>
                <Area name="observacoes" rows={2} defaultValue={clinica.observacoes ?? ""} />
              </div>
            </FormularioAcao>
          </Cartao>

          <CartaoDivulgacao slug={clinica.slug} nome={clinica.nome} />
        </div>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Tabela de preço</div>
          <div className="text-[11px] text-gray-500 mb-4">
            Preço negociado desta clínica por serviço. Em branco, vale o valor de tabela — e é ele
            que o pedido congela no momento da criação.
          </div>
          <TabelaPrecos
            clinicaId={clinica.id}
            servicos={servicos.map((servico) => ({
              ...servico,
              negociadoCentavos:
                clinica.precos.find((p) => p.servicoId === servico.id)?.valorCentavos ?? null,
            }))}
          />
        </Cartao>
      </div>
    </>
  );
}
