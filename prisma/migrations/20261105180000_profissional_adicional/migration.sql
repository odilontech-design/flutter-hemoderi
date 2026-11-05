ALTER TABLE "Pedido" ADD COLUMN "apoioDeId" TEXT;
CREATE INDEX "Pedido_apoioDeId_idx" ON "Pedido"("apoioDeId");
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_apoioDeId_fkey" FOREIGN KEY ("apoioDeId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
