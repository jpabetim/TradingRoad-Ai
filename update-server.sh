#!/bin/bash

# Script para actualizar TradingRoad en el servidor
# Este script debe ejecutarse en el servidor

set -e

echo "🔄 Iniciando actualización de TradingRoad..."

# Verificar que estamos en el directorio correcto
if [ ! -d "/var/www/traderoad" ]; then
    echo "❌ Error: El directorio /var/www/traderoad no existe"
    exit 1
fi

# Ir al directorio de la aplicación
cd /var/www/traderoad

# Guardar la API key actual antes de actualizar
CURRENT_API_KEY=""
if [ -f ".env" ]; then
    CURRENT_API_KEY=$(grep "VITE_GEMINI_API_KEY" .env | cut -d '=' -f2)
    echo "🔑 API key actual guardada"
fi

# Actualizar desde git
echo "📦 Actualizando código desde git..."
git fetch origin
git reset --hard origin/main

# Restaurar o configurar la API key
echo "🔧 Configurando variables de entorno..."
if [ -n "$CURRENT_API_KEY" ]; then
    # Usar la API key guardada
    echo "VITE_GEMINI_API_KEY=$CURRENT_API_KEY" > .env
    echo "✅ API key restaurada"
else
    # Pedir una nueva API key
    echo "Por favor, ingresa tu clave API de Gemini:"
    read -s GEMINI_API_KEY
    echo "VITE_GEMINI_API_KEY=$GEMINI_API_KEY" > .env
    echo "✅ Nueva API key configurada"
fi

# Instalar dependencias y construir
echo "🔨 Instalando dependencias..."
npm install

echo "🏗️ Construyendo la aplicación..."
npm run build

# Reiniciar Nginx para aplicar cambios
echo "🔄 Reiniciando Nginx..."
sudo systemctl restart nginx

echo ""
echo "✅ ¡Actualización completada!"
echo "🌐 La aplicación TradingRoad está actualizada y disponible."
echo ""
echo "Para verificar posibles errores:"
echo "   sudo tail -f /var/log/nginx/error.log"
