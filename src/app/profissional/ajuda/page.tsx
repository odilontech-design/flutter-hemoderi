import { exigirProfissional } from "@/lib/sessao";
import { AJUDA_PROFISSIONAL } from "@/lib/ajuda";
import { PaginaDeAjuda } from "@/components/PaginaDeAjuda";

export default async function AjudaDoProfissional() {
  await exigirProfissional();
  return <PaginaDeAjuda titulo="Ajuda — como usar o app" topicos={AJUDA_PROFISSIONAL} />;
}
