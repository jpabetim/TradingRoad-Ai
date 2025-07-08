# Instrucciones para actualizar el servidor de TradingRoad

Este documento describe los pasos para actualizar y verificar la aplicación TradingRoad en el servidor de producción.

## Requisitos previos

- Archivo `traidingguard.pem` en el directorio local de trabajo
- Acceso SSH al servidor de EC2
- Permisos para ejecutar comandos sudo en el servidor

## Opciones de actualización

### Opción 1: Actualización automatizada (recomendada)

Ejecuta el script local `remote-update.sh` que realizará todo el proceso automáticamente:

```bash
./remote-update.sh
```

Este script:
1. Envía los scripts de actualización al servidor
2. Ejecuta el script de actualización en el servidor
3. Ejecuta el script de verificación para confirmar que todo está correcto

### Opción 2: Actualización manual paso a paso

1. Conectarse al servidor:

```bash
ssh -i traidingguard.pem ubuntu@ec2-13-40-214-138.eu-west-2.compute.amazonaws.com
```

2. Ir al directorio de la aplicación:

```bash
cd /var/www/traderoad
```

3. Guardar la API key actual:

```bash
CURRENT_API_KEY=$(grep "VITE_GEMINI_API_KEY" .env | cut -d '=' -f2)
```

4. Actualizar el código desde git:

```bash
git fetch origin
git reset --hard origin/main
```

5. Restaurar la API key:

```bash
echo "VITE_GEMINI_API_KEY=$CURRENT_API_KEY" > .env
```

6. Reconstruir la aplicación:

```bash
npm install
npm run build
```

7. Reiniciar Nginx:

```bash
sudo systemctl restart nginx
```

## Verificación

Después de la actualización, puedes ejecutar el script `verify-server.sh` para comprobar que todo está correcto:

```bash
sudo /tmp/verify-server.sh
```

Este script verificará:
- La presencia de la API key de Gemini en el archivo .env
- La ausencia de referencias directas a crypto.randomUUID en el bundle
- La presencia de la función generateUUID en el bundle
- El estado de Nginx

## Verificación manual del asistente de IA

1. Abrir la aplicación en un navegador web: http://ec2-13-40-214-138.eu-west-2.compute.amazonaws.com
2. Habilitar el chat IA
3. Enviar un mensaje al asistente y verificar que responda correctamente
4. Comprobar que los niveles de Fibonacci se dibujan correctamente en el gráfico cuando se seleccionan
5. Verificar que no aparece el error "crypto.randomUUID is not a function" en la consola del navegador

## Solución de problemas

Si encuentras algún problema:

1. Verificar los logs de Nginx:
```bash
sudo tail -f /var/log/nginx/error.log
```

2. Verificar que la variable de entorno de la API key esté correctamente configurada:
```bash
cat /var/www/traderoad/.env
```

3. Si sigue habiendo problemas con el asistente IA, comprobar la consola del navegador para obtener más detalles sobre los errores.
