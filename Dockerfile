FROM node:22-bookworm-slim AS node-runtime
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

FROM python:3.13-slim-bookworm AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
RUN python -m venv .venv && python -m venv .mcp-venv
COPY agent/requirements.txt agent/mcp-requirements.txt /tmp/
RUN .venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt && .mcp-venv/bin/pip install --no-cache-dir -r /tmp/mcp-requirements.txt
COPY --from=web-build /app/.next/standalone ./
COPY --from=web-build /app/.next/static ./.next/static
COPY --from=web-build /app/public ./public
COPY agent ./agent
COPY start-services.sh ./start-services.sh
RUN chmod +x start-services.sh
CMD ["./start-services.sh"]
