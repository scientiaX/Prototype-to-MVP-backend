FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
# Using --prefer-offline to speed up if packages are cached
RUN npm ci --omit=dev --prefer-offline || npm ci --omit=dev

# Copy source code (after npm ci, so dependencies are cached)
COPY src ./src

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
