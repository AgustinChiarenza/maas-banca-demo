# Demo MaaS Banca — Workshop Banco de Córdoba

App web para probar un modelo multimodal (DeepSeek v4.1) servido como **Model as a Service**,
con casos de uso bancarios y una sección que muestra lo simple que es migrar de proveedor.

Endpoint, API key y modelo se configuran desde la propia app: cualquier API compatible con OpenAI sirve.
Un solo servidor Node sin dependencias; corre igual en Windows, macOS, Linux y contenedores.

## Casos

1. **Onboarding DNI**: extrae los datos del DNI y valida edad, vigencia y coincidencia con lo declarado.
2. **Recibo de sueldo**: lee haberes y deducciones (imagen o PDF), controla que cierren y simula el monto prestable.
3. **Antifraude**: analiza capturas de SMS/WhatsApp/mail, da un veredicto y redacta la respuesta al cliente.
4. **Chat libre**: texto, imágenes y PDF para preguntas del público.
5. **Migrar en 3 líneas**: código antes/después (Python, JS, cURL) generado con la configuración actual.

## Guías de instalación

| Dónde | Guía | Resumen |
|---|---|---|
| Mac (Apple Silicon o Intel) | [docs/mac.md](docs/mac.md) | Docker Desktop + doble clic, o Node.js |
| PC con Windows | [docs/windows.md](docs/windows.md) | Docker Desktop + doble clic, o Node.js |
| Huawei Cloud ECS (Linux) | [docs/huawei-cloud-ecs.md](docs/huawei-cloud-ecs.md) | Docker en un ECS x86 o Kunpeng, con clave y HTTPS |

### Inicio rápido

**Llave en mano (Docker):** bajá `maas-banca-demo-<versión>.zip` de [Releases](https://github.com/AgustinChiarenza/maas-banca-demo/releases),
descomprimilo y hacé doble clic en `Iniciar demo (Mac).command` o `Iniciar demo (Windows).bat`.
Se abre `http://localhost:8090`. El zip trae las imágenes Docker para amd64 y arm64, no hace falta construir nada.

**Con Node.js 18+ (sin Docker):**

```bash
git clone https://github.com/AgustinChiarenza/maas-banca-demo.git
cd maas-banca-demo
node server.js
```

Se abre `http://127.0.0.1:5173`. No hay que instalar paquetes.

**Con Docker, desde el código:**

```bash
docker build -t maas-banca-demo:1.0 .
docker run -d --name maas-banca-demo -p 8090:8090 -e DEMO_PASSWORD=miclave maas-banca-demo:1.0
```

## En la app

Abrí **Configuración** y completá:

- **Endpoint**: URL base compatible con OpenAI (la app agrega `/chat/completions`).
- **API key**: se manda como `Authorization: Bearer …`. Queda solo en la pestaña salvo que marques "Recordar".
- **Modelo**: por ejemplo `deepseek-v4.1`.
- **Modo simulado**: respuestas de ejemplo sin llamar al modelo (plan B si falla la red).

## Variables de entorno (opcionales)

| Variable | Para qué |
|---|---|
| `DEMO_PASSWORD`, `DEMO_USER` | Pide usuario y clave para entrar (usuario por defecto: `demo`). Recomendado si la demo queda accesible desde la red. |
| `HOST`, `PORT` | Dónde escucha (local: `127.0.0.1:5173`; contenedor: `0.0.0.0:8090`). |
| `NO_OPEN=1` | No abrir el navegador al iniciar. |

Ver [.env.example](.env.example).

## Generar el zip llave en mano

Requiere Docker con buildx y Python 3:

```bash
sh scripts/empaquetar.sh
```

Construye las imágenes amd64 y arm64 y deja `dist/maas-banca-demo-<versión>.zip` con los lanzadores
de [entregable/](entregable/), las imágenes y el código fuente. La versión sale de `package.json`.
El zip se publica como asset del Release (no se sube al repositorio).

## Estructura

```
server.js            Servidor HTTP + proxy /api/chat hacia el endpoint MaaS (streaming SSE)
public/              Front (HTML, CSS, JS sin build)
public/vendor/       pdf.js incluido, para convertir PDF a imagen sin depender de un CDN
Dockerfile           Imagen node:22-alpine, usuario sin privilegios, health check en /healthz
entregable/          Lanzadores y LEEME del zip llave en mano
scripts/             empaquetar.sh
docs/                Guías por plataforma
iniciar.*            Atajos para correrla con Node (Windows, Mac, Linux)
```

## Notas

- El PDF se convierte a imagen en el navegador (hasta 3 páginas); al modelo le llega siempre una imagen.
- Las imágenes de ejemplo se generan en el navegador con datos ficticios y la leyenda "MUESTRA".
- El servidor nunca registra la API key. Si la demo es accesible desde internet, usá HTTPS
  (la key se escribe en el navegador); ver la guía de Huawei Cloud.
- En contenedores escucha en `0.0.0.0` sin intentar abrir el navegador y responde a SIGTERM
  cerrando las conexiones de forma ordenada.
