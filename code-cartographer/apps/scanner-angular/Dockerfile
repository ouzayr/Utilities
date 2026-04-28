FROM node:20-alpine AS build
WORKDIR /app
COPY apps/scanner-angular/package.json ./
RUN npm install --no-audit --no-fund
COPY apps/scanner-angular/tsconfig.json ./
COPY apps/scanner-angular/src ./src
RUN npx tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY apps/scanner-angular/package.json ./
ENTRYPOINT ["node", "/app/dist/index.js"]
