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

# Android: notificações (Android 13+), biometria, câmera para anexos e localização do "Cheguei".
MANIFESTO="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFESTO" ]; then
  for PERMISSAO in POST_NOTIFICATIONS USE_BIOMETRIC CAMERA ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION; do
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
  definir NSLocationWhenInUseUsageDescription "A localização registra a sua chegada ao atendimento."
  definir NSFaceIDUsageDescription "O Face ID protege o acesso ao app."
fi

npx cap sync
echo "Projetos nativos prontos em mobile/$APP."
