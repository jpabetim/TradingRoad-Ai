#!/bin/bash

# Script de despliegue simplificado para AWS App Runner
# Más fácil de usar que ECS, ideal para aplicaciones simples

set -e

# Configuración
REGION="us-east-1"
REPOSITORY_NAME="traderoad-app"
SERVICE_NAME="traderoad-app-runner"

echo "🚀 Iniciando despliegue de TradeRoad en AWS App Runner..."

# Obtener ID de cuenta de AWS
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ Cuenta AWS: $ACCOUNT_ID"

# Crear repositorio ECR si no existe
echo "📦 Verificando repositorio ECR..."
if ! aws ecr describe-repositories --repository-names $REPOSITORY_NAME --region $REGION >/dev/null 2>&1; then
    echo "📦 Creando repositorio ECR..."
    aws ecr create-repository --repository-name $REPOSITORY_NAME --region $REGION
    echo "✅ Repositorio ECR creado"
else
    echo "✅ Repositorio ECR ya existe"
fi

# Autenticarse en ECR
echo "🔐 Autenticando en ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Construir imagen Docker
echo "🔨 Construyendo imagen Docker..."
docker build -t $REPOSITORY_NAME .
docker tag $REPOSITORY_NAME:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest

# Subir imagen a ECR
echo "⬆️ Subiendo imagen a ECR..."
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest

# Crear configuración de App Runner
echo "📝 Creando configuración de App Runner..."
cat > deploy/apprunner-config.json << EOF
{
    "ServiceName": "$SERVICE_NAME",
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest",
            "ImageConfiguration": {
                "Port": "80",
                "RuntimeEnvironmentVariables": {
                    "NODE_ENV": "production"
                }
            },
            "ImageRepositoryType": "ECR"
        },
        "AutoDeploymentsEnabled": false
    },
    "InstanceConfiguration": {
        "Cpu": "0.25 vCPU",
        "Memory": "0.5 GB"
    }
}
EOF

echo ""
echo "🎉 ¡Imagen subida exitosamente!"
echo "🌐 Imagen ECR: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest"
echo ""
echo "📱 Para crear el servicio de App Runner:"
echo "1. Ve a la consola de AWS App Runner: https://console.aws.amazon.com/apprunner/"
echo "2. Haz clic en 'Create service'"
echo "3. Selecciona 'Container registry' -> 'Amazon ECR'"
echo "4. Usa la imagen: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest"
echo "5. Configura:"
echo "   - Port: 80"
echo "   - Environment: NODE_ENV=production"
echo "   - CPU: 0.25 vCPU"
echo "   - Memory: 0.5 GB"
echo ""
echo "⚡ Alternativamente, usa AWS CLI:"
echo "aws apprunner create-service --cli-input-json file://deploy/apprunner-config.json --region $REGION"
echo ""
echo "💡 App Runner incluye HTTPS automático y escalado automático"
echo "💰 Costo estimado: ~\$25-40/mes"
