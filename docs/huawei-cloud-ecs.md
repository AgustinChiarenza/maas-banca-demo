# Guía: Huawei Cloud ECS (Linux)

Deja la demo publicada en un Elastic Cloud Server de Huawei Cloud, accesible desde internet,
con clave de acceso y reinicio automático. Tiempo estimado: 20 minutos.

La imagen funciona tanto en ECS **x86** como en **Kunpeng (ARM)**.

## 1. Crear el ECS

En la consola de Huawei Cloud: **Elastic Cloud Server > Buy ECS**.

| Campo | Valor sugerido |
|---|---|
| Billing mode | Pay-per-use (para un workshop) |
| Region | La más cercana a los usuarios (ej. LA-Santiago o LA-Sao Paulo1) |
| Specifications | 1 vCPU / 2 GiB alcanza. General computing (x86) o Kunpeng (ARM). |
| Image | Public image > **Ubuntu 22.04 server 64bit** (o 24.04) |
| System disk | 40 GiB, General Purpose SSD |
| EIP | **Auto assign**, facturado por tráfico, 5 Mbit/s alcanza |
| Login | Key pair (recomendado) o contraseña |

El servidor necesita salida a internet para llamar al endpoint del modelo (la EIP la da).

## 2. Security group

En el security group del ECS, agregá estas **inbound rules**:

| Protocolo / puerto | Origen | Para qué |
|---|---|---|
| TCP 22 | Tu IP pública (`x.x.x.x/32`) | SSH |
| TCP 8090 | La IP de la oficina o del workshop | La demo por HTTP |
| TCP 80 y 443 | `0.0.0.0/0` | Solo si configurás HTTPS (paso 6) |

Evitá abrir el 8090 a `0.0.0.0/0`: la API key se escribe en el navegador y por HTTP viaja sin cifrar.
Para acceso público, usá HTTPS (paso 6).

## 3. Instalar Docker

Conectate por SSH (o desde la consola: **Remote Login**):

```bash
ssh root@<EIP>
```

Instalá Docker (Ubuntu):

```bash
apt-get update && apt-get install -y docker.io unzip
```

```bash
systemctl enable --now docker
```

Verificá:

```bash
docker version
```

## 4. Poner la demo en el servidor

Elegí **una** de las dos formas.

### 4a. Con la imagen del release (no construye nada)

Bajá el zip del release. Si el repositorio es privado, bajalo en tu PC y subilo con
`scp maas-banca-demo-*.zip root@<EIP>:/root/`.

```bash
curl -LO https://github.com/AgustinChiarenza/maas-banca-demo/releases/latest/download/maas-banca-demo-1.0.0.zip
```

```bash
unzip maas-banca-demo-1.0.0.zip && cd maas-banca-demo
```

Cargá la imagen según la arquitectura del ECS (`x86_64` → amd64, `aarch64` → arm64):

```bash
docker load -i imagen-$( [ "$(uname -m)" = aarch64 ] && echo arm64 || echo amd64 ).tar.gz
```

### 4b. Construyendo desde el código

```bash
git clone https://github.com/AgustinChiarenza/maas-banca-demo.git && cd maas-banca-demo
```

```bash
docker build -t maas-banca-demo:1.0 .
```

Si el repositorio es privado, `git clone` pide usuario y un *personal access token* de GitHub
(no la contraseña). Si la descarga de `node:22-alpine` desde Docker Hub falla o es lenta, usá la opción 4a.

## 5. Iniciar

Elegí una clave para entrar a la demo y reemplazá `CAMBIAR_CLAVE`:

```bash
docker run -d --name maas-banca-demo --restart unless-stopped -p 8090:8090 -e DEMO_PASSWORD=CAMBIAR_CLAVE maas-banca-demo:1.0
```

Verificá que responde:

```bash
curl -s http://localhost:8090/healthz
```

Tiene que devolver `{"ok":true}`. Abrí `http://<EIP>:8090` en el navegador: pide usuario `demo`
y la clave que elegiste.

Con `--restart unless-stopped` la demo vuelve a levantarse sola si el ECS se reinicia.

## 6. HTTPS con dominio propio (recomendado si es pública)

Necesitás un dominio o subdominio (ej. `demo.tudominio.com`) con un registro **A** apuntando a la EIP,
y los puertos 80 y 443 abiertos en el security group. Caddy obtiene el certificado de Let's Encrypt
automáticamente:

```bash
docker run -d --name caddy --restart unless-stopped --network host -v caddy_data:/data caddy:2 caddy reverse-proxy --from demo.tudominio.com --to localhost:8090
```

Abrí `https://demo.tudominio.com`. Después podés cerrar el puerto 8090 en el security group.

Si en lugar de Caddy usás un **ELB** de Huawei Cloud delante del ECS: listener HTTPS hacia el puerto 8090,
health check HTTP en `/healthz`, y subí el **idle timeout** del listener a 300 s (las respuestas del modelo
con razonamiento pueden tardar más de 60 s).

## Operación

| Tarea | Comando |
|---|---|
| Ver logs | `docker logs -f maas-banca-demo` |
| Detener | `docker stop maas-banca-demo` |
| Volver a iniciar | `docker start maas-banca-demo` |
| Cambiar la clave | `docker rm -f maas-banca-demo` y repetir el paso 5 |
| Actualizar a una versión nueva | Repetir el paso 4, luego `docker rm -f maas-banca-demo` y el paso 5 |

Al terminar el workshop, si el ECS es pay-per-use, **eliminalo** (y su EIP) para que no siga facturando.
