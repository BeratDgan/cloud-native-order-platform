FROM node:20-alpine

ARG APP_VERSION=v1

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src

ENV APP_VERSION=${APP_VERSION}

USER node
EXPOSE 8080

CMD ["node", "src/index.js"]
