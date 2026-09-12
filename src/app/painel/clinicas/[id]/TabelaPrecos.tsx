"use client";

import { useState, useTransition } from "react";
import { Botao, Campo } from "@/components/ui";
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
 *
 * Linhas em flexbox, não `<table>`: misturar texto com um campo de largura
 * fixa e um botão é exatamente o caso em que o table-layout:auto do navegador
 * reparte mal a largura entre colunas tão diferentes — o botão pode vazar
 * pixels pra fora da própria tabela sem aviso. Flexbox com quebra de linha
 * lida com isso de graça: no celular, cada pedaço quebra pra linha de baixo
 * em vez de espremer ou cortar.
 */
export function TabelaPrecos({ clinicaId, servicos }: { clinicaId: string; servicos: LinhaServico[] }) {
  return (
    <div>
      <div className="hidden sm:flex text-left text-gray-500 border-b border-gray-200 text-xs font-semibold py-2 gap-4">
        <div className="flex-1">Serviço</div>
        <div className="w-20 shrink-0">Tabela</div>
        <div className="w-32 shrink-0">Preço desta clínica</div>
        <div className="w-20 shrink-0" />
      </div>
      {servicos.map((servico) => (
        <LinhaPreco key={servico.id} clinicaId={clinicaId} servico={servico} />
      ))}
    </div>
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 last:border-0 py-3 text-xs">
      <div className="font-semibold text-bordo basis-full sm:basis-0 sm:flex-1">{servico.nome}</div>
      <div className="text-gray-400 sm:w-20 sm:shrink-0">
        <span className="sm:hidden text-gray-400">Tabela: </span>
        {formatarReais(servico.valorPadraoCentavos)}
      </div>
      <div className="sm:w-32 sm:shrink-0">
        <Campo
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="usa a tabela"
          className="!py-1.5 w-32"
        />
      </div>
      <div className="flex items-center gap-2 sm:w-20 sm:shrink-0">
        <Botao variante="secundario" disabled={pendente} onClick={salvar}>
          Salvar
        </Botao>
        {mensagem && <span className="text-[10px] text-gray-500">{mensagem}</span>}
      </div>
    </div>
  );
}
