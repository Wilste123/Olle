FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/mind/package.json apps/mind/

RUN npm ci

COPY packages/protocol packages/protocol
COPY apps/mind apps/mind
COPY tsconfig.base.json ./

RUN npm run build

ENV NODE_ENV=production
ENV OLLE_INBOUND_PORT=8787
EXPOSE 8787

CMD ["npm", "start"]
