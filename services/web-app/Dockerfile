FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

ENV PORT=3000

USER node
EXPOSE 3000

CMD ["node", "src/server.js"]