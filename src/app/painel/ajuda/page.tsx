import { exigirInterno } from "@/lib/sessao";
import { AJUDA_EQUIPE } from "@/lib/ajuda";
import { PaginaDeAjuda } from "@/components/PaginaDeAjuda";

export default async function AjudaDaEquipe() {
  await exigirInterno();
  return <PaginaDeAjuda titulo="Ajuda — como usar o sistema" topicos={AJUDA_EQUIPE} />;
}
