"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { completarClientesPipedrive } from "@/app/actions/integracoes";

/**
 * Liga ao cliente (organização) que já existe no PipeDrive os negócios que
 * nasceram sem ele. Não mexe nos que já têm cliente e nunca cria cliente novo.
 */
export function CompletarClientes() {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");

  function rodar() {
    if (!window.confirm("Ligar ao cliente que já existe no PipeDrive os negócios que estão sem organização? Os que já têm cliente ficam como estão; só o título que o sistema montou com o número errado é refeito.")) return;
    setMensagem("Conferindo…");
    iniciar(async () => {
      let ligados = 0;
      let jaTinham = 0;
      let titulos = 0;
      const semCliente: string[] = [];
      const falhas: string[] = [];
      let antesDe: number | undefined;
      for (let volta = 0; volta < 40; volta++) {
        const r = await completarClientesPipedrive(antesDe);
        ligados += r.ligados;
        jaTinham += r.jaTinham;
        titulos += r.titulosCorrigidos;
        semCliente.push(...r.semCliente);
        falhas.push(...r.falhas);
        setMensagem(`${ligados} ligado(s), ${jaTinham} já tinham cliente…${r.restam > 0 ? ` faltam ${r.restam}` : ""}`);
        if (!r.ultimo || r.restam === 0) break;
        antesDe = r.ultimo;
      }
      setMensagem(
        `${ligados} negócio(s) ligados ao cliente; ${jaTinham} já tinham; ${titulos} título(s) corrigido(s).` +
          (semCliente.length ? ` Sem cliente achado (${semCliente.length}): ${semCliente.slice(0, 15).join(", ")}.` : "") +
          (falhas.length ? ` ${falhas.length} falha(s): ${falhas[0]}` : "")
      );
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Botao disabled={pendente} onClick={rodar}>
        Completar clientes dos negócios
      </Botao>
      {mensagem && <span className="text-[11px] text-gray-600">{mensagem}</span>}
    </span>
  );
}
