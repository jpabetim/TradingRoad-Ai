#!/bin/bash

# Script de despliegue automatizado para AWS ECS
# Asegúrate de tener AWS CLI configurado y permisos necesarios

set -e

# Configuración
REGION="us-east-1"
REPOSITORY_NAME="traderoad-app"
CLUSTER_NAME="traderoad-app-cluster"
SERVICE_NAME="traderoad-app-service"
STACK_NAME="traderoad-app"

echo "🚀 Iniciando despliegue de TradeRoad en AWS..."

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

# Actualizar task definition con la nueva imagen
echo "📝 Actualizando task definition..."
sed "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" deploy/task-definition.json > deploy/task-definition-updated.json

# Desplegar con CloudFormation
echo "☁️ Desplegando infraestructura con CloudFormation..."
aws cloudformation deploy \
    --template-file deploy/ecs-service.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        ImageUri=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest \
        ServiceName=$REPOSITORY_NAME \
    --capabilities CAPABILITY_IAM \
    --region $REGION

# Obtener URL del Load Balancer
echo "🌐 Obteniendo URL de la aplicación..."
ALB_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
    --output text)

echo ""
echo "🎉 ¡Despliegue completado exitosamente!"
echo "🌐 URL de la aplicación: $ALB_URL"
echo "📊 Monitoreo: https://console.aws.amazon.com/ecs/home?region=$REGION#/clusters/$CLUSTER_NAME/services"
echo ""
echo "💡 Para actualizar la aplicación, ejecuta este script nuevamente"
echo "💡 Para eliminar todos los recursos: aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"

# Limpiar archivos temporales
rm -f deploy/task-definition-updated.json
