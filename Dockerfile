# Multi-stage build para optimizar el tamaño de la imagen
FROM node:18-alpine AS builder

# Instalar curl para healthcheck
RUN apk add --no-cache curl

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluye devDependencies para build)
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa de producción
FROM nginx:alpine

# Instalar curl para healthcheck
RUN apk add --no-cache curl

# Copiar archivos de configuración de nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copiar archivos construidos desde la etapa builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar el logo al directorio público si existe
COPY --from=builder /app/logo.png /usr/share/nginx/html/logo.png

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nginx && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Dar permisos apropiados
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Cambiar permisos para que nginx pueda escribir en el directorio PID
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Exponer puerto 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Cambiar a usuario no-root
USER nginx

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
