# Guía: Mac

Funciona en Mac con Apple Silicon (M1–M4) y con Intel. Hay dos caminos:

| | Opción A: Docker (llave en mano) | Opción B: Node.js |
|---|---|---|
| Requiere | Docker Desktop | Node.js 18 o superior |
| Internet para instalar | Solo para bajar el zip | Solo para bajar el código |
| Ideal para | Entregar a terceros, workshops | Desarrollo y cambios |

## Opción A: Docker (recomendada)

1. Instalá **Docker Desktop para Mac**: <https://www.docker.com/products/docker-desktop/>.
   Elegí la versión para tu chip ( > Acerca de esta Mac: "Apple M…" o "Intel").
2. Abrí Docker Desktop y esperá que abajo a la izquierda diga **Engine running**.
3. Bajá `maas-banca-demo-<versión>.zip` desde la sección **Releases** del repositorio
   y hacé doble clic para descomprimirlo.
4. En la carpeta, doble clic en **`Iniciar demo (Mac).command`**.
   - La primera vez macOS dice que no puede verificar el desarrollador:
     **clic derecho > Abrir > Abrir**. Solo hace falta una vez.
   - Si aún así no abre: *Configuración del Sistema > Privacidad y seguridad* > "Abrir igualmente".
5. Se abre el navegador en `http://localhost:8090`. Si ese puerto está ocupado, el script usa
   el siguiente libre (8091, 8092…) y lo indica en la ventana.

Para detenerla: doble clic en **`Detener demo (Mac).command`**.

### Desde la Terminal

```bash
cd ~/Downloads/maas-banca-demo
sh iniciar-mac-linux.sh
```

Con clave de acceso (pide usuario `demo`):

```bash
DEMO_PASSWORD=miclave sh iniciar-mac-linux.sh
```

## Opción B: Node.js, sin Docker

1. Instalá Node.js 18 o superior: <https://nodejs.org> (versión LTS), o con Homebrew:

   ```bash
   brew install node
   ```

2. Bajá el código (botón **Code > Download ZIP** en GitHub, o con git):

   ```bash
   git clone https://github.com/AgustinChiarenza/maas-banca-demo.git
   cd maas-banca-demo
   ```

3. Iniciá:

   ```bash
   sh iniciar.sh
   ```

   Se abre `http://127.0.0.1:5173`. No hay que instalar dependencias (`npm install` no hace falta).
   También podés hacer doble clic en `iniciar.command` (la primera vez: `chmod +x iniciar.command`).

## Problemas comunes

| Síntoma | Solución |
|---|---|
| "Docker no está corriendo" | Abrí Docker Desktop y esperá **Engine running**. |
| El `.command` no abre | Clic derecho > Abrir, o `sh iniciar-mac-linux.sh` desde la Terminal. |
| "El puerto 5173 está ocupado" (opción B) | `PORT=5180 node server.js` |
| Error `exec format error` en Docker | Se cargó la imagen de otra arquitectura. Borrala con `docker rmi maas-banca-demo:1.0` y volvé a iniciar. |
