#!/bin/bash

# Script de despliegue con Docker para EC2 - TradingRoad
# Este script usa la configuración Docker que ya tienes preparada

set -e

echo "🐳 Iniciando despliegue de TradingRoad con Docker en EC2..."

# Configuración
EC2_HOST="ec2-13-40-214-138.eu-west-2.compute.amazonaws.com"
KEY_FILE="traidingguard.pem"
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

echo "🐳 Configurando Docker en EC2..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST << 'ENDSSH'

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Instalar Git
sudo apt install -y git

# Clonar el repositorio
cd /home/$USER
if [ -d "TradingRoad-Ai" ]; then
    echo "🔄 Actualizando repositorio existente..."
    cd TradingRoad-Ai
    git pull
else
    echo "📥 Clonando repositorio..."
    git clone https://github.com/jpabetim/TradingRoad-Ai.git
    cd TradingRoad-Ai
fi

# Crear archivo .env de producción
echo "🔧 Configurando variables de entorno..."
cat > .env << 'EOF'
NODE_ENV=production
PORT=80
GEMINI_API_KEY=tu_api_key_aqui
EOF

echo "📝 ¡IMPORTANTE! Necesitas configurar tu GEMINI_API_KEY en el archivo .env"

# Detener contenedores existentes si los hay
echo "🛑 Deteniendo contenedores existentes..."
docker-compose down || true

# Construir y ejecutar con Docker Compose
echo "🏗️ Construyendo y desplegando aplicación..."
docker-compose up -d --build

# Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Mostrar estado
echo ""
echo "✅ Despliegue completado con Docker!"
echo "🐳 Estado de los contenedores:"
docker-compose ps

echo ""
echo "🌐 Tu aplicación estará disponible en:"
echo "   http://$(curl -s ifconfig.me)"
echo "   http://ec2-13-42-20-93.eu-west-2.compute.amazonaws.com"

echo ""
echo "📝 Para configurar tu API key de Gemini:"
echo "   nano .env"
echo "   # Cambia: GEMINI_API_KEY=tu_api_key_aqui"
echo "   docker-compose restart"

ENDSSH

echo ""
echo "🎉 ¡Despliegue con Docker completado!"
echo ""
echo "📌 PASOS FINALES:"
echo "1. 🔐 Conéctate a tu servidor:"
echo "   ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"
echo ""
echo "2. 🔑 Configura tu API key de Gemini:"
echo "   cd TradingRoad-Ai"
echo "   nano .env"
echo "   # Edita la línea: GEMINI_API_KEY=tu_api_key_real"
echo "   docker-compose restart"
echo ""
echo "3. 🌐 Accede a tu aplicación:"
echo "   http://$EC2_HOST"
echo ""
echo "🔧 Comandos útiles una vez conectado:"
echo "   docker-compose ps              # Ver estado"
echo "   docker-compose logs -f         # Ver logs"
echo "   docker-compose restart         # Reiniciar"
echo "   docker-compose down && docker-compose up -d  # Redeploy completo"
