"use client";

import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarServico } from "@/app/actions/cadastros";

const ROTULO_CATEGORIA: Record<string, string> = {
  ODONTOLOGIA: "Odontologia",
  ESTETICA: "Estética",
  SAUDE: "Saúde",
};

export function NovoServicoForm({
  familias,
  tiposDeEquipamento,
}: {
  familias: string[];
  tiposDeEquipamento: string[];
}) {
  const router = useRouter();

  return (
    <FormularioAcao
      acao={salvarServico}
      botao="Cadastrar serviço"
      aoSalvar={() => router.push("/painel/catalogo")}
    >
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
  );
}
