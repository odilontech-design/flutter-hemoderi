"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarEquipamento } from "@/app/actions/cadastros";
import { FormularioAcao } from "@/components/FormularioAcao";
import { Area, Botao, Campo, Rotulo, Selecao } from "@/components/ui";

const ROTULO_EQUIPAMENTO: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_USO: "Em uso",
  MANUTENCAO: "Manutenção",
  INATIVO: "Inativo",
};

type Equipamento = {
  id: string;
  nome: string;
  tipo: string | null;
  patrimonio: string | null;
  status: string;
  observacoes: string | null;
};

/**
 * Uma linha da lista de equipamentos, editável pelo app (pedido de 28/10):
 * nome, tipo, patrimônio, status (manutenção, inativo…) e observações. Antes só
 * dava para cadastrar — qualquer correção virava pedido ao desenvolvedor.
 */
export function EditarEquipamento({ equipamento }: { equipamento: Equipamento }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0">
        <td className="py-2 pr-3 font-semibold text-bordo">
          {equipamento.nome}
          {equipamento.observacoes && <div className="text-[10px] font-normal text-gray-400">{equipamento.observacoes}</div>}
        </td>
        <td className="py-2 pr-3 text-gray-500">{equipamento.tipo ?? "—"}</td>
        <td className="py-2 pr-3 text-gray-500">{equipamento.patrimonio ?? "—"}</td>
        <td className="py-2 pr-3">{ROTULO_EQUIPAMENTO[equipamento.status] ?? equipamento.status}</td>
        <td className="py-2 text-right">
          <Botao type="button" variante="secundario" onClick={() => setAberto((a) => !a)}>
            {aberto ? "Fechar" : "Editar"}
          </Botao>
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-gray-100 bg-bege/30">
          <td colSpan={5} className="p-3">
            <FormularioAcao
              acao={salvarEquipamento}
              botao="Salvar equipamento"
              limparAoSalvar={false}
              aoSalvar={() => {
                setAberto(false);
                router.refresh();
              }}
            >
              <input type="hidden" name="id" value={equipamento.id} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Rotulo>Nome</Rotulo>
                  <Campo name="nome" required defaultValue={equipamento.nome} />
                </div>
                <div>
                  <Rotulo>Tipo</Rotulo>
                  <Campo name="tipo" defaultValue={equipamento.tipo ?? ""} />
                  <div className="text-[10px] text-gray-400 mt-0.5">Igual ao tipo exigido pelo serviço, para a alocação reconhecer o equipamento.</div>
                </div>
                <div>
                  <Rotulo>Patrimônio</Rotulo>
                  <Campo name="patrimonio" defaultValue={equipamento.patrimonio ?? ""} />
                </div>
                <div>
                  <Rotulo>Status</Rotulo>
                  <Selecao name="status" defaultValue={equipamento.status}>
                    {Object.entries(ROTULO_EQUIPAMENTO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                </div>
              </div>
              <div>
                <Rotulo>Observações</Rotulo>
                <Area name="observacoes" rows={2} defaultValue={equipamento.observacoes ?? ""} />
              </div>
            </FormularioAcao>
          </td>
        </tr>
      )}
    </>
  );
}
