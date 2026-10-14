import { resumoDoEndereco } from "@/lib/endereco";

export type DadosDoResumo = {
  horaInicio: string;
  quantidade: number;
  doutorNome: string | null;
  contatoClinica: string | null;
  procedimentoPaciente: string | null;
  observacoes: string | null;
  clinica: { nome: string };
  servico: { nome: string };
  /** O endereço de fato (o do pedido ou o principal), já resolvido. */
  onde: {
    endereco?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  };
  /** Observações e referências do endereço escolhido (bloco, sala, estacionamento). */
  referencias?: string | null;
};

/**
 * Endereço e resumo do pedido para o profissional (ata de 13/10: "acesso
 * rápido ao resumo do endereço a qualquer momento"). O endereço, com o link
 * do mapa, fica sempre à vista; o resumo do pedido abre num toque. Só é usado
 * depois da janela de revelação do local — antes dela vale o sigilo
 * (lib/sigilo.ts) e o profissional vê apenas a cidade.
 */
export function ResumoDoAtendimento({ dados, aberto = false }: { dados: DadosDoResumo; aberto?: boolean }) {
  const endereco = resumoDoEndereco(dados.onde);
  const busca = encodeURIComponent([dados.clinica.nome, endereco].filter(Boolean).join(", "));
  const linhas: [string, string | null][] = [
    ["Serviço", `${dados.servico.nome}${dados.quantidade > 1 ? ` × ${dados.quantidade}` : ""}`],
    ["Horário", dados.horaInicio],
    ["Doutor(a)", dados.doutorNome],
    ["Contato da clínica", dados.contatoClinica],
    ["Procedimento", dados.procedimentoPaciente],
    ["Observações", dados.observacoes],
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-bege/50 p-3 text-[11px] text-gray-700 space-y-1.5">
      <div>
        <div className="font-semibold text-bordo">{dados.clinica.nome}</div>
        <div>{endereco || "Endereço não informado — fale com a central."}</div>
        {dados.referencias && <div className="text-gray-500">Referências: {dados.referencias}</div>}
        {endereco && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${busca}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bordo hover:underline"
          >
            📍 Abrir no mapa
          </a>
        )}
      </div>
      <details open={aberto} className="group">
        <summary className="cursor-pointer select-none font-semibold text-bordo list-none [&::-webkit-details-marker]:hidden">
          Resumo do pedido <span aria-hidden className="text-[9px] group-open:hidden">▾</span>
          <span aria-hidden className="text-[9px] hidden group-open:inline">▴</span>
        </summary>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {linhas
            .filter(([, valor]) => valor)
            .map(([rotulo, valor]) => (
              <div key={rotulo} className="contents">
                <dt className="text-gray-400">{rotulo}</dt>
                <dd className="whitespace-pre-line">{valor}</dd>
              </div>
            ))}
        </dl>
      </details>
    </div>
  );
}
