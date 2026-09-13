# Etapa de compilación y tareas de inicialización (migraciones y semilla).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Esta etapa conserva las dependencias de desarrollo para ejecutar TypeORM.
FROM build AS runner

# Imagen mínima que ejecuta únicamente la API compilada.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
