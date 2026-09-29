#!/bin/sh
# Levanta la demo MaaS Banca con Docker (macOS o Linux).
#   sh iniciar-mac-linux.sh
# Opcional: DEMO_PASSWORD=clave sh iniciar-mac-linux.sh   (pide usuario "demo" y esa clave)
#           PORT=9000 sh iniciar-mac-linux.sh              (puerto inicial; si está ocupado prueba el siguiente)
cd "$(dirname "$0")" || exit 1
IMG=maas-banca-demo:1.0
NAME=maas-banca-demo

command -v docker >/dev/null 2>&1 || { echo "Falta Docker. Instalá Docker Desktop: https://www.docker.com/products/docker-desktop/"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker no está corriendo. Abrí Docker Desktop, esperá que diga 'Engine running' y volvé a ejecutar."; exit 1; }

case "$(uname -m)" in arm64|aarch64) FILE=imagen-arm64.tar.gz ;; *) FILE=imagen-amd64.tar.gz ;; esac
echo "Cargando la imagen ($FILE)..."
docker load -i "$FILE" >/dev/null || { echo "No se pudo cargar $FILE"; exit 1; }

docker rm -f "$NAME" >/dev/null 2>&1
PORT=${PORT:-8090}
LAST=$((PORT + 10))
while [ "$PORT" -lt "$LAST" ]; do
  if docker run -d --rm --name "$NAME" -p "$PORT:8090" \
       -e DEMO_PASSWORD="${DEMO_PASSWORD:-}" -e DEMO_USER="${DEMO_USER:-demo}" "$IMG" >/dev/null 2>&1; then
    break
  fi
  docker rm -f "$NAME" >/dev/null 2>&1
  PORT=$((PORT + 1))
done
if [ "$PORT" -ge "$LAST" ]; then
  echo "No se pudo iniciar el contenedor. Detalle:"
  docker run --rm -p "${PORT}:8090" "$IMG" 2>&1 | head -5
  exit 1
fi

printf "Iniciando"
i=0
while [ $i -lt 30 ]; do
  curl -fs "http://localhost:$PORT/healthz" >/dev/null 2>&1 && break
  printf "."; sleep 1; i=$((i + 1))
done
URL="http://localhost:$PORT"
echo ""
echo ""
echo "  Demo lista en $URL"
[ -n "$DEMO_PASSWORD" ] && echo "  Usuario: ${DEMO_USER:-demo}"
echo "  Para detenerla: sh detener-mac-linux.sh  (o: docker stop $NAME)"
echo ""
if command -v open >/dev/null 2>&1; then open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
fi
