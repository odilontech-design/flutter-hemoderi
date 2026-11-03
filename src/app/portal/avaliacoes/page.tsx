import { HistoricoOuAvaliacoes } from "../historico/HistoricoOuAvaliacoes";

export const dynamic = "force-dynamic";

/** Avaliações, separadas do histórico (ata de 03/11). */
export default async function Avaliacoes() {
  return <HistoricoOuAvaliacoes modo="avaliacoes" />;
}
