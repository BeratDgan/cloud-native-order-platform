FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src

USER node
EXPOSE 8080

CMD ["node", "src/index.js"]
