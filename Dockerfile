### Builder stage — install deps and compile TypeScript
FROM node:24-alpine@sha256:cd6fb7efa6490f039f3471a189214d5f548c11df1ff9e5b181aa49e22c14383e AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Re-install production-only deps so devDependencies (picomatch, eslint, etc.) are excluded
RUN rm -rf node_modules && npm ci --omit=dev

### Production stage — runtime only, no npm/headers/source/devDeps
FROM node:24-alpine@sha256:cd6fb7efa6490f039f3471a189214d5f548c11df1ff9e5b181aa49e22c14383e AS runner

WORKDIR /app

# CVE-2026-26960, CVE-2026-24842 (tar), CVE-2026-27904, CVE-2026-26996, CVE-2026-27903 (minimatch),
# CVE-2026-25547 (@isaacs/brace-expansion): remove npm — not needed at runtime
# CVE-2025-69419, CVE-2025-69420, CVE-2025-69421, CVE-2026-2673, CVE-2025-15467: remove Node.js
# OpenSSL headers — not needed at runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/include

# GHSA-c2c7-rcm5-vvqj (picomatch): upgrade system packages
# --no-cache avoids persisting the apk index in the image
RUN apk upgrade --no-cache

# Copy only production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

# Create a non-root user
RUN adduser -D mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser

ENV LINKEDIN_CLIENT_ID=""
ENV LINKEDIN_CLIENT_SECRET=""
ENV NODE_ENV=production

CMD ["node", "build/main.js"]
