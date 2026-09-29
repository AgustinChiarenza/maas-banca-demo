@echo off
rem Levanta la demo MaaS Banca con Docker (Windows). Doble clic para ejecutar.
rem Opcional: set DEMO_PASSWORD=clave antes de ejecutar para pedir usuario "demo" y esa clave.
setlocal
cd /d "%~dp0"
set IMG=maas-banca-demo:1.0
set NAME=maas-banca-demo
where docker >nul 2>nul || (echo Falta Docker. Instala Docker Desktop: https://www.docker.com/products/docker-desktop/ & goto fin)
docker info >nul 2>nul || (echo Docker no esta corriendo. Abri Docker Desktop, espera "Engine running" y volve a ejecutar. & goto fin)
set FILE=imagen-amd64.tar.gz
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set FILE=imagen-arm64.tar.gz
echo Cargando la imagen (%FILE%)...
docker load -i "%FILE%" >nul || (echo No se pudo cargar %FILE% & goto fin)
docker rm -f %NAME% >nul 2>nul
if "%PORT%"=="" set PORT=8090
set /a LAST=%PORT%+10
:probar
if %PORT% GEQ %LAST% (echo No se pudo iniciar el contenedor: puertos ocupados o error de Docker. & goto fin)
docker run -d --rm --name %NAME% -p %PORT%:8090 -e DEMO_PASSWORD=%DEMO_PASSWORD% -e DEMO_USER=%DEMO_USER% %IMG% >nul 2>nul && goto arranco
docker rm -f %NAME% >nul 2>nul
set /a PORT=%PORT%+1
goto probar
:arranco
echo Iniciando...
for /l %%i in (1,1,30) do (
  curl -fs http://localhost:%PORT%/healthz >nul 2>nul && goto listo
  ping -n 2 127.0.0.1 >nul
)
:listo
echo.
echo   Demo lista en http://localhost:%PORT%
echo   Para detenerla: doble clic en "Detener demo (Windows).bat"
echo.
start "" "http://localhost:%PORT%"
:fin
echo.
pause
