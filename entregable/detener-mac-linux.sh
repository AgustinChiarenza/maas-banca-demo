#!/bin/sh
docker stop maas-banca-demo >/dev/null 2>&1 && echo "Demo detenida." || echo "La demo no estaba corriendo."
