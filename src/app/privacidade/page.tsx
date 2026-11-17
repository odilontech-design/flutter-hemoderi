import type { Metadata } from "next";
import { PaginaPublica } from "@/components/PaginaPublica";
import { CONTATO_DE_PRIVACIDADE, SECOES_DA_POLITICA, VERSAO_DA_POLITICA } from "@/lib/privacidade";

export const metadata: Metadata = { title: "Política de privacidade · Hemoderi" };

/** Pública, sem login: as lojas de aplicativos pedem uma URL aberta. */
export default function Privacidade() {
  return (
    <PaginaPublica titulo="Política de privacidade" subtitulo={`Versão de ${VERSAO_DA_POLITICA}`}>
      {SECOES_DA_POLITICA.map((s) => (
        <section key={s.titulo}>
          <h2 className="font-semibold text-bordo mb-1">{s.titulo}</h2>
          {s.paragrafos?.map((p) => (
            <p key={p} className="mb-2">{p}</p>
          ))}
          {s.itens && (
            <ul className="list-disc pl-5 space-y-1">
              {s.itens.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section>
        <h2 className="font-semibold text-bordo mb-1">Contato</h2>
        <p>
          Dúvidas ou pedidos sobre seus dados: <a className="underline" href={`mailto:${CONTATO_DE_PRIVACIDADE}`}>{CONTATO_DE_PRIVACIDADE}</a>.
        </p>
      </section>
    </PaginaPublica>
  );
}
