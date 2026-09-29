#!/bin/sh
# macOS: doble clic en Finder (la primera vez: chmod +x iniciar.command)
cd "$(dirname "$0")" || exit 1
exec sh ./iniciar.sh
