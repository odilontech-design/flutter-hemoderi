"use client";

import { useState } from "react";
import { salvarServico, alternarServico } from "@/app/actions/cadastros";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { Area, Botao, Campo, OCULTO_MOVEL, Rotulo, Selecao } from "@/components/ui";
import { formatarPercent, formatarReais } from "@/lib/dinheiro";

/** Centavos → texto editável ("1234,56"), o mesmo formato que TabelaPrecos usa. */
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

type Servico = {
  id: string;
  nome: string;
  categoria: "ODONTOLOGIA" | "ESTETICA" | "SAUDE";
  descricao: string | null;
  duracaoMin: number;
  valorPadraoCentavos: number;
  repassePercent: number | null;
  repasseFixoCentavos: number | null;
  exigeEquipamento: boolean;
  equipamentoIlimitado: boolean;
  tipoEquipamento: string | null;
  familia: string | null;
  ativo: boolean;
};

const ROTULO_CATEGORIA: Record<Servico["categoria"], string> = {
  ODONTOLOGIA: "Odontologia",
  ESTETICA: "Estética",
  SAUDE: "Saúde",
};

/**
 * Uma linha do catálogo, com edição de todo campo.
 *
 * Fechada, é a linha compacta de sempre — nome, categoria, duração, valor,
 * repasse, equipamento e as ações. Aberta, essas mesmas colunas dão lugar a
 * um formulário completo numa segunda linha (mesmo padrão do que
 * `AvaliarAtendimento` faz num cartão): editar não é uma tela à parte,
 * porque a operação corrige um valor errado no catálogo com a mesma
 * frequência com que cadastra um serviço novo, e mandar isso para uma
 * página própria só adiciona um clique a mais toda vez.
 */
export function EditarServico({
  servico,
  tiposDeEquipamento,
  familias,
}: {
  servico: Servico;
  tiposDeEquipamento: string[];
  familias: string[];
}) {
  const [aberto, setAberto] = useState(false);

  const exigeEquipamentoAtual = !servico.exigeEquipamento
    ? "nao"
    : servico.equipamentoIlimitado
      ? "ilimitado"
      : "sim";

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0">
        <td className="py-2 pr-3 font-semibold text-bordo">{servico.nome}</td>
        <td className={`py-2 pr-3 text-gray-500 ${OCULTO_MOVEL}`}>{ROTULO_CATEGORIA[servico.categoria]}</td>
        <td className={`py-2 pr-3 text-gray-500 ${OCULTO_MOVEL}`}>{servico.duracaoMin} min</td>
        <td className="py-2 pr-3">
          {servico.valorPadraoCentavos > 0 ? (
            formatarReais(servico.valorPadraoCentavos)
          ) : (
            <span className="text-gray-400">a negociar</span>
          )}
        </td>
        <td className={`py-2 pr-3 ${OCULTO_MOVEL}`}>
          {servico.repasseFixoCentavos != null ? (
            formatarReais(servico.repasseFixoCentavos)
          ) : servico.repassePercent != null ? (
            formatarPercent(servico.repassePercent)
          ) : (
            <span className="text-gray-400">padrão</span>
          )}
        </td>
        <td className={`py-2 pr-3 text-gray-500 ${OCULTO_MOVEL}`}>
          {!servico.exigeEquipamento ? (
            "—"
          ) : (
            <>
              {servico.tipoEquipamento ?? "exige (tipo livre)"}
              {servico.equipamentoIlimitado && (
                <div className="text-[10px] text-gray-400">sem limite de quantidade</div>
              )}
            </>
          )}
        </td>
        <td className="py-2">
          <div className="flex flex-nowrap gap-1.5 whitespace-nowrap">
            <Botao variante="secundario" onClick={() => setAberto((v) => !v)}>
              {aberto ? "Fechar" : "Editar"}
            </Botao>
            <BotaoAcao
              acao={alternarServico.bind(null, servico.id, !servico.ativo)}
              variante={servico.ativo ? "perigo" : "secundario"}
            >
              {servico.ativo ? "Desativar" : "Reativar"}
            </BotaoAcao>
          </div>
        </td>
      </tr>

      {aberto && (
        <tr className="border-b border-gray-100 last:border-0 bg-bege/40">
          <td colSpan={7} className="py-4 px-3">
            <FormularioAcao acao={salvarServico} botao="Salvar alterações" limparAoSalvar={false}>
              <input type="hidden" name="id" value={servico.id} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Nome</Rotulo>
                  <Campo name="nome" defaultValue={servico.nome} required />
                </div>
                <div>
                  <Rotulo>Categoria</Rotulo>
                  <Selecao name="categoria" defaultValue={servico.categoria}>
                    {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                </div>
              </div>
              <div>
                <Rotulo>Descrição</Rotulo>
                <Area name="descricao" rows={2} defaultValue={servico.descricao ?? ""} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Duração (min)</Rotulo>
                  <Campo
                    name="duracaoMin"
                    type="number"
                    min={15}
                    step={15}
                    defaultValue={servico.duracaoMin}
                  />
                </div>
                <div>
                  <Rotulo>Valor de tabela</Rotulo>
                  <Campo
                    name="valorPadrao"
                    placeholder="em branco = a negociar por clínica"
                    defaultValue={
                      servico.valorPadraoCentavos > 0 ? centavosParaTexto(servico.valorPadraoCentavos) : ""
                    }
                  />
                </div>
              </div>
              <div>
                <Rotulo>Repasse (valor fixo)</Rotulo>
                <Campo
                  name="repasseFixo"
                  placeholder="em branco = repasse padrão da operação"
                  defaultValue={
                    servico.repasseFixoCentavos != null ? centavosParaTexto(servico.repasseFixoCentavos) : ""
                  }
                />
                {servico.repassePercent != null && (
                  <div className="text-[10px] text-amber-700 mt-1">
                    Este serviço ainda carrega um repasse percentual antigo
                    ({formatarPercent(servico.repassePercent)}) — salvar aqui substitui por valor fixo
                    (ou pelo padrão, se ficar em branco); a política atual não usa mais percentual por
                    serviço.
                  </div>
                )}
              </div>
              <div>
                <Rotulo>Exige equipamento?</Rotulo>
                <Selecao name="exigeEquipamento" defaultValue={exigeEquipamentoAtual}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim — reserva um aparelho na alocação</option>
                  <option value="ilimitado">Sim, mas sem limite de quantidade</option>
                </Selecao>
              </div>
              <div>
                <Rotulo>Família (agrupa na vitrine pública)</Rotulo>
                <Campo
                  name="familia"
                  list={`familias-${servico.id}`}
                  placeholder="ex.: PRF"
                  defaultValue={servico.familia ?? ""}
                />
                <datalist id={`familias-${servico.id}`}>
                  {familias.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div>
                <Rotulo>Tipo de equipamento exigido</Rotulo>
                <Campo
                  name="tipoEquipamento"
                  list={`tipos-equipamento-${servico.id}`}
                  placeholder="ex.: Laser LiteTouch"
                  defaultValue={servico.tipoEquipamento ?? ""}
                />
                <datalist id={`tipos-equipamento-${servico.id}`}>
                  {tiposDeEquipamento.map((tipo) => (
                    <option key={tipo} value={tipo} />
                  ))}
                </datalist>
              </div>
            </FormularioAcao>
          </td>
        </tr>
      )}
    </>
  );
}
