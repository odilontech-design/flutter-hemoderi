import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Area, Campo, Cartao, Rotulo, Selecao, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarEquipamento, salvarServico } from "@/app/actions/cadastros";
import { familiaDoNome } from "@/lib/familia";
import { EditarServico } from "./EditarServico";

export const dynamic = "force-dynamic";

const ROTULO_EQUIPAMENTO: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_USO: "Em uso",
  MANUTENCAO: "Manutenção",
  INATIVO: "Inativo",
};

// As três frentes do catálogo comercial — a mesma divisão que a Hemoderi usa
// no site e no catálogo do WhatsApp.
const ROTULO_CATEGORIA: Record<string, string> = {
  ODONTOLOGIA: "Odontologia",
  ESTETICA: "Estética",
  SAUDE: "Saúde",
};

export default async function Catalogo() {
  await exigirInterno();

  const [servicos, equipamentos] = await Promise.all([
    prisma.servico.findMany({ orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }] }),
    prisma.equipamento.findMany({ orderBy: { nome: "asc" } }),
  ]);

  // Sugestões para o campo de tipo, para reduzir o erro de digitação que
  // quebraria o casamento com Equipamento.tipo na hora de alocar.
  const tiposDeEquipamento = Array.from(new Set(equipamentos.map((e) => e.tipo).filter(Boolean))) as string[];

  // As famílias já usadas viram sugestão, para o cadastro não criar "PRF",
  // "prf" e "P.R.F." como três grupos na vitrine.
  const familias = Array.from(
    new Set(servicos.map((s) => s.familia?.trim()).filter(Boolean).concat(servicos.map((s) => familiaDoNome(s.nome))))
  ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")) as string[];

  return (
    <>
      <Titulo>Serviços e equipamentos</Titulo>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <Cartao className="lg:col-span-2">
          <div className="font-display font-bold text-bordo text-sm mb-3">Serviços</div>
          {servicos.length === 0 ? (
            <Vazio>Nenhum serviço cadastrado.</Vazio>
          ) : (
            <Tabela cabecalho={["Serviço", "Categoria", "Duração", "Valor de tabela", "Repasse", "Equipamento", ""]}>
              {servicos.map((servico) => (
                <EditarServico
                  key={servico.id}
                  servico={servico}
                  tiposDeEquipamento={tiposDeEquipamento}
                  familias={familias}
                />
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">Novo serviço</div>
          <FormularioAcao acao={salvarServico} botao="Cadastrar serviço">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div>
              <Rotulo>Categoria</Rotulo>
              <Selecao name="categoria" defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Selecao>
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
                <Campo name="valorPadrao" placeholder="em branco = a negociar por clínica" />
              </div>
            </div>
            <div>
              <Rotulo>Repasse (valor fixo)</Rotulo>
              <Campo name="repasseFixo" placeholder="em branco = repasse padrão da operação" />
              <div className="text-[10px] text-gray-400 mt-1">
                Sempre valor fixo, nunca percentual (decisão da reunião de 14/09) — em branco,
                vale o percentual padrão configurado nos parâmetros da operação.
              </div>
            </div>
            <div>
              <Rotulo>Exige equipamento?</Rotulo>
              <Selecao name="exigeEquipamento" defaultValue="nao">
                <option value="nao">Não</option>
                <option value="sim">Sim — reserva um aparelho na alocação</option>
                <option value="ilimitado">Sim, mas sem limite de quantidade</option>
              </Selecao>
              <div className="text-[10px] text-gray-400 mt-1">
                &ldquo;Sem limite&rdquo; para aparelho que a operação tem de sobra, ou que o
                profissional leva o próprio: o serviço continua exigindo equipamento, mas não
                disputa o estoque — senão um item abundante limita a agenda como se fosse escasso.
              </div>
            </div>
            <div>
              <Rotulo>Família (agrupa na vitrine pública)</Rotulo>
              <Campo name="familia" list="familias" placeholder="ex.: PRF" />
              <datalist id="familias">
                {familias.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <div className="text-[10px] text-gray-400 mt-1 mb-3">
                Vazio, o sistema deduz do nome. É o agrupamento comercial — “PRF”, “Piezo” —, que
                atravessa as categorias.
              </div>
            </div>
            <div>
              <Rotulo>Tipo de equipamento exigido</Rotulo>
              <Campo name="tipoEquipamento" list="tipos-equipamento" placeholder="ex.: Laser LiteTouch" />
              <datalist id="tipos-equipamento">
                {tiposDeEquipamento.map((tipo) => (
                  <option key={tipo} value={tipo} />
                ))}
              </datalist>
              <div className="text-[10px] text-gray-400 mt-1">
                Precisa casar exatamente com o &ldquo;Tipo&rdquo; do equipamento cadastrado abaixo —
                é por esse campo que a alocação reserva o aparelho certo, não só &ldquo;algum
                aparelho livre&rdquo;. Só importa quando &ldquo;Exige equipamento&rdquo; é Sim.
              </div>
            </div>
          </FormularioAcao>
        </Cartao>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
          <div className="font-display font-bold text-bordo text-sm mb-3">Equipamentos</div>
          {equipamentos.length === 0 ? (
            <Vazio>Nenhum equipamento cadastrado.</Vazio>
          ) : (
            <Tabela cabecalho={["Equipamento", "Tipo", "Patrimônio", "Status"]}>
              {equipamentos.map((equipamento) => (
                <tr key={equipamento.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-bordo">{equipamento.nome}</td>
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
          <div className="font-display font-bold text-bordo text-sm mb-3">Novo equipamento</div>
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
