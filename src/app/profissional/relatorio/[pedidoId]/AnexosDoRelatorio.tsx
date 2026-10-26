"use client";

import { useRef, useState } from "react";
import { Rotulo } from "@/components/ui";
import { reduzirImagem } from "@/lib/reduzir-imagem";
import { MAXIMO_DE_ANEXOS, anexosAceitos, tamanhoLegivel } from "@/lib/anexos-relatorio";

export type AnexoGuardado = { id: string; nome: string; tamanho: number };

/**
 * "Anexar arquivos" no envio do relatório (reunião de 28/10): fotos do
 * atendimento e documentos, opcionais, até 5. Os arquivos novos ficam na lista
 * aqui e entram no FormData no envio (`anexosNovos`, lido pelo formulário); os
 * que já estavam guardados aparecem com "remover", que vira `removerAnexo`.
 *
 * A foto é reduzida no navegador (o celular tira 5–8 MB) antes de entrar na
 * lista, e a lista inteira é conferida contra o limite do envio.
 */
export function AnexosDoRelatorio({
  guardados,
  novos,
  aoMudar,
}: {
  guardados: AnexoGuardado[];
  novos: File[];
  aoMudar: (novos: File[]) => void;
}) {
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const restantes = guardados.filter((g) => !removidos.includes(g.id));

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(evento.currentTarget.files ?? []);
    evento.currentTarget.value = "";
    if (escolhidos.length === 0) return;
    setAviso(null);
    const prontos = await Promise.all(escolhidos.map((arquivo) => reduzirImagem(arquivo)));
    const lista = [...novos, ...prontos];
    const problema = anexosAceitos({ jaGuardados: restantes.length, novos: lista });
    if (problema) return setAviso(problema);
    aoMudar(lista);
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2">
      <Rotulo>Anexos (opcional)</Rotulo>
      <div className="text-[10px] text-gray-500">
        Fotos do atendimento ou documentos: JPG, PNG ou PDF, até {MAXIMO_DE_ANEXOS} arquivos. Só você e a central veem.
      </div>

      {removidos.map((id) => (
        <input key={id} type="hidden" name="removerAnexo" value={id} />
      ))}

      {(restantes.length > 0 || novos.length > 0) && (
        <ul className="divide-y divide-gray-100 text-xs">
          {restantes.map((g) => (
            <li key={g.id} className="py-1.5 flex items-center justify-between gap-2">
              <a href={`/api/anexos/${g.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-semibold text-bordo hover:underline">
                {g.nome}
              </a>
              <span className="shrink-0 text-gray-400">{tamanhoLegivel(g.tamanho)} · já enviado</span>
              <button
                type="button"
                onClick={() => setRemovidos((atuais) => [...atuais, g.id])}
                className="shrink-0 text-[11px] font-semibold text-red-600 hover:underline"
              >
                remover
              </button>
            </li>
          ))}
          {novos.map((arquivo, i) => (
            <li key={`${arquivo.name}-${i}`} className="py-1.5 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-gray-700">{arquivo.name}</span>
              <span className="shrink-0 text-gray-400">{tamanhoLegivel(arquivo.size)} · novo</span>
              <button
                type="button"
                onClick={() => aoMudar(novos.filter((_, j) => j !== i))}
                className="shrink-0 text-[11px] font-semibold text-red-600 hover:underline"
              >
                tirar
              </button>
            </li>
          ))}
        </ul>
      )}

      {restantes.length + novos.length < MAXIMO_DE_ANEXOS && (
        <>
          <input
            ref={campo}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={aoEscolher}
            className="sr-only"
            id="anexos-do-relatorio"
          />
          <label
            htmlFor="anexos-do-relatorio"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-bordo/40 px-3 py-2 text-xs font-semibold text-bordo hover:bg-bordo/5"
          >
            📎 Anexar arquivos
          </label>
        </>
      )}
      {aviso && <div className="text-[11px] text-red-600">{aviso}</div>}
    </div>
  );
}
