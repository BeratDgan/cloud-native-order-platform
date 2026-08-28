FROM node:24-alpine
RUN apk update && apk upgrade --no-cache


WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src

USER node
EXPOSE 8080

CMD ["node", "src/index.js"]
