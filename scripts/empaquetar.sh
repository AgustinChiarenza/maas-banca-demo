#!/bin/sh
# Arma el entregable llave en mano: dist/maas-banca-demo-<versión>.zip
# Contiene las imágenes Docker (amd64 y arm64), los scripts de inicio, el LEEME y el código fuente.
#   sh scripts/empaquetar.sh
# Requiere Docker con buildx (Docker Desktop lo trae) y Python 3 (para armar el zip con permisos).
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
IMG=maas-banca-demo:1.0   # el tag que esperan los scripts de entregable/
OUT=dist/maas-banca-demo
rm -rf "$OUT" && mkdir -p "$OUT/codigo-fuente"

for ARCH in amd64 arm64; do
  echo "Construyendo imagen $ARCH..."
  docker buildx build -q --platform "linux/$ARCH" -t "$IMG" --load . >/dev/null
  docker save "$IMG" | gzip > "$OUT/imagen-$ARCH.tar.gz"
done
docker buildx build -q -t "$IMG" --load . >/dev/null   # deja la local con la arquitectura de esta máquina

cp entregable/* "$OUT/"
cp -r public server.js package.json Dockerfile .dockerignore .env.example .gitattributes README.md \
      iniciar.sh iniciar.command iniciar.bat docs "$OUT/codigo-fuente/"

ZIP="dist/maas-banca-demo-$VERSION.zip"
rm -f "$ZIP"
PY=
for c in python3 python; do "$c" -c "" >/dev/null 2>&1 && PY=$c && break; done   # en Windows python3 puede ser un atajo vacío
[ -n "$PY" ] || { echo "Falta Python 3"; exit 1; }
"$PY" - "$OUT" "$ZIP" <<'EOF_PY'
import os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(root)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, _, fns in os.walk(root):
        for fn in sorted(fns):
            p = os.path.join(dp, fn)
            zi = zipfile.ZipInfo.from_file(p, os.path.relpath(p, base).replace(os.sep, '/'))
            # .sh y .command ejecutables, para que el doble clic funcione en Mac
            zi.external_attr = (0o100755 if fn.endswith(('.sh', '.command')) else 0o100644) << 16
            zi.compress_type = zipfile.ZIP_STORED if fn.endswith('.gz') else zipfile.ZIP_DEFLATED
            with open(p, 'rb') as f:
                z.writestr(zi, f.read())
EOF_PY
echo "Listo: $ZIP ($(du -h "$ZIP" | cut -f1))"
