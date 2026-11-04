"use client";

import { FORM_EM_MASSA } from "./AcoesEmMassa";

/** Marca ou desmarca todas as linhas da tabela de uma vez. */
export function MarcarTodos() {
  return (
    <input
      type="checkbox"
      aria-label="Marcar todos"
      className="h-4 w-4 accent-bordo"
      onChange={(e) => {
        document
          .querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${FORM_EM_MASSA}"]`)
          .forEach((caixa) => (caixa.checked = e.target.checked));
      }}
    />
  );
}
