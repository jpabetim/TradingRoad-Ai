# TradeRoad - AWS Deployment Guide

Esta aplicación está configurada para desplegarse en AWS usando contenedores Docker. Aquí tienes las opciones de despliegue disponibles:

## 🚀 Opciones de Despliegue en AWS

### 1. AWS ECS (Elastic Container Service) - Recomendado
La forma más sencilla para aplicaciones containerizadas.

### 2. AWS App Runner
Ideal para aplicaciones simples sin necesidad de configuración compleja.

### 3. AWS Elastic Beanstalk
Buena opción si prefieres menos configuración manual.

## 📦 Archivos de Configuración Incluidos

- `Dockerfile` - Imagen de producción optimizada con Nginx
- `Dockerfile.dev` - Imagen para desarrollo con hot reload
- `docker-compose.yml` - Orquestación local (producción y desarrollo)
- `nginx.conf` - Configuración optimizada de Nginx para SPA
- `deploy/` - Plantillas de CloudFormation y configuraciones ECS
- `.dockerignore` - Archivos excluidos del contexto Docker

## 🏗️ Construcción Local

```bash
# Desarrollo
docker-compose --profile dev up

# Producción
docker-compose up

# Solo construcción
docker build -t traderoad-app .
```

## 🌐 Despliegue en AWS ECS

### Prerrequisitos
- AWS CLI configurado
- Docker instalado
- Cuenta de AWS con permisos ECR y ECS

### Pasos de Despliegue

1. **Crear repositorio ECR:**
```bash
aws ecr create-repository --repository-name traderoad-app --region us-east-1
```

2. **Autenticarse en ECR:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

3. **Construir y subir imagen:**
```bash
docker build -t traderoad-app .
docker tag traderoad-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/traderoad-app:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/traderoad-app:latest
```

4. **Desplegar con CloudFormation:**
```bash
cd deploy
aws cloudformation deploy \
  --template-file ecs-service.yaml \
  --stack-name traderoad-app \
  --parameter-overrides ImageUri=<account-id>.dkr.ecr.us-east-1.amazonaws.com/traderoad-app:latest \
  --capabilities CAPABILITY_IAM
```

## 🌍 Despliegue en AWS App Runner

Para una opción más simple:

1. **Crear archivo de configuración:**
   - Se incluye `apprunner.yaml` en el directorio `deploy/`

2. **Desplegar desde la consola de AWS:**
   - Ve a AWS App Runner en la consola
   - Selecciona "Create service"
   - Conecta tu repositorio GitHub/GitLab
   - AWS App Runner detectará automáticamente la configuración

## 🔧 Variables de Entorno

Para configuración específica de AWS, puedes usar:

```bash
# Ejemplo para ECS Task Definition
GEMINI_API_KEY=tu_api_key_aqui
NODE_ENV=production
PORT=80
```

## 📊 Monitoreo y Logs

- Los logs de la aplicación están disponibles en CloudWatch
- Métricas de contenedor disponibles en ECS/App Runner console
- Configuración de alarmas recomendada para CPU y memoria

## 🔐 Consideraciones de Seguridad

- Nginx configurado con headers de seguridad
- HTTPS recomendado (usar ALB con certificado SSL)
- Variables de entorno para API keys
- CORS configurado para dominios específicos

## 💰 Estimación de Costos

**ECS Fargate (t3.micro equivalent):**
- ~$15-25/mes para tráfico bajo-medio

**App Runner:**
- ~$25-40/mes (incluye HTTPS automático)

**Load Balancer (opcional):**
- ~$16/mes adicional

## 🚀 CI/CD Automatizado

Se incluye configuración para GitHub Actions en `.github/workflows/deploy.yml` para automatizar el despliegue.

## 📞 Soporte

Para problemas específicos de despliegue, consulta:
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
