FROM node:22-alpine AS compilador
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS produccion
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=compilador /app/dist ./dist
USER node
CMD ["node", "dist/main"]
