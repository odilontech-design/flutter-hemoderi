import { HistoricoOuAvaliacoes } from "./HistoricoOuAvaliacoes";

export const dynamic = "force-dynamic";

/** Histórico e pagamentos (ata de 03/11): o que aconteceu e o que falta pagar. */
export default async function Historico() {
  return <HistoricoOuAvaliacoes modo="historico" />;
}
