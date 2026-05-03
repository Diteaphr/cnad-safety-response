# Stage 1: Build the React PWA App
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies statically
RUN npm install

# Copy all source assets
COPY . .

# 空字串：執行時由 nginx 將 /api 轉到後端（見 nginx.conf）。若要改為瀏覽器直連後端再加 ARG。
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend assets using Vite
RUN npm run build


# Stage 2: Serve the application via Nginx
FROM nginx:alpine

# Remove default nginx config to place our own SPA config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled React PWA from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]