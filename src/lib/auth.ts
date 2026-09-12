import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { clinica: true, profissional: true },
        });
        if (!usuario || usuario.desativadoEm) return null;

        const confere = await bcrypt.compare(credentials.senha, usuario.senhaHash);
        if (!confere) return null;

        // Conta de clínica ou de profissional desativado não entra: o vínculo
        // é o escopo inteiro do usuário, e sem ele não há o que mostrar.
        if (usuario.papel === "CLINICA" && !usuario.clinica?.ativa) return null;
        if (usuario.papel === "PROFISSIONAL" && !usuario.profissional?.ativo) return null;

        // O que sai daqui vira o token. O escopo (clínica ou profissional)
        // SEMPRE vem do usuário autenticado — nunca de query string ou de
        // campo escondido no formulário, senão uma clínica lê os pedidos de
        // outra trocando um id na URL.
        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          clinicaId: usuario.clinicaId,
          clinicaNome: usuario.clinica?.nome ?? null,
          profissionalId: usuario.profissionalId,
          profissionalNome: usuario.profissional?.nome ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.papel = u.papel;
        token.clinicaId = u.clinicaId;
        token.clinicaNome = u.clinicaNome;
        token.profissionalId = u.profissionalId;
        token.profissionalNome = u.profissionalNome;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const s = session.user as any;
        s.id = token.sub;
        s.papel = token.papel;
        s.clinicaId = token.clinicaId ?? null;
        s.clinicaNome = token.clinicaNome ?? null;
        s.profissionalId = token.profissionalId ?? null;
        s.profissionalNome = token.profissionalNome ?? null;
      }
      return session;
    },
  },
};
