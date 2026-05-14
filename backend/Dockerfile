FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .
COPY src/ ./src/
EXPOSE 5000
CMD ["node", "server.js"]
