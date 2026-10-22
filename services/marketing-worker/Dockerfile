FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY dist/marketing-worker.cjs ./worker.cjs
USER node
ENV NODE_ENV=production PORT=8080 FIREBASE_USE_ADC=true
CMD ["node", "--conditions=react-server", "worker.cjs"]
