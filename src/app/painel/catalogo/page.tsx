import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { familiaDoNome } from "@/lib/familia";
import { EditarServico } from "./EditarServico";

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
      <Titulo
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/painel/catalogo/equipamento/novo"
              className="border border-gray-300 text-bordo text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-gray-50"
            >
              + Novo equipamento
            </Link>
            <Link
              href="/painel/catalogo/servico/novo"
              className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
            >
              + Novo serviço
            </Link>
          </div>
        }
      >
        Serviços e equipamentos
      </Titulo>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">Serviços</div>
        {servicos.length === 0 ? (
          <Vazio>Nenhum serviço cadastrado.</Vazio>
        ) : (
          <Tabela
            cabecalho={[
              "Serviço",
              { texto: "Categoria", ocultoMovel: true },
              { texto: "Duração", ocultoMovel: true },
              "Valor de tabela",
              { texto: "Repasse", ocultoMovel: true },
              { texto: "Equipamento", ocultoMovel: true },
              "",
            ]}
          >
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
    </>
  );
}
