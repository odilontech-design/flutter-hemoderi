"use client";

import { SessionProvider } from "next-auth/react";

/** signOut/useSession do menu lateral precisam do provider no cliente. */
export function Provedores({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
