#!/bin/bash

# Script de despliegue para EC2 - TradingRoad
# Este script conecta a tu instancia y despliega la aplicación

set -e

echo "🚀 Iniciando despliegue de TradingRoad en EC2..."

# Configuración (ajusta según tu setup)
EC2_HOST="ec2-13-40-214-138.eu-west-2.compute.amazonaws.com"
KEY_FILE="traidingguard.pem"  # Asegúrate de que este archivo esté en tu directorio actual
EC2_USER="ubuntu"

echo "📋 Configuración:"
echo "  Host: $EC2_HOST"
echo "  Usuario: $EC2_USER"
echo "  Clave: $KEY_FILE"

# Verificar que la clave existe
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: No se encuentra el archivo de clave $KEY_FILE"
    echo "💡 Asegúrate de que el archivo tradingguard.pem esté en este directorio"
    exit 1
fi

# Establecer permisos correctos para la clave
chmod 400 "$KEY_FILE"

echo "📦 Clonando repositorio desde GitHub..."
echo "💡 Usaremos el repositorio TradingRoad-Ai directamente desde GitHub"

echo "🔧 Conectando y configurando servidor..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST << 'ENDSSH'
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar Nginx
sudo apt install -y nginx

# Instalar PM2 para gestión de procesos
sudo npm install -g pm2

# Instalar Git
sudo apt install -y git

# Crear directorio para la aplicación
sudo mkdir -p /var/www/traderoad
sudo chown $USER:$USER /var/www/traderoad

# Clonar el repositorio desde GitHub
cd /var/www
git clone https://github.com/jpabetim/TradingRoad-Ai.git traderoad
cd traderoad

# Instalar dependencias y construir
npm install
npm run build

# Configurar Nginx
sudo tee /etc/nginx/sites-available/traderoad << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/traderoad/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        application/javascript
        application/json
        text/css
        text/plain
        text/xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Habilitar sitio
sudo ln -sf /etc/nginx/sites-available/traderoad /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración de Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Configuración completada!"
echo "🌐 Tu aplicación estará disponible en: http://$(curl -s ifconfig.me)"
echo "🌐 O en: http://ec2-13-42-20-93.eu-west-2.compute.amazonaws.com"

ENDSSH

echo ""
echo "🎉 ¡Despliegue completado!"
echo "🌐 Tu aplicación TradingRoad está disponible en:"
echo "   http://$EC2_HOST"
echo ""
echo "📱 Para verificar el estado:"
echo "   ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"
echo ""
echo "🔧 Para ver logs de Nginx:"
echo "   ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'sudo tail -f /var/log/nginx/error.log'"
