#!/bin/bash

# Script para verificar la configuración de TradingRoad
# Este script debe ejecutarse en el servidor

set -e

echo "🔍 Verificando configuración de TradingRoad..."

# Verificar que estamos en el directorio correcto
if [ ! -d "/var/www/traderoad" ]; then
    echo "❌ Error: El directorio /var/www/traderoad no existe"
    exit 1
fi

# Ir al directorio de la aplicación
cd /var/www/traderoad

# Verificar configuración de variables de entorno
echo "🔑 Verificando variables de entorno..."
if [ -f ".env" ]; then
    if grep -q "VITE_GEMINI_API_KEY" .env; then
        echo "✅ Variable VITE_GEMINI_API_KEY encontrada"
    else
        echo "❌ Variable VITE_GEMINI_API_KEY no encontrada en .env"
    fi
else
    echo "❌ Archivo .env no encontrado"
fi

# Verificar que el bundle no contiene referencias directas a crypto.randomUUID
echo "🔍 Verificando referencias a crypto.randomUUID en el bundle..."
cd dist
if grep -r "crypto.randomUUID" --include="*.js" .; then
    echo "⚠️ Referencias a crypto.randomUUID encontradas en el bundle"
else
    echo "✅ No se encontraron referencias directas a crypto.randomUUID en el bundle"
fi

# Verificar que la función generateUUID está incluida en el bundle
echo "🔍 Verificando inclusión de generateUUID en el bundle..."
if grep -r "generateUUID" --include="*.js" .; then
    echo "✅ Función generateUUID encontrada en el bundle"
else
    echo "❌ Función generateUUID no encontrada en el bundle"
fi

# Verificar estado de Nginx
echo "🌐 Verificando estado de Nginx..."
if sudo systemctl is-active nginx > /dev/null; then
    echo "✅ Nginx está activo"
else
    echo "❌ Nginx no está activo"
fi

echo ""
echo "✅ Verificación completada."
