#!/bin/bash

# Script de validación pre-despliegue
# Verifica que todo esté configurado correctamente antes del despliegue

set -e

echo "🔍 Validando configuración para despliegue en AWS..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi
echo "✅ Docker instalado"

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI no está instalado"
    echo "💡 Instala con: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
    exit 1
fi
echo "✅ AWS CLI instalado"

# Verificar configuración de AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI no está configurado"
    echo "💡 Configura con: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS configurado (Cuenta: $ACCOUNT_ID)"

# Verificar archivos necesarios
REQUIRED_FILES=(
    "package.json"
    "index.html"
    "Dockerfile"
    "nginx.conf"
    "deploy/ecs-service.yaml"
    "deploy/task-definition.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Archivo faltante: $file"
        exit 1
    fi
done
echo "✅ Todos los archivos necesarios presentes"

# Verificar que la aplicación compile
echo "🔨 Verificando que la aplicación compile..."
if ! npm run build &> /dev/null; then
    echo "❌ La aplicación no compila correctamente"
    echo "💡 Ejecuta 'npm run build' para ver los errores"
    exit 1
fi
echo "✅ Aplicación compila correctamente"

# Verificar que Docker build funcione
echo "🐳 Verificando construcción de Docker..."
if ! docker build -t traderoad-test . &> /dev/null; then
    echo "❌ Docker build falló"
    echo "💡 Ejecuta 'docker build -t traderoad-test .' para ver los errores"
    exit 1
fi
echo "✅ Docker build exitoso"

# Limpiar imagen de test
docker rmi traderoad-test &> /dev/null || true

# Verificar permisos de ECR
echo "🔐 Verificando permisos de ECR..."
if ! aws ecr describe-repositories --region us-east-1 &> /dev/null; then
    echo "⚠️ No se pueden listar repositorios ECR (puede ser normal si no hay repositorios)"
else
    echo "✅ Permisos de ECR verificados"
fi

# Verificar permisos de ECS
echo "📦 Verificando permisos de ECS..."
if ! aws ecs list-clusters --region us-east-1 &> /dev/null; then
    echo "❌ No tienes permisos para ECS"
    exit 1
fi
echo "✅ Permisos de ECS verificados"

# Verificar permisos de CloudFormation
echo "☁️ Verificando permisos de CloudFormation..."
if ! aws cloudformation list-stacks --region us-east-1 &> /dev/null; then
    echo "❌ No tienes permisos para CloudFormation"
    exit 1
fi
echo "✅ Permisos de CloudFormation verificados"

echo ""
echo "🎉 ¡Validación completada exitosamente!"
echo ""
echo "📋 Opciones de despliegue disponibles:"
echo "1. 🚀 ECS Completo: ./deploy/deploy.sh"
echo "2. ⚡ App Runner: ./deploy/deploy-apprunner.sh"
echo "3. 🔧 Manual: Sigue las instrucciones en AWS_DEPLOYMENT.md"
echo ""
echo "💡 Recomendación: App Runner para aplicaciones simples, ECS para mayor control"
echo "💰 Costos estimados: App Runner ~$30/mes, ECS ~$20/mes"
