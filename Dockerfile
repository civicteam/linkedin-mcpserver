FROM node:24-alpine@sha256:cd6fb7efa6490f039f3471a189214d5f548c11df1ff9e5b181aa49e22c14383e

# CVE-2026-26960, CVE-2026-24842 (tar), CVE-2026-27904, CVE-2026-26996 (minimatch),
# CVE-2026-25547 (@isaacs/brace-expansion): upgrade npm to get latest security patches
RUN npm install -g npm@11.8.0

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files and build
COPY . .
RUN npm run build

# CVE-2025-69419, CVE-2025-69420, CVE-2026-2673, CVE-2025-15467: upgrade OpenSSL
# --no-cache avoids persisting the apk index in the image; does not affect Docker layer caching
RUN apk upgrade --no-cache

# Create a non-root user
RUN adduser -D mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser

ENV LINKEDIN_CLIENT_ID=""
ENV LINKEDIN_CLIENT_SECRET=""
ENV NODE_ENV=production

# Start the server
CMD ["node", "build/main.js"]
