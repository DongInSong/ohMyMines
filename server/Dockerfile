FROM node:20-alpine

WORKDIR /app

# Copy shared package
COPY shared/package.json shared/
COPY shared/dist shared/dist/

# Copy server package
COPY server/package.json server/
WORKDIR /app/server
RUN npm install --production

# Copy server source
COPY server/dist ./dist/

EXPOSE 3001

CMD ["node", "dist/index.js"]
