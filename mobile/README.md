# Apps Hemoderi (Android e iOS)

Dois apps, uma casca nativa (Capacitor) em volta do sistema que já está no ar
(`app.hemoderi.com.br`). Regra, tela, cobrança e integração continuam no
servidor: melhoria no sistema chega ao app sem nova publicação nas lojas.

| App | Pasta | Abre em | Identificador (não muda depois de publicar) |
| --- | --- | --- | --- |
| App Clínica | `mobile/clinica` | `/portal` | `br.com.hemoderi.clinica` |
| App Profissional | `mobile/profissional` | `/profissional` | `br.com.hemoderi.profissional` |

A equipe interna continua no navegador.

## O que é do app e o que é do sistema
- **Push**: o app registra o aparelho em `POST /api/app/dispositivo`; o sistema
  envia pelo Firebase (FCM) quando há alocação, confirmação, lembrete etc.
  (`src/lib/push.ts`, ligado ao mesmo ponto que dispara o WhatsApp).
- **Ponte**: `src/components/PonteDoApp.tsx` pede a permissão, registra o
  aparelho e abre a tela certa ao tocar na notificação.
- **Câmera e localização**: o próprio WebView usa os campos de arquivo e o
  `navigator.geolocation` do sistema; o app só declara as permissões.

## Variáveis na Vercel (push)
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — conta
de serviço do projeto Firebase (papel "Firebase Cloud Messaging API Admin").
Sem elas, o sistema funciona e simplesmente não envia push.

## Gerar os projetos nativos
```bash
cd mobile/clinica        # ou mobile/profissional
npm install
npm run preparar         # cap add android (e ios no macOS) + permissões + sync
```
O workflow `.github/workflows/app-android.yml` gera o APK de teste dos dois apps.
Para o iPhone é preciso um macOS (Codemagic ou GitHub Actions macOS) e a conta
Apple Developer da Hemoderi.

## O que falta para publicar
1. Contas Apple Developer e Google Play da Hemoderi (D-U-N-S, 25/11).
2. Projeto no Firebase com os dois apps (`br.com.hemoderi.*`), os arquivos
   `google-services.json` (Android) e `GoogleService-Info.plist` (iOS) e a chave
   APNs cadastrada no Firebase.
3. Ícone, nome e capturas de tela das lojas; política de privacidade em URL;
   exclusão de conta dentro do app; contas de teste para a revisão.
4. Assinatura: keystore Android e certificados/perfis da Apple.
5. Entrada por biometria (próxima etapa).
