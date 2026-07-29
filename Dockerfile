FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3847
ENV DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 3847

CMD ["npx", "tsx", "src/index.ts"]
