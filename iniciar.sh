#!/bin/sh
# macOS y Linux: sh iniciar.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js 18 o superior: https://nodejs.org (o 'brew install node' en Mac)"
  exit 1
fi
exec node server.js
