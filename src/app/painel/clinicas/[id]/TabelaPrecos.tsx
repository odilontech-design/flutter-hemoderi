"use client";

import { useState, useTransition } from "react";
import { Botao, Campo, Tabela } from "@/components/ui";
import { salvarPreco } from "@/app/actions/cadastros";
import { formatarReais } from "@/lib/dinheiro";

type LinhaServico = {
  id: string;
  nome: string;
  valorPadraoCentavos: number;
  negociadoCentavos: number | null;
};

/**
 * Uma linha por serviço, com o preço negociado editável no lugar.
 *
 * Salva linha a linha em vez de tudo de uma vez: quem ajusta preço mexe em um
 * serviço e confere, não reescreve a tabela inteira — e um formulário único
 * transformaria a correção de um valor num risco de sobrescrever os outros.
 */
export function TabelaPrecos({ clinicaId, servicos }: { clinicaId: string; servicos: LinhaServico[] }) {
  return (
    <Tabela cabecalho={["Serviço", "Tabela", "Preço desta clínica", ""]}>
      {servicos.map((servico) => (
        <LinhaPreco key={servico.id} clinicaId={clinicaId} servico={servico} />
      ))}
    </Tabela>
  );
}

function LinhaPreco({ clinicaId, servico }: { clinicaId: string; servico: LinhaServico }) {
  const [valor, setValor] = useState(
    servico.negociadoCentavos != null ? (servico.negociadoCentavos / 100).toFixed(2).replace(".", ",") : ""
  );
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");

  function salvar() {
    setMensagem("");
    iniciar(async () => {
      const dados = new FormData();
      dados.set("clinicaId", clinicaId);
      dados.set("servicoId", servico.id);
      dados.set("valor", valor);
      const resultado = await salvarPreco({ ok: false }, dados);
      setMensagem(resultado.ok ? "salvo ✓" : (resultado.erro ?? "erro"));
    });
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-3 font-semibold text-navy">{servico.nome}</td>
      <td className="py-2 pr-3 text-gray-400">{formatarReais(servico.valorPadraoCentavos)}</td>
      <td className="py-2 pr-3">
        <Campo
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="usa a tabela"
          className="!w-32 !py-1.5"
        />
      </td>
      <td className="py-2 whitespace-nowrap">
        <Botao variante="secundario" disabled={pendente} onClick={salvar}>
          Salvar
        </Botao>
        {mensagem && <span className="text-[10px] text-gray-500 ml-2">{mensagem}</span>}
      </td>
    </tr>
  );
}
