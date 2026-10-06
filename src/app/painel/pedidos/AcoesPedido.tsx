"use client";

import { useState, useTransition } from "react";
import type { PerfilInterno, StatusPedido } from "@prisma/client";
import { Botao, Campo, Selecao } from "@/components/ui";
import { perfilPermite } from "@/lib/papeis";
import {
  alocarPedido,
  cancelarPedido,
  confirmarPedido,
  definirAjudaDeCusto,
  desalocarPedido,
  marcarResultadoInterno,
  reagendarPedidoInterno,
} from "@/app/actions/pedidos";

/** Motivos padronizados de realocação (ata de 21/09) — "Outro" libera o texto. */
const MOTIVOS_DESALOCACAO = [
  { valor: "recusa-endereco", rotulo: "Recusa de endereço" },
  { valor: "forca-maior", rotulo: "Força maior" },
  { valor: "motivo-logistico", rotulo: "Motivo logístico" },
  { valor: "outro", rotulo: "Outro" },
];

/**
 * Pede um motivo (selecionável ou digitado) antes de confirmar uma ação
 * destrutiva. Fica fechado até o botão que dispara a ação ser clicado —
 * evita abrir um campo de texto na cara de quem só está lendo a esteira.
 */
export function AcaoComMotivo({
  rotulo,
  variante,
  disabled,
  motivos,
  placeholder,
  onConfirmar,
}: {
  rotulo: string;
  variante: "secundario" | "perigo";
  disabled?: boolean;
  /** Quando ausente, o motivo é sempre texto livre. */
  motivos?: { valor: string; rotulo: string }[];
  placeholder: string;
  onConfirmar: (motivo: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(motivos?.[0]?.valor ?? "");
  const [texto, setTexto] = useState("");

  if (!aberto) {
    return (
      <Botao variante={variante} disabled={disabled} onClick={() => setAberto(true)}>
        {rotulo}
      </Botao>
    );
  }

  const usaTexto = !motivos || selecionado === "outro";
  const motivoFinal = usaTexto ? texto.trim() : motivos!.find((m) => m.valor === selecionado)?.rotulo ?? "";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {motivos && (
        <Selecao
          aria-label={`Motivo — ${rotulo}`}
          value={selecionado}
          onChange={(e) => setSelecionado(e.target.value)}
          className="!w-auto !py-1.5 !min-h-[40px] sm:!min-h-0 text-xs"
        >
          {motivos.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.rotulo}
            </option>
          ))}
        </Selecao>
      )}
      {usaTexto && (
        <Campo
          aria-label={`Motivo — ${rotulo}`}
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="!w-40 !py-1.5"
        />
      )}
      <Botao
        variante={variante}
        disabled={disabled || !motivoFinal}
        onClick={() => {
          onConfirmar(motivoFinal);
          setAberto(false);
          setTexto("");
        }}
      >
        Confirmar
      </Botao>
      <Botao variante="secundario" disabled={disabled} onClick={() => setAberto(false)}>
        Voltar
      </Botao>
    </div>
  );
}

/**
 * Ajuda de custo prevista (ata de 05/10): a logística é quem sabe a distância e
 * o transporte, então o valor nasce aqui, na alocação, e chega pré-preenchido no
 * relatório do profissional. Opcional — vazio é "nada combinado".
 */
export function CampoAjudaDeCusto({
  valor,
  onChange,
  className = "",
}: {
  valor: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  return (
    <Campo
      aria-label="Ajuda de custo prevista (R$)"
      title="Ajuda de custo prevista (opcional)"
      inputMode="decimal"
      placeholder="Ajuda de custo R$"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`!w-32 !py-1.5 text-xs ${className}`}
    />
  );
}

/**
 * Ajuda de custo de um atendimento já alocado: corrige sem derrubar o aceite.
 * Autônomo (faz a própria chamada) para servir tanto ao cartão do pedido quanto
 * à linha de cada serviço dentro do cartão de um agendamento com vários.
 */
export function EditarAjudaDeCusto({ pedidoId, inicial }: { pedidoId: string; inicial: number | null }) {
  const [valor, setValor] = useState(inicial != null ? (inicial / 100).toFixed(2).replace(".", ",") : "");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CampoAjudaDeCusto valor={valor} onChange={setValor} />
      <Botao
        variante="secundario"
        disabled={pendente}
        onClick={() => {
          setErro(null);
          iniciar(async () => {
            const resultado = await definirAjudaDeCusto(pedidoId, valor);
            if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível salvar.");
          });
        }}
      >
        Salvar ajuda
      </Botao>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}

/**
 * Nova data e horário antes de reagendar — sem checar disponibilidade no
 * navegador (a `reagendarPedidoInterno` já confere e recusa com o motivo, o
 * mesmo caminho que o "Novo agendamento" interno usa). Fecha sem confirmar,
 * igual ao padrão de `AcaoComMotivo`.
 */
function AcaoReagendar({ disabled, onConfirmar }: { disabled?: boolean; onConfirmar: (data: string, hora: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");

  if (!aberto) {
    return (
      <Botao variante="secundario" disabled={disabled} onClick={() => setAberto(true)}>
        Reagendar
      </Botao>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Campo
        aria-label="Nova data"
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="!w-auto !py-1.5"
      />
      <Campo
        aria-label="Novo horário"
        type="time"
        step={900}
        value={hora}
        onChange={(e) => setHora(e.target.value)}
        className="!w-auto !py-1.5"
      />
      <Botao
        variante="secundario"
        disabled={disabled || !data || !hora}
        onClick={() => {
          onConfirmar(data, hora);
          setAberto(false);
        }}
      >
        Confirmar
      </Botao>
      <Botao variante="secundario" disabled={disabled} onClick={() => setAberto(false)}>
        Voltar
      </Botao>
    </div>
  );
}

/**
 * As ações possíveis para o pedido no estado em que ele está.
 *
 * A tela só oferece o que a máquina de status permite (lib/pedido.ts). Botão
 * que aparece e depois recusa é a forma mais barata de fazer a equipe
 * desconfiar do sistema — e a recusa aqui é comum: alocar esbarra em agenda,
 * sala e equipamento.
 *
 * Alocar/desalocar, reagendar e cancelar também recusam por PERFIL (ata de
 * 21/09): alocação é da logística, reagendamento e cancelamento são do
 * comercial. Esconder o botão de quem não pode não substitui a checagem na
 * action — é só o que evita a pessoa clicar em algo que a própria action vai
 * recusar, igual ao padrão já usado no menu lateral para financeiro/acessos.
 */
export function AcoesPedido({
  pedidoId,
  status,
  perfil,
  profissionais,
  profissionalSolicitadoId,
  ajudaCustoCentavos = null,
}: {
  pedidoId: string;
  status: StatusPedido;
  perfil: PerfilInterno;
  profissionais: { id: string; nome: string }[];
  /** Quem a clínica pediu no portal, quando pediu alguém. */
  profissionalSolicitadoId?: string | null;
  /** Ajuda de custo prevista já definida na alocação. */
  ajudaCustoCentavos?: number | null;
}) {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  // Já vem preenchido com quem a clínica pediu: confirmar o que foi pedido é
  // o caso comum, e obrigar a reencontrar o nome na lista é atrito à toa.
  const [profissionalId, setProfissionalId] = useState(profissionalSolicitadoId ?? "");
  const [ajudaCusto, setAjudaCusto] = useState("");

  function executar(acao: () => Promise<{ ok: boolean; erro?: string; avisos?: string[] }>) {
    setMensagem(null);
    iniciar(async () => {
      const resultado = await acao();
      if (!resultado.ok) {
        setMensagem({ texto: resultado.erro ?? "Não foi possível concluir.", erro: true });
      } else if (resultado.avisos?.length) {
        setMensagem({ texto: resultado.avisos.join(" "), erro: false });
      }
    });
  }

  const terminal = status === "REALIZADO" || status === "FALTOU" || status === "CANCELADO";
  if (terminal) return null;

  const podeAlocar = perfilPermite(perfil, "LOGISTICA");
  const podeCancelar = perfilPermite(perfil, "COMERCIAL");
  // Mesmo perfil do cancelamento — ata de 21/09: é a Ana quem decide, com a
  // clínica, se o atendimento muda de data.
  const podeReagendar = perfilPermite(perfil, "COMERCIAL");

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
      {status === "SOLICITADO" && (
        <Botao disabled={pendente} onClick={() => executar(() => confirmarPedido(pedidoId))}>
          Confirmar
        </Botao>
      )}

      {status === "CONFIRMADO" && podeAlocar && (
        <>
          <Selecao
            aria-label="Profissional para alocar"
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="!w-auto !py-1.5 !min-h-[40px] sm:!min-h-0 text-xs"
          >
            <option value="">Alocar profissional…</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id === profissionalSolicitadoId ? " (pedido pela clínica)" : ""}
              </option>
            ))}
          </Selecao>
          <CampoAjudaDeCusto valor={ajudaCusto} onChange={setAjudaCusto} />
          <Botao
            disabled={pendente || !profissionalId}
            onClick={() => executar(() => alocarPedido(pedidoId, profissionalId, ajudaCusto))}
          >
            Alocar
          </Botao>
        </>
      )}

      {status === "ALOCADO" && (
        <>
          <Botao disabled={pendente} onClick={() => executar(() => marcarResultadoInterno(pedidoId, true))}>
            Marcar realizado
          </Botao>
          <Botao
            variante="secundario"
            disabled={pendente}
            onClick={() => executar(() => marcarResultadoInterno(pedidoId, false))}
          >
            Registrar falta
          </Botao>
          {podeAlocar && (
            <EditarAjudaDeCusto pedidoId={pedidoId} inicial={ajudaCustoCentavos} />
          )}
          {podeAlocar && (
            <AcaoComMotivo
              rotulo="Desalocar"
              variante="secundario"
              disabled={pendente}
              motivos={MOTIVOS_DESALOCACAO}
              placeholder="Descreva o motivo"
              onConfirmar={(motivo) => executar(() => desalocarPedido(pedidoId, motivo))}
            />
          )}
        </>
      )}

      {podeReagendar && (
        <AcaoReagendar
          disabled={pendente}
          onConfirmar={(data, hora) => executar(() => reagendarPedidoInterno(pedidoId, data, hora))}
        />
      )}

      {podeCancelar && (
        <AcaoComMotivo
          rotulo="Cancelar"
          variante="perigo"
          disabled={pendente}
          placeholder="Motivo do cancelamento"
          onConfirmar={(motivo) => executar(() => cancelarPedido(pedidoId, motivo))}
        />
      )}

      {mensagem && (
        <span className={`text-[11px] ${mensagem.erro ? "text-red-600" : "text-amber-700"}`}>{mensagem.texto}</span>
      )}
    </div>
  );
}
