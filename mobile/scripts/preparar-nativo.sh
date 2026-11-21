#!/usr/bin/env bash
# Gera os projetos nativos (Android e, no macOS, iOS) do app informado e aplica
# as permissões que o sistema usa. Os projetos nativos NÃO ficam no repositório:
# são gerados aqui, no CI, a partir da configuração.
#
# Uso (dentro de mobile/<app>): npm install && npm run preparar
set -euo pipefail
APP="${1:?informe clinica ou profissional}"
cd "$(dirname "$0")/../$APP"

[ -d android ] || npx cap add android
if [ "$(uname)" = "Darwin" ]; then
  [ -d ios ] || npx cap add ios
fi

# Android: notificações (Android 13+), biometria e câmera para anexos. A
# localização (o "Cheguei") só no app do profissional: permissão declarada e não
# usada é motivo de recusa nas lojas.
PERMISSOES="POST_NOTIFICATIONS USE_BIOMETRIC CAMERA"
[ "$APP" = "profissional" ] && PERMISSOES="$PERMISSOES ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION"
MANIFESTO="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFESTO" ]; then
  for PERMISSAO in $PERMISSOES; do
    grep -q "android.permission.$PERMISSAO" "$MANIFESTO" || \
      sed -i.bak "s|</manifest>|    <uses-permission android:name=\"android.permission.$PERMISSAO\" />\n</manifest>|" "$MANIFESTO"
  done
  rm -f "$MANIFESTO.bak"
fi

# iOS: textos de permissão (a Apple exige justificativa clara de cada uso).
PLIST="ios/App/App/Info.plist"
if [ -f "$PLIST" ]; then
  definir() { /usr/libexec/PlistBuddy -c "Delete :$1" "$PLIST" 2>/dev/null || true; /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST"; }
  definir NSCameraUsageDescription "A câmera é usada para anexar fotos e documentos ao atendimento."
  definir NSPhotoLibraryUsageDescription "Você escolhe fotos e arquivos para anexar ao atendimento."
  [ "$APP" = "profissional" ] && definir NSLocationWhenInUseUsageDescription "A localização registra a sua chegada ao atendimento."
  definir NSFaceIDUsageDescription "O Face ID protege o acesso ao app."
  # Só HTTPS padrão: dispensa a pergunta de exportação de criptografia a cada envio.
  /usr/libexec/PlistBuddy -c "Delete :ITSAppUsesNonExemptEncryption" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"
fi

# Ícone e abertura (splash) em todos os tamanhos, a partir de mobile/<app>/assets
# (gerados por mobile/scripts/gerar-icones.js a partir do logo do sistema).
if [ -d assets ]; then
  PLATAFORMAS="--android"
  [ -d ios ] && PLATAFORMAS="$PLATAFORMAS --ios"
  npx capacitor-assets generate $PLATAFORMAS --assetPath assets
fi

# Versão da loja: o nome vem do package.json do app; o número (que a loja exige
# sempre maior) vem de NUMERO_DA_VERSAO, que o CI preenche com o número da execução.
VERSAO="$(node -p "require('./package.json').version")"
NUMERO="${NUMERO_DA_VERSAO:-1}"
GRADLE="android/app/build.gradle"
if [ -f "$GRADLE" ]; then
  sed -i.bak -E "s/versionCode [0-9]+/versionCode $NUMERO/; s/versionName \"[^\"]*\"/versionName \"$VERSAO\"/" "$GRADLE"
  rm -f "$GRADLE.bak"
fi

npx cap sync
echo "Projetos nativos prontos em mobile/$APP."
