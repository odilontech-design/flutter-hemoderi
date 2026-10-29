/**
 * Quem pode abrir as Integrações (PipeDrive, WhatsApp, Pix Bradesco): só o
 * administrador técnico do sistema (pedido de 29/10). A tela mexe em
 * credenciais, certificado e filas de sistemas externos, e ser RESPONSÁVEL
 * pela operação não é o mesmo que responder por essas ligações.
 *
 * A lista vem de ACESSO_TECNICO_EMAILS (e-mails separados por vírgula, na
 * Vercel); sem ela, vale o e-mail do desenvolvedor.
 */
const PADRAO = "felipe@dilontech.com.br";

export function emailsDoAdministradorTecnico(env: string | undefined = process.env.ACESSO_TECNICO_EMAILS): string[] {
  const lista = (env ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.length > 0 ? lista : [PADRAO];
}

export function ehAdministradorTecnico(email: string | null | undefined, env?: string): boolean {
  if (!email) return false;
  return emailsDoAdministradorTecnico(env ?? process.env.ACESSO_TECNICO_EMAILS).includes(email.trim().toLowerCase());
}
