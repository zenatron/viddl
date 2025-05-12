# Dockerfile

# ---- Base ----
FROM node:18-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm
RUN pnpm build

# ---- Runner ----
FROM base AS runner

# Switch to root to install system packages
USER root

# Install Python, pip, curl, ffmpeg and other build essentials
RUN apk add --no-cache python3 py3-pip curl ffmpeg build-base python3-dev libffi-dev

# Create a virtual environment for Python dependencies
RUN python3 -m venv /opt/pydepenv

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies into the virtual environment
# Ensure pip in venv is up-to-date first
RUN /opt/pydepenv/bin/python3 -m pip install --upgrade pip && \
    /opt/pydepenv/bin/python3 -m pip install -r requirements.txt

# Add the virtual environment's bin directory to the PATH
ENV PATH="/opt/pydepenv/bin:${PATH}"

# Switch back to the node user for running the app
USER node

WORKDIR /app
ENV NODE_ENV=production
# COPY --from=build /app/public ./public # If you have a public folder
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"] 