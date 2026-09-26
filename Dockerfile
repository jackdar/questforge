FROM node:24-alpine AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci
COPY shared shared
COPY client client
COPY assets/maps/*.glb assets/maps/
RUN npm run build -w client

FROM nginx:stable-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/client/dist /usr/share/nginx/html

FROM node:24-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci --omit=dev --workspace server
COPY shared shared
COPY server server
USER node
EXPOSE 3030
CMD ["node", "server/src/index.js"]
