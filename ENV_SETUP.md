# Configuración de Variables de Entorno

## Para Desarrollo Local

1. Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Edita el archivo `.env` y agrega tu clave API de Gemini:
```bash
VITE_GEMINI_API_KEY=tu_clave_api_real_aqui
```

3. Obtén tu clave API de Gemini en: https://aistudio.google.com/app/apikey

## Para Despliegue en Producción

### EC2 (Despliegue Manual)
El script `deploy-ec2.sh` te pedirá la clave API durante el despliegue.

### AWS ECS (Despliegue Automático)
Agrega los siguientes secrets en GitHub Actions:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY` 
- `AWS_REGION`
- `VITE_GEMINI_API_KEY`

## Verificación

Una vez configurada correctamente, la aplicación:
- ✅ No mostrará el mensaje de "Clave API No Configurada"
- ✅ Permitirá generar análisis IA
- ✅ Los WebSockets funcionarán correctamente
