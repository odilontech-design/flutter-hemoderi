import "next-auth";
import type { PapelUsuario } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      papel: PapelUsuario;
      clinicaId: string | null;
      clinicaNome: string | null;
      profissionalId: string | null;
      profissionalNome: string | null;
    };
  }
}
