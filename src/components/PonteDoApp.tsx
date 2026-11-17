"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { guardarToken } from "@/lib/ponte-app";

/**
 * A ponte entre o site e o app (Capacitor). Quando o site roda dentro do app
 * da Hemoderi, pede permissão de notificação, registra o aparelho no sistema e
 * abre a tela certa quando a pessoa toca numa notificação.
 *
 * No navegador comum não faz nada: o pacote do Capacitor é carregado sob
 * demanda e só age em plataforma nativa.
 */
export function PonteDoApp({ app }: { app: "clinica" | "profissional" }) {
  const roteador = useRouter();

  useEffect(() => {
    let encerrado = false;
    const removedores: (() => void)[] = [];

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform() || encerrado) return;
        const plataforma = Capacitor.getPlatform();
        if (plataforma !== "android" && plataforma !== "ios") return;
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const registro = await PushNotifications.addListener("registration", async ({ value }) => {
          guardarToken(value);
          await fetch("/api/app/dispositivo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: value, plataforma, app }),
          }).catch(() => undefined);
        });
        const toque = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const url = (notification.data as { url?: unknown } | undefined)?.url;
          // Só caminhos do próprio sistema: uma notificação não leva a outro site.
          if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) roteador.push(url);
        });
        removedores.push(() => void registro.remove(), () => void toque.remove());

        let permissao = await PushNotifications.checkPermissions();
        if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
          permissao = await PushNotifications.requestPermissions();
        }
        if (permissao.receive === "granted" && !encerrado) await PushNotifications.register();
      } catch (erro) {
        console.error("ponte do app", erro);
      }
    })();

    return () => {
      encerrado = true;
      removedores.forEach((r) => r());
    };
  }, [app, roteador]);

  return null;
}
