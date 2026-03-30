FROM node:20-alpine AS modules-builder

WORKDIR /workspace/modules

COPY modules/package.json modules/package-lock.json ./
RUN npm ci

COPY modules/ ./
RUN npm run build

FROM heroiclabs/nakama:3.22.0

COPY --from=modules-builder /workspace/modules/build /nakama/data/modules

CMD ["/bin/sh", "-ec", ": \"${DATABASE_ADDRESS:?DATABASE_ADDRESS is required}\"; nakama migrate up --database.address \"$DATABASE_ADDRESS\" && exec nakama --name nakama1 --database.address \"$DATABASE_ADDRESS\" --logger.level INFO"]
