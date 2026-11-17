-- Aparelhos que instalaram o app (Clínica ou Profissional) e aceitaram notificações.
CREATE TABLE "DispositivoPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositivoPush_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispositivoPush_token_key" ON "DispositivoPush"("token");
CREATE INDEX "DispositivoPush_usuarioId_idx" ON "DispositivoPush"("usuarioId");

ALTER TABLE "DispositivoPush" ADD CONSTRAINT "DispositivoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
