FROM node:24-alpine
RUN apk upgrade --no-cache

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm \
              /usr/local/lib/node_modules/corepack \
              /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm \
             /usr/local/bin/npx \
             /usr/local/bin/corepack \
             /usr/local/bin/yarn \
             /usr/local/bin/yarnpkg

COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

ENV PORT=3000

USER node
EXPOSE 3000

CMD ["node", "src/server.js"]
