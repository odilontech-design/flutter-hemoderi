"use client";

import { useState } from "react";
import { salvarCupom, alternarCupom, excluirCupom } from "@/app/actions/cupons";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { Botao, Campo, Rotulo, Tabela, Vazio } from "@/components/ui";
import { formatarReais } from "@/lib/dinheiro";

type Servico = { id: string; nome: string };

type Cupom = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: "PERCENTUAL" | "VALOR_FIXO";
  valor: number;
  servicoIds: string[];
  validoAte: Date | null;
  limiteUsos: number | null;
  usosRealizados: number;
  ativo: boolean;
};

function resumoServicos(servicoIds: string[], servicos: Servico[]): string {
  if (servicoIds.length === 0) return "Todos";
  const nomes = servicoIds
    .map((id) => servicos.find((s) => s.id === id)?.nome ?? id)
    .slice(0, 3);
  const resto = servicoIds.length - nomes.length;
  return nomes.join(", ") + (resto > 0 ? ` +${resto}` : "");
}

function formatarValidade(validoAte: Date | null): string {
  if (!validoAte) return "Sem limite";
  return new Date(validoAte).toLocaleDateString("pt-BR");
}

function SeletorServicos({ servicos, selecionados }: { servicos: Servico[]; selecionados: string[] }) {
  const [ids, setIds] = useState<string[]>(selecionados);

  return (
    <div>
      <Rotulo>Serviços elegíveis</Rotulo>
      <input type="hidden" name="servicoIds" value={ids.join(",")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
        {servicos.map((s) => (
          <label key={s.id} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
            <input
              type="checkbox"
              checked={ids.includes(s.id)}
              onChange={(e) => {
                setIds((prev) =>
                  e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                );
              }}
              className="rounded border-gray-300 text-bordo focus:ring-bordo/30"
            />
            <span className="truncate">{s.nome}</span>
          </label>
        ))}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">Nenhum marcado = vale para todos.</div>
    </div>
  );
}

function LinhaCupom({ cupom, servicos }: { cupom: Cupom; servicos: Servico[] }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <tr className={`border-b border-gray-100 last:border-0 ${!cupom.ativo ? "opacity-50" : ""}`}>
        <td className="py-2 pr-3">
          <span className="font-mono font-bold text-bordo">{cupom.codigo}</span>
          {cupom.descricao && <div className="text-[10px] text-gray-400">{cupom.descricao}</div>}
        </td>
        <td className="py-2 pr-3 whitespace-nowrap">
          {cupom.tipo === "PERCENTUAL" ? `${cupom.valor}%` : formatarReais(cupom.valor)}
        </td>
        <td className="py-2 pr-3 text-[11px] text-gray-500">{resumoServicos(cupom.servicoIds, servicos)}</td>
        <td className="py-2 pr-3 text-[11px] text-gray-500 whitespace-nowrap">{formatarValidade(cupom.validoAte)}</td>
        <td className="py-2 pr-3 whitespace-nowrap">
          {cupom.limiteUsos !== null
            ? `${cupom.usosRealizados}/${cupom.limiteUsos}`
            : `${cupom.usosRealizados} (ilimitado)`}
        </td>
        <td className="py-2">
          <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
            <Botao variante="secundario" onClick={() => setAberto((v) => !v)}>
              {aberto ? "Fechar" : "Editar"}
            </Botao>
            <BotaoAcao
              acao={alternarCupom.bind(null, cupom.id, !cupom.ativo)}
            >
              {cupom.ativo ? "Desativar" : "Ativar"}
            </BotaoAcao>
            <BotaoAcao
              acao={excluirCupom.bind(null, cupom.id)}
              variante="perigo"
              confirmar={`Excluir o cupom "${cupom.codigo}"?`}
            >
              Excluir
            </BotaoAcao>
          </div>
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-gray-100 last:border-0 bg-bege/40">
          <td colSpan={6} className="py-4 px-3">
            <FormularioCupom servicos={servicos} cupom={cupom} botao="Salvar cupom" />
          </td>
        </tr>
      )}
    </>
  );
}

function FormularioCupom({
  servicos,
  cupom,
  botao = "Criar cupom",
}: {
  servicos: Servico[];
  cupom?: Cupom;
  botao?: string;
}) {
  const [tipo, setTipo] = useState<"PERCENTUAL" | "VALOR_FIXO">(cupom?.tipo ?? "PERCENTUAL");

  return (
    <FormularioAcao acao={salvarCupom} botao={botao} limparAoSalvar={!cupom}>
      {cupom && <input type="hidden" name="id" value={cupom.id} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Rotulo>Código</Rotulo>
          <Campo name="codigo" placeholder="RETORNO10" defaultValue={cupom?.codigo ?? ""} required />
        </div>
        <div>
          <Rotulo>Tipo</Rotulo>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "PERCENTUAL" | "VALOR_FIXO")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-bordo/30 focus:border-bordo"
          >
            <option value="PERCENTUAL">Percentual (%)</option>
            <option value="VALOR_FIXO">Valor fixo (R$)</option>
          </select>
        </div>
        <div>
          <Rotulo>{tipo === "PERCENTUAL" ? "Desconto (%)" : "Desconto (R$)"}</Rotulo>
          <Campo
            name="valor"
            inputMode="decimal"
            placeholder={tipo === "PERCENTUAL" ? "10" : "50,00"}
            defaultValue={
              cupom
                ? cupom.tipo === "VALOR_FIXO"
                  ? (cupom.valor / 100).toFixed(2).replace(".", ",")
                  : String(cupom.valor)
                : ""
            }
            required
          />
        </div>
        <div>
          <Rotulo>Descrição (opcional)</Rotulo>
          <Campo name="descricao" placeholder="Cortesia por atraso" defaultValue={cupom?.descricao ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div>
          <Rotulo>Validade (opcional)</Rotulo>
          <Campo
            type="date"
            name="validoAte"
            defaultValue={
              cupom?.validoAte
                ? new Date(cupom.validoAte).toISOString().split("T")[0]
                : ""
            }
          />
        </div>
        <div>
          <Rotulo>Limite de usos (opcional)</Rotulo>
          <Campo
            name="limiteUsos"
            inputMode="numeric"
            placeholder="Ilimitado"
            defaultValue={cupom?.limiteUsos ?? ""}
          />
        </div>
      </div>

      <div className="mt-3">
        <SeletorServicos servicos={servicos} selecionados={cupom?.servicoIds ?? []} />
      </div>
    </FormularioAcao>
  );
}

export function ListaCupons({ cupons, servicos }: { cupons: Cupom[]; servicos: Servico[] }) {
  return (
    <>
      {cupons.length === 0 ? (
        <Vazio>Nenhum cupom criado ainda.</Vazio>
      ) : (
        <Tabela cabecalho={["Cupom", "Desconto", "Serviços", "Validade", "Usos", "Ações"]}>
          {cupons.map((c) => (
            <LinhaCupom key={c.id} cupom={c} servicos={servicos} />
          ))}
        </Tabela>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="font-display font-bold text-bordo text-xs mb-2">Novo cupom</div>
        <FormularioCupom servicos={servicos} />
      </div>
    </>
  );
}
