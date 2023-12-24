FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:18-alpine as runner

WORKDIR /app

COPY package*.json ./

RUN npm ci --production

COPY --from=builder /app/dist /app/dist

EXPOSE 8000
CMD ["node", "dist/server.js"]