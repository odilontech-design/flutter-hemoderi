import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App clinica: uma casca nativa que abre o sistema já publicado (o mesmo da web).
 * Toda regra e tela vêm do servidor; o app só acrescenta push, biometria,
 * câmera e localização. Por isso melhoria no sistema chega ao app sem nova
 * publicação nas lojas.
 *
 * O appId NÃO pode mudar depois da publicação nas lojas.
 */
const config: CapacitorConfig = {
  appId: "br.com.hemoderi.clinica",
  appName: "Hemoderi",
  webDir: "www",
  server: {
    url: "https://app.hemoderi.com.br/portal",
    cleartext: false,
    // A página de pagamento do Asaas abre dentro do app.
    allowNavigation: ["app.hemoderi.com.br", "asaas.com", "*.asaas.com"],
  },
  ios: { contentInset: "automatic" },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
