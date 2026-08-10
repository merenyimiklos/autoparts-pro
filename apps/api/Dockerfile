FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/api apps/api
FROM base AS dev
EXPOSE 4000
CMD ["npm","run","dev","-w","@autoparts/api"]
FROM base AS build
RUN npm run prisma:generate -w @autoparts/api && npm run build -w @autoparts/api
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/package.json apps/api/package.json
EXPOSE 4000
CMD ["node","apps/api/dist/src/main.js"]
