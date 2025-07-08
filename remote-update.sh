#!/bin/bash

# Script para enviar y ejecutar scripts de actualización en el servidor
# Este script debe ejecutarse localmente

set -e

echo "🚀 Iniciando proceso de actualización remota de TradingRoad..."

# Configuración
EC2_HOST="ec2-13-40-214-138.eu-west-2.compute.amazonaws.com"
KEY_FILE="traidingguard.pem"  # Asegúrate de que este archivo esté en tu directorio actual
EC2_USER="ubuntu"

# Verificar que la clave existe
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: No se encuentra el archivo de clave $KEY_FILE"
    echo "💡 Asegúrate de que el archivo tradingguard.pem esté en este directorio"
    exit 1
fi

# Establecer permisos correctos para la clave
chmod 400 "$KEY_FILE"

echo "📤 Enviando scripts al servidor..."
scp -i "$KEY_FILE" update-server.sh verify-server.sh $EC2_USER@$EC2_HOST:/tmp/

echo "🔧 Otorgando permisos de ejecución a los scripts..."
ssh -i "$KEY_FILE" $EC2_USER@$EC2_HOST "chmod +x /tmp/update-server.sh /tmp/verify-server.sh"

echo "🔄 Ejecutando script de actualización..."
ssh -i "$KEY_FILE" $EC2_USER@$EC2_HOST "cd /var/www && sudo /tmp/update-server.sh"

echo "🔍 Ejecutando script de verificación..."
ssh -i "$KEY_FILE" $EC2_USER@$EC2_HOST "cd /var/www && sudo /tmp/verify-server.sh"

echo ""
echo "✅ Proceso completado."
echo "🌐 La aplicación debería estar actualizada y funcionando correctamente en:"
echo "   http://$EC2_HOST"
