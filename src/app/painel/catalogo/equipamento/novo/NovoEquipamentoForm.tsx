"use client";

import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarEquipamento } from "@/app/actions/cadastros";

const ROTULO_EQUIPAMENTO: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_USO: "Em uso",
  MANUTENCAO: "Manutenção",
  INATIVO: "Inativo",
};

export function NovoEquipamentoForm() {
  const router = useRouter();

  return (
    <FormularioAcao
      acao={salvarEquipamento}
      botao="Cadastrar equipamento"
      aoSalvar={() => router.push("/painel/catalogo")}
    >
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
  );
}
