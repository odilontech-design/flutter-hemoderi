export { default } from "next-auth/middleware";

// Os três escopos do contrato, separados por prefixo de caminho. O
// middleware garante apenas que existe sessão; QUAL papel pode entrar em cada
// prefixo é decidido nas guardas de lib/sessao.ts, que também reconferem o
// vínculo no banco.
//
// /trocar-senha entra aqui porque é a única página fora dos três prefixos que
// exige sessão. Ela não usa as guardas (seria laço de redirect com a senha
// provisória), então o middleware é o que a mantém fora do alcance de quem
// não está autenticado.
export const config = {
  matcher: ["/painel/:path*", "/portal/:path*", "/profissional/:path*", "/trocar-senha"],
};
