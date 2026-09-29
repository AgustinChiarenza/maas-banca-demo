@echo off
docker stop maas-banca-demo >nul 2>nul && echo Demo detenida. || echo La demo no estaba corriendo.
ping -n 4 127.0.0.1 >nul
