import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Area, Campo, Cartao, Rotulo, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CartaoDivulgacao } from "@/components/CartaoDivulgacao";
import { salvarClinica } from "@/app/actions/cadastros";
import { TabelaPrecos } from "./TabelaPrecos";
import { formatarData } from "@/lib/data";
import { ROTULO_FAIXA_NPS, faixaDaNota } from "@/lib/nps";

export const dynamic = "force-dynamic";

export default async function DetalheClinica({ params }: { params: { id: string } }) {
  await exigirInterno();

  const [clinica, servicos, pesquisasNps] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: params.id },
      include: { precos: true },
    }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, valorPadraoCentavos: true },
    }),
    prisma.pesquisaNps.findMany({
      where: { clinicaId: params.id },
      orderBy: { janelaInicio: "desc" },
      take: 12,
    }),
  ]);
  if (!clinica) notFound();

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/clinicas" className="text-xs text-gray-500 px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center">
            ‹ voltar
          </Link>
        }
      >
        {clinica.nome}
      </Titulo>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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

      <Cartao className="mt-3">
        <div className="font-display font-bold text-bordo text-sm mb-1">Pesquisa de satisfação (NPS)</div>
        <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
          Gerada a cada 60 dias só para quem NÃO teve múltiplos atendimentos no período — quem
          atende toda semana já mostra satisfação pelo próprio volume; aqui o objetivo é ouvir
          quem está esfriando.
        </div>
        {pesquisasNps.length === 0 ? (
          <Vazio>Esta clínica ainda não completou a primeira janela de 60 dias.</Vazio>
        ) : (
          <div className="space-y-3">
            {pesquisasNps.map((pesquisa) => (
              <div key={pesquisa.id} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="font-semibold text-bordo">
                    {formatarData(pesquisa.janelaInicio)} – {formatarData(pesquisa.janelaFim)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {pesquisa.atendimentosNoPeriodo} atendimento{pesquisa.atendimentosNoPeriodo === 1 ? "" : "s"} no período
                  </span>
                </div>
                {pesquisa.nota === null ? (
                  <div className="text-[11px] text-amber-700 font-semibold mt-1">aguardando resposta</div>
                ) : (
                  <>
                    <div className="text-[11px] mt-1">
                      <span className="font-semibold text-bordo">{pesquisa.nota}/10</span>
                      {" · "}
                      {ROTULO_FAIXA_NPS[faixaDaNota(pesquisa.nota)]}
                    </div>
                    {pesquisa.pontosPositivos && (
                      <div className="text-[11px] text-gray-600 mt-1">
                        <strong className="text-gray-500">Pontos positivos:</strong> {pesquisa.pontosPositivos}
                      </div>
                    )}
                    {pesquisa.expectativasNaoAtendidas && (
                      <div className="text-[11px] text-gray-600 mt-1">
                        <strong className="text-gray-500">Expectativas não atendidas:</strong>{" "}
                        {pesquisa.expectativasNaoAtendidas}
                      </div>
                    )}
                    {pesquisa.sugestoes && (
                      <div className="text-[11px] text-gray-600 mt-1">
                        <strong className="text-gray-500">Sugestões:</strong> {pesquisa.sugestoes}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
