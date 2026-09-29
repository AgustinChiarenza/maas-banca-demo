# Guía: PC con Windows

Probado en Windows 11. Funciona también en Windows 10 (versión 21H2 o posterior). Hay dos caminos:

| | Opción A: Docker (llave en mano) | Opción B: Node.js |
|---|---|---|
| Requiere | Docker Desktop (usa WSL 2) | Node.js 18 o superior |
| Permisos de administrador | Sí, para instalar Docker Desktop | Sí, para instalar Node.js |
| Ideal para | Entregar a terceros, workshops | PCs corporativas sin Docker |

## Opción A: Docker (recomendada)

1. Instalá **Docker Desktop para Windows**: <https://www.docker.com/products/docker-desktop/>.
   Si lo pide, dejá marcada la opción **Use WSL 2** y reiniciá.
2. Abrí Docker Desktop y esperá que diga **Engine running**.
3. Bajá `maas-banca-demo-<versión>.zip` desde la sección **Releases** del repositorio,
   clic derecho > **Extraer todo**.
4. En la carpeta extraída, doble clic en **`Iniciar demo (Windows).bat`**.
   - Si aparece "Windows protegió su PC": **Más información > Ejecutar de todas formas**.
5. Se abre el navegador en `http://localhost:8090`. Si ese puerto está ocupado, el script usa
   el siguiente libre (8091, 8092…) y lo indica en la ventana.

Para detenerla: doble clic en **`Detener demo (Windows).bat`**.

### Con clave de acceso

En una consola (`cmd`) dentro de la carpeta:

```bat
set DEMO_PASSWORD=miclave
"Iniciar demo (Windows).bat"
```

Usuario: `demo`.

## Opción B: Node.js, sin Docker

Útil en PCs donde no se puede instalar Docker (políticas corporativas, sin virtualización).

1. Instalá Node.js 18 o superior: <https://nodejs.org> (versión LTS), o con winget:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. Bajá el código (botón **Code > Download ZIP** en GitHub y extraelo, o con git):

   ```powershell
   git clone https://github.com/AgustinChiarenza/maas-banca-demo.git
   cd maas-banca-demo
   ```

3. Doble clic en **`iniciar.bat`**, o desde una consola:

   ```powershell
   node server.js
   ```

   Se abre `http://127.0.0.1:5173`. No hay que instalar dependencias.

### Mostrarla a otras PCs de la red

Por defecto solo escucha en la propia PC. Para que otros entren por la red local:

```powershell
$env:HOST="0.0.0.0"; $env:DEMO_PASSWORD="miclave"; node server.js
```

Windows va a preguntar si permite el acceso de Node.js a la red: aceptá **Redes privadas**.
Los demás entran con `http://<IP-de-esta-PC>:5173` (la IP se ve con `ipconfig`).

## Problemas comunes

| Síntoma | Solución |
|---|---|
| "Docker no está corriendo" | Abrí Docker Desktop y esperá **Engine running**. |
| Docker Desktop no arranca / pide WSL | En PowerShell como administrador: `wsl --install` y reiniciá. |
| "Virtualization support not detected" | Activá la virtualización (VT-x / AMD-V) en la BIOS, o usá la opción B. |
| "El puerto 5173 está ocupado" (opción B) | `$env:PORT=5180; node server.js` |
| `node` no se reconoce | Cerrá y volvé a abrir la consola después de instalar Node.js. |
