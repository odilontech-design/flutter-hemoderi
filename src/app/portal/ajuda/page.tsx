import { exigirClinica } from "@/lib/sessao";
import { AJUDA_CLINICA } from "@/lib/ajuda";
import { PaginaDeAjuda } from "@/components/PaginaDeAjuda";

export default async function AjudaDaClinica() {
  await exigirClinica();
  return <PaginaDeAjuda titulo="Ajuda — como usar o portal" topicos={AJUDA_CLINICA} />;
}
