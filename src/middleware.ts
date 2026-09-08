export { default } from "next-auth/middleware";

// Os três escopos do contrato, separados por prefixo de caminho. O
// middleware garante apenas que existe sessão; QUAL papel pode entrar em cada
// prefixo é decidido nas guardas de lib/sessao.ts, que também reconferem o
// vínculo no banco.
export const config = {
  matcher: ["/painel/:path*", "/portal/:path*", "/profissional/:path*"],
};
