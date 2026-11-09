# syntax=docker/dockerfile:1

# ---- Build: same Node major as .nvmrc and package.json#engines ----
FROM node:26-alpine AS build
WORKDIR /app

# Install first (cached until the manifests change); `npm ci` is reproducible and respects package-lock.json.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Serve: static files only, no Node at runtime. Unprivileged nginx listens on 8080. ----
FROM nginxinc/nginx-unprivileged:stable-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
