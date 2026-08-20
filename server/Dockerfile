FROM node:24-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
# state lives on the CVM's encrypted disk
ENV STATE_FILE=/data/state.json
VOLUME /data
EXPOSE 8787
CMD ["node", "src/server.ts"]
