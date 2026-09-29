# Imagen multi-arquitectura (amd64 y arm64/Kunpeng, también Mac con Apple Silicon).
FROM node:22-alpine

WORKDIR /app
COPY package.json server.js ./
COPY public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8090 \
    NO_OPEN=1

USER node
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "server.js"]
