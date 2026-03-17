FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

# Create a data directory for persistent SQLite database
RUN mkdir -p /usr/src/app/data

EXPOSE 3000

ENV DB_PATH=/usr/src/app/data/database.sqlite
CMD ["npm", "start"]
