# syntax=docker/dockerfile:1.7

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ecommerce_server_node/package.json ecommerce_server_node/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run deploy:build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ecommerce_server_node/package.json ecommerce_server_node/

# Copy node_modules from builder (includes tsx needed to run .ts source)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/ecommerce_server_node/node_modules ./ecommerce_server_node/node_modules

# Copy server source and built widget from builder
COPY --from=builder /app/ecommerce_server_node/src ./ecommerce_server_node/src
COPY --from=builder /app/ecommerce_server_node/tsconfig.json ./ecommerce_server_node/
COPY --from=builder /app/assets ./assets

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "run", "deploy:start"]
