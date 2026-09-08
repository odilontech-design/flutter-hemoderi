import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Area, Campo, Cartao, Rotulo, Selecao, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { alternarServico, salvarEquipamento, salvarServico } from "@/app/actions/cadastros";
import { formatarPercent, formatarReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

const ROTULO_EQUIPAMENTO: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_USO: "Em uso",
  MANUTENCAO: "Manutenção",
  INATIVO: "Inativo",
};

export default async function Catalogo() {
  await exigirInterno();

  const [servicos, equipamentos] = await Promise.all([
    prisma.servico.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    prisma.equipamento.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <Titulo>Serviços e equipamentos</Titulo>

      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <Cartao className="lg:col-span-2">
          <div className="font-display font-bold text-navy text-sm mb-3">Serviços</div>
          {servicos.length === 0 ? (
            <Vazio>Nenhum serviço cadastrado.</Vazio>
          ) : (
            <Tabela cabecalho={["Serviço", "Duração", "Valor de tabela", "Repasse", "Equipamento", ""]}>
              {servicos.map((servico) => (
                <tr key={servico.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-navy">{servico.nome}</td>
                  <td className="py-2 pr-3 text-gray-500">{servico.duracaoMin} min</td>
                  <td className="py-2 pr-3">{formatarReais(servico.valorPadraoCentavos)}</td>
                  <td className="py-2 pr-3">
                    {servico.repasseFixoCentavos != null
                      ? formatarReais(servico.repasseFixoCentavos)
                      : servico.repassePercent != null
                        ? formatarPercent(servico.repassePercent)
                        : <span className="text-gray-400">padrão</span>}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{servico.exigeEquipamento ? "exige" : "—"}</td>
                  <td className="py-2">
                    <BotaoAcao
                      acao={alternarServico.bind(null, servico.id, !servico.ativo)}
                      variante={servico.ativo ? "perigo" : "secundario"}
                    >
                      {servico.ativo ? "Desativar" : "Reativar"}
                    </BotaoAcao>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-navy text-sm mb-3">Novo serviço</div>
          <FormularioAcao acao={salvarServico} botao="Cadastrar serviço">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div>
              <Rotulo>Descrição</Rotulo>
              <Area name="descricao" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Duração (min)</Rotulo>
                <Campo name="duracaoMin" type="number" min={15} step={15} defaultValue={60} />
              </div>
              <div>
                <Rotulo>Valor de tabela</Rotulo>
                <Campo name="valorPadrao" placeholder="R$ 200,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Repasse (%)</Rotulo>
                <Campo name="repassePercent" placeholder="opcional" />
              </div>
              <div>
                <Rotulo>ou valor fixo</Rotulo>
                <Campo name="repasseFixo" placeholder="opcional" />
              </div>
            </div>
            <div>
              <Rotulo>Exige equipamento?</Rotulo>
              <Selecao name="exigeEquipamento" defaultValue="nao">
                <option value="nao">Não</option>
                <option value="sim">Sim — reserva um aparelho na alocação</option>
              </Selecao>
            </div>
          </FormularioAcao>
        </Cartao>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
          <div className="font-display font-bold text-navy text-sm mb-3">Equipamentos</div>
          {equipamentos.length === 0 ? (
            <Vazio>Nenhum equipamento cadastrado.</Vazio>
          ) : (
            <Tabela cabecalho={["Equipamento", "Tipo", "Patrimônio", "Status"]}>
              {equipamentos.map((equipamento) => (
                <tr key={equipamento.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-navy">{equipamento.nome}</td>
                  <td className="py-2 pr-3 text-gray-500">{equipamento.tipo ?? "—"}</td>
                  <td className="py-2 pr-3 text-gray-500">{equipamento.patrimonio ?? "—"}</td>
                  <td className="py-2 pr-3">{ROTULO_EQUIPAMENTO[equipamento.status]}</td>
                </tr>
              ))}
            </Tabela>
          )}
          <div className="text-[10px] text-gray-400 mt-3">
            Só equipamento com status <strong>Disponível</strong> entra na conta da alocação — aparelho
            em manutenção deixa de ser oferecido no mesmo instante.
          </div>
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-navy text-sm mb-3">Novo equipamento</div>
          <FormularioAcao acao={salvarEquipamento} botao="Cadastrar equipamento">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Tipo</Rotulo>
                <Campo name="tipo" />
              </div>
              <div>
                <Rotulo>Patrimônio</Rotulo>
                <Campo name="patrimonio" />
              </div>
            </div>
            <div>
              <Rotulo>Status</Rotulo>
              <Selecao name="status" defaultValue="DISPONIVEL">
                {Object.entries(ROTULO_EQUIPAMENTO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Selecao>
            </div>
            <div>
              <Rotulo>Observações</Rotulo>
              <Area name="observacoes" rows={2} />
            </div>
          </FormularioAcao>
        </Cartao>
      </div>
    </>
  );
}
