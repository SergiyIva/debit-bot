# syntax=docker/dockerfile:1.7

# --- deps: install production dependencies with a cached lockfile ---
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime: copy source and run via bun (no TS build step needed) ---
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

ARG PORT
EXPOSE ${PORT}
USER bun

CMD ["bun", "src/main.ts"]
