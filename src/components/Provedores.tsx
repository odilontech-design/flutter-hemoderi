"use client";

import { SessionProvider } from "next-auth/react";
import { ProvedorConfirmacao } from "./ConfirmacaoSalvo";

/**
 * signOut/useSession do menu lateral precisam do provider no cliente; o aviso
 * de "salvo por" lê o nome da mesma sessão.
 */
export function Provedores({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProvedorConfirmacao>{children}</ProvedorConfirmacao>
    </SessionProvider>
  );
}
